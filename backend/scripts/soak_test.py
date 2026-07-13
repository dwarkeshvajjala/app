#!/usr/bin/env python3
"""Local substitute for a staging soak test (Milestone 12, docs/tdr/0011 - no real
staging environment exists in this build to soak-test against). Drives sustained,
realistic traffic (guest sessions, page registration, snapshots, comments) against a
real running local stack for a configurable duration, watching the backend process's
memory and the Arq queue backlog for signs of a leak or the workers falling behind.

Usage:
  uv run python scripts/soak_test.py --duration 90 --concurrency 8 \
      --backend-log /path/to/backend.log [--pid <backend_pid>]
"""

import argparse
import asyncio
import random
import re
import subprocess
import time
from pathlib import Path

import httpx
import redis.asyncio as redis

OTP_PATTERN = re.compile(r"<strong>(\d{6})</strong>")


def read_otp_code(log_path: Path, email: str) -> str:
    log = log_path.read_text()
    idx = log.rindex(f"to={email}")
    match = OTP_PATTERN.search(log[idx : idx + 400])
    if not match:
        raise RuntimeError(f"No OTP code found for {email}")
    return match.group(1)


def sample_rss_kb(pid: int) -> int | None:
    try:
        out = subprocess.run(
            ["ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True, check=True
        )
        return int(out.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return None


async def setup_project(client: httpx.AsyncClient, log_path: Path) -> tuple[str, str]:
    """Real member signup -> workspace -> project -> share link, exactly the path a
    real agency takes - returns (share_token, page_url) for the guest traffic below."""
    email = f"soak-{int(time.time())}@example.com"
    await client.post("/api/v1/auth/otp/request", json={"email": email})
    code = read_otp_code(log_path, email)
    verify = await client.post("/api/v1/auth/otp/verify", json={"email": email, "code": code})
    verify.raise_for_status()
    access_token = verify.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    ws = await client.post("/api/v1/workspaces", json={"name": f"Soak {email}"}, headers=headers)
    ws.raise_for_status()
    workspace_id = ws.json()["id"]

    switch = await client.post(
        "/api/v1/auth/switch-workspace", json={"workspace_id": workspace_id}, headers=headers
    )
    switch.raise_for_status()
    headers = {"Authorization": f"Bearer {switch.json()['access_token']}"}

    project = await client.post(
        f"/api/v1/workspaces/{workspace_id}/projects",
        json={"name": "Soak Project", "target_origin": "https://example.com"},
        headers=headers,
    )
    project.raise_for_status()
    project_id = project.json()["id"]

    link = await client.post(
        f"/api/v1/projects/{project_id}/share-links", json={"mode": "snippet"}, headers=headers
    )
    link.raise_for_status()
    return link.json()["token"], "https://example.com/soak-test-page"


async def guest_cycle(client: httpx.AsyncClient, share_token: str, page_url: str) -> list[bool]:
    """One guest reviewer's worth of real traffic: session -> page -> snapshot ->
    comment. Returns per-call success flags.

    A fake, distinct-per-cycle X-Forwarded-For: guest-writable endpoints are
    IP-rate-limited (docs/tdr/0010) at levels meant for one real reviewer, not a soak
    generator hammering from one machine's IP - a real production soak test would see
    many distinct real reviewer IPs. Without this, every cycle competes for the same
    rate-limit bucket and the test would just be re-proving M11's rate limiting exists,
    not exercising the memory/queue-backlog behavior it's actually meant to check."""
    fake_ip = ".".join(str(random.randint(1, 254)) for _ in range(4))
    headers = {"X-Forwarded-For": fake_ip}
    results = []

    guest = await client.post(
        "/api/v1/guest-sessions",
        json={"share_token": share_token, "display_name": "Soak Guest"},
        headers=headers,
    )
    results.append(guest.status_code == 201)
    if guest.status_code != 201:
        return results
    guest_headers = {**headers, "X-Guest-Session": guest.json()["guest_session_token"]}

    resolved = await client.get(f"/api/v1/review/{share_token}", headers=headers)
    results.append(resolved.status_code == 200)
    if resolved.status_code != 200:
        return results
    project_id = resolved.json()["project_id"]

    page = await client.post(
        "/api/v1/pages",
        json={"project_id": project_id, "url": page_url},
        headers=guest_headers,
    )
    results.append(page.status_code == 201)
    if page.status_code != 201:
        return results
    page_id = page.json()["id"]

    snapshot = await client.post(
        f"/api/v1/pages/{page_id}/snapshots",
        json={
            "viewport": {"width": 1440, "height": 900},
            "node_tree": {"node_id": "n1", "tag": "html", "children": []},
            "nodes_index": {"n1": {"tag": "html", "attributes": {}, "text": None}},
            "full_page_hash": f"sha256:soak-{time.time_ns()}",
        },
        headers=guest_headers,
    )
    results.append(snapshot.status_code == 201)

    comment = await client.post(
        f"/api/v1/pages/{page_id}/comments",
        json={
            "body": "Soak test comment",
            "layer": "client",
            "anchor": {
                "tier": 1,
                "dom_fingerprint": {
                    "selector_path": "body",
                    "tag": "body",
                    "attributes": {},
                    "node_hash": "sha256:soak",
                    "ancestor_path_hash": "sha256:soak-pos",
                },
                "text_fingerprint": {"normalized_text": "soak", "text_similarity_hash": "0" * 16},
            },
            "context": {
                "browser": "Chrome",
                "os": "macOS",
                "viewport": {"width": 1440, "height": 900},
                "device_type": "desktop",
                "url": page_url,
            },
            "screenshot_key": None,
            "capture_status": "ok",
        },
        headers=guest_headers,
    )
    results.append(comment.status_code == 201)
    return results


async def queue_backlog(redis_url: str) -> int:
    client: redis.Redis = redis.from_url(redis_url)  # type: ignore[no-untyped-call]
    try:
        return int(await client.zcard("arq:queue"))
    finally:
        await client.aclose()


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--redis-url", default="redis://localhost:6379")
    parser.add_argument("--backend-log", required=True, type=Path)
    parser.add_argument("--duration", type=int, default=90, help="seconds")
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--pid", type=int, default=None, help="backend PID, for RSS sampling")
    args = parser.parse_args()

    async with httpx.AsyncClient(base_url=args.base_url, timeout=15.0) as client:
        print("Setting up a project + share link for guest traffic...")
        share_token, page_url = await setup_project(client, args.backend_log)
        print(f"share_token={share_token}")

        total = 0
        failed = 0
        rss_samples: list[int] = []
        start = time.monotonic()
        last_sample = 0.0

        async def worker() -> None:
            nonlocal total, failed
            while time.monotonic() - start < args.duration:
                results = await guest_cycle(client, share_token, page_url)
                total += len(results)
                failed += sum(1 for ok in results if not ok)

        tasks = [asyncio.create_task(worker()) for _ in range(args.concurrency)]

        while time.monotonic() - start < args.duration:
            await asyncio.sleep(1)
            if args.pid and time.monotonic() - last_sample >= 10:
                rss = sample_rss_kb(args.pid)
                if rss is not None:
                    rss_samples.append(rss)
                    print(f"[{int(time.monotonic() - start)}s] RSS={rss}KB requests={total}")
                last_sample = time.monotonic()

        await asyncio.gather(*tasks)

    backlog = await queue_backlog(args.redis_url)

    print("\n--- Soak test summary ---")
    print(f"Duration: {args.duration}s, concurrency: {args.concurrency}")
    print(f"Total requests: {total}, failed: {failed} ({failed / max(total, 1):.1%})")
    if rss_samples:
        print(
            f"Backend RSS: start={rss_samples[0]}KB end={rss_samples[-1]}KB "
            f"growth={rss_samples[-1] - rss_samples[0]}KB"
        )
    print(f"Arq queue backlog at end: {backlog}")

    if failed > 0:
        print("FAIL: non-zero error rate during soak.")
        return 1
    if backlog > 50:
        print("FAIL: Arq queue backlog did not drain - workers may be falling behind.")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

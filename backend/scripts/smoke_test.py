#!/usr/bin/env python3
"""Post-deploy smoke test (18-Storage-Deployment.md §18.8): "smoke test hits /health and
a read-only API endpoint post-deploy before marking the deploy healthy." Exits non-zero
on any failure - a CI/deploy pipeline step, not a human-read report.

Usage: python scripts/smoke_test.py [base_url]  (defaults to $SMOKE_TEST_BASE_URL, then
http://localhost:8000)
"""

import os
import sys

import httpx

DEFAULT_BASE_URL = "http://localhost:8000"


def main() -> int:
    env_base_url = os.environ.get("SMOKE_TEST_BASE_URL", DEFAULT_BASE_URL)
    base_url = sys.argv[1] if len(sys.argv) > 1 else env_base_url
    print(f"Smoke testing {base_url}")

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        try:
            health = client.get("/health")
        except httpx.HTTPError as exc:
            print(f"FAIL: /health unreachable - {exc}")
            return 1

        if health.status_code != 200:
            print(f"FAIL: /health returned {health.status_code}")
            return 1
        body = health.json()
        if body.get("status") != "ok":
            print(f"FAIL: /health status is not ok - {body}")
            return 1
        if body.get("mongo") != "ok":
            print(f"FAIL: /health reports Mongo unreachable - {body}")
            return 1
        if body.get("redis") != "ok":
            print(f"FAIL: /health reports Redis unreachable - {body}")
            return 1
        print("OK: /health (mongo ok, redis ok)")

        # A read-only endpoint that exercises the full route table, not just the raw
        # process being up - no fixture data exists post-deploy to hit a real domain
        # endpoint (e.g. /review/{token}) with, so FastAPI's own generated schema is the
        # least-arbitrary "the API is genuinely routing requests" check available.
        try:
            openapi = client.get("/openapi.json")
        except httpx.HTTPError as exc:
            print(f"FAIL: /openapi.json unreachable - {exc}")
            return 1
        if openapi.status_code != 200 or "paths" not in openapi.json():
            print(f"FAIL: /openapi.json returned {openapi.status_code}")
            return 1
        print(f"OK: /openapi.json ({len(openapi.json()['paths'])} routes)")

    print("Smoke test passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

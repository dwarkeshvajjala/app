"""Verify Cloudflare R2 credentials actually work, before pasting them into Railway.

Runs the exact operations your app performs: upload a file, generate a signed download
link, fetch it back, then clean up. If this passes, screenshots and comment attachments
will work in the deployed app.

The secret key is typed with hidden input and is never printed or saved anywhere.

Usage:
    uv run python /tmp/r2_check.py
"""

import sys
import uuid
from getpass import getpass

import boto3
import httpx
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError


def ask(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or default


def main() -> int:
    print("=" * 68)
    print("  Cloudflare R2 credential check")
    print("=" * 68)
    print("\nPaste the values you copied from Cloudflare.\n")

    endpoint = ask("R2_ENDPOINT_URL (https://....r2.cloudflarestorage.com)")
    bucket = ask("R2_BUCKET_NAME", "backline-testing")
    access_key = ask("R2_ACCESS_KEY_ID")
    secret_key = getpass("R2_SECRET_ACCESS_KEY (input hidden): ")

    if not all([endpoint, bucket, access_key, secret_key]):
        print("\n❌ All four values are required.")
        return 2

    if not endpoint.startswith("http"):
        endpoint = "https://" + endpoint
    endpoint = endpoint.rstrip("/")

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
        config=BotoConfig(signature_version="s3v4"),
    )

    key = f"_healthcheck/{uuid.uuid4()}.txt"
    payload = b"backline r2 connectivity check"

    try:
        print("\n1/4  Uploading a test file...")
        client.put_object(Bucket=bucket, Key=key, Body=payload, ContentType="text/plain")
        print("     ✅ upload OK  (screenshots & attachments can be saved)")

        print("2/4  Creating a temporary signed link...")
        url = client.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=300
        )
        print("     ✅ signed link created")

        print("3/4  Downloading it back through that link...")
        resp = httpx.get(url, timeout=20)
        if resp.status_code == 200 and resp.content == payload:
            print("     ✅ download OK  (your team will be able to view attachments)")
        else:
            print(f"     ❌ download failed: HTTP {resp.status_code}")
            return 1

        print("4/4  Cleaning up...")
        client.delete_object(Bucket=bucket, Key=key)
        print("     ✅ deleted — nothing left behind")

        print("\n" + "=" * 68)
        print("  ✅ ALL CHECKS PASSED — these R2 values are correct.")
        print("=" * 68)
        print("\nSafe to paste into Railway:")
        print(f"  R2_BUCKET_NAME={bucket}")
        print(f"  R2_ENDPOINT_URL={endpoint}")
        print("  R2_ACCESS_KEY_ID=<the one you entered>")
        print("  R2_SECRET_ACCESS_KEY=<the one you entered>")
        print("  R2_ACCOUNT_ID=<from the R2 overview page>\n")
        return 0

    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "Unknown")
        print(f"\n❌ FAILED — R2 rejected the request (code: {code})\n")
        if code in ("InvalidAccessKeyId", "SignatureDoesNotMatch", "Unauthorized", "403"):
            print("   Most likely: Access Key ID or Secret Access Key is wrong.")
            print("   Fix: Cloudflare → R2 → Manage R2 API Tokens → create a NEW token")
            print("        (an existing secret can never be viewed again).")
        elif code in ("NoSuchBucket", "404"):
            print(f"   Most likely: no bucket named '{bucket}' in this account,")
            print("   or the token wasn't given access to it.")
            print("   Fix: check the bucket name spelling; confirm the token is scoped")
            print("        to that exact bucket.")
        elif code == "AccessDenied":
            print("   Most likely: the token is Read-only.")
            print("   Fix: create a new token with 'Object Read & Write'.")
        else:
            print(f"   Raw error: {exc}")
        return 1

    except httpx.HTTPError as exc:
        print(f"\n❌ NETWORK ERROR reaching R2: {exc}")
        print("   Check the endpoint URL is correct and you're online.")
        return 1

    except Exception as exc:  # noqa: BLE001 - a diagnostic should never itself traceback
        print(f"\n❌ UNEXPECTED ERROR: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

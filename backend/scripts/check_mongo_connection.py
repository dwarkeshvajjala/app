"""Verify a MongoDB connection string works, before deploying with it.

A wrong password or a missing Network Access rule shows up on Railway as a confusing
startup failure much later; this catches it in 30 seconds instead.

Never prints, logs, or stores the password or the assembled connection string - it
prompts with hidden input (getpass), uses the value in memory, and reports only
pass/fail plus non-sensitive server facts.

Usage:
    uv run python scripts/check_mongo_connection.py
    uv run python scripts/check_mongo_connection.py --host other.xxxxx.mongodb.net
    uv run python scripts/check_mongo_connection.py --uri "mongodb://localhost:27017"
"""

import argparse
import sys
import time
from getpass import getpass
from typing import Any
from urllib.parse import quote_plus

from pymongo import MongoClient
from pymongo.errors import (
    ConfigurationError,
    OperationFailure,
    ServerSelectionTimeoutError,
)

DEFAULT_HOST = "backline-prod.adieyyw.mongodb.net"
DEFAULT_USER = "backline_app"
DEFAULT_APP_NAME = "backline-prod"


def build_uri(host: str, user: str) -> str:
    password = getpass(f"Password for Atlas user '{user}' (input hidden): ")
    if not password:
        print("No password entered - aborting.")
        sys.exit(2)
    # quote_plus so a password containing @ / : # still produces a valid URI.
    return (
        f"mongodb+srv://{user}:{quote_plus(password)}@{host}/"
        f"?retryWrites=true&w=majority&appName={DEFAULT_APP_NAME}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Check a MongoDB connection string.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Atlas cluster hostname")
    parser.add_argument("--user", default=DEFAULT_USER, help="Atlas database user")
    parser.add_argument("--uri", help="Full URI (skips the prompt; used for local testing)")
    args = parser.parse_args()

    uri = args.uri or build_uri(args.host, args.user)

    print("\nConnecting (10s timeout)...")
    client: MongoClient[dict[str, Any]] | None = None
    started = time.perf_counter()
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=10_000)
        result = client.admin.command("ping")
        elapsed_ms = (time.perf_counter() - started) * 1000

        info = client.server_info()
        print("\n✅ CONNECTED — your connection string works.\n")
        print(f"   ping response    : {result}")
        print(f"   round trip       : {elapsed_ms:.0f} ms")
        print(f"   server version   : {info.get('version')}")

        # Proves the *credentials* are accepted, not merely that the host is reachable.
        names = client.list_database_names()
        print(f"   databases visible: {len(names)}")
        print("\n   Auth is working. This connection string is safe to use in Railway.")
        return 0

    except OperationFailure as exc:
        print("\n❌ AUTHENTICATION FAILED — reached the cluster, but the login was rejected.\n")
        print(f"   server said: {exc.details.get('errmsg') if exc.details else exc}")
        print("\n   Most likely: wrong password, or the username is different.")
        print("   Fix: Atlas → Database Access → Edit → Edit Password → Autogenerate.")
        return 1

    except ServerSelectionTimeoutError:
        print("\n❌ COULD NOT REACH THE CLUSTER (timed out).\n")
        print("   Most likely: your IP isn't on the Access List, or the cluster is paused.")
        print("   Fix: Atlas → Network Access → confirm 0.0.0.0/0 is 'Active'.")
        return 1

    except ConfigurationError as exc:
        print(f"\n❌ BAD CONNECTION STRING / DNS PROBLEM: {exc}\n")
        print("   Most likely: the cluster hostname is wrong.")
        return 1

    except Exception as exc:  # noqa: BLE001 - a diagnostic should never itself traceback
        print(f"\n❌ UNEXPECTED ERROR: {type(exc).__name__}: {exc}")
        return 1

    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# Starts native Mongo/Redis/MinIO for local dev (no Docker required).
# See docs/tdr/0001-local-toolchain-without-docker.md
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$DIR/start-mongo.sh"
"$DIR/start-redis.sh"
"$DIR/start-minio.sh"

echo "All local services started. Logs: $DIR/logs/  PIDs: $DIR/*.pid"

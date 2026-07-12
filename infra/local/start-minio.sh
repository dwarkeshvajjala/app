#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$DIR/data/minio"
LOG_DIR="$DIR/logs"
PID_FILE="$DIR/minio.pid"

mkdir -p "$DATA_DIR" "$LOG_DIR"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "minio already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

MINIO_ROOT_USER=backline-local MINIO_ROOT_PASSWORD=backline-local-secret \
  minio server "$DATA_DIR" --address ":9000" --console-address ":9001" \
  > "$LOG_DIR/minio.log" 2>&1 &
echo $! > "$PID_FILE"

sleep 0.5
echo "minio started on port 9000 (console :9001, pid $(cat "$PID_FILE"))"
echo "Bucket 'backline-local' is created automatically by the backend's storage module on startup."

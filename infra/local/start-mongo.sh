#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$DIR/data/mongo"
LOG_DIR="$DIR/logs"
PID_FILE="$DIR/mongod.pid"

mkdir -p "$DATA_DIR" "$LOG_DIR"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "mongod already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

mongod --dbpath "$DATA_DIR" --port 27017 --bind_ip 127.0.0.1 \
  --logpath "$LOG_DIR/mongod.log" --fork --pidfilepath "$PID_FILE"

echo "mongod started on port 27017 (pid $(cat "$PID_FILE"))"

#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$DIR/data/redis"
LOG_DIR="$DIR/logs"
PID_FILE="$DIR/redis.pid"

mkdir -p "$DATA_DIR" "$LOG_DIR"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "redis-server already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

redis-server --port 6379 --bind 127.0.0.1 --dir "$DATA_DIR" \
  --logfile "$LOG_DIR/redis.log" --daemonize yes --pidfile "$PID_FILE"

sleep 0.5
echo "redis-server started on port 6379 (pid $(cat "$PID_FILE"))"

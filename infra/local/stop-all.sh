#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for svc in mongod redis minio; do
  PID_FILE="$DIR/$svc.pid"
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "stopped $svc (pid $pid)"
    fi
    rm -f "$PID_FILE"
  fi
done

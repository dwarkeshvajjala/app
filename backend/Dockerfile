# Railway deployment target (18-Storage-Deployment.md §18.6) - backend/frontend run
# natively (not containerized) in local dev for fast reload; this is the only place the
# backend actually runs inside a container.
FROM python:3.12-slim AS base

RUN pip install --no-cache-dir uv==0.11.28

WORKDIR /app

# Dependencies first, so an application-code-only change doesn't invalidate this layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY scripts ./scripts
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# No --reload (that's local-dev only, core/config.py's ENVIRONMENT=production path) and
# no hardcoded worker count - Railway sets $PORT; multiple uvicorn workers would each
# hold their own in-process rate-limit/connection state, which is exactly what
# core/rate_limit.py's Redis-backed sliding window and the realtime WS gateway assume
# a single process *doesn't* need to coordinate - scale via multiple Railway replicas
# behind its own load balancer instead, not multiple workers inside one container.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

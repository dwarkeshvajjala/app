# TDR-0001: Local toolchain without Homebrew/Docker

Date: 2026-07-12
Status: Accepted

## Context

`18-Storage-Deployment.md` §18.4/§18.6 specifies Docker Compose (Mongo, Redis, MinIO) for local dev, and `04-Technology-Decisions.md`/`02-Engineering-Principles.md` assume a toolchain (Node 20, pnpm, Python 3.12) typically provisioned via Homebrew. The actual development machine had no Homebrew installed, no Docker, and no passwordless sudo (the Homebrew install script requires interactive sudo authentication, which isn't available in a non-interactive shell), and shipped with Python 3.9.6.

## Decision

Local dev tooling is provisioned without root/sudo:
- **Node 20 LTS** via `nvm`.
- **pnpm** via Corepack (bundled with Node).
- **Python 3.12** via `uv` (`uv python install 3.12`), and `uv` is also used for backend dependency management instead of a plain `venv`/`pip` workflow.
- **MongoDB**, **Redis**, **MinIO**: native binaries instead of Docker containers. MongoDB and MinIO are downloaded as official pre-built binaries; Redis is built from source (`make`) since no official pre-built macOS binary is distributed. All three run as plain background processes via `infra/local/*.sh` scripts, using the same ports and connection strings (`mongodb://localhost:27017`, `redis://localhost:6379`, MinIO S3 API on `:9000`) that the Docker Compose file would have used.

`docker-compose.yml` is still included in `infra/` for any future contributor whose machine does have Docker - both paths are supported, and the application code has no knowledge of which one is running underneath.

## Consequences

- `18-Storage-Deployment.md` §18.6 is amended to describe both paths (native scripts and Docker Compose) rather than assuming Docker exclusively.
- No change to schemas, API contracts, or production deployment targets (Railway/Vercel/Atlas/R2 per `18-Storage-Deployment.md` §18.4 are unaffected - this TDR is local-dev-only).
- CI (`19-Testing-CI.md` §19.4) continues to use GitHub Actions service containers (which run in Docker on the runner, unaffected by this TDR) for integration tests.

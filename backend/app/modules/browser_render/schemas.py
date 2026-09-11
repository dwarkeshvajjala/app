from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# The four options the dashboard's BrowserMenu ("CAPTURE AS") offers - kept in sync
# with apps/web/src/features/projects/footer/BrowserMenu.tsx's BROWSERS list. "Edge" has
# no distinct rendering engine of its own (Chromium-based since v79) so it maps onto the
# same engine as Chrome; it is kept as its own option because QA teams reasonably track
# it as a separate target even though pixel output is effectively identical to Chrome.
Browser = Literal["Chrome", "Safari", "Firefox", "Edge"]

Orientation = Literal["portrait", "landscape"]

RenderStatus = Literal["queued", "rendering", "ready", "failed"]

# Playwright ships exactly three rendering engines - this is the actual cross-engine
# coverage a self-hosted render service can offer without a third-party device-grid
# contract. "Safari" maps to webkit (the real engine Safari itself is built on, not a
# Chromium-with-a-different-UA approximation); "Edge" maps to chromium (see the Browser
# literal's docstring above for why that's an intentional, not missing, mapping).
#
# Keyed by plain `str`, not the `Browser` literal: the Arq job (app/workers/
# browser_render.py) receives this value back out of a queue message as an untyped
# str, several layers past the Pydantic validation that first constrained it to
# `Browser` in RenderRequest - a `dict[Browser, ...]` there would make `.get()` demand
# a Literal mypy can't actually prove queue-deserialized data satisfies.
ENGINE_BY_BROWSER: dict[str, Literal["chromium", "webkit", "firefox"]] = {
    "Chrome": "chromium",
    "Edge": "chromium",
    "Safari": "webkit",
    "Firefox": "firefox",
}


class ViewportIn(BaseModel):
    width: int = Field(ge=200, le=3840)
    height: int = Field(ge=200, le=3840)


class RenderRequest(BaseModel):
    browser: Browser
    viewport: ViewportIn
    orientation: Orientation = "portrait"
    # A reviewer can click "Refresh render" explicitly (VersionMenu-style pattern) to
    # bypass the cache below even when a recent render already exists - e.g. right after
    # they deployed a fix and want to see the new markup instead of the stale screenshot.
    force: bool = False


class RenderStatusOut(BaseModel):
    status: RenderStatus
    browser: Browser
    viewport: ViewportIn
    orientation: Orientation
    screenshot_url: str | None = None
    rendered_at: datetime | None = None
    # Surfaced to the dashboard rather than a generic 500 - a target site timing out or
    # blocking headless UAs is an expected, actionable outcome, not a bug in this service.
    error: str | None = None

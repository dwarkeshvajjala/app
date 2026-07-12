from urllib.parse import urlsplit, urlunsplit


def normalize_url(raw_url: str) -> str:
    """09-Snapshot-Engine.md doesn't specify the exact normalization algorithm - this
    lowercases scheme/host and strips a trailing slash (except the root path), but keeps
    the query string (stripping it risks colliding distinct pages, e.g. `?page=2`
    pagination) and always drops the fragment (an anchor within the same page, never a
    different page)."""
    parts = urlsplit(raw_url)
    scheme = (parts.scheme or "https").lower()
    netloc = parts.netloc.lower()
    path = parts.path
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    if not path:
        path = "/"
    return urlunsplit((scheme, netloc, path, parts.query, ""))

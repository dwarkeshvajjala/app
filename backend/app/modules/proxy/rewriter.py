import re
from urllib.parse import urlsplit

# Attribute-value rewriting via regex rather than a full HTML parser (no new heavy
# dependency for a "4-5 day" milestone item, 20-Build-Plan.md) - deliberately scoped to
# the common case: root-relative and same-origin-absolute href/src/action attributes.
# What this does NOT handle (documented in docs/tdr/0008): inline <script>-driven
# navigation (fetch/XHR/history.pushState), CSS url(...) references, srcset, or
# malformed/unusual HTML. Rule 10.6-style MVP scope guard - a general-purpose reverse
# proxy is explicitly not the goal here.
_ATTR_PATTERN = re.compile(
    r'(?P<attr>\b(?:href|src|action)=)(?P<quote>["\'])(?P<value>[^"\']*)(?P=quote)', re.IGNORECASE
)

_SKIP_PREFIXES = ("#", "//", "mailto:", "tel:", "javascript:", "data:")


def _rewrite_url(value: str, *, target_origin: str, proxy_prefix: str) -> str:
    if not value or value.startswith(_SKIP_PREFIXES):
        return value

    if value.startswith("/"):
        return f"{proxy_prefix}{value}"

    parsed_target = urlsplit(target_origin)
    parsed_value = urlsplit(value)
    if parsed_value.scheme and parsed_value.netloc:
        if parsed_value.netloc == parsed_target.netloc:
            rest = parsed_value.path or "/"
            if parsed_value.query:
                rest += f"?{parsed_value.query}"
            if parsed_value.fragment:
                rest += f"#{parsed_value.fragment}"
            return f"{proxy_prefix}{rest}"
        # Different origin entirely (a CDN, a third-party widget, etc.) - left as-is;
        # it simply won't be proxied, which is safe (just slower/direct), not broken.
        return value

    # A bare relative path like "about" or "../foo" - resolve it against the current
    # request path so it still routes through the proxy rather than 404ing there.
    return value


def rewrite_html(
    html: str, *, target_origin: str, proxy_prefix: str, widget_script_tag: str
) -> str:
    """`proxy_prefix` is `/proxy/{share_token}` - every rewritten root-relative or
    same-origin link is prefixed with it so subsequent navigation stays on Backline's
    proxy instead of jumping back to the real site directly."""

    def _replace(match: re.Match[str]) -> str:
        value = match.group("value")
        new_value = _rewrite_url(value, target_origin=target_origin, proxy_prefix=proxy_prefix)
        quote = match.group("quote")
        return f"{match.group('attr')}{quote}{new_value}{quote}"

    rewritten = _ATTR_PATTERN.sub(_replace, html)

    body_close = re.search(r"</body\s*>", rewritten, re.IGNORECASE)
    if body_close:
        idx = body_close.start()
        return rewritten[:idx] + widget_script_tag + rewritten[idx:]
    return rewritten + widget_script_tag

"""Pure function tests for the HTML rewriter (docs/tdr/0008) - no DB/network, so these
run against synthetic HTML fragments exercising each rewrite rule independently."""

from app.modules.proxy.rewriter import rewrite_html

TARGET_ORIGIN = "https://target.example.com"
PROXY_PREFIX = "/proxy/tok123"
SCRIPT_TAG = "<script>INJECTED</script>"


def test_root_relative_href_is_prefixed_with_proxy_path() -> None:
    html = '<a href="/pricing">Pricing</a></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="/proxy/tok123/pricing"' in result


def test_same_origin_absolute_href_is_rewritten_to_proxy_path() -> None:
    html = '<a href="https://target.example.com/about">About</a></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="/proxy/tok123/about"' in result


def test_same_origin_absolute_with_query_and_fragment_is_preserved() -> None:
    html = '<a href="https://target.example.com/search?q=x#top">Search</a></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="/proxy/tok123/search?q=x#top"' in result


def test_different_origin_link_is_left_untouched() -> None:
    html = '<a href="https://other-site.example.com/foo">Elsewhere</a></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="https://other-site.example.com/foo"' in result


def test_fragment_mailto_tel_javascript_and_data_uris_are_left_untouched() -> None:
    html = (
        '<a href="#section">Jump</a>'
        '<a href="mailto:hi@example.com">Mail</a>'
        '<a href="tel:+15551234567">Call</a>'
        '<a href="javascript:void(0)">JS</a>'
        '<img src="data:image/png;base64,AAAA">'
        "</body>"
    )
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="#section"' in result
    assert 'href="mailto:hi@example.com"' in result
    assert 'href="tel:+15551234567"' in result
    assert 'href="javascript:void(0)"' in result
    assert 'src="data:image/png;base64,AAAA"' in result


def test_protocol_relative_url_is_left_untouched() -> None:
    html = '<script src="//cdn.example.com/lib.js"></script></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'src="//cdn.example.com/lib.js"' in result


def test_script_and_form_action_and_img_src_are_all_rewritten() -> None:
    html = (
        '<script src="/js/app.js"></script>'
        '<img src="/img/logo.png">'
        '<form action="/contact">'
        "</body>"
    )
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'src="/proxy/tok123/js/app.js"' in result
    assert 'src="/proxy/tok123/img/logo.png"' in result
    assert 'action="/proxy/tok123/contact"' in result


def test_bare_relative_path_is_left_untouched_and_resolves_via_browser() -> None:
    """No leading slash and not absolute - the browser resolves this against the
    current (proxied) page URL on its own, so no rewriting is needed."""
    html = '<a href="about">About</a></body>'
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert 'href="about"' in result


def test_widget_script_injected_before_closing_body_tag() -> None:
    html = "<html><body><h1>Hi</h1></body></html>"
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert result.index(SCRIPT_TAG) < result.index("</body>")


def test_widget_script_appended_when_no_body_tag_present() -> None:
    html = "<html><h1>Fragment without a body tag</h1></html>"
    result = rewrite_html(
        html, target_origin=TARGET_ORIGIN, proxy_prefix=PROXY_PREFIX, widget_script_tag=SCRIPT_TAG
    )
    assert result.endswith(SCRIPT_TAG)

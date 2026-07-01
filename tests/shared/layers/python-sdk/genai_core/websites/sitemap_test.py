import gzip
from genai_core.websites.sitemap import (
    decompress_gzip_data,
    extract_urls_from_sitemap,
)


def test_decompress_gzip_data():
    assert (
        decompress_gzip_data(
            type("obj", (object,), {"url": "url", "content": gzip.compress(b"test")})
        )
    ) == b"test"


def test_extract_urls_returns_list_when_request_fails(mocker):
    # requests.get raising (unreachable host, timeout, etc.) must not collapse
    # the function to None — it should return an (empty) list.
    mocker.patch(
        "genai_core.websites.sitemap.requests.get",
        side_effect=Exception("connection failed"),
    )

    result = extract_urls_from_sitemap("https://example.com/sitemap.xml")

    assert result == []


def test_extract_urls_returns_list_when_child_sitemap_fails(mocker):
    # A sitemapindex whose child fetch raises must still yield a list of the
    # URLs gathered so far, not crash on urls.extend(None) / return None.
    sitemapindex = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        b"<sitemap><loc>https://example.com/child.xml</loc></sitemap>"
        b"</sitemapindex>"
    )

    def fake_get(url, timeout=None):
        if url.endswith("child.xml"):
            raise Exception("child fetch failed")
        return type(
            "Resp", (object,), {"status_code": 200, "content": sitemapindex, "url": url}
        )

    mocker.patch("genai_core.websites.sitemap.requests.get", side_effect=fake_get)

    result = extract_urls_from_sitemap("https://example.com/sitemap.xml")

    assert isinstance(result, list)

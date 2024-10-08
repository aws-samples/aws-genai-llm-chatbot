import gzip
from genai_core.websites.sitemap import decompress_gzip_data


def test_decompress_gzip_data():
    assert (
        decompress_gzip_data(
            type("obj", (object,), {"url": "url", "content": gzip.compress(b"test")})
        )
    ) == b"test"

import requests
import defusedxml.ElementTree as ET


def extract_urls_from_sitemap(sitemap_url: str):
    response = requests.get(sitemap_url, timeout=30)
    sitemap = response.content

    root = ET.fromstring(sitemap)

    urls = [
        elem.text
        for elem in root.findall(
            "{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
        )
    ]

    return urls

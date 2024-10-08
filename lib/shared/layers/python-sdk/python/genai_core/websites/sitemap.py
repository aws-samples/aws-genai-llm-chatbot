import tempfile
import requests
import defusedxml.ElementTree as ET
import gzip
import os


def decompress_gzip_data(response):
    tmpdir = tempfile.gettempdir()
    filename = f"{tmpdir}/{hash(response.url)}.gzip"
    with open(filename, "wb") as file:
        file.write(response.content)
    with gzip.open(filename, "rb") as f:
        sitemap_xml = f.read()
    os.remove(filename)
    return sitemap_xml


def extract_urls_from_sitemap(sitemap_url: str):
    urls = []
    try:
        response = requests.get(sitemap_url, timeout=15)  # seconds
        if response.status_code != 200:
            print(f"Error while fetching sitemap data: {sitemap_url}")
            return []

        # Handle sitemap with gzip compression
        if sitemap_url.lower().endswith("gz"):
            sitemap = decompress_gzip_data(response)
        else:
            sitemap = response.content
        root = ET.fromstring(sitemap)
        root_tag = root.tag.lower()

        # if root element is sitemapindex, fetch individual sitemaps recursively
        if "sitemapindex" in root_tag:
            for elem in root.findall(
                "{http://www.sitemaps.org/schemas/sitemap/0.9}"
                + "sitemap/{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
            ):
                links = extract_urls_from_sitemap(elem.text)
                urls.extend(links)
        elif "urlset" in root_tag:
            for elem in root.findall(
                "{http://www.sitemaps.org/schemas/sitemap/0.9}"
                + "url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
            ):
                urls.append(elem.text)
        else:
            print(f"No valid root tag found for sitemap: {sitemap_url}")
    except Exception as e:
        print(f"Error while processing sitemaps for {sitemap_url}", e)
    else:
        return urls

#!/usr/bin/env python3
"""
scrape_wallpapers.py
Usage: python3 scrape_wallpapers.py
Scrapes image URLs from wallpapercave.com album pages and saves them to images.json
"""

import json
import sys
import time
import requests
from bs4 import BeautifulSoup

# ── Configure your URLs here ──────────────────────────────────────────────────
URLS = [
    "https://wallpapercave.com/front-end-web-development-wallpapers",
    "https://wallpapercave.com/devops-wallpapers",
    "https://wallpapercave.com/cloud-technology-wallpapers",
    "https://wallpapercave.com/llm-large-language-model-wallpapers",
    "https://wallpapercave.com/product-design-wallpapers",
    "https://wallpapercave.com/database-wallpapers",
]

IMAGE_PREFIX = "https://wallpapercave.com/dwp2x/"
OUTPUT_FILE  = "images.json"
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0 Safari/537.36"
    )
}


def scrape_page(url: str, session: requests.Session) -> list:
    """Return a list of full image URLs found on one album page."""
    try:
        response = session.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"[ERROR] Could not fetch {url}: {exc}", file=sys.stderr)
        return []

    soup = BeautifulSoup(response.text, "html.parser")

    print("checker")
    # Selector: .albumwp .wallpaper > a > img[src]
    # images = soup.select(".albumwp .wallpaper a picture img")
    images = soup.select("#albumwp .wallpaper .wpinkw picture img")
    print(f"[OK] {url}  ->  {len(images)} image(s) found")

    results = []
    for img in images:
        src = img.get("src", "").strip()
        if not src:
            continue
        # Strip any existing path prefix, keep only the filename
        filename = src.split("/")[-1]
        full_url = IMAGE_PREFIX + filename
        results.append(full_url)

    print(f"[OK] {url}  ->  {len(results)} image(s) found")
    return results


def main():
    session = requests.Session()
    all_images = []

    print("URLS", URLS)
    for i, url in enumerate(URLS):
        images = scrape_page(url, session)
        all_images.extend(images)
        # Be polite between requests
        if i < len(URLS) - 1:
            time.sleep(1)

    # Deduplicate while preserving order
    seen = set()
    unique_images = []
    for url in all_images:
        if url not in seen:
            seen.add(url)
            unique_images.append(url)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(unique_images, f, indent=2)

    print(f"\nDone. {len(unique_images)} unique image URL(s) saved to '{OUTPUT_FILE}'")


if __name__ == "__main__":
    main()
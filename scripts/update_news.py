"""Fetch public CNA politics RSS metadata. Never fetch article bodies or execute feed content."""
import argparse
import hashlib
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

FEED = 'https://feeds.feedburner.com/rsscna/politics'
CITIES = {
 'taipei': ['臺北', '台北', '蔣萬安', '沈伯洋'],
 'new-taipei': ['新北', '李四川', '蘇巧慧'],
 'taoyuan': ['桃園', '張善政', '黃世杰'],
 'taichung': ['臺中', '台中', '江啟臣', '何欣純'],
 'tainan': ['臺南', '台南', '謝龍介', '陳亭妃'],
 'kaohsiung': ['高雄', '柯志恩', '賴瑞隆'],
}
PEOPLE = {name: city for city, names in CITIES.items() for name in names[-2:]}

def parse_feed(data, now):
    if len(data) > 2_000_000 or b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('Unsafe or oversized RSS')
    root = ET.fromstring(data)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Expected RSS channel')
    items = {}
    for node in root.findall('./channel/item'):
        title = re.sub(r'<[^>]*>', '', node.findtext('title', '')).strip()[:180]
        link = urlsplit(node.findtext('link', '').strip())
        if link.scheme != 'https' or link.netloc.lower() != 'www.cna.com.tw' or not link.path.startswith('/news/'):
            continue
        url = urlunsplit((link.scheme, link.netloc, link.path, '', ''))
        try:
            date = parsedate_to_datetime(node.findtext('pubDate', ''))
            if date.tzinfo is None:
                continue
            published = date.astimezone(timezone.utc)
        except (ValueError, TypeError, OverflowError):
            continue
        if not title or published > now + timedelta(minutes=5) or published < now - timedelta(days=7):
            continue
        # 避免新北標題僅因「台北」一般字樣而跨市誤綁；姓名是額外映射，非實體解析斷言。
        cities = [city for city, words in CITIES.items() if any(w in title for w in words)]
        if not cities:
            continue
        key = hashlib.sha256(url.encode()).hexdigest()[:16]
        item = {'id': key, 'title': title, 'url': url, 'publisher': '中央社',
                      'publishedAt': published.isoformat().replace('+00:00', 'Z'),
                      'districtIds': cities, 'personNames': [n for n in PEOPLE if n in title]}
        previous = items.get(key)
        if previous is None or (item['publishedAt'], item['title']) > (previous['publishedAt'], previous['title']):
            items[key] = item
    return sorted(items.values(), key=lambda i: (i['publishedAt'], i['id']), reverse=True)[:60]

def update(previous, data, now):
    stamp = now.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    try:
        items = parse_feed(data, now)
        # 空回應屬合法更新，不將舊新聞假裝成最新。
        signature = hashlib.sha256(json.dumps(items, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        return {'version': signature, 'sourceUrl': FEED, 'refreshMinutes': 60, 'lastAttemptAt': stamp,
                'lastSuccessAt': stamp, 'status': 'ok' if items else 'empty', 'items': items}
    except Exception:
        return {**previous, 'lastAttemptAt': stamp, 'status': 'stale'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='public/news.json')
    args = parser.parse_args()
    target = Path(args.output)
    fallback = {'version': 'empty', 'sourceUrl': FEED, 'refreshMinutes': 60, 'lastAttemptAt': None,
                'lastSuccessAt': None, 'status': 'stale', 'items': []}
    try:
        previous = json.loads(target.read_text())
    except (OSError, ValueError):
        previous = fallback
    now = datetime.now(timezone.utc)
    try:
        request = urllib.request.Request(FEED, headers={'User-Agent': 'CampaignSimulator/0.5 (+RSS metadata only)'})
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read(2_000_001)
    except Exception:
        data = b''
    result = update(previous, data, now)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    os.replace(temporary, target)
    print(json.dumps({'status': result['status'], 'items': len(result['items']), 'version': result['version']}))
    return 1 if result['status'] == 'stale' else 0

if __name__ == '__main__':
    raise SystemExit(main())

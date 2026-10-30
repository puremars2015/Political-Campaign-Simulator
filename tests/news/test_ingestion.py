import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
spec = importlib.util.spec_from_file_location('update_news', Path(__file__).parents[2] / 'scripts/update_news.py')
news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(news)

def feed(title='新北蘇巧慧提出公共建設說明', date='Fri, 30 Oct 2026 08:00:00 +0800'):
    return f'<rss><channel><item><title>{title}</title><link>https://www.cna.com.tw/news/aipl/202610300001.aspx?utm=test</link><pubDate>{date}</pubDate></item></channel></rss>'.encode()

class IngestionTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026,10,30,3,tzinfo=timezone.utc)
        self.previous = {'version':'old','items':[], 'lastSuccessAt':'2026-10-29T00:00:00Z'}
    def test_timezone_mapping_and_no_body(self):
        result = news.update(self.previous, feed(), self.now)
        item = result['items'][0]
        self.assertEqual(item['publishedAt'],'2026-10-30T00:00:00Z')
        self.assertEqual(item['districtIds'],['new-taipei'])
        self.assertEqual(item['personNames'],['蘇巧慧'])
        self.assertNotIn('?',item['url'])
        self.assertNotIn('body',item)
    def test_duplicate_and_idempotency(self):
        original = feed()
        duplicate = original.replace(b'</channel>', original.split(b'<channel>')[1].split(b'</channel>')[0] + b'</channel>')
        a = news.update(self.previous,original,self.now)
        b = news.update(a,duplicate,self.now)
        self.assertEqual(a['version'],b['version'])
        self.assertEqual(len(b['items']),1)
    def test_different_days_and_failures(self):
        a = news.update(self.previous,feed(),self.now)
        b = news.update(a,feed('新北李四川說明市政規劃','Sat, 31 Oct 2026 08:00:00 +0800'),datetime(2026,10,31,3,tzinfo=timezone.utc))
        self.assertNotEqual(a['version'],b['version'])
        stale = news.update(a,b'bad xml',self.now)
        self.assertEqual(stale['status'],'stale')
        self.assertEqual(stale['items'],a['items'])
        self.assertEqual(stale['lastSuccessAt'],a['lastSuccessAt'])
    def test_empty_unsafe_old_and_future(self):
        for payload in [b'<rss><channel/></rss>', feed(date='Fri, 30 Oct 2026 08:00:00'),feed(date='Fri, 30 Oct 2027 08:00:00 +0800'),feed(date='Fri, 10 Oct 2026 08:00:00 +0800')]:
            self.assertEqual(news.update(self.previous,payload,self.now)['status'],'empty')
        self.assertEqual(news.update(self.previous,b'<!DOCTYPE rss><rss/>',self.now)['status'],'stale')

    def test_conflicting_duplicates_order_independent_and_unsafe_authority(self):
        a=feed('新北蘇巧慧公開說明')
        b=feed('新北蘇巧慧新版說明','Fri, 30 Oct 2026 09:00:00 +0800')
        item_a=a.split(b'<channel>')[1].split(b'</channel>')[0]
        item_b=b.split(b'<channel>')[1].split(b'</channel>')[0]
        ab=b'<rss><channel>'+item_a+item_b+b'</channel></rss>'
        ba=b'<rss><channel>'+item_b+item_a+b'</channel></rss>'
        self.assertEqual(news.update(self.previous,ab,self.now)['version'],news.update(self.previous,ba,self.now)['version'])
        unsafe=a.replace(b'www.cna.com.tw/news/',b'www.cna.com.tw:4444/news/')
        self.assertEqual(news.parse_feed(unsafe,self.now),[])

"""Package the existing Vite build as a double-clickable, offline trial."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
output = root / 'deliverables'
output.mkdir(exist_ok=True)
html = (dist / 'index.html').read_text()
for path in (dist / 'assets').iterdir():
    if path.suffix == '.js':
        script = path.read_text().replace('</script', '<\\/script')
        html = re.sub(r'<script type="module"[^>]*src="[^"]+"[^>]*></script>', lambda _: '<script type="module">' + script + '</script>', html)
    elif path.suffix == '.css':
        css = path.read_text()
        html = re.sub(r'<link rel="stylesheet"[^>]*>', lambda _: '<style>' + css + '</style>', html)
news = json.loads((root / 'public/news.json').read_text())
news_json = json.dumps(news, ensure_ascii=False).replace('<', '\\u003c')
html = html.replace('</head>', '<script id="campaign-news-snapshot" type="application/json">' + news_json + '</script></head>')
if re.search(r'<(?:script|link)[^>]+(?:src|href)="/assets/', html):
    raise RuntimeError('External build asset was not inlined')
target = output / 'Political-Campaign-Simulator-Trial.html'
target.write_text(html)
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'newsVersion':news['version']}))

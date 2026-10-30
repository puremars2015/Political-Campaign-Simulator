// Local/self-hosted runtime: static app + periodically refreshed RSS metadata.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve('dist');
const port = Number(process.env.PORT ?? 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
let running = false;
function updateNews() {
  if (running) return;
  running = true;
  const child = spawn('python3', ['scripts/update_news.py'], { stdio: 'inherit' });
  child.on('error', () => { running = false; });
  child.on('exit', () => { running = false; });
}
if (process.env.NEWS_UPDATES === '1') {
  updateNews();
  setInterval(updateNews, 60 * 60 * 1000).unref();
}
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = pathname === '/news.json' ? resolve('public/news.json') : resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (pathname !== '/news.json' && !file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Local preview http://127.0.0.1:${port}; RSS polling ${process.env.NEWS_UPDATES === '1' ? 'enabled' : 'disabled'}`));

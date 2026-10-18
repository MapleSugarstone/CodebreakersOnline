// Static file server for the project folder, used to view assets and run browser checks.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 8123);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.css': 'text/css', '.sb3': 'application/zip' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, s) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    if (s.isDirectory()) {
      const list = fs.readdirSync(file).map(n => `<a href="${path.posix.join(url, n)}">${n}</a>`).join('<br>');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(list);
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));

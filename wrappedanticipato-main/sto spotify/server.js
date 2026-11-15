// Semplice server statico per lo sviluppo locale
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };

http.createServer((req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(5500, () => console.log('Server su http://127.0.0.1:5500'));

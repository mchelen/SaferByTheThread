#!/usr/bin/env node
/* Serves the repository root for local work and the browser tests, exactly like GitHub Pages does:
   files as they are, and 404.html (with a 404 status) for any path without a file, so the clean
   URLs (/c/balls, /p/<id>) go through the same hand-off as on the live site.
   Usage: node tools/serve.js [port]  (default 8000; 0 picks a free port). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown' };

function serve(port, cb) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    let status = 200;
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      status = 404;
      f = path.join(root, '404.html'); // a clean URL: 404.html hands it to the app, as on Pages
    }
    res.writeHead(status, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => cb && cb(server));
  return server;
}

module.exports = { serve };

if (require.main === module) {
  const port = parseInt(process.argv[2] || '8000', 10);
  serve(port, (s) => console.log('Serving ' + root + ' at http://127.0.0.1:' + s.address().port + '/'));
}

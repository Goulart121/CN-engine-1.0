const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3600;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function resolvePath(requestUrl) {
  const url = new URL(requestUrl, `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return resolvedPath;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, message: 'Invalid request URL' });
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, status: 'running' });
    return;
  }

  const filePath = resolvePath(req.url);

  if (!filePath) {
    sendJson(res, 403, { ok: false, message: 'Forbidden path' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    if (stats.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
      return;
    }

    sendFile(res, filePath);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`CN Engine Web running at http://${HOST}:${PORT}`);
});


#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

let PORT = parseInt(process.env.PORT || '8080', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
};

function createServer() {
  const server = http.createServer((req, res) => {
    // Enable cross-origin isolation required for Stockfish WebAssembly & SharedArrayBuffer
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Handle /api/config
    if (req.url === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      let apiKey = '';
      try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const match = content.match(/MISTRAL_API_KEY=(.+)/);
          if (match) apiKey = match[1].trim();
        }
      } catch {}
      res.end(JSON.stringify({ MISTRAL_API_KEY: apiKey }));
      return;
    }

    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    const safePath = path.normalize(decodeURIComponent(reqPath)).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\x1b[33mPort ${PORT} in use, trying port ${PORT + 1}...\x1b[0m`);
      PORT++;
      server.listen(PORT, '127.0.0.1');
    } else {
      console.error(err);
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\x1b[32m✔ Chess Coach dev server ready in 15ms:\x1b[0m \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[90m  WASM/COOP/COEP streaming enabled · Node/pnpm dev server\x1b[0m`);
  });
}

createServer();

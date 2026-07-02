const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'db.json');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Data-Mode': 'file'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      return send(res, 204, '');
    }

    if (url.pathname === '/api/data' && req.method === 'GET') {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return send(res, 200, data);
    }

    if (url.pathname === '/api/data' && req.method === 'POST') {
      const body = await readBody(req);
      const parsed = JSON.parse(body);
      parsed.updatedAt = new Date().toISOString();
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
      return send(res, 200, JSON.stringify({ ok: true, updatedAt: parsed.updatedAt }));
    }

    let filePath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    filePath = path.normalize(filePath).replace(/^([/\\])+/, '');
    const absolute = path.join(ROOT, filePath);

    if (!absolute.startsWith(ROOT)) {
      return send(res, 403, 'Acesso negado', 'text/plain; charset=utf-8');
    }

    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
      return send(res, 404, 'Arquivo não encontrado', 'text/plain; charset=utf-8');
    }

    const ext = path.extname(absolute).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(absolute).pipe(res);
  } catch (error) {
    send(res, 500, JSON.stringify({ ok: false, error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Observatório de Eventos rodando em http://localhost:${PORT}`);
  console.log(`Persistência ativa em ${DB_PATH}`);
});

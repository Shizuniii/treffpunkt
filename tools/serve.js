/* Kleiner lokaler Webserver – nur zum Ausprobieren und für die UI-Tests.
   Aufruf:  npm start            → http://localhost:8000  (Demo-Modus, solange config.js Platzhalter hat)
            npm start -- 3000    → anderer Port
   Warum nötig? Die App besteht aus JavaScript-Modulen; die lädt der Browser nicht per Doppelklick (file://). */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

/** Startet den Server. Gibt { url, close } zurück. Port 0 = irgendein freier Port. */
export function serve(port = 8000, root = ROOT) {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory()) {
        res.writeHead(301, { Location: path + '/' }).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${server.address().port}/`;
      ok({ url, close: () => new Promise(r => server.close(r)) });
    });
  });
}

// Direkt gestartet (npm start)? Dann Server laufen lassen.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await serve(+process.argv[2] || 8000);
  console.log(`Treffpunkt läuft auf ${url}\nTests im Browser: ${url}tests/\nBeenden mit Strg+C`);
}

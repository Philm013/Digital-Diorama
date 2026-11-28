/**
 * Dev-server side of the animal workbench (workbench.html).
 *
 * Vite plugin, active only under `vite` / `npm run dev` (never in a build). It lets the
 * workbench page read and write the source of the asset modules it is editing, and keeps the
 * page live while it does:
 *
 *   GET  /__wb/file?path=src/assets/...   → the file's text
 *   PUT  /__wb/file?path=...  (body)      → writes it (only under src/assets/)
 *   GET  /__wb/head?path=...              → the file as committed (git HEAD), for reverting
 *   GET  /__wb/diff?path=a,b              → `git diff HEAD` of those files
 *   PUT  /__wb/shot?name=...  (PNG body)  → saves a capture to shots/workbench/<name>.png
 *
 * Only requests from this machine may write (PUT): the dev server listens on the network
 * (`server.host: true`) and this middleware runs before Vite's own host checks, so a write must come
 * from a loopback address with a local Host header (and Origin, if sent). That also stops DNS-rebinding
 * pages; a cross-site page can't write either, since its PUT needs a CORS preflight that gets no CORS
 * headers here. Other devices on the network can still view the workbench.
 *
 * A save from the workbench to a module the page can hot-swap (a *.mjs asset module or a
 * built-in model in src/assets/models/builtin) skips Vite's usual full reload: the page gets a
 * `wb:file` message instead, re-imports the module and rebuilds only the model on screen.
 * Edits made anywhere else (your editor) reload the page as usual; it restores its state.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const WRITABLE = [/^src\/assets\/.+\.(mjs|ts|json)$/];
const READABLE = [...WRITABLE, /^src\/.+\.(ts|tsx|json|css)$/, /^public\/species\/media\.json$/];
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
/** a request from this machine, addressed to it by a local name */
function fromThisMachine(req: import('node:http').IncomingMessage) {
  const ra = req.socket.remoteAddress ?? '';
  const loopback = ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
  const origin = req.headers.origin;
  return loopback && LOCAL_HOST.test(req.headers.host ?? '') && (!origin || LOCAL_ORIGIN.test(origin));
}
/** modules the page re-imports in place (everything else needs a page reload) */
export const HOT_SWAPPABLE = /^src\/assets\/models\/(.+\.mjs|builtin\/[^/]+\.ts)$/;

function git(root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 }, (err, out, errOut) => (err && !out ? reject(new Error(errOut || String(err))) : resolve(out)));
  });
}

function readBody(req: import('node:http').IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function workbenchPlugin(): Plugin {
  let root = process.cwd();
  let server: ViteDevServer | null = null;
  /** repo-relative path → time the workbench last wrote it */
  const ownWrites = new Map<string, number>();

  const safe = (rel: string | null, allow: RegExp[]) => {
    if (!rel) return null;
    const norm = path.posix.normalize(rel.replace(/\\/g, '/')).replace(/^\/+/, '');
    if (norm.startsWith('..') || !allow.some((re) => re.test(norm))) return null;
    return norm;
  };

  return {
    name: 'digital-diorama-workbench',
    apply: 'serve',
    configResolved(cfg) { root = cfg.root; },
    configureServer(srv) {
      server = srv;
      srv.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__wb/')) return next();
        const url = new URL(req.url, 'http://x');
        const send = (code: number, body: string, type = 'text/plain; charset=utf-8') => { res.statusCode = code; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store'); res.end(body); };
        if (req.method !== 'GET' && req.method !== 'HEAD' && !fromThisMachine(req)) return send(403, 'the workbench saves files only for requests from this machine (open it at localhost)');
        try {
          if (url.pathname === '/__wb/file') {
            const rel = safe(url.searchParams.get('path'), req.method === 'PUT' ? WRITABLE : READABLE);
            if (!rel) return send(403, 'path not allowed');
            const abs = path.join(root, rel);
            if (req.method === 'PUT') {
              const text = (await readBody(req)).toString('utf8');
              ownWrites.set(rel, Date.now());
              await fs.writeFile(abs, text, 'utf8');
              return send(200, JSON.stringify({ ok: true, path: rel, bytes: text.length, hot: HOT_SWAPPABLE.test(rel) }), 'application/json');
            }
            return send(200, await fs.readFile(abs, 'utf8'));
          }
          if (url.pathname === '/__wb/head') {
            const rel = safe(url.searchParams.get('path'), READABLE);
            if (!rel) return send(403, 'path not allowed');
            return send(200, await git(root, ['show', `HEAD:${rel}`]));
          }
          if (url.pathname === '/__wb/diff') {
            const rels = (url.searchParams.get('path') ?? '').split(',').map((p) => safe(p, READABLE)).filter((p): p is string => !!p);
            if (!rels.length) return send(200, '');
            return send(200, await git(root, ['diff', '--no-color', '--stat', '--patch', 'HEAD', '--', ...rels]));
          }
          if (url.pathname === '/__wb/shot' && req.method === 'PUT') {
            const name = (url.searchParams.get('name') ?? 'shot').replace(/[^\w.-]+/g, '_').slice(0, 80);
            const dir = path.join(root, 'shots', 'workbench');
            await fs.mkdir(dir, { recursive: true });
            let buf = await readBody(req);
            const head = buf.subarray(0, 32).toString('latin1');
            if (head.startsWith('data:image/png;base64,')) buf = Buffer.from(buf.toString('latin1').slice(22), 'base64');
            const file = path.join(dir, name.endsWith('.png') ? name : `${name}.png`);
            await fs.writeFile(file, buf);
            return send(200, JSON.stringify({ ok: true, file: path.relative(root, file) }), 'application/json');
          }
          return send(404, 'unknown workbench endpoint');
        } catch (e) {
          return send(500, String((e as Error)?.message ?? e));
        }
      });
    },
    handleHotUpdate(ctx) {
      const rel = path.relative(root, ctx.file).split(path.sep).join('/');
      if (!WRITABLE.some((re) => re.test(rel))) return;
      const own = Date.now() - (ownWrites.get(rel) ?? 0) < 4000;
      server?.ws.send({ type: 'custom', event: 'wb:file', data: { path: rel, own, hot: HOT_SWAPPABLE.test(rel) } });
      // our own save of a hot-swappable module: the workbench re-imports it, no reload needed
      if (own && HOT_SWAPPABLE.test(rel)) return [];
      return undefined;
    },
  };
}

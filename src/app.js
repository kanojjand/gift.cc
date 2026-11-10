import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { HTTPException } from 'hono/http-exception';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { securityHeaders } from './security.js';
import { errorPage, notFoundPage } from './views/pages.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
/** Картинки и стили шаблонов из папки дизайнера, отдаются по адресу /static/design/. */
const DESIGN_DIR = fileURLToPath(new URL('../raiko/assets', import.meta.url));
const STATIC_CACHE = 'public, max-age=86400';

/**
 * @param {{ config: object, repo: object, storage: object, now: () => number }} deps
 */
export function createApp(deps) {
  const app = new Hono();

  app.use('*', securityHeaders);
  app.use('*', compress());
  app.use('/static/*', async (c, next) => {
    await next();
    if (c.res.ok) c.header('Cache-Control', STATIC_CACHE);
  });
  app.use(
    '/static/design/*',
    serveStatic({
      root: relative(process.cwd(), DESIGN_DIR) || '.',
      rewriteRequestPath: (path) => path.replace(/^\/static\/design/, ''),
    }),
  );
  app.use(
    '/static/*',
    serveStatic({
      root: relative(process.cwd(), PUBLIC_DIR) || '.',
      rewriteRequestPath: (path) => path.replace(/^\/static/, ''),
    }),
  );
  app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));
  app.get('/favicon.ico', (c) => c.body(null, 204));
  app.route('/admin', adminRoutes(deps));
  app.route('/', publicRoutes(deps));

  app.notFound((c) => c.html(notFoundPage().value, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(`[error] ${c.req.method} ${c.req.path}`, error);
    return c.html(errorPage().value, 500);
  });
  return app;
}

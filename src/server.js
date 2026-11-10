import { serve } from '@hono/node-server';
import { bootApp, runSweep } from './bootstrap.js';
import { loadConfig } from './config.js';

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

const config = loadConfig();
const { app, repo, storage } = bootApp(config);
setInterval(() => runSweep({ repo, storage }), SWEEP_INTERVAL_MS).unref();

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.info(`Сервер запущен: http://localhost:${port}  (домен в QR: ${config.baseUrl})`);
});

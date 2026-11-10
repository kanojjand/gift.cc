import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { compressSong } from './audio.js';
import { loadConfig } from './config.js';
import { createRepo, openDb } from './db.js';
import { createStorage } from './storage.js';
import { sweep } from './sweep.js';

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

function runSweep(deps) {
  try {
    sweep({ ...deps, now: Date.now() });
  } catch (error) {
    console.error('[sweep] не удалось очистить открытки', error);
  }
}

const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true });
const repo = createRepo(openDb(join(config.dataDir, 'flowers.db')));
const storage = createStorage(config.dataDir);

runSweep({ repo, storage });
setInterval(() => runSweep({ repo, storage }), SWEEP_INTERVAL_MS).unref();

serve({ fetch: createApp({ config, repo, storage, now: Date.now, compressSong }).fetch, port: config.port }, ({ port }) => {
  console.info(`Сервер запущен: http://localhost:${port}  (домен в QR: ${config.baseUrl})`);
});

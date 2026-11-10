import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app.js';
import { compressSong } from './audio.js';
import { createRepo, openDb } from './db.js';
import { createStorage } from './storage.js';
import { sweep } from './sweep.js';

/** Чистит просроченные открытки; ошибка очистки не должна ронять сайт. */
export function runSweep(deps) {
  try {
    sweep({ ...deps, now: Date.now() });
  } catch (error) {
    console.error('[sweep] не удалось очистить открытки', error);
  }
}

/**
 * Открывает базу и папку с файлами и собирает приложение.
 * @param {ReturnType<import('./config.js').loadConfig>} config
 */
export function bootApp(config) {
  mkdirSync(config.dataDir, { recursive: true });
  const repo = createRepo(openDb(join(config.dataDir, 'flowers.db')));
  const storage = createStorage(config.dataDir);
  runSweep({ repo, storage });
  const app = createApp({ config, repo, storage, now: Date.now, compressSong });
  return { app, repo, storage };
}

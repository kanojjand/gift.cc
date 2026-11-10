import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createRepo, openDb } from '../src/db.js';
import { createStorage } from '../src/storage.js';
import { getTemplate } from '../src/tiers.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'test-password';
export const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

export function makeContext(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'flowers-'));
  const db = openDb(':memory:');
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const config = loadConfig({
    ADMIN_PASSWORD: PASSWORD,
    SESSION_SECRET: 'x'.repeat(40),
    PUBLIC_BASE_URL: ORIGIN,
    DATA_DIR: dir,
  });
  const repo = createRepo(db);
  const storage = createStorage(dir);
  const clock = { now: Date.UTC(2026, 10, 9) };
  const app = createApp({ config, repo, storage, now: () => clock.now, compressSong: async () => false, ...overrides });
  return { app, repo, storage, clock, config };
}

export function issueCard(repo, templateId = 'envelope', code = 'abcdefghjkmn') {
  repo.createBatch({ tier: getTemplate(templateId).tier, label: 'test', codes: [code], now: 1 });
  return code;
}

export function greetingForm(overrides = {}, photos = []) {
  const form = new FormData();
  const fields = { templateId: 'envelope', sender: 'Данияр', recipient: 'Айгерим', message: 'С праздником!', ...overrides };
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const photo of photos) form.append('photos', new File([photo], 'p.jpg', { type: 'image/jpeg' }));
  return form;
}

export function postForm(app, path, form) {
  return app.request(path, { method: 'POST', body: form });
}

export async function loginCookie(app) {
  const res = await app.request('/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
    body: new URLSearchParams({ password: PASSWORD }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

export function adminPost(app, path, cookie, fields) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN, cookie },
    body: new URLSearchParams(fields),
  });
}

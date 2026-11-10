import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_DIRS = [
  fileURLToPath(new URL('../../public', import.meta.url)),
  fileURLToPath(new URL('../../raiko/assets', import.meta.url)),
];
const VERSION_LENGTH = 10;

function computeVersion() {
  const hash = createHash('sha256');
  STATIC_DIRS.flatMap((dir) => readdirSync(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
    .forEach((path) => hash.update(readFileSync(path)));
  return hash.digest('hex').slice(0, VERSION_LENGTH);
}

const VERSION = computeVersion();

/** Адрес статического файла с версией: Cloudflare и браузеры кэшируют файлы, и без неё новое оформление приходит с опозданием. */
export function asset(path) {
  return `/static/${path}?v=${VERSION}`;
}

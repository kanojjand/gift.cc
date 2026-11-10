import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const DESIGN_DIR = STATIC_DIRS[1];
const inlineCache = new Map();

/**
 * Текст файла из raiko/assets для вставки прямо в страницу (стили открытки). Так первый экран рисуется
 * сразу после HTML, без лишнего запроса. Файл перечитывается, только если его поменяли.
 */
export function designFileText(path) {
  const full = join(DESIGN_DIR, path);
  const { mtimeMs } = statSync(full);
  const cached = inlineCache.get(full);
  if (cached?.mtimeMs === mtimeMs) return cached.text;
  const text = readFileSync(full, 'utf8');
  inlineCache.set(full, { mtimeMs, text });
  return text;
}

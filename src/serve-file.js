import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Math.min(Number(match[2]), size);
    return suffix > 0 ? { start: size - suffix, end: size - 1 } : null;
  }
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : null;
}

function statOrNull(path) {
  try {
    return statSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function streamResponse(path, status, headers, range) {
  const stream = createReadStream(path, range);
  return new Response(Readable.toWeb(stream), { status, headers });
}

/** Отдаёт файл с поддержкой Range: без неё Safari на iPhone не проигрывает аудио. */
export function serveFile(c, path, mime, cacheControl) {
  const stat = statOrNull(path);
  if (!stat) return c.notFound();
  const size = stat.size;
  const headers = { 'content-type': mime, 'accept-ranges': 'bytes', 'cache-control': cacheControl };
  const rangeHeader = c.req.header('range');
  if (!rangeHeader) return streamResponse(path, 200, { ...headers, 'content-length': String(size) });

  const range = parseRange(rangeHeader, size);
  if (!range) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  return streamResponse(
    path,
    206,
    {
      ...headers,
      'content-length': String(range.end - range.start + 1),
      'content-range': `bytes ${range.start}-${range.end}/${size}`,
    },
    range,
  );
}

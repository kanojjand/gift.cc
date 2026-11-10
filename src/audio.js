import { execFile } from 'node:child_process';
import { rmSync, statSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const MAX_SECONDS = 90;
const FADE_SECONDS = 2;
const BITRATE = '96k';
const TIMEOUT_MS = 60 * 1000;
const LOUDNESS_FILTER = 'loudnorm=I=-16:TP=-1.5:LRA=11';

async function probeSeconds(input) {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input], {
    timeout: TIMEOUT_MS,
  });
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Не удалось определить длину файла');
  return seconds;
}

/** Плавное затухание нужно только обрезанным трекам: короткие петли должны повторяться без провала. */
function audioFilters(seconds) {
  if (seconds <= MAX_SECONDS) return LOUDNESS_FILTER;
  return `${LOUDNESS_FILTER},afade=t=out:st=${MAX_SECONDS - FADE_SECONDS}:d=${FADE_SECONDS}`;
}

/**
 * Обрезает песню до 90 секунд, выравнивает громкость и сжимает в AAC.
 * @param {string} input
 * @param {string} output
 * @returns {Promise<boolean>} true, если готов файл меньше исходного
 */
export async function compressSong(input, output) {
  try {
    const seconds = await probeSeconds(input);
    await run(
      FFMPEG,
      ['-nostdin', '-y', '-protocol_whitelist', 'file', '-i', input, '-vn', '-map_metadata', '-1', '-t', String(MAX_SECONDS),
        '-af', audioFilters(seconds), '-c:a', 'aac', '-b:a', BITRATE, '-ar', '44100', '-movflags', '+faststart', output],
      { timeout: TIMEOUT_MS },
    );
    if (statSync(output).size < statSync(input).size) return true;
    rmSync(output, { force: true });
    return false;
  } catch (error) {
    rmSync(output, { force: true });
    console.error(error.code === 'ENOENT' ? '[audio] ffmpeg не найден, песня сохранена без сжатия' : '[audio] не удалось сжать песню', error.code === 'ENOENT' ? '' : error);
    return false;
  }
}

import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function removeQuietly(path) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 2 });
  } catch (error) {
    console.error(`[storage] не удалось удалить ${path}`, error);
  }
}

export function createStorage(root) {
  const photosRoot = join(root, 'photos');
  const songsRoot = join(root, 'songs');
  mkdirSync(photosRoot, { recursive: true });
  mkdirSync(songsRoot, { recursive: true });

  const photoDir = (code) => join(photosRoot, code);

  return {
    photoPath: (code, name) => join(photoDir(code), name),
    /** Мелодии, загруженные до того, как раздел «Музыка» убрали: их ещё играют старые открытки. */
    songPath: (name) => join(songsRoot, name),

    savePhoto(code, buffer) {
      mkdirSync(photoDir(code), { recursive: true });
      const name = `${randomBytes(8).toString('hex')}.jpg`;
      writeFileSync(join(photoDir(code), name), buffer);
      return name;
    },

    /** Удаляет фото открытки, кроме перечисленных в keep. */
    prunePhotos(code, keep) {
      let names;
      try {
        names = readdirSync(photoDir(code));
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      names.filter((name) => !keep.includes(name)).forEach((name) => removeQuietly(join(photoDir(code), name)));
    },

    /** Если файл занят, sweep удалит его при следующем проходе. */
    removePhotos(code) {
      removeQuietly(photoDir(code));
    },

    listPhotoCodes() {
      return readdirSync(photosRoot);
    },
  };
}

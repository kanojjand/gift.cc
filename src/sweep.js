import { LIFETIME } from './config.js';

const STATUSES_WITH_PHOTOS = new Set(['draft', 'active']);

/** Снимает просроченные открытки, освобождает брошенные черновики и удаляет фото, которым некому принадлежать. */
export function sweep({ repo, storage, now }) {
  const expired = repo.expireDue(now);
  const abandoned = repo.resetAbandonedDrafts(now - LIFETIME.abandonedDraftMs, now);
  storage
    .listPhotoCodes()
    .filter((code) => !STATUSES_WITH_PHOTOS.has(repo.getCard(code)?.status))
    .forEach((code) => storage.removePhotos(code));
  return { expired: expired.length, abandoned: abandoned.length };
}

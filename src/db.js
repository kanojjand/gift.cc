import { DatabaseSync } from 'node:sqlite';
import { DAY_MS } from './config.js';
import { DEFAULT_LIFETIME_DAYS } from './lifetime.js';

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA secure_delete = ON;
  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cards (
    code TEXT PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(id),
    template_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new', 'draft', 'active', 'expired', 'blocked')),
    sender TEXT,
    recipient TEXT,
    message TEXT,
    song_id INTEGER,
    photos TEXT NOT NULL DEFAULT '[]',
    activated_at INTEGER,
    expires_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cards_batch ON cards(batch_id);
  CREATE INDEX IF NOT EXISTS idx_cards_status_expires ON cards(status, expires_at);
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT NOT NULL,
    slot INTEGER NOT NULL,
    title TEXT NOT NULL,
    file TEXT NOT NULL,
    mime TEXT NOT NULL,
    UNIQUE (template_id, slot)
  );
`;

const LEGACY_PREMIUM_TEMPLATES = `'gold', 'garden', 'cinema', 'silk', 'ornament'`;
const WIPE_CONTENT = `sender = NULL, recipient = NULL, message = NULL, song_id = NULL, music_link = NULL, photos = '[]'`;

export function openDb(path) {
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  addOpenTracking(db);
  addTiers(db);
  addPalette(db);
  addMusicLink(db);
  addLifetime(db);
  return db;
}

const columnsOf = (db, table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));

/** Цветовая палитра, которую покупатель выбрал в шаблоне. У старых открыток её нет: NULL. */
function addPalette(db) {
  if (!columnsOf(db, 'cards').has('palette')) db.exec('ALTER TABLE cards ADD COLUMN palette TEXT');
}

/** Ссылка на песню в YouTube, Spotify, Apple Music или Яндекс Музыке, которую покупатель вставил сам. */
function addMusicLink(db) {
  if (!columnsOf(db, 'cards').has('music_link')) db.exec('ALTER TABLE cards ADD COLUMN music_link TEXT');
}

/** Срок хранения открыток партии в днях; NULL — навсегда. Старые партии остаются на прежних 7 днях. */
function addLifetime(db) {
  if (!columnsOf(db, 'batches').has('lifetime_days')) {
    db.exec(`ALTER TABLE batches ADD COLUMN lifetime_days INTEGER DEFAULT ${DEFAULT_LIFETIME_DAYS}`);
  }
}

/**
 * Раньше шаблон закреплялся за кодом при выпуске, потом у кода был тип (базовый или премиум).
 * С 2026-11-23 тип один на всех: колонка tier осталась в базе, но её никто не читает.
 */
function addTiers(db) {
  if (columnsOf(db, 'cards').has('tier')) return;
  transaction(db, () => {
    db.exec(`
      ALTER TABLE batches ADD COLUMN tier TEXT NOT NULL DEFAULT 'basic';
      ALTER TABLE cards ADD COLUMN tier TEXT NOT NULL DEFAULT 'basic';
      UPDATE batches SET tier = 'premium' WHERE template_id IN (${LEGACY_PREMIUM_TEMPLATES});
      UPDATE cards SET tier = 'premium' WHERE template_id IN (${LEGACY_PREMIUM_TEMPLATES});
      UPDATE cards SET template_id = '' WHERE status = 'new';
    `);
  });
}

function addOpenTracking(db) {
  const columns = columnsOf(db, 'cards');
  if (!columns.has('first_opened_at')) db.exec('ALTER TABLE cards ADD COLUMN first_opened_at INTEGER');
  if (!columns.has('open_count')) db.exec('ALTER TABLE cards ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0');
  if (!columns.has('last_opened_at')) db.exec('ALTER TABLE cards ADD COLUMN last_opened_at INTEGER');
}

function toCard(row) {
  if (!row) return null;
  return {
    code: row.code,
    batchId: row.batch_id,
    templateId: row.template_id || null,
    palette: row.palette ?? null,
    status: row.status,
    sender: row.sender,
    recipient: row.recipient,
    message: row.message,
    songId: row.song_id,
    musicLink: row.music_link ?? null,
    photos: JSON.parse(row.photos),
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at ?? null,
    openCount: row.open_count,
  };
}

function toSong(row) {
  if (!row) return null;
  return { id: row.id, templateId: row.template_id, slot: row.slot, title: row.title, file: row.file, mime: row.mime };
}

function toBatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    total: row.total,
    unused: row.unused,
    drafts: row.drafts,
    lifetimeDays: row.lifetime_days,
    live: row.live,
    activated: row.activated,
    opened: row.opened,
  };
}

const BATCH_SELECT = `
  SELECT b.*, COUNT(c.code) AS total,
    COALESCE(SUM(c.status = 'new'), 0) AS unused,
    COALESCE(SUM(c.status = 'draft'), 0) AS drafts,
    COALESCE(SUM(c.status = 'active'), 0) AS live,
    COALESCE(SUM(c.activated_at IS NOT NULL), 0) AS activated,
    COALESCE(SUM(c.first_opened_at IS NOT NULL), 0) AS opened
  FROM batches b LEFT JOIN cards c ON c.batch_id = b.id`;

function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createRepo(db) {
  const codesOf = (rows) => rows.map((row) => row.code);

  return {
    createBatch({ label, codes, now, lifetimeDays = DEFAULT_LIFETIME_DAYS }) {
      return transaction(db, () => {
        const { lastInsertRowid } = db
          .prepare(`INSERT INTO batches (template_id, label, created_at, lifetime_days) VALUES ('', ?, ?, ?)`)
          .run(label, now, lifetimeDays);
        const batchId = Number(lastInsertRowid);
        const insert = db.prepare(`INSERT INTO cards (code, batch_id, template_id, updated_at) VALUES (?, ?, '', ?)`);
        codes.forEach((code) => insert.run(code, batchId, now));
        return batchId;
      });
    },

    listBatches() {
      return db.prepare(`${BATCH_SELECT} GROUP BY b.id ORDER BY b.id DESC`).all().map(toBatch);
    },

    /**
     * Удаляет партию со всеми кодами и возвращает удалённые коды (чтобы стереть их фото).
     * Партию с заполненными открытками — только при allowUsed; иначе null и ничего не удалено.
     */
    deleteBatch(id, { allowUsed = false } = {}) {
      return transaction(db, () => {
        const { used } = db.prepare(`SELECT COUNT(*) AS used FROM cards WHERE batch_id = ? AND status <> 'new'`).get(id);
        if (used > 0 && !allowUsed) return null;
        const codes = codesOf(db.prepare('SELECT code FROM cards WHERE batch_id = ?').all(id));
        db.prepare('DELETE FROM cards WHERE batch_id = ?').run(id);
        const { changes } = db.prepare('DELETE FROM batches WHERE id = ?').run(id);
        return changes === 1 ? codes : null;
      });
    },

    /** Удаляет все партии и коды разом; возвращает удалённые коды, чтобы стереть их фото. */
    deleteAllBatches() {
      return transaction(db, () => {
        const codes = codesOf(db.prepare('SELECT code FROM cards').all());
        db.exec('DELETE FROM cards; DELETE FROM batches;');
        return codes;
      });
    },

    /**
     * Данные для страницы «Статистика»: сколько кодов в каждом статусе, когда открытки активировали
     * (начиная с since, мс) и какие шаблоны выбирают в заполненных открытках.
     */
    dashboardStats(since) {
      const statuses = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM cards GROUP BY status').all().map((row) => [row.status, row.n]));
      const activations = db.prepare('SELECT activated_at FROM cards WHERE activated_at >= ?').all(since).map((row) => row.activated_at);
      const templates = db
        .prepare(`SELECT template_id AS id, COUNT(*) AS n FROM cards WHERE status <> 'new' AND template_id <> '' GROUP BY template_id ORDER BY n DESC, template_id`)
        .all()
        .map((row) => ({ id: row.id, count: row.n }));
      return { statuses, activations, templates };
    },

    /**
     * Меняет заметку и срок хранения партии. С extendActive продлевает уже активные открытки до нового срока
     * (от их активации), но никогда не сокращает. Возвращает, сколько открыток продлено.
     */
    updateBatch(id, { label, lifetimeDays, extendActive = false }) {
      return transaction(db, () => {
        db.prepare('UPDATE batches SET label = ?, lifetime_days = ? WHERE id = ?').run(label, lifetimeDays, id);
        if (!extendActive) return 0;
        if (lifetimeDays === null) {
          return Number(db.prepare(`UPDATE cards SET expires_at = NULL WHERE batch_id = ? AND status = 'active' AND expires_at IS NOT NULL`).run(id).changes);
        }
        const term = lifetimeDays * DAY_MS;
        const { changes } = db
          .prepare(
            `UPDATE cards SET expires_at = activated_at + ?
             WHERE batch_id = ? AND status = 'active' AND expires_at IS NOT NULL AND expires_at < activated_at + ?`,
          )
          .run(term, id, term);
        return Number(changes);
      });
    },

    /** Срок хранения открыток партии в днях; null — навсегда. */
    batchLifetimeDays(batchId) {
      const row = db.prepare('SELECT lifetime_days FROM batches WHERE id = ?').get(batchId);
      return row ? row.lifetime_days : DEFAULT_LIFETIME_DAYS;
    },

    getBatch(id) {
      const row = db.prepare(`${BATCH_SELECT} WHERE b.id = ? GROUP BY b.id`).get(id);
      return toBatch(row);
    },

    listCards(batchId) {
      return db.prepare('SELECT * FROM cards WHERE batch_id = ? ORDER BY rowid').all(batchId).map(toCard);
    },

    getCard(code) {
      return toCard(db.prepare('SELECT * FROM cards WHERE code = ?').get(code));
    },

    saveDraft(code, { templateId, palette = null, sender, recipient, message, songId, musicLink = null, photos }, now) {
      const { changes } = db
        .prepare(
          `UPDATE cards SET status = 'draft', template_id = ?, palette = ?, sender = ?, recipient = ?, message = ?, song_id = ?, music_link = ?, photos = ?, updated_at = ?
           WHERE code = ? AND status IN ('new', 'draft')`,
        )
        .run(templateId, palette, sender, recipient, message, songId, musicLink, JSON.stringify(photos), now, code);
      return changes === 1;
    },

    /** lifetimeMs = null — открытка хранится навсегда. */
    activate(code, now, lifetimeMs) {
      const { changes } = db
        .prepare(
          `UPDATE cards SET status = 'active', activated_at = ?, expires_at = ?, updated_at = ?
           WHERE code = ? AND status = 'draft'`,
        )
        .run(now, lifetimeMs === null ? null : now + lifetimeMs, now, code);
      return changes === 1;
    },

    /** Новый срок активной открытки из админки; null — навсегда. Содержимое и дата изменения не трогаются. */
    setExpiry(code, expiresAt) {
      const { changes } = db.prepare(`UPDATE cards SET expires_at = ? WHERE code = ? AND status = 'active'`).run(expiresAt, code);
      return changes === 1;
    },

    /** Освобождает код: стирает открытку и её статистику, напечатанный QR снова ведёт в каталог. */
    resetCard(code, now) {
      const { changes } = db
        .prepare(
          `UPDATE cards SET status = 'new', template_id = '', palette = NULL, ${WIPE_CONTENT},
             activated_at = NULL, expires_at = NULL, first_opened_at = NULL, last_opened_at = NULL, open_count = 0, updated_at = ?
           WHERE code = ? AND status <> 'new'`,
        )
        .run(now, code);
      return changes === 1;
    },

    block(code, now) {
      const { changes } = db
        .prepare(`UPDATE cards SET status = 'blocked', ${WIPE_CONTENT}, updated_at = ? WHERE code = ?`)
        .run(now, code);
      return changes === 1;
    },

    recordOpen(code, now) {
      db.prepare(
        `UPDATE cards SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?
         WHERE code = ? AND status = 'active'`,
      ).run(now, now, code);
    },

    expireDue(now) {
      const rows = db
        .prepare(
          `UPDATE cards SET status = 'expired', ${WIPE_CONTENT}, updated_at = ?
           WHERE status = 'active' AND expires_at <= ? RETURNING code`,
        )
        .all(now, now);
      return codesOf(rows);
    },

    resetAbandonedDrafts(cutoff, now) {
      const rows = db
        .prepare(`UPDATE cards SET status = 'new', template_id = '', ${WIPE_CONTENT}, updated_at = ? WHERE status = 'draft' AND updated_at <= ? RETURNING code`)
        .all(now, cutoff);
      return codesOf(rows);
    },

    listSongs(templateId) {
      return db.prepare('SELECT * FROM songs WHERE template_id = ? ORDER BY slot').all(templateId).map(toSong);
    },

    getSong(id) {
      return toSong(db.prepare('SELECT * FROM songs WHERE id = ?').get(id));
    },

    getSongByFile(file) {
      return toSong(db.prepare('SELECT * FROM songs WHERE file = ?').get(file));
    },

    /** Загрузка мелодий из админки убрана; метод остался для мелодий, загруженных раньше, и для тестов. */
    upsertSong({ templateId, slot, title, file, mime }) {
      db.prepare(
        `INSERT INTO songs (template_id, slot, title, file, mime) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (template_id, slot) DO UPDATE SET title = excluded.title, file = excluded.file, mime = excluded.mime`,
      ).run(templateId, slot, title, file, mime);
    },
  };
}

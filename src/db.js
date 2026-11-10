import { DatabaseSync } from 'node:sqlite';

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
const WIPE_CONTENT =`sender = NULL, recipient = NULL, message = NULL, song_id = NULL, photos = '[]'`;

export function openDb(path) {
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  addOpenTracking(db);
  addTiers(db);
  return db;
}

/** Раньше шаблон закреплялся за кодом при выпуске. Теперь у кода только тип, а неиспользованные коды снова открывают каталог. */
function addTiers(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(cards)').all().map((column) => column.name));
  if (columns.has('tier')) return;
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
  const columns = new Set(db.prepare('PRAGMA table_info(cards)').all().map((column) => column.name));
  if (!columns.has('first_opened_at')) db.exec('ALTER TABLE cards ADD COLUMN first_opened_at INTEGER');
  if (!columns.has('open_count')) db.exec('ALTER TABLE cards ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0');
}

function toCard(row) {
  if (!row) return null;
  return {
    code: row.code,
    batchId: row.batch_id,
    templateId: row.template_id || null,
    tier: row.tier,
    status: row.status,
    sender: row.sender,
    recipient: row.recipient,
    message: row.message,
    songId: row.song_id,
    photos: JSON.parse(row.photos),
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    firstOpenedAt: row.first_opened_at,
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
    tier: row.tier,
    activated: row.activated,
    opened: row.opened,
  };
}

const BATCH_SELECT = `
  SELECT b.*, COUNT(c.code) AS total,
    COALESCE(SUM(c.status = 'new'), 0) AS unused,
    COALESCE(SUM(c.status = 'draft'), 0) AS drafts,
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
    createBatch({ tier, label, codes, now }) {
      return transaction(db, () => {
        const { lastInsertRowid } = db
          .prepare(`INSERT INTO batches (template_id, tier, label, created_at) VALUES ('', ?, ?, ?)`)
          .run(tier, label, now);
        const batchId = Number(lastInsertRowid);
        const insert = db.prepare(`INSERT INTO cards (code, batch_id, template_id, tier, updated_at) VALUES (?, ?, '', ?, ?)`);
        codes.forEach((code) => insert.run(code, batchId, tier, now));
        return batchId;
      });
    },

    listBatches() {
      return db.prepare(`${BATCH_SELECT} GROUP BY b.id ORDER BY b.id DESC`).all().map(toBatch);
    },

    deleteUnusedBatch(id) {
      return transaction(db, () => {
        const { used } = db.prepare(`SELECT COUNT(*) AS used FROM cards WHERE batch_id = ? AND status <> 'new'`).get(id);
        if (used > 0) return false;
        db.prepare('DELETE FROM cards WHERE batch_id = ?').run(id);
        db.prepare('DELETE FROM batches WHERE id = ?').run(id);
        return true;
      });
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

    saveDraft(code, { templateId, sender, recipient, message, songId, photos }, now) {
      const { changes } = db
        .prepare(
          `UPDATE cards SET status = 'draft', template_id = ?, sender = ?, recipient = ?, message = ?, song_id = ?, photos = ?, updated_at = ?
           WHERE code = ? AND status IN ('new', 'draft')`,
        )
        .run(templateId, sender, recipient, message, songId, JSON.stringify(photos), now, code);
      return changes === 1;
    },

    activate(code, now, lifetimeMs) {
      const { changes } = db
        .prepare(
          `UPDATE cards SET status = 'active', activated_at = ?, expires_at = ?, updated_at = ?
           WHERE code = ? AND status = 'draft'`,
        )
        .run(now, now + lifetimeMs, now, code);
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
        `UPDATE cards SET open_count = open_count + 1, first_opened_at = COALESCE(first_opened_at, ?)
         WHERE code = ? AND status = 'active'`,
      ).run(now, code);
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

    getSongBySlot(templateId, slot) {
      return toSong(db.prepare('SELECT * FROM songs WHERE template_id = ? AND slot = ?').get(templateId, slot));
    },

    getSongByFile(file) {
      return toSong(db.prepare('SELECT * FROM songs WHERE file = ?').get(file));
    },

    upsertSong({ templateId, slot, title, file, mime }) {
      db.prepare(
        `INSERT INTO songs (template_id, slot, title, file, mime) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (template_id, slot) DO UPDATE SET title = excluded.title, file = excluded.file, mime = excluded.mime`,
      ).run(templateId, slot, title, file, mime);
    },

    renameSong(id, title) {
      db.prepare('UPDATE songs SET title = ? WHERE id = ?').run(title, id);
    },

    deleteSong(id) {
      db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    },
  };
}

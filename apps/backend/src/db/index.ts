import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "support_inbox.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

export function initDb(): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id            TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      email         TEXT NOT NULL,
      subject       TEXT NOT NULL,
      message       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'new',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS triage_results (
      id          TEXT PRIMARY KEY,
      ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      category    TEXT NOT NULL,
      sentiment   TEXT NOT NULL,
      urgency     TEXT NOT NULL,
      priority    TEXT NOT NULL,
      confidence  REAL NOT NULL,
      explanation TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS draft_responses (
      id              TEXT PRIMARY KEY,
      ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      suggested_reply TEXT NOT NULL,
      tone            TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      reviewer_edits  TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log("✅  Database initialised →", DB_PATH);
}

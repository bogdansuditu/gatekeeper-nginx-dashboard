import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
if (!fs.existsSync(config.faviconsDir)) {
  fs.mkdirSync(config.faviconsDir, { recursive: true });
}
if (!fs.existsSync(config.avatarsDir)) {
  fs.mkdirSync(config.avatarsDir, { recursive: true });
}

export const db = new Database(config.databasePath);

// Enable WAL mode and foreign key enforcement for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  } else {
    // Fallback inline schema if schema.sql isn't located relative to compiled dir
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          avatar_url TEXT,
          role TEXT DEFAULT 'user',
          totp_secret TEXT NULL,
          totp_enabled INTEGER DEFAULT 0,
          backup_codes TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          theme_mode TEXT DEFAULT 'dark',
          custom_theme_json TEXT NULL,
          npm_endpoint TEXT NULL,
          npm_identity TEXT NULL,
          npm_secret_encrypted TEXT NULL,
          card_order TEXT NULL,
          hidden_apps TEXT NULL,
          show_analytics INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS npm_applications (
          id TEXT PRIMARY KEY,
          npm_host_id INTEGER UNIQUE NOT NULL,
          domain_name TEXT NOT NULL,
          forward_scheme TEXT NOT NULL,
          forward_host TEXT NOT NULL,
          forward_port INTEGER NOT NULL,
          is_ssl INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          custom_title TEXT NULL,
          custom_description TEXT NULL,
          favicon_path TEXT NULL,
          last_known_status TEXT DEFAULT 'unknown',
          last_response_time_ms INTEGER DEFAULT 0,
          last_checked_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS health_samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          online_count INTEGER NOT NULL,
          down_count INTEGER NOT NULL,
          total_count INTEGER NOT NULL,
          avg_latency_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_health_samples_ts ON health_samples(timestamp);
    `);
  }
}

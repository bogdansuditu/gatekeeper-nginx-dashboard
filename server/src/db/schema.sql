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

CREATE TABLE IF NOT EXISTS cloudflare_applications (
    id TEXT PRIMARY KEY,
    tunnel_id TEXT NOT NULL,
    tunnel_name TEXT NULL,
    domain_name TEXT NOT NULL,
    forward_scheme TEXT NOT NULL,
    forward_host TEXT NOT NULL,
    forward_port INTEGER NOT NULL,
    is_ssl INTEGER DEFAULT 1,
    is_enabled INTEGER DEFAULT 1,
    custom_title TEXT NULL,
    custom_description TEXT NULL,
    favicon_path TEXT NULL,
    last_known_status TEXT DEFAULT 'unknown',
    last_response_time_ms INTEGER DEFAULT 0,
    last_checked_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tunnel_id, domain_name)
);

CREATE VIEW IF NOT EXISTS unified_applications AS
SELECT 
    id,
    'npm' as source,
    npm_host_id as source_id,
    domain_name,
    forward_scheme,
    forward_host,
    forward_port,
    is_ssl,
    is_enabled,
    custom_title,
    custom_description,
    favicon_path,
    last_known_status,
    last_response_time_ms,
    last_checked_at
FROM npm_applications
UNION ALL
SELECT 
    id,
    'cloudflare' as source,
    tunnel_id as source_id,
    domain_name,
    forward_scheme,
    forward_host,
    forward_port,
    is_ssl,
    is_enabled,
    custom_title,
    custom_description,
    favicon_path,
    last_known_status,
    last_response_time_ms,
    last_checked_at
FROM cloudflare_applications;

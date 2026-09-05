# Product Requirements Document (PRD)

# Project: NGINX Dashboard (Auto-Discovered NPM App Portal)

**Document Version:** 1.0.0  
**Target Release:** Q4 2026  
**Status:** Approved for Implementation  
**Deployment Target:** Docker Container Only (`linux/amd64`, `linux/arm64`)  

---

## 1. Executive Summary & Objective

**NGINX Dashboard** is a secure, multi-user, self-hosted application launcher and service-health portal designed exclusively for containerized deployment. It autonomously interrogates an upstream **Nginx Proxy Manager (NPM)** instance to discover published proxy hosts, extract their domains and forwarding schemes, scrape and cache their favicons, monitor their live HTTP health status, and present them in a modern, responsive, modular dashboard interface.

### Key Goals
- **Zero-Friction Discovery:** Eliminate manual maintenance of portal bookmarks and service YAML files.
- **Enterprise-Grade Security:** Multi-user architecture with role isolation, session management, and built-in database/API readiness for Time-based One-Time Password (TOTP) 2FA.
- **Design Excellence:** A UI derived from modern indigo-dark aesthetics (deep navy/slate backgrounds, card surfaces, periwinkle accents, high-readability metrics, fluid reordering).
- **Resilient & Autonomous:** Intelligent favicon caching with fallback generators, asynchronous health-check pingers, and cron-like delta discovery for new NPM hosts.

---

## 2. Technical Stack & Deployment Constraints

The application is engineered strictly to run within a Docker container. Host system dependencies must be zero; all services, workers, and databases run in an isolated multi-process or containerized architecture.

| Layer | Selected Technology | Rationale |
| :--- | :--- | :--- |
| **Container Runtime** | Docker (`docker-compose` / OCI compliant) | Portable across Proxmox LXC (nested Docker), Unraid, TrueNAS, and bare-metal Debian/Ubuntu. |
| **Backend API** | Node.js (Fastify/TypeScript) or Python (FastAPI) | High-performance asynchronous I/O for network probing, NPM REST API polling, and lightweight resource usage. |
| **Frontend Framework** | React / Next.js (Standalone) or SvelteKit | Component-driven reactivity, HTML5 Drag & Drop API support, and responsive grid layouts. |
| **Persistence / DB** | SQLite (via WAL mode) or embedded PostgreSQL | Self-contained, zero-configuration database persisted via single `/data` volume mount. |
| **Process Management** | `s6-overlay` or multi-stage lightweight Node/Python container | Manages foreground app server, periodic health-check workers, and background sync daemons cleanly. |
| **Caching Engine** | In-memory LRU + Persistent disk cache for favicons (`/data/cache/favicons`) | Minimizes external DNS lookups and eliminates broken image links. |

---

## 3. Visual Design System & Theme Specification

The default visual design system is extracted directly from the reference interface: a rich, modern, dark-mode dashboard utilizing a multi-layered indigo/slate palette, soft rounded containers, subtle borders, high-contrast typography, and pastel pill badges.

### 3.1 Default Theme Palette ("Indigo Slate")

```json
{
  "theme_id": "indigo_slate_default",
  "name": "Indigo Slate (Default Dark)",
  "mode": "dark",
  "palette": {
    "background_canvas": "#14152c",
    "background_surface_elevated": "#1c1e3d",
    "background_card": "#232652",
    "background_card_hover": "#2b2f63",
    "border_subtle": "#2f3366",
    "border_focus": "#5364f0",
    "text_primary": "#ffffff",
    "text_secondary": "#8c94bf",
    "text_muted": "#5d658e",
    "accent_primary": "#5364f0",
    "accent_primary_hover": "#6c7cf7",
    "accent_gradient": "linear-gradient(135deg, #5364f0 0%, #8553f0 100%)",
    "status_healthy": "#10b981",
    "status_warning": "#f59e0b",
    "status_critical": "#ef4444",
    "status_pill_bg": "rgba(83, 100, 240, 0.15)",
    "status_pill_text": "#7585ff"
  },
  "typography": {
    "font_family": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "font_size_base": "14px",
    "border_radius_card": "14px",
    "border_radius_pill": "9999px"
  }
}
```

### 3.2 Light Mode Counterpart ("Slate Breeze")

```json
{
  "theme_id": "slate_breeze_light",
  "name": "Slate Breeze (Default Light)",
  "mode": "light",
  "palette": {
    "background_canvas": "#f4f5fa",
    "background_surface_elevated": "#e9ecf6",
    "background_card": "#ffffff",
    "background_card_hover": "#f8f9ff",
    "border_subtle": "#dce1f0",
    "border_focus": "#5364f0",
    "text_primary": "#121426",
    "text_secondary": "#58607e",
    "text_muted": "#8d96b3",
    "accent_primary": "#5364f0",
    "accent_primary_hover": "#4251cc",
    "accent_gradient": "linear-gradient(135deg, #5364f0 0%, #7b46e3 100%)",
    "status_healthy": "#059669",
    "status_warning": "#d97706",
    "status_critical": "#dc2626",
    "status_pill_bg": "rgba(83, 100, 240, 0.08)",
    "status_pill_text": "#4151db"
  },
  "typography": {
    "font_family": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "font_size_base": "14px",
    "border_radius_card": "14px",
    "border_radius_pill": "9999px"
  }
}
```

### 3.3 Theme System Requirements
- **OS Theme Sync:** By default, the application queries CSS media query `(prefers-color-scheme: dark)`. When toggled to `Auto`, it switches dynamically when the operating system changes mode.
- **User Override:** Users can force `Dark`, `Light`, or select custom user-imported JSON themes.
- **Custom JSON Theme Engine:** Users can export or import custom JSON theme definition files validating against the schema above.

---

## 4. Functional Requirements

### 4.1 Authentication, Multi-User & 2FA Readiness

#### Multi-User RBAC
- **Admin Role:** Configure global instance defaults, manage users, set fallback NPM connection credentials, and trigger manual global host rescanning.
- **Standard User Role:** Manage personal profile, upload avatar, customize card ordering, toggle card visibility, override NPM credentials with individual NPM user accounts, and manage personal themes.

#### Authentication Workflow
1. **Login Interface:** Clean, centered card styled with default indigo dark theme. Contains email/username and password fields.
2. **Session Security:**
   - Password hashing using `Argon2id` (or `bcrypt` with cost factor 12).
   - Stateless JWT authentication delivered via `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
3. **2FA Architecture (Pre-Configured & Ready):**
   - User table schema includes:
     - `totp_secret` (VARCHAR 64, nullable, encrypted with AES-GCM application master key).
     - `totp_enabled` (BOOLEAN, default `false`).
     - `backup_codes` (JSON array of hashed 8-digit emergency recovery tokens).
   - **Login Challenge Pipeline:**
     - Step 1: Validate credentials. If `totp_enabled == false`, issue authorization cookie.
     - Step 2: If `totp_enabled == true`, issue short-lived temporary token (`totp_challenge`) valid for 3 minutes.
     - Step 3: Frontend transitions to TOTP 6-digit numeric input screen (with support for pasting codes and authenticator autofill). Upon validation, promote session to active auth token.
   - **User Settings UI (2FA Management):** Provides a modal with QR code generation (using standard `otpauth://totp/Gatekeeper:<user>?secret=...`), manual secret key copy, verify-to-activate flow, and backup code download.

---

### 4.2 Nginx Proxy Manager (NPM) Auto-Discovery & Health Polling

#### Connection Modes
- **Global Configuration:** Set via environment variables in `docker-compose.yml` (`NPM_HOST`, `NPM_USER`, `NPM_PASS`, or `NPM_TOKEN`).
- **Per-User Configuration:** Allowed in user settings for homelabs where multiple NPM instances exist or users have dedicated NPM accounts.

#### Discovery Pipeline
1. **Authentication:** Authenticate against `${NPM_HOST}/api/tokens` using JSON credentials to obtain a Bearer JWT.
2. **Host Retrieval:** Query `${NPM_HOST}/api/nginx/proxy-hosts`.
3. **Data Sanitization & Extraction:**
   - `domain_names`: Primary FQDN (e.g., `grafana.homelab.local`).
   - `forward_scheme`: `http` vs `https`.
   - `forward_host` & `forward_port`: Destination internal address.
   - `ssl_forced` / `certificate_id`: Determine if public URL is `https://`.
   - `enabled`: Filter out disabled entries (`enabled == 1` only).
4. **Auto-Discovery Scheduler:**
   - Background worker checks NPM every `N` minutes (default: 5 minutes, configurable via settings).
   - Detects added hosts, modified hosts, and deleted hosts.
   - Automatically provisions new application cards into user dashboards without requiring container restart.

#### Service Health Monitor
- **Probing Engine:** Asynchronous background health checker issues `HEAD` or `GET` requests to each discovered host.
- **Evaluation Criteria:**
  - Status `200–399`: **Online / Working** (Green status indicator).
  - Status `401 / 403`: **Online / Protected** (Green or subtle Amber warning badge).
  - Status `500–599` or Connection Timeout / DNS failure: **Down / Not Responding** (Red status indicator with pulsing dot).
- **Probing Optimization:** Uses connection timeouts (3 seconds max) to prevent worker thread starvation. Polling interval defaults to 60 seconds per service.

---

### 4.3 Application Cards & Favicon Handling

#### Card Component Architecture
Each application card on the main dashboard contains:
1. **Favicon / Icon:** Scraped high-res favicon, cached locally. Fallback to initial-letter SVG badge with gradient fill if no icon is available.
2. **Title:** Auto-generated from subdomain (e.g., `vaultwarden.lan` -> `Vaultwarden`), with user ability to edit/rename per user preference.
3. **Description:** Auto-inferred (e.g., `Internal: 192.168.1.50:8080`) or customizable by the user.
4. **Live Status Indicator:** Real-time indicator dot with tooltip showing response time (e.g., `Online - 24ms` or `Unreachable - 504 Gateway Timeout`).
5. **Action Menu:** Quick access to open in new tab, edit card metadata, hide from dashboard, or force favicon re-fetch.
6. **Reordering Support:** Smooth Drag-and-Drop ordering using HTML5 DnD / `@dnd-kit`. Card order array (`card_order: [host_id_3, host_id_1, ...]`) is saved per user profile to the database.

#### Favicon Caching Engine
To ensure high performance and eliminate broken images on isolated subnets:
1. **Resolution Pipeline:**
   - Step 1: Check if `<domain>/favicon.ico` or `<link rel="icon">` exists via fast HTTP fetch.
   - Step 2: If unreachable or blank, check the DuckDuckGo / Google Favicon fallback cache API (if internet access is available).
   - Step 3: If in an air-gapped/offline local network, render an SVG icon using the first letter of the application name on an accent-gradient background.
2. **Local Storage:** Downloaded icons are converted and stored under `/data/cache/favicons/<hash>.webp` or `.png`.
3. **Cache Headers:** Served via backend API `/api/v1/icons/:id` with `Cache-Control: public, max-age=604800, immutable`.

---

### 4.4 User Settings & Profile Management

The application provides a dedicated settings drawer / modal with tabbed sections:
- **Profile:**
  - Display Name.
  - Avatar / Photo upload (saved to `/data/avatars/`, resized to 256x256 WebP).
  - Password change and 2FA enrollment.
- **Preferences:**
  - Theme selector (`Indigo Slate`, `Slate Breeze`, `Follow System`, or custom JSON upload).
  - Card density (Compact, Comfortable, Detailed).
  - Open links in new tab (`true`/`false`).
- **NPM Integration:**
  - Endpoint URL (e.g., `http://192.168.1.2:81`).
  - Authentication Identity (Email / Username) and Secret.
  - Test Connection button with status verification toast.
  - Auto-sync interval slider (1 min to 60 min).

---

## 5. UI Layout & Responsiveness Specification

The user interface follows a modern sidebar + responsive grid layout:

```
+-----------------------------------------------------------------------------------+
|  [Sidebar]  |  Header: Welcome back, [User Avatar]    [Search Apps...] [Theme 🌙] |
|             +---------------------------------------------------------------------+
|  (Logo)     |  Metrics Bar:                                                       |
|  [Dashboard]|  [ Total Apps: 24 ]  [ Online: 22 ]  [ Down: 2 ]  [ Sync: 2m ago 🔄] |
|  [Settings] +---------------------------------------------------------------------+
|  [Users]    |  Application Grid:                                                  |
|  [Logout]   |  +----------------+  +----------------+  +----------------+         |
|             |  | [Icon] App A  🟢|  | [Icon] App B  🟢|  | [Icon] App C  🔴|         |
|             |  | Proxied Host   |  | Proxied Host   |  | Connection Ref |         |
|             |  +----------------+  +----------------+  +----------------+         |
+-----------------------------------------------------------------------------------+
```

### Breakpoint Matrix
- **Desktop / Ultrawide (>= 1440px):** 5-column or 6-column fluid grid.
- **Laptop / Standard (1024px – 1439px):** 4-column card grid, collapsible sidebar into icon-only mode.
- **Tablet (768px – 1023px):** 2 to 3-column card grid, off-canvas sliding sidebar.
- **Mobile (< 768px):** Single-column or 2-column compact cards, sticky bottom or top navigation bar, full touch drag handles for card reordering.

---

## 6. Database Schema (SQLite / PostgreSQL)

```sql
-- Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user', -- 'admin', 'user'
    totp_secret VARCHAR(128) NULL,
    totp_enabled BOOLEAN DEFAULT 0,
    backup_codes TEXT NULL, -- JSON array of hashed recovery codes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences & Themes
CREATE TABLE user_preferences (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme_mode VARCHAR(20) DEFAULT 'system', -- 'dark', 'light', 'system', 'custom'
    custom_theme_json TEXT NULL,
    npm_endpoint VARCHAR(255) NULL,
    npm_identity VARCHAR(255) NULL,
    npm_secret_encrypted VARCHAR(255) NULL,
    card_order TEXT NULL, -- JSON array of application IDs
    hidden_apps TEXT NULL -- JSON array of application IDs
);

-- Discovered Applications (Cached from NPM)
CREATE TABLE npm_applications (
    id VARCHAR(36) PRIMARY KEY,
    npm_host_id INTEGER UNIQUE NOT NULL,
    domain_name VARCHAR(255) NOT NULL,
    forward_scheme VARCHAR(10) NOT NULL,
    forward_host VARCHAR(255) NOT NULL,
    forward_port INTEGER NOT NULL,
    is_ssl BOOLEAN DEFAULT 0,
    is_enabled BOOLEAN DEFAULT 1,
    custom_title VARCHAR(100) NULL,
    custom_description TEXT NULL,
    favicon_path VARCHAR(255) NULL,
    last_known_status VARCHAR(20) DEFAULT 'unknown', -- 'healthy', 'down', 'degraded'
    last_response_time_ms INTEGER DEFAULT 0,
    last_checked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Containerization & Docker Architecture

### 7.1 Dockerfile Structure
Multi-stage build minimizing attack surface and image size (< 120MB final footprint):
- **Stage 1 (Builder):** Alpine Linux + Node.js/Python compiler. Installs production dependencies and compiles TypeScript frontend/backend.
- **Stage 2 (Runner):** Lightweight Alpine runtime. Non-root user `appuser` (UID 1000) for security hardening.
- **Volumes:** Exposes `/data` for SQLite database, custom icons, and theme files.

### 7.2 Docker Compose Reference Implementation

```yaml
version: '3.8'

services:
  gatekeeper-dashboard:
    image: gatekeeper-dashboard:latest
    container_name: gatekeeper_dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_PATH=/data/gatekeeper.sqlite
      - CACHE_DIR=/data/cache
      - JWT_SECRET=change_me_to_a_secure_random_string_in_production
      # Global Fallback NPM Credentials (Optional)
      - NPM_DEFAULT_HOST=http://nginx-proxy-manager:81
      - NPM_DEFAULT_USER=admin@example.com
      - NPM_DEFAULT_PASS=changeme
      - SYNC_INTERVAL_MINUTES=5
      - HEALTHCHECK_INTERVAL_SECONDS=60
    volumes:
      - ./dashboard-data:/data
    networks:
      - npm_network

networks:
  npm_network:
    external: true # Connect directly to NPM's Docker bridge if co-located
```

---

## 8. Non-Functional & Security Requirements

1. **Self-Contained Execution:** Zero external cloud dependencies. In air-gapped homelabs, all favicons, fonts, and scripts are bundled directly within the container image.
2. **Least Privilege Container Security:**
   - Container runs as non-root user (`node` or `appuser` with UID:GID `1000:1000`).
   - Read-only root filesystem with write access restricted strictly to `/data` and `/tmp`.
3. **Rate Limiting & Brute-Force Mitigation:**
   - Login attempts throttled to 5 attempts per IP per minute using in-memory token bucket.
4. **Resilience & Fault Tolerance:**
   - If Nginx Proxy Manager is temporarily unreachable, Gatekeeper serves cached applications and displays a non-blocking warning badge ("NPM Sync Paused").

---

## 9. Implementation Milestones

- [ ] **Phase 1:** Dockerfile multi-stage template, DB schema migration, and Argon2id user authentication.
- [ ] **Phase 2:** NPM API client module, automated polling scheduler, and SQLite caching.
- [ ] **Phase 3:** High-res favicon scraper with offline SVG avatar generator.
- [ ] **Phase 4:** Frontend implementation with Indigo Slate theme, responsive cards, and drag-and-drop reordering.
- [ ] **Phase 5:** 2FA/TOTP verification workflow and user settings profile management.
- [ ] **Phase 6:** End-to-end container health checks, packaging, and documentation.
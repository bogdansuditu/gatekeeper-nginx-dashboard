# Gatekeeper — NGINX Dashboard (Auto-Discovered NPM Portal)

A multi-user, self-hosted application launcher and live service-health portal designed exclusively for containerized deployment. It autonomously synchronizes with upstream **Nginx Proxy Manager (NPM)** instances to discover published proxy hosts, scrape and cache favicons, monitor HTTP health roundtrips, and present an indigo-dark operations dashboard.

Styled directly after modern high-density dark UI design with fluid drag-and-drop card reordering, collapsible analytics panels, and built-in 2FA (TOTP) readiness.

---

## 🔒 Operational Constraint: Docker-Only Runtime

> **MANDATORY**: This application is strictly containerized. All builds, backend services, frontend assets, workers, and SQLite databases run **ONLY within Docker containers**. Nothing runs directly on the host OS.

---

## 🚀 Quick Start

### 1. Start the Container
Clone or enter the directory, then run:

```bash
docker compose up --build -d
```

### 2. Access the Dashboard
Open your browser at:
```
http://localhost:3000
```

### 3. Default Credentials
On initial startup, Gatekeeper automatically provisions the primary administrator account:
- **Email / Username:** `admin@example.com`
- **Password:** `adminpassword`

*(You can customize these in `docker-compose.yml` or `.env` via `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`)*.

---

## 🎨 Visual Design System & Themes

- **Indigo Slate (Default Dark):** Deep navy/slate palette (`#14152c`, `#1c1e3d`, `#232652`, `#5364f0`), rounded containers (`14px`), subtle border glows, glowing status indicators.
- **Slate Breeze (Light Mode):** High-contrast crisp light theme (`#f4f5fa`, `#ffffff`).
- **Follow System:** Automatically synchronizes with your device's `(prefers-color-scheme: dark)` mode.

---

## 📊 Dashboard Features

1. **Collapsible Telemetry & Analytics Panel:**
   - **KPI Cards:** Total Hosts, Online Services, Avg Latency, and Network Availability with sparklines and trend pills.
   - **Infrastructure Latency & Load Wave Chart:** Smooth curved SVG spline chart with real-time overload indicator, time range filters (Today, 7d, 2w, 1m, 3m), and one-click CSV telemetry export.
   - **Host Distribution Radar:** Concentric circular radar chart showing SSL vs Non-SSL and port distribution.
   - **Service Statistics Gauges:** Ring gauges displaying live uptime percentage and average roundtrip response times.
   - **One-Click Collapse:** Toggle the top analytics panel anytime to focus exclusively on launching applications.

2. **Drag-and-Drop Application Launcher:**
   - **High-Res Favicon Scraper:** Caches upstream favicons locally in `/data/cache/favicons`, with Google/DuckDuckGo fallback and an offline SVG avatar generator.
   - **Live Health Indicators:** Real-time pulsing status dots (Green = Online, Amber = Degraded, Red = Offline) with tooltips showing roundtrip milliseconds.
   - **Smooth Reordering:** Drag and drop cards anywhere using `@dnd-kit`. Reordered positions persist per-user in SQLite.
   - **Card Customization:** Edit display titles, descriptions, open in new tab, or hide cards.

3. **Enterprise Security & 2FA (TOTP):**
   - **Multi-User RBAC:** Administrator and Standard User roles with secure session cookies.
   - **Two-Factor Authentication:** Generate QR codes for Google Authenticator / Authy / Bitwarden, encrypted with AES-256-GCM.
   - **Emergency Backup Codes:** Generates 8 one-time hashed recovery codes during 2FA enrollment.

4. **Nginx Proxy Manager Integration:**
   - Connects to `${NPM_HOST}/api/tokens` to retrieve Bearer tokens.
   - Polling scheduler automatically detects newly created, modified, or deleted proxy hosts.
   - **Demo Mode Fallback:** When NPM is unconfigured or unreachable, Gatekeeper serves realistic homelab sample hosts (Grafana, Vaultwarden, Nextcloud, Plex, Home Assistant, Portainer, Uptime Kuma, NPM) so the UI is immediately functional.
   - **Homelab Permissive SSL:** Allows health checks and favicon scrapes across internal homelab domains with self-signed certificates (`STRICT_SSL=false`).

5. **Cloudflare Tunnels Integration:**
   - Autonomously extracts published hostnames and upstream target applications directly from Cloudflare Zero Trust Tunnels via Cloudflare API v4.
   - **Unified Dashboard & Grouping:** Extracted applications merge into the same grid. When using **"Grouping: By Server"**, Cloudflare apps pointing to internal IPs group under the exact same server IP headers as your NPM hosts.

---

## ☁️ Setting Up Cloudflare Tunnels

To connect Gatekeeper to your Cloudflare Tunnels, open **Settings** (gear icon or user menu) → click the **Cloudflare Tunnels** tab. You will need your **Cloudflare Account ID** and an **API Token**.

### 1. How to Find Your Cloudflare Account ID

Cloudflare accounts have a 32-character hexadecimal Account ID. You can find it in either of two quick ways:

#### Option A: Directly from your Browser URL (Fastest)
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Look at your browser's address bar. The URL will look like:
   ```text
   https://dash.cloudflare.com/a1b2c3d4e5f60718293a4b5c6d7e8f90
   ```
3. The 32-character string right after `dash.cloudflare.com/` is your **Account ID**. Copy that string.
*(If you are in Cloudflare Zero Trust, the URL is `https://one.dash.cloudflare.com/<ACCOUNT_ID>/...` — the string after `one.dash.cloudflare.com/` is also your Account ID)*.

#### Option B: From Any Domain Overview Sidebar
1. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), click on any of your active domains/websites.
2. On the **Overview** page, scroll down the right-hand sidebar.
3. Under the **API** section at the bottom right, find **Account ID** and click **Click to copy**.

---

### 2. How to Create or Use Your Cloudflare API Token

Gatekeeper only needs **Read** access to your tunnels to discover your published ingress rules:

1. In the top-right corner of the Cloudflare Dashboard, click your **User Profile icon** → select **My Profile**.
2. In the left navigation menu, click **API Tokens** (or navigate directly to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)).
3. Click **Create Token**.
4. You can use either of the following:
   - **Method 1 (Recommended - Scoped Custom Token):**
     - Scroll down to **Custom Token** and click **Get started**.
     - **Token name:** `Gatekeeper Tunnels Reader`
     - **Permissions:**
       - Select `Account` → `Cloudflare Tunnel` → `Read`.
     - **Account Resources:**
       - Select `Include` → `All accounts` (or select your specific account).
     - Click **Continue to summary** → **Create Token**.
   - **Method 2 (Read All Resources Token):**
     - If you already created a token using the **Read all resources** template, that token already has the required permissions and works out of the box!
5. Copy the generated token string. *(Note: Cloudflare only shows this once; Gatekeeper stores it securely encrypted using AES-256-GCM)*.

---

### 3. Connecting in Gatekeeper
1. Open Gatekeeper → click **Settings** → **Cloudflare Tunnels**.
2. Paste your **Account ID** and **API Token**.
3. Click **Test Connection** — Gatekeeper will query your account and list your active tunnels.
4. Under **Tunnel Scope**, choose **All Tunnels (Combined Ingress)** or pick an individual tunnel.
5. Click **Save & Sync Hosts** (or **Import Apps Now**).
6. Your published Cloudflare applications will instantly appear on your dashboard!


## ⚙️ Configuration Reference (`docker-compose.yml`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port served by the Docker container |
| `DATABASE_PATH` | `/data/gatekeeper.sqlite` | SQLite database file location (WAL mode enabled) |
| `CACHE_DIR` | `/data/cache` | Directory for cached favicons and assets |
| `JWT_SECRET` | `change_me_...` | Master secret key used for signing JWTs and encrypting 2FA secrets |
| `INITIAL_ADMIN_EMAIL` | `admin@example.com` | Email of initial auto-provisioned admin account |
| `INITIAL_ADMIN_PASSWORD` | `adminpassword` | Password of initial auto-provisioned admin account |
| `ENABLE_DEMO_DATA` | `true` | Serves realistic sample hosts if NPM is not connected |
| `STRICT_SSL` | `false` | Set to `true` to reject self-signed SSL certificates |
| `NPM_DEFAULT_HOST` | `http://nginx-proxy-manager:81` | Upstream NPM host URL |
| `NPM_DEFAULT_USER` | `admin@example.com` | NPM account email |
| `NPM_DEFAULT_PASS` | `changeme` | NPM account password |
| `SYNC_INTERVAL_MINUTES`| `5` | Background sync interval for NPM discovery |
| `HEALTHCHECK_INTERVAL_SECONDS`| `60` | Background health check ping frequency |

---

## 📁 Data Persistence (`/data`)

Persistent state is cleanly preserved under `./dashboard-data` mounted to `/data`:
- `/data/gatekeeper.sqlite`: SQLite database (users, custom card order, NPM cache)
- `/data/cache/favicons/`: Locally stored favicons and generated SVG badges
- `/data/avatars/`: User profile pictures

---

## 🛠️ Testing & Verification Inside Docker

To verify the containerized build and health status:

```bash
# Check running container status
docker compose ps

# View live application logs
docker compose logs -f gatekeeper_dashboard

# Test health check endpoint
docker compose exec gatekeeper-dashboard wget -qO- http://localhost:3000/api/v1/health
```

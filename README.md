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

---

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

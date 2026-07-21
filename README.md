# MorphIQ — Intelligent Body Composition & Health Companion

MorphIQ is a premium, privacy-first body composition dashboard and AI-driven coaching application. It connects to the **Xiaomi Mi Body Composition Scale 2 (XMTZC05HM)** via Web Bluetooth to track body metrics and uses that data to power a **Professional Nutritionist & Gym Coach AI Agent** that dynamically adjusts workouts and diet plans.

Data can be stored **locally in your browser** (default) or synced to a **personal PostgreSQL server** (Raspberry Pi) accessible from anywhere via a **Tailscale VPN** — so your data follows you across all your devices and networks.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📡 **Direct Scale Integration** | Connects to the Xiaomi Mi Scale 2 via Web Bluetooth (BLE) |
| 🧪 **Simulator Mode** | Generate realistic weight & impedance data instantly, no hardware required |
| 🧠 **AI Nutritionist & Coach** | Gemini-powered chat contextualised with your full measurement, food & workout history |
| 📊 **Analytics Dashboard** | Glassmorphic charts tracking weight, body fat, muscle mass, BMI and more over time |
| 🍽️ **Daily Food & Workout Logs** | Log meals with macro breakdown and workouts by type |
| 💾 **Dual Storage Modes** | Local-first (IndexedDB) or remote PostgreSQL server |
| 🌍 **Access From Anywhere** | Personal VPN via Tailscale — same data from any device, any network |
| 👤 **Multi-Profile Support** | Create and switch between multiple user profiles |

---

## 🛠️ Technology Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite + TypeScript |
| Styling | Vanilla CSS (Cinema Dark design system) |
| State | Zustand |
| Local DB | Dexie.js (IndexedDB) |
| Charts | Recharts |
| Icons | Lucide React |
| Tests | Vitest + Testing Library (24 tests, 100% core coverage) |

### Backend (Raspberry Pi Server)
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| API | Express 4 (REST) |
| Database | PostgreSQL 15 |
| Process Manager | systemd (`morphiq-server.service`) |
| VPN | Tailscale (private mesh network) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and **npm** v9+
- A **Chromium-based browser** (Chrome, Edge, Opera) — required for Web Bluetooth API
  - *iOS users: use [Bluefy](https://apps.apple.com/app/bluefy/id1492822055) or [WebBLE](https://apps.apple.com/app/webble/id1193531073)*
- **Tailscale** installed and logged in (required for server mode — see below)
- A **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com/)

### 1. Clone & Install

```bash
git clone <your-repository-url>
cd morphiq
npm install
```

### 2. Configure Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Your Gemini API key (required for AI Coach)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Storage mode: 'local' (browser) or 'server' (Raspberry Pi)
VITE_DB_TYPE=server

# Pi's Tailscale IP — only needed when VITE_DB_TYPE=server
VITE_API_URL=http://100.103.57.4:3000
```

> **Note:** `.env` is git-ignored. Never commit API keys or server IPs to version control.

### 3. Run the App

```bash
npm run dev
```

> Web Bluetooth requires HTTPS. Vite uses a local self-signed certificate — click **Advanced → Proceed to localhost** in your browser the first time.

---

## 💾 Data Storage Modes

MorphIQ supports two storage backends, switchable via the `VITE_DB_TYPE` environment variable.

### Mode 1: Local (Default)

```env
VITE_DB_TYPE=local
```

All data is stored in your **browser's IndexedDB** on the current machine only. Fast, zero-config, works offline. Data does **not** sync between devices.

| Pros | Cons |
|------|------|
| ✅ No server required | ❌ Data stays on this browser only |
| ✅ Works offline | ❌ Lost if browser storage is cleared |
| ✅ Zero configuration | ❌ No multi-device sync |

### Mode 2: Server (Raspberry Pi + PostgreSQL)

```env
VITE_DB_TYPE=server
VITE_API_URL=http://100.103.57.4:3000
```

All data is sent to a **PostgreSQL database** running on your personal Raspberry Pi, accessible from anywhere via **Tailscale VPN**. Log in on any device that has Tailscale installed, and your data is always there.

| Pros | Cons |
|------|------|
| ✅ Syncs across all your devices | ❌ Requires Tailscale on each device |
| ✅ Data persists permanently | ❌ Pi must be powered on |
| ✅ Accessible from any network | ❌ Initial setup required |
| ✅ Your own private server | |

---

## 🌐 Secure Remote Connection Methods

To access your Raspberry Pi database securely from the mobile app (or any device outside your home network), we support two methods. **Cloudflare Tunnel** is recommended as it doesn't require a VPN client on your phone and provides automatic HTTPS/TLS.

### Method A: Cloudflare Tunnel (`cloudflared`) — **Recommended**

A Cloudflare Tunnel connects your local Raspberry Pi Express service securely to the Cloudflare network via an outbound connection, exposing it under a domain you control.

#### 1. Setup the Tunnel on Cloudflare
1. Log in to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks** → **Tunnels** and click **Create a Tunnel**.
3. Choose **Cloudflare Tunnel**, name it (e.g. `morphiq-pi`), and save.
4. Cloudflare will display installation commands. Copy the script for your Pi's architecture (usually **Debian** `arm64` or `armhf`).

#### 2. Install on your Raspberry Pi
SSH into your Raspberry Pi and execute the copied command. This will download `cloudflared` and configure it to run as a boot service:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
```

#### 3. Route Traffic to the Express Server
1. Go back to the Cloudflare Zero Trust page.
2. In the **Public Hostname** tab, click **Add a public hostname**.
3. Fill in your Domain details:
   - **Subdomain**: `morphiq`
   - **Domain**: `yourdomain.com`
4. Set **Service**:
   - **Type**: `HTTP`
   - **URL**: `localhost:3000` (where your Express API is running)
5. Save the configuration. Your backend is now securely available globally at `https://morphiq.yourdomain.com`.

#### 4. Configure Frontend Env
In your local `.env` file (and phone build configuration), update the API endpoint:
```env
VITE_DB_TYPE=server
VITE_API_URL=https://morphiq.yourdomain.com
```

---

### Method B: Private Mesh Network (Tailscale VPN)

If you prefer not to use a public domain, you can route your traffic through a private Mesh VPN using Tailscale.

1. Install Tailscale on the Raspberry Pi and log in.
2. Install Tailscale on your mobile phone and sign in with the same account.
3. Once connected, your Pi is reachable at its Tailscale IP (e.g. `http://100.103.57.4:3000`).
4. Set `VITE_API_URL=http://100.103.57.4:3000` in the `.env` file.

---


## 🍓 Raspberry Pi Server

The backend runs as a **systemd service** on your Raspberry Pi, meaning it starts automatically on boot and restarts if it crashes.

### Architecture

```
[Browser App]
     │  HTTP REST (via Tailscale VPN)
     ▼
[Express API — port 3000]  ←  /home/marche/morphiq-server/
     │
     ▼
[PostgreSQL 15 — localhost:5432]
  Database: morphiq
  User: morphiq
```

### Server File Structure

```
server/
├── index.js        # Express API server (all REST endpoints)
├── schema.sql      # PostgreSQL table definitions (auto-applied on startup)
├── package.json    # Node dependencies (express, pg, cors, dotenv)
├── .env            # Server config (DB credentials, port) — NOT in git
└── .gitignore
```

### Managing the Service

SSH into the Pi and use these commands:

```bash
# Check if the server is running
sudo systemctl status morphiq-server

# Restart the server (e.g. after updating files)
sudo systemctl restart morphiq-server

# View live logs
sudo journalctl -u morphiq-server -f

# Stop / Start
sudo systemctl stop morphiq-server
sudo systemctl start morphiq-server
```

### Updating the Server

After changing `server/index.js` or `server/schema.sql` locally:

```bash
# Copy updated files to the Pi
scp server/index.js server/schema.sql marche@192.168.100.8:/home/marche/morphiq-server/

# Restart the service
ssh marche@192.168.100.8 "sudo systemctl restart morphiq-server"
```

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/profiles` | List all profiles |
| `POST` | `/api/profiles` | Create profile |
| `PUT` | `/api/profiles/:id` | Update profile |
| `DELETE` | `/api/profiles/:id` | Delete profile (cascades all data) |
| `GET` | `/api/profiles/:id/measurements` | List measurements |
| `POST` | `/api/measurements` | Save measurement |
| `DELETE` | `/api/measurements/:id` | Delete measurement |
| `GET` | `/api/profiles/:id/food-logs?date=YYYY-MM-DD` | List food logs |
| `POST` | `/api/food-logs` | Add food log |
| `DELETE` | `/api/food-logs/:id` | Delete food log |
| `GET` | `/api/profiles/:id/workout-logs?date=YYYY-MM-DD` | List workout logs |
| `POST` | `/api/workout-logs` | Add workout log |
| `DELETE` | `/api/workout-logs/:id` | Delete workout log |
| `GET` | `/api/profiles/:id/messages` | Get chat history |
| `POST` | `/api/messages` | Save chat message |
| `DELETE` | `/api/profiles/:id/messages` | Clear chat history |

---

## 🔬 How BLE Scale Integration Works

### Byte Parsing

The Xiaomi Mi Body Composition Scale 2 broadcasts a **13-byte Little-Endian BLE packet**:

| Bytes | Field | Decoding |
|-------|-------|----------|
| 0–1 | Control flags | Unit (kg/lb), stabilized lock, impedance present |
| 9–10 | Impedance | Raw resistance in Ohms (Ω) |
| 11–12 | Weight | Divide by 200 (kg) or 100 (lb) |

### BIA Calculation Engine

Once weight and impedance are captured, MorphIQ runs reverse-engineered Huami physiological models (`BiaCalculator.ts`) to compute:

- Body Fat % · Total Body Water % · Muscle Mass
- Bone Mass · Visceral Fat Index · Basal Metabolic Rate (BMR)
- Protein % · Metabolic Age · Body Type Index (0–8)

---

## 🧪 Testing

```bash
# Run all unit tests
npm run test

# Run with coverage report
npx vitest run --coverage
```

The test suite (24 tests, 100% core coverage) covers:
- BIA mathematical models (`BiaCalculator.test.ts`)
- BLE byte parser (`WebBluetoothScale.test.ts`)
- IndexedDB repositories (`LocalDatabase.test.ts`)
- Zustand store actions (`store.test.ts`)
- Gemini AI adapter (`GeminiCoach.test.ts`)

Uses `fake-indexeddb` to run database tests fully offline.

---

## 📦 Publishing to GitHub

```bash
# Add your GitHub remote
git remote add origin https://github.com/<username>/morphiq.git

# Rename branch and push
git branch -M main
git push -u origin main
```

> ⚠️ Make sure `.env` and `server/.env` are listed in `.gitignore` before pushing — they contain secrets.

---

## 📁 Project Structure

```
morphiq/
├── server/                     # Raspberry Pi backend
│   ├── index.js                # Express REST API
│   ├── schema.sql              # PostgreSQL schema
│   └── package.json
├── src/
│   ├── core/
│   │   ├── entities/           # TypeScript interfaces (UserProfile, Measurement, etc.)
│   │   └── interfaces/         # Repository contracts (IDatabase)
│   ├── data/
│   │   ├── ai/                 # Gemini AI coach adapter
│   │   ├── bluetooth/          # Web BLE scale adapter + mock simulator
│   │   ├── calculation/        # BIA math engine
│   │   └── database/
│   │       ├── LocalDatabase.ts    # Dexie.js (IndexedDB) repositories
│   │       └── ServerDatabase.ts   # HTTP REST repositories (Pi backend)
│   ├── presentation/
│   │   ├── components/         # React UI components
│   │   └── state/              # Zustand store
│   ├── index.css               # Full design system (Cinema Dark theme)
│   └── App.tsx                 # Root component + navigation
├── .env.example                # Environment variable template
└── vite.config.ts
```

---

## 📄 License

MIT — use freely for personal projects.

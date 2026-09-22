RoadGuard AI

AI-powered real-time road condition monitoring â€” detects potholes from a live IP/USB camera feed, a browser device camera, or an uploaded video, then generates a cost-estimate PDF report that's stored in Supabase and emailed to the user.

## âœ¨ Features

- **Live pothole detection** via YOLOv11, from three sources:
  - **IP/USB camera** â€” pulls an MJPEG/HTTP stream from a networked camera or phone (e.g. the *IP Webcam* Android app)
  - **Device camera** â€” captures directly from the browser (`getUserMedia`), works from any device/network with zero extra setup
  - **Video upload** â€” analyze a pre-recorded video file
- **Automatic PDF report** â€” pothole count, dimensions, and an estimated maintenance cost per session
- **Cloud storage** â€” reports are uploaded to Supabase Storage and a public link is generated
- **Email delivery** â€” the report PDF is emailed to whichever user ran the session
- **Interactive pothole map** â€” session results plotted on a map (Leaflet + OpenStreetMap reverse geocoding)
- **Auth** â€” Supabase Auth (Google/email), with an optional SQL policy to restrict sign-ups to a specific email domain

## ðŸ—ï¸ Architecture

```
Browser
   â”‚  HTTPS (auto TLS via Caddy)
   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”   internal docker network   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Caddy  â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚ frontend â”‚  (Next.js static export, served by nginx)
â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜                             â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
                                             â”‚ /api, /ws  (nginx reverse proxy)
                                             â–¼
                                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                        â”‚ backend  â”‚  (FastAPI + YOLOv11, gunicorn/uvicorn)
                                        â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
                                             â”‚
                                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                  â–¼                      â–¼
                             Supabase              Gmail SMTP
                       (Auth + Storage)          (report emails)
```

- **Caddy** terminates HTTPS automatically (Let's Encrypt) so the browser can grant camera permissions â€” `getUserMedia` requires a secure context (HTTPS or `localhost`), so this is required for the Device Camera feature to work on any non-localhost deployment.
- **nginx** (inside the frontend container) proxies `/api/*` and `/ws/*` to the backend, so the backend's port is never exposed to the internet directly.
- **Backend** never needs a public port â€” only Caddy and nginx do.

## ðŸ§° Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (static export), React, Tailwind, Leaflet |
| Backend | FastAPI, Gunicorn + Uvicorn workers, YOLOv11 (Ultralytics), OpenCV |
| Reports | ReportLab (PDF generation) |
| Storage/Auth | Supabase (Postgres, Storage, Auth) |
| Email | Gmail SMTP |
| Reverse proxy / TLS | nginx + Caddy |
| Deployment | Docker Compose |

## ðŸš€ Deployment (Docker Compose)

### 1. Prerequisites

- A VM (tested on Azure) with Docker + Docker Compose installed
- Inbound ports **80** and **443** open on the VM's firewall/NSG (only these â€” the frontend and backend ports are not published to the host)
- A Supabase project with:
  - A **Storage bucket** (public) for PDF reports
  - **Authentication â†’ URL Configuration** set to your deployed URL (see step 4)
- A Gmail account with **2-Step Verification** enabled and an **App Password** generated for SMTP (a normal Gmail password will not work)

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in `backend/.env`:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase **service_role** key (needed for Storage upload) |
| `SUPABASE_BUCKET` | Storage bucket name (default: `pothole-reports`) |
| `SENDER_EMAIL` | Gmail address reports are sent from |
| `SENDER_APP_PASSWORD` | Gmail App Password â€” **paste it with no spaces** |
| `SMTP_HOST` / `SMTP_PORT` | Defaults are correct for Gmail |

Fill in `frontend/.env.local` with your Supabase project URL and anon key. The frontend does **not** need a backend URL configured â€” it talks to the backend via relative paths (`/api`, `/ws`), which work automatically on any domain/IP once deployed behind the reverse proxy.

### 3. Point Caddy at your domain

Edit `Caddyfile` and replace the hostname with your own domain, or with a free [nip.io](https://nip.io) address that maps straight to your VM's public IP (no domain purchase needed):

```
<your-vm-public-ip>.nip.io {
    reverse_proxy frontend:100
}
```

If your VM's public IP changes, update this file and run `docker compose up -d --build caddy`.

### 4. Update Supabase Auth settings

In **Supabase Dashboard â†’ Authentication â†’ URL Configuration**:

- **Site URL**: `https://<your-vm-public-ip>.nip.io`
- **Redirect URLs**: `https://<your-vm-public-ip>.nip.io/**`

### 5. Build and run

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Check that everything came up cleanly:

```bash
docker compose ps
docker logs -f caddy-nitin     # should show a certificate obtained successfully
docker logs -f back-nitin      # should show YOLO model loaded + Supabase/Email configured: True
```

Open `https://<your-vm-public-ip>.nip.io` in a browser.

## ðŸ“¡ Using an external IP camera (drone/dedicated camera)

The **"Start IP/USB Cam"** option pulls a stream directly from a camera's IP address, so the backend needs network-level reachability to that camera. On a cloud VM this generally means the camera and the VM must share a private network â€” a [Tailscale](https://tailscale.com) tailnet is a simple way to do this for a camera/drone you control:

```
http://<camera-tailscale-ip>:8080/video
```

This only really works for devices *you* control and add to your own tailnet â€” it isn't practical to ask every end user to join a VPN. For any regular user on their own device/network, use **"Use Device Camera"** instead: it captures the browser's camera directly (no VPN, no network setup, works over the public internet like any other website feature) and is the recommended option for a multi-user deployment.

## ðŸ©º Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Use Device Camera" doesn't open | Site isn't served over HTTPS. `getUserMedia` requires a secure context â€” check the padlock icon in the address bar. |
| Video upload fails / times out | Check `back-nitin` logs for a Gunicorn worker timeout; the Dockerfile sets `--timeout 600` for this reason. |
| `GET /api/v1/...` returns 404 | Check `nginx.conf`'s `/api/` `proxy_pass` has **no trailing slash** after the port â€” a trailing slash strips the `/api` prefix before it reaches the backend. |
| Email fails with `535 Username and Password not accepted` | The Gmail App Password is wrong/expired, or was pasted **with spaces**. Regenerate one at `myaccount.google.com/apppasswords` and paste it with no spaces. |
| PDF/email/Supabase never happen | These only run when a session actually **ends** with detected potholes and a valid user email â€” check that the WebSocket disconnect / upload actually completed, and check `back-nitin` logs for `[Report]`, `[Email]`, and `[Supabase]` lines. |
| Caddy container keeps restarting | Check `docker logs caddy-nitin` for a Caddyfile syntax error â€” validate the file matches the format shown in this README. |

## ðŸ“ Project structure

```
RoadGuardAI/
â”œâ”€â”€ backend/            FastAPI app, YOLO model, PDF/email/Supabase logic
â”‚   â”œâ”€â”€ main.py
â”‚   â”œâ”€â”€ requirements.txt
â”‚   â””â”€â”€ Dockerfile
â”œâ”€â”€ frontend/           Next.js app (static export)
â”‚   â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ nginx.conf      Reverse proxy for /api and /ws
â”‚   â””â”€â”€ dockerfile
â”œâ”€â”€ Caddyfile            Automatic HTTPS reverse proxy in front of everything
â””â”€â”€ docker-compose.yml
```

## ðŸ”’ Security notes

- Never commit `.env` / `.env.local` â€” they're already in `.gitignore`.
- Use the Supabase **service_role** key only on the backend â€” never ship it to the frontend.
- If credentials are ever pasted into a chat, ticket, or shared document, rotate them afterwards.

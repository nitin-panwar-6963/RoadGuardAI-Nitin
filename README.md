
Bhai, ye raha poora complete README.md raw copyable format mein. Aap direct isse copy karke apni README.md file mein paste kar sakte ho:

Markdown
# 🚧 RoadGuard AI
### AI-Powered Real-Time Road Condition Monitoring & Pothole Detection

RoadGuard AI is an AI-powered road monitoring system that detects potholes in real time using YOLOv11. It supports live IP/USB cameras, browser-based device cameras, and uploaded videos. The system analyzes road conditions, estimates pothole dimensions and maintenance costs, generates a PDF inspection report, stores the report in Supabase Storage, and delivers it to the authenticated user's email.

---

## ✨ Features

- 🤖 **Real-time Pothole Detection** using YOLOv11
- 📹 **Multiple Video Input Sources:**
  - IP/USB camera
  - Browser/device camera
  - Uploaded video
- 📐 **Pothole Detection and Dimension Estimation**
- 💰 **Automatic Maintenance Cost Estimation**
- 📄 **Automatic PDF Report Generation**
- ☁️ **Supabase Storage** for report storage
- 📧 **Automated Email Delivery** using Gmail SMTP
- 🗺️ **Interactive Pothole Map**
- 🔐 **Supabase Authentication** (Google / Email authentication support)
- 🌐 **HTTPS** using Caddy + Let's Encrypt
- ⚡ **FastAPI Backend** with WebSocket-based real-time communication
- 🔀 **Nginx Reverse Proxy** & 🐳 **Dockerized Deployment** via Docker Compose
- ☁️ **Cloud VM Deployment Support**

---

## 🏗️ Architecture

```text
┌─────────────────────┐
│       Browser       │
│    Device Camera    │
│    IP/USB Camera    │
│     Video Upload    │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐
│        Caddy        │
│ Reverse Proxy + TLS │
│    Let's Encrypt    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       Frontend      │
│    Next.js + React  │
│  Tailwind + Leaflet │
│        nginx        │
└──────────┬──────────┘
           │ /api + /ws
           ▼
┌─────────────────────┐
│       Backend       │
│  FastAPI + YOLOv11  │
│ OpenCV + WebSockets │
└──────────┬──────────┘
           │
  ┌────────┼────────┐
  │        │        │
  ▼        ▼        ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │  Gmail SMTP  │ │  PDF Report  │
│ Auth/Storage │ │     Email    │ │  ReportLab   │
└──────────────┘ └──────────────┘ └──────────────┘
🧠 How It Works
RoadGuard AI follows this end-to-end workflow:

Plaintext
Camera / Video Upload 
  └─► Video Frames 
        └─► OpenCV 
              └─► YOLOv11 
                    └─► Pothole Detection 
                          └─► Count + Dimensions 
                                └─► Maintenance Cost 
                                      └─► Session Report 
                                            └─► PDF Report 
                                                  └─► Supabase Storage 
                                                        └─► Report URL 
                                                              └─► Email to User
Step-by-Step
Input Selection: The user selects an IP/USB camera, browser device camera, or uploads a video.

Video Processing: The FastAPI backend receives and processes the video stream using OpenCV.

AI Detection: YOLOv11 analyzes video frames and detects potholes.

Result Collection: The system collects pothole count, dimensions, location/session information, and other detection results.

Cost Estimation: Based on the detected pothole information, the system calculates an estimated maintenance cost.

PDF Generation: A detailed session report is generated using ReportLab.

Cloud Storage: The generated PDF is uploaded to Supabase Storage.

Email Delivery: The report link/PDF is delivered to the authenticated user's email through Gmail SMTP.

Map Visualization: Session results can be displayed on an interactive Leaflet/OpenStreetMap map.

🛠️ Tech Stack
Layer	Technology
Frontend	Next.js, React, Tailwind CSS
Mapping	Leaflet, OpenStreetMap
Backend	FastAPI, Python
AI/ML	YOLOv11, Ultralytics
Computer Vision	OpenCV
Real-Time Communication	WebSockets
PDF Generation	ReportLab
Authentication	Supabase Auth
Database / Storage	Supabase Storage
Email	Gmail SMTP
Frontend Server	Nginx
Reverse Proxy	Caddy
TLS	Let's Encrypt
Containerization	Docker
Orchestration	Docker Compose
Deployment	Azure VM / Cloud VM
📁 Project Structure
Plaintext
RoadGuardAI/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── ...
│
├── frontend/
│   ├── app/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── ...
│
├── Caddyfile
├── docker-compose.yml
├── .gitignore
└── README.md
🚀 Deployment
Prerequisites
Linux VM / Cloud VM

Docker & Docker Compose

Public VM IP or Domain

Supabase Project

Gmail Account with 2-Step Verification & App Password

Open only these public ports:

80 → HTTP

443 → HTTPS

(The frontend and backend application ports do not need to be directly exposed to the internet.)

🔐 Environment Configuration
Create backend environment file:

Bash
cp backend/.env.example backend/.env
Create frontend environment file:

Bash
cp frontend/.env.example frontend/.env.local
Backend .env
Code snippet
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_service_role_key
SUPABASE_BUCKET=pothole-reports

SENDER_EMAIL=your_gmail@gmail.com
SENDER_APP_PASSWORD=your_gmail_app_password

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
Variable	Description
SUPABASE_URL	Supabase project URL
SUPABASE_KEY	Supabase service_role key
SUPABASE_BUCKET	Supabase Storage bucket name
SENDER_EMAIL	Gmail account used to send reports
SENDER_APP_PASSWORD	Gmail App Password
SMTP_HOST	Gmail SMTP host
SMTP_PORT	Gmail SMTP port
⚠️ Security Warning:

The Supabase service_role key must only be used on the backend. Never commit .env or .env.local to GitHub, nor put service keys in frontend code.

🌐 Caddy & Reverse Proxy Configuration
Example Caddyfile:
Plaintext
your-vm-public-ip.nip.io {
    reverse_proxy frontend:100
}
Caddy provides automatic HTTPS using Let's Encrypt.

Reverse Proxy Flow:
Plaintext
Internet
   │
   │ HTTPS :443
   ▼
┌─────────────┐
│    Caddy    │
│ TLS + Proxy │
└──────┬──────┘
       │
       │ frontend:100
       ▼
┌─────────────┐
│    nginx    │
│  Frontend   │
└──────┬──────┘
       │
       ├── /     ──► Next.js frontend
       ├── /api/ ──► FastAPI backend
       └── /ws/  ──► FastAPI WebSocket
       │
       ▼
┌─────────────┐
│   FastAPI   │
│   YOLOv11   │
└─────────────┘
🔑 Supabase Authentication
Go to: Supabase Dashboard ──► Authentication ──► URL Configuration

Set Site URL: https://your-vm-public-ip.nip.io

Add https://your-vm-public-ip.nip.io/** to the allowed redirect URLs.

🐳 Docker Compose Deployment
Bash
# Stop existing containers
docker compose down

# Build images
docker compose build --no-cache

# Start the application
docker compose up -d

# Check containers
docker compose ps
📋 Viewing Logs
Caddy: docker logs -f caddy-nitin

Backend: docker logs -f back-nitin

Frontend: docker logs -f front-nitin

📹 Camera & Input Configuration
1. Device Camera
Browsers access local cameras via navigator.mediaDevices.getUserMedia().

Supported devices: Laptop Camera, Phone Camera, Tablet Camera, USB Camera.

(Requires secure HTTPS connection in production).

2. IP / USB Camera
RoadGuard AI can process IP camera streams directly (e.g., http://<IP>:8080/video).

3. Remote Camera with Tailscale
When deployed on a cloud VM, connect the VM and camera over Tailscale VPN:

Plaintext
Camera ──► Tailscale ──► Cloud VM ──► RoadGuard Backend
4. Video Upload
Pre-recorded video files can be uploaded via Frontend to FastAPI for processing.

📄 PDF Report & Cloud Delivery
Monitoring Session ──► Generate PDF ──► Upload to Supabase Storage ──► Generate Report URL ──► Email to User

PDF reports are generated dynamically using ReportLab.

Reports contain session details, pothole counts, estimated dimensions, calculated repair costs, and location metadata.

Reports are stored in Supabase bucket (pothole-reports/) and emailed via Gmail SMTP.

🧪 Troubleshooting
Issue	Cause & Solution
Device Camera Does Not Open	Ensure site is running over HTTPS (https://domain.com). Browsers block camera access on unsecured HTTP.
Video Upload Fails / Times Out	Check docker logs -f back-nitin. Extend backend request timeouts for long video inference.
/api/v1/... Returns 404	Check frontend/nginx.conf. Ensure /api/ proxy preserves the /api prefix when forwarding to FastAPI.
Gmail SMTP 535 Error	Ensure 2-Step Verification is ON, use App Password (not normal password), and remove spaces from .env.
PDF / Email Not Triggered	Run docker logs -f back-nitin. Verify potholes were detected, session ended, and credentials are set.
Caddy Keeps Restarting	Run docker logs caddy-nitin. Check Caddyfile syntax and domain/IP host binding.
👨‍💻 Author
Nitin Panwar

B.Tech CSE Student | Cloud & DevOps Enthusiast

Skills & Interests: Cloud Computing, DevOps, Docker, Kubernetes, AWS, CI/CD, AI/ML Deployment, Python, FastAPI, Linux

GitHub: @nitin-panwar-6963

📜 License
This project is developed for educational, research, and demonstration purposes.

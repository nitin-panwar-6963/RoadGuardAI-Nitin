# 🚧 RoadGuard AI

### AI-Powered Real-Time Road Condition Monitoring & Pothole Detection

RoadGuard AI is an AI-powered road monitoring system that detects potholes in real time using YOLOv11. It supports live IP/USB cameras, browser-based device cameras, and uploaded videos. The system analyzes road conditions, estimates pothole dimensions and maintenance costs, generates a PDF inspection report, stores the report in Supabase Storage, and delivers it to the authenticated user's email.

---

## ✨ Features

* 🤖 **Real-time Pothole Detection** using YOLOv11
* 📹 **Multiple Video Input Sources**

  * IP/USB Camera
  * Browser/Device Camera
  * Uploaded Video
* 📐 **Pothole Detection and Dimension Estimation**
* 💰 **Automatic Maintenance Cost Estimation**
* 📄 **Automatic PDF Report Generation**
* ☁️ **Supabase Storage** for report storage
* 📧 **Automated Email Delivery** using Gmail SMTP
* 🗺️ **Interactive Pothole Map**
* 🔐 **Supabase Authentication**
* 🌐 **HTTPS** using Caddy + Let's Encrypt
* ⚡ **FastAPI Backend**
* 🔌 **WebSocket-based Real-Time Communication**
* 🔀 **Nginx Reverse Proxy**
* 🐳 **Dockerized Deployment**
* ☁️ **Cloud VM Deployment Support**
* 🔒 **Secure Backend Environment Configuration**
* 📡 **Remote Camera Support using Tailscale**

---

## 🏗️ Architecture

```text
┌─────────────────────────┐
│         Browser         │
│                         │
│  Device Camera          │
│  IP/USB Camera          │
│  Video Upload           │
└────────────┬────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────┐
│         Caddy           │
│                         │
│ Reverse Proxy + TLS     │
│ Let's Encrypt           │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│       Frontend          │
│                         │
│ Next.js + React         │
│ Tailwind CSS            │
│ Leaflet                 │
│ Nginx                   │
└────────────┬────────────┘
             │
             │ /api + /ws
             ▼
┌─────────────────────────┐
│        Backend          │
│                         │
│ FastAPI + Python        │
│ YOLOv11                 │
│ OpenCV                  │
│ WebSockets              │
└────────────┬────────────┘
             │
      ┌──────┼────────┐
      │      │        │
      ▼      ▼        ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Supabase │ │  Gmail   │ │ PDF Report   │
│          │ │  SMTP    │ │  ReportLab   │
│ Auth     │ │  Email   │ │              │
│ Storage  │ │          │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

---

# 🧠 How It Works

RoadGuard AI works as an end-to-end AI-powered road monitoring and reporting system.

The complete workflow is:

```text
Camera / Video Upload
        │
        ▼
Video Frames
        │
        ▼
OpenCV Video Processing
        │
        ▼
YOLOv11 AI Detection
        │
        ▼
Pothole Detection
        │
        ▼
Pothole Count + Dimensions
        │
        ▼
Maintenance Cost Estimation
        │
        ▼
Session Result
        │
        ▼
PDF Report Generation
        │
        ▼
Supabase Storage
        │
        ▼
Report URL
        │
        ▼
Email Delivery
```

## 🔄 Complete Working Process

### 1. Input Selection

The user can select one of multiple input sources:

* Browser/device camera
* IP camera
* USB camera
* Pre-recorded video upload

The browser camera requires a secure HTTPS connection in production.

---

### 2. Video Stream / Upload

The selected camera or uploaded video provides video frames to the RoadGuard AI backend.

For remote cameras, the camera can communicate with the cloud VM through Tailscale.

```text
Camera
   │
   ▼
Tailscale VPN
   │
   ▼
Cloud VM
   │
   ▼
RoadGuard Backend
```

---

### 3. Video Processing

The FastAPI backend receives the video stream and processes the frames using OpenCV.

OpenCV is responsible for handling video frames before sending them to the AI detection model.

```text
Video Stream
     │
     ▼
OpenCV
     │
     ▼
Individual Frames
```

---

### 4. AI-Based Pothole Detection

Each processed frame is analyzed using the YOLOv11 model.

YOLOv11 detects potholes from the road scene and identifies their locations within the frame.

```text
Frame
  │
  ▼
YOLOv11
  │
  ▼
Pothole Detection
  │
  ├── Pothole Location
  ├── Pothole Count
  └── Detection Information
```

---

### 5. Result Collection

The backend collects the detection results generated during the monitoring session.

The system records information such as:

* Number of detected potholes
* Estimated pothole dimensions
* Session information
* Location metadata
* Detection results

---

### 6. Maintenance Cost Estimation

Based on the detected pothole information, RoadGuard AI calculates an estimated maintenance/repair cost.

```text
Pothole Detection
       │
       ▼
Dimensions
       │
       ▼
Cost Calculation
       │
       ▼
Estimated Repair Cost
```

---

### 7. Session Report

After the monitoring session, the collected information is combined into a session report.

The report contains:

* Session details
* Pothole count
* Estimated dimensions
* Repair cost estimation
* Location metadata
* Detection information

---

### 8. PDF Generation

The session report is converted into a PDF using **ReportLab**.

```text
Session Data
     │
     ▼
ReportLab
     │
     ▼
PDF Inspection Report
```

---

### 9. Supabase Storage

The generated PDF is uploaded to the configured Supabase Storage bucket.

```text
PDF Report
    │
    ▼
Supabase Storage
    │
    ▼
pothole-reports/
```

---

### 10. Email Delivery

After the PDF is stored, the report URL is generated and delivered to the authenticated user's email using Gmail SMTP.

```text
PDF
 │
 ▼
Supabase Storage
 │
 ▼
Report URL
 │
 ▼
Gmail SMTP
 │
 ▼
User Email
```

---

### 11. Map Visualization

RoadGuard AI also provides interactive map visualization using Leaflet and OpenStreetMap.

Session/location information can be displayed on the interactive map.

```text
Detection Session
       │
       ▼
Location Metadata
       │
       ▼
Leaflet + OpenStreetMap
       │
       ▼
Interactive Pothole Map
```

---

## 🔁 End-to-End Example

```text
User opens RoadGuard AI
        │
        ▼
Selects Device/IP Camera
        │
        ▼
Camera sends video
        │
        ▼
FastAPI receives stream
        │
        ▼
OpenCV processes frames
        │
        ▼
YOLOv11 detects potholes
        │
        ▼
System counts potholes
        │
        ▼
Dimensions are estimated
        │
        ▼
Repair cost is estimated
        │
        ▼
Session is completed
        │
        ▼
PDF report is generated
        │
        ▼
PDF uploaded to Supabase
        │
        ▼
Report URL generated
        │
        ▼
Email sent using Gmail SMTP
        │
        ▼
User receives the report
```

---

## 🛠️ Tech Stack

| Layer                       | Technology                   |
| --------------------------- | ---------------------------- |
| **Frontend**                | Next.js, React, Tailwind CSS |
| **Mapping**                 | Leaflet, OpenStreetMap       |
| **Backend**                 | FastAPI, Python              |
| **AI/ML**                   | YOLOv11, Ultralytics         |
| **Computer Vision**         | OpenCV                       |
| **Real-Time Communication** | WebSockets                   |
| **PDF Generation**          | ReportLab                    |
| **Authentication**          | Supabase Auth                |
| **Storage**                 | Supabase Storage             |
| **Email**                   | Gmail SMTP                   |
| **Frontend Server**         | Nginx                        |
| **Reverse Proxy**           | Caddy                        |
| **TLS**                     | Let's Encrypt                |
| **Containerization**        | Docker                       |
| **Orchestration**           | Docker Compose               |
| **Remote Networking**       | Tailscale                    |
| **Deployment**              | Azure VM / Cloud VM          |

---

## 📁 Project Structure

```text
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
```

---

# 🚀 Deployment

## Prerequisites

Before deploying RoadGuard AI, make sure the following are available:

* Linux VM / Cloud VM
* Docker
* Docker Compose
* Public VM IP or Domain
* Supabase Project
* Gmail Account
* Gmail App Password
* Optional Tailscale setup for remote cameras

---

## 🌐 Public Ports

Only the following ports need to be publicly accessible:

```text
80   → HTTP
443  → HTTPS
```

The frontend and backend internal application ports do not need to be directly exposed to the internet when using Caddy and Docker networking.

---

# 🔐 Environment Configuration

## Backend Environment

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

## Frontend Environment

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env.local
```

---

## Backend `.env`

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_service_role_key
SUPABASE_BUCKET=pothole-reports

SENDER_EMAIL=your_gmail@gmail.com
SENDER_APP_PASSWORD=your_gmail_app_password

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

---

## Environment Variables

| Variable              | Description                        |
| --------------------- | ---------------------------------- |
| `SUPABASE_URL`        | Supabase project URL               |
| `SUPABASE_KEY`        | Supabase service_role key          |
| `SUPABASE_BUCKET`     | Supabase Storage bucket name       |
| `SENDER_EMAIL`        | Gmail account used to send reports |
| `SENDER_APP_PASSWORD` | Gmail App Password                 |
| `SMTP_HOST`           | Gmail SMTP host                    |
| `SMTP_PORT`           | Gmail SMTP port                    |

> ⚠️ **Security Warning:**
> The Supabase `service_role` key must only be used on the backend. Never commit `.env` or `.env.local` to GitHub. Never expose service keys in frontend code.

---

# 🌐 Caddy & Reverse Proxy

## Example `Caddyfile`

```text
your-vm-public-ip.nip.io {
    reverse_proxy frontend:100
}
```

Caddy handles:

* HTTPS
* TLS certificates
* Reverse proxying
* Let's Encrypt certificate management

---

## Reverse Proxy Flow

```text
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
│    Nginx    │
│  Frontend   │
└──────┬──────┘
       │
       ├── /     ──► Next.js Frontend
       │
       ├── /api/ ──► FastAPI Backend
       │
       └── /ws/  ──► FastAPI WebSocket
                         │
                         ▼
                   ┌──────────┐
                   │ YOLOv11  │
                   └──────────┘
```

---

# 🔑 Supabase Authentication

Go to:

**Supabase Dashboard → Authentication → URL Configuration**

Set the Site URL:

```text
https://your-vm-public-ip.nip.io
```

Add the allowed redirect URL:

```text
https://your-vm-public-ip.nip.io/**
```

---

# 🐳 Docker Compose Deployment

## Stop Existing Containers

```bash
docker compose down
```

## Build Images

```bash
docker compose build --no-cache
```

## Start Application

```bash
docker compose up -d
```

## Check Containers

```bash
docker compose ps
```

---

# 📋 Viewing Logs

## Caddy

```bash
docker logs -f caddy-nitin
```

## Backend

```bash
docker logs -f back-nitin
```

## Frontend

```bash
docker logs -f front-nitin
```

---

# 📹 Camera & Input Configuration

## 1. Device Camera

Browsers access local cameras using:

```javascript
navigator.mediaDevices.getUserMedia()
```

Supported devices include:

* Laptop Camera
* Phone Camera
* Tablet Camera
* USB Camera

> Device camera access requires HTTPS in production.

---

## 2. IP / USB Camera

RoadGuard AI can process IP camera streams directly.

Example:

```text
http://<IP>:8080/video
```

---

## 3. Remote Camera with Tailscale

For a cloud deployment, the VM and remote camera can communicate using Tailscale.

```text
Camera
   │
   ▼
Tailscale VPN
   │
   ▼
Cloud VM
   │
   ▼
RoadGuard Backend
```

This allows the backend to access a remote camera without directly exposing the camera to the public internet.

---

## 4. Video Upload

Users can upload pre-recorded videos through the frontend.

The frontend sends the uploaded video to the FastAPI backend for processing.

```text
Video Upload
     │
     ▼
Frontend
     │
     ▼
FastAPI
     │
     ▼
OpenCV
     │
     ▼
YOLOv11
```

---

# 📄 PDF Report & Cloud Delivery

```text
Monitoring Session
        │
        ▼
Generate PDF
        │
        ▼
Upload to Supabase Storage
        │
        ▼
Generate Report URL
        │
        ▼
Email to User
```

PDF reports are generated dynamically using **ReportLab**.

Reports contain:

* Session details
* Pothole count
* Estimated dimensions
* Calculated repair costs
* Location metadata
* Detection information

Reports are stored in:

```text
pothole-reports/
```

and delivered using **Gmail SMTP**.

---

# 🧪 Troubleshooting

| Issue                              | Cause & Solution                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Device Camera Does Not Open**    | Ensure the website is running over HTTPS. Browsers block camera access on unsecured HTTP.                      |
| **Video Upload Fails / Times Out** | Check `docker logs -f back-nitin` and increase backend request timeout for long video processing.              |
| **/api/v1/... Returns 404**        | Check `frontend/nginx.conf` and ensure `/api/` is correctly proxied to FastAPI.                                |
| **Gmail SMTP 535 Error**           | Enable 2-Step Verification and use a Gmail App Password instead of the normal Gmail password.                  |
| **PDF / Email Not Triggered**      | Check backend logs, verify that the session completed and Gmail/Supabase credentials are configured correctly. |
| **Caddy Keeps Restarting**         | Run `docker logs caddy-nitin` and check the Caddyfile syntax and domain configuration.                         |
| **Camera Not Reachable from VM**   | Check Tailscale connectivity and verify that the camera IP/port is reachable from the VM.                      |

---

# 👨‍💻 Author

## Nitin Panwar

**B.Tech CSE Student | Cloud & DevOps Enthusiast**

### Skills & Interests

* Cloud Computing
* DevOps
* Docker
* Kubernetes
* AWS
* CI/CD
* AI/ML Deployment
* Python
* FastAPI
* Linux
* Networking
* Git & GitHub

### GitHub

https://github.com/nitin-panwar-6963

---

# 📜 License

This project is developed for educational, research, and demonstration purposes.

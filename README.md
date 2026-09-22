# 🚧 RoadGuard AI
> **AI-Powered Real-Time Road Condition Monitoring & Pothole Detection**

RoadGuard AI is an AI-powered road monitoring system that detects potholes in real time using **YOLOv11**. It supports live IP/USB cameras, browser-based device cameras, and uploaded videos. The system analyzes road conditions, estimates pothole dimensions and maintenance costs, generates a PDF inspection report, stores the report in Supabase Storage, and delivers it to the authenticated user's email.

---

## ✨ Features

- 🤖 **Real-time Pothole Detection:** Powered by YOLOv11 for high precision identification.
- 📹 **Multiple Video Inputs:** IP/USB camera, Browser/device camera, or uploaded video files.
- 📐 **Dimension & Cost Estimation:** Automatic calculation of pothole size metrics and estimated maintenance budget.
- 📄 **Automatic PDF Reports:** Dynamic session-wise report generation using ReportLab.
- ☁️ **Cloud Storage:** Secure report backup and URL generation via Supabase Storage.
- 📧 **Automated Email Delivery:** Instant report delivery to authenticated users using Gmail SMTP.
- 🗺️ **Interactive Pothole Map:** Geographic mapping of detected potholes using Leaflet and OpenStreetMap.
- 🔐 **Authentication:** Supabase Auth supporting Email and Google login.
- 🌐 **HTTPS & Security:** Automated TLS/SSL certificates using Caddy and Let's Encrypt.
- 🐳 **Containerized Deployment:** Orchestrated using Docker, Docker Compose, and Nginx.

---

## 🏗️ Architecture

```text
┌─────────────────────┐
│       Browser       │
│  Device Camera      │
│  IP/USB Camera      │
│  Video Upload       │
└──────────┬──────────┘
           │
         HTTPS
           │
           ▼
┌─────────────────────┐
│       Caddy         │
│ Reverse Proxy + TLS │
│    Let's Encrypt    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       Frontend      │
│ Next.js + React     │
│ Tailwind + Leaflet  │
│       nginx         │
└──────────┬──────────┘
           │
     /api + /ws
           │
           ▼
┌─────────────────────┐
│       Backend       │
│ FastAPI + YOLOv11   │
│ OpenCV + WebSockets │
└──────────┬──────────┘
           │
 ┌─────────┼─────────┐
 │         │         │
 ▼         ▼         ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│   Supabase   │   │ Gmail SMTP   │  │ PDF Report   │
│ Auth/Storage │   │    Email     │  │  ReportLab   │
└──────────────┘   └──────────────┘  └──────────────┘

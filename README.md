🚧 RoadGuard AI
AI-Powered Real-Time Road Condition Monitoring & Pothole Detection
RoadGuard AI is an AI-powered road monitoring system that detects potholes in real time using YOLOv11.
It supports live IP/USB cameras, browser-based device cameras, and uploaded videos. The system analyzes road conditions, estimates pothole dimensions and maintenance costs, generates a PDF inspection report, stores the report in Supabase Storage, and delivers it to the authenticated user's email.
✨ Features
🤖 Real-time pothole detection using YOLOv11
📹 Multiple video input sources
IP/USB camera
Browser/device camera
Uploaded video
📐 Pothole detection and dimension estimation
💰 Automatic maintenance cost estimation
📄 Automatic PDF report generation
☁️ Supabase Storage for report storage
📧 Automated email delivery using Gmail SMTP
🗺️ Interactive pothole map
🔐 Supabase Authentication
🔑 Google/Email authentication support
🌐 HTTPS using Caddy + Let's Encrypt
⚡ FastAPI backend
🔄 WebSocket-based real-time communication
🔀 nginx reverse proxy
🐳 Dockerized deployment
🚀 Docker Compose deployment
☁️ Cloud VM deployment support
🏗️ Architecture
┌─────────────────────┐
                         │       Browser       │
                         │                     │
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
                         │      Frontend       │
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
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 ▼                 ▼
          ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
          │   Supabase   │   │ Gmail SMTP   │  │ PDF Report   │
          │ Auth/Storage │   │    Email     │  │  ReportLab   │
          └──────────────┘   └──────────────┘  └──────────────┘
🧠 How It Works
RoadGuard AI follows this workflow:
Camera / Video Upload
          ↓
     Video Frames
          ↓
        OpenCV
          ↓
       YOLOv11
          ↓
   Pothole Detection
          ↓
 Count + Dimensions
          ↓
 Maintenance Cost
          ↓
    Session Report
          ↓
      PDF Report
          ↓
   Supabase Storage
          ↓
     Report URL
          ↓
     Email to User
Step-by-Step
Input Selection
The user selects an IP/USB camera, browser device camera, or uploads a video.
Video Processing
The FastAPI backend receives/processes the video stream using OpenCV.
AI Detection
YOLOv11 analyzes video frames and detects potholes.
Result Collection
The system collects pothole count, dimensions, location/session information, and other detection results.
Cost Estimation
Based on the detected pothole information, the system calculates an estimated maintenance cost.
PDF Generation
A detailed session report is generated using ReportLab.
Cloud Storage
The generated PDF is uploaded to Supabase Storage.
Email Delivery
The report link/PDF is delivered to the authenticated user's email through Gmail SMTP.
Map Visualization
Session results can be displayed on an interactive Leaflet/OpenStreetMap map.
🛠️ Tech Stack
Layer
Technology
Frontend
Next.js, React, Tailwind CSS
Mapping
Leaflet, OpenStreetMap
Backend
FastAPI, Python
AI/ML
YOLOv11, Ultralytics
Computer Vision
OpenCV
Real-Time Communication
WebSockets
PDF Generation
ReportLab
Authentication
Supabase Auth
Database / Storage
Supabase
Email
Gmail SMTP
Frontend Server
nginx
Reverse Proxy
Caddy
TLS
Let's Encrypt
Containerization
Docker
Orchestration
Docker Compose
Deployment
Azure VM / Cloud VM
📁 Project Structure
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
Docker
Docker Compose
Public VM IP or domain
Supabase project
Gmail account
Gmail 2-Step Verification
Gmail App Password
Open only these public ports:
80   → HTTP
443  → HTTPS
The frontend and backend application ports do not need to be directly exposed to the internet.
🔐 Environment Configuration
Create the backend environment file:
cp backend/.env.example backend/.env
Create the frontend environment file:
cp frontend/.env.example frontend/.env.local
Backend .env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_service_role_key
SUPABASE_BUCKET=pothole-reports

SENDER_EMAIL=your_gmail@gmail.com
SENDER_APP_PASSWORD=your_gmail_app_password

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
Variable
Description
SUPABASE_URL
Supabase project URL
SUPABASE_KEY
Supabase service_role key
SUPABASE_BUCKET
Supabase Storage bucket name
SENDER_EMAIL
Gmail account used to send reports
SENDER_APP_PASSWORD
Gmail App Password
SMTP_HOST
Gmail SMTP host
SMTP_PORT
Gmail SMTP port
⚠️ Security
The Supabase service_role key must only be used on the backend.
Never:
❌ Commit it to GitHub
❌ Put it in frontend environment variables
❌ Expose it in browser code
❌ Share it publicly
Never commit:
.env
.env.local
🌐 Caddy Configuration
Example Caddyfile:
your-vm-public-ip.nip.io {
    reverse_proxy frontend:100
}
Caddy provides automatic HTTPS using Let's Encrypt.
🔑 Supabase Authentication
Go to:
Supabase Dashboard
        ↓
Authentication
        ↓
URL Configuration
Set:
Site URL:
https://your-vm-public-ip.nip.io
Add:
https://your-vm-public-ip.nip.io/**
to the allowed redirect URLs.
🐳 Docker Compose Deployment
Stop existing containers:
docker compose down
Build the images:
docker compose build --no-cache
Start the application:
docker compose up -d
Check containers:
docker compose ps
📋 Logs
Caddy
docker logs -f caddy-nitin
Backend
docker logs -f back-nitin
Frontend
docker logs -f front-nitin
🌍 Access the Application
Open:
https://your-vm-public-ip.nip.io
🔀 Reverse Proxy Flow
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
       ├── /              → Next.js frontend
       ├── /api/*         → FastAPI backend
       └── /ws/*          → FastAPI WebSocket
                                │
                                ▼
                         ┌─────────────┐
                         │   FastAPI   │
                         │   YOLOv11   │
                         └─────────────┘
The backend does not need a public host port.
📹 Camera Support
Device Camera
The browser accesses the camera using:
navigator.mediaDevices.getUserMedia()
Supported devices include:
Laptop Camera
Phone Camera
Tablet Camera
USB Camera
No VPN configuration is required.
🔒 HTTPS Requirement
Browser camera access requires a secure context.
Production:
https://your-domain.com
Local development:
http://localhost
Caddy provides HTTPS for production deployments.
📡 IP / USB Camera
RoadGuard AI can process an IP camera stream.
Example:
http://<camera-ip>:8080/video
A phone running an IP Webcam application can also provide an MJPEG/HTTP stream.
🌐 Remote Camera with Tailscale
When the backend is deployed on a cloud VM, the VM needs network access to the IP camera.
Camera
   │
   │ Tailscale
   ▼
Cloud VM
   │
   ▼
RoadGuard Backend
Example:
http://<camera-tailscale-ip>:8080/video
For regular users, the Device Camera option is simpler because users do not need VPN configuration.
🎥 Video Upload
Users can upload pre-recorded videos.
Video File
    ↓
Frontend
    ↓
FastAPI
    ↓
OpenCV
    ↓
YOLOv11
    ↓
Pothole Detection
    ↓
Report Generation
📄 PDF Report
RoadGuard AI generates a PDF report after a completed monitoring session.
The report can contain:
RoadGuard AI Report
────────────────────────

Session Information
Pothole Count
Pothole Dimensions
Estimated Maintenance Cost
Location Information
Detection Results

────────────────────────

Generated by RoadGuard AI
PDF reports are generated using ReportLab.
☁️ Supabase Storage
Generated PDF reports are uploaded to Supabase Storage.
Example:
Supabase
   │
   └── pothole-reports/
          │
          ├── report-session-001.pdf
          ├── report-session-002.pdf
          └── report-session-003.pdf
📧 Email Delivery
Monitoring Session
       ↓
Generate PDF
       ↓
Upload to Supabase
       ↓
Generate Report URL
       ↓
Send Email
The report is sent to the authenticated user's email using Gmail SMTP.
🔑 Gmail App Password
Gmail SMTP requires an App Password.
Google Account
      ↓
Enable 2-Step Verification
      ↓
Generate App Password
      ↓
Add App Password to backend/.env
Do not use your normal Gmail password.
🗺️ Interactive Pothole Map
RoadGuard AI provides an interactive map for detected pothole locations.
Technologies:
Leaflet
   +
OpenStreetMap
   +
Reverse Geocoding
🔐 Authentication
RoadGuard AI uses Supabase Authentication.
Supported methods can include:
Email Authentication
Google Authentication
The authenticated user's email is used for report delivery.
An optional SQL policy can be configured to restrict registration to a specific email domain.
🧪 Troubleshooting
Device Camera Does Not Open
Make sure the website is running over HTTPS:
https://your-domain.com
Check the browser address bar for the secure connection indicator.
Video Upload Fails or Times Out
Check:
docker logs -f back-nitin
Video processing can take longer than normal API requests, so the backend uses an extended timeout.
/api/v1/... Returns 404
Check:
frontend/nginx.conf
Make sure the /api/ proxy configuration preserves the /api prefix when forwarding requests to FastAPI.
Gmail Error
If you see:
535 Username and Password not accepted
Check:
✓ 2-Step Verification enabled
✓ App Password generated
✓ Correct Gmail address
✓ Correct App Password
✓ No spaces accidentally added
PDF / Email / Supabase Report Not Generated
Check:
docker logs -f back-nitin
Verify:
✓ Potholes were detected
✓ Session completed successfully
✓ User email is available
✓ Supabase credentials are correct
✓ Gmail credentials are correct
Caddy Container Keeps Restarting
Check:
docker logs caddy-nitin
Verify the Caddyfile hostname and syntax.
📊 Complete System Flow
USER
                         │
                         ▼
                  HTTPS Request
                         │
                         ▼
                  ┌─────────────┐
                  │    Caddy    │
                  │ TLS / Proxy │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    nginx    │
                  │  Next.js    │
                  └──────┬──────┘
                         │
                    /api + /ws
                         │
                         ▼
                  ┌─────────────┐
                  │   FastAPI   │
                  │   Backend   │
                  └──────┬──────┘
                         │
                       YOLOv11
                         │
                         ▼
                  Pothole Detection
                         │
                         ▼
                   Session Results
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
        PDF Report   Supabase    Gmail SMTP
                        Storage
             │           │           │
             └───────────┴───────────┘
                         │
                         ▼
                    User Report
🎯 Project Highlights
RoadGuard AI demonstrates practical implementation of:
Artificial Intelligence
Computer Vision
YOLOv11 Object Detection
Real-Time Video Processing
FastAPI
WebSockets
Next.js
React
Supabase
Cloud Storage
SMTP Email Automation
PDF Generation
nginx
Caddy
HTTPS / TLS
Docker
Docker Compose
Cloud VM Deployment
Reverse Proxy Architecture
Secure Environment Configuration
🔮 Future Improvements
📍 GPS-based pothole tracking
📊 Admin analytics dashboard
📈 Historical road-condition analysis
🧠 Pothole severity classification
🚗 Vehicle-mounted camera integration
☁️ Cloud-based inference scaling
🔔 Real-time severe pothole alerts
🗃️ Location-based road-condition history
📱 Dedicated mobile application
🤖 Automated municipal maintenance workflow
👨‍💻 Author
Nitin Panwar
B.Tech CSE Student | Cloud & DevOps Enthusiast
Skills & Interests
Cloud Computing
DevOps
Docker
Kubernetes
AWS
CI/CD
AI/ML Deployment
Python
FastAPI
Linux
⭐ RoadGuard AI
AI-powered real-time pothole detection and road-condition monitoring.
Built with:
YOLOv11
FastAPI
Next.js
React
Supabase
Docker
Docker Compose
nginx
Caddy
OpenCV
ReportLab
Gmail SMTP
Leaflet
OpenStreetMap
📜 License
This project is developed for educational, research, and demonstration purposes.

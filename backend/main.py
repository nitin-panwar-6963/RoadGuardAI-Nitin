import traceback
import cv2
import numpy as np
import os
import shutil
import uuid
import base64
import asyncio
import threading
import smtplib
import json
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage

load_dotenv()

app = FastAPI(title="RoadGuard AI Backend", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading YOLOv11 Model...", flush=True)
model = YOLO("pothole_best.pt")

os.makedirs("temp_uploads", exist_ok=True)

DRONE_IP_CAM_URL = "http://192.168.1.2:8080/video"

# ---------------------------------------------------------------------------
# MAINTENANCE COST ESTIMATION CONFIG
# ---------------------------------------------------------------------------
CM_PER_PIXEL = 0.4
MIN_DEPTH_CM = 3.0
MAX_DEPTH_CM = 25.0
COST_PER_CUBIC_METER_INR = 650
FIXED_LABOR_COST_INR = 150


def estimate_pothole_dimensions(x1: float, y1: float, x2: float, y2: float, conf: float):
    width_px = max(1.0, x2 - x1)
    breadth_px = max(1.0, y2 - y1)
    width_cm = round(width_px * CM_PER_PIXEL, 1)
    breadth_cm = round(breadth_px * CM_PER_PIXEL, 1)
    area_px = width_px * breadth_px
    depth_cm = 3.0 + (conf ** 2) * 15.0 + (area_px / 6000.0)
    depth_cm = round(min(MAX_DEPTH_CM, max(MIN_DEPTH_CM, depth_cm)), 1)
    return width_cm, breadth_cm, depth_cm


def calculate_maintenance_cost(width_cm: float, breadth_cm: float, depth_cm: float):
    volume_m3 = (width_cm / 100.0) * (breadth_cm / 100.0) * (depth_cm / 100.0)
    material_cost = volume_m3 * COST_PER_CUBIC_METER_INR
    total_cost = round(FIXED_LABOR_COST_INR + material_cost)
    return total_cost, round(volume_m3, 5)


# ---------------------------------------------------------------------------
# SESSION REPORT (PDF) + SUPABASE STORAGE + EMAIL CONFIG
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "pothole-reports")

SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_APP_PASSWORD = os.getenv("SENDER_APP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

CAPTURES_DIR = "session_captures"
REPORTS_DIR = "session_reports"
os.makedirs(CAPTURES_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# Unifying Report Status tracking
report_status = {}

def _status_file_path(session_id: str) -> str:
    return os.path.join(REPORTS_DIR, f"{session_id}.status.json")

def write_report_status(session_id: str, data: dict):
    report_status[session_id] = data
    try:
        with open(_status_file_path(session_id), "w") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"[Report] failed to persist status file for {session_id}: {e}", flush=True)

def read_report_status(session_id: str):
    path = _status_file_path(session_id)
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception as e:
            print(f"[Report] failed to read status file for {session_id}: {e}", flush=True)
    return report_status.get(session_id)


supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Supabase] client init failed: {e}", flush=True)
else:
    print("[Supabase] SUPABASE_URL/SUPABASE_KEY not set in .env — PDF upload to cloud will be skipped.", flush=True)

print(
    f"[Config] Supabase configured: {bool(supabase_client)} | "
    f"Email configured: {bool(SENDER_EMAIL and SENDER_APP_PASSWORD)} | "
    f"SUPABASE_BUCKET={SUPABASE_BUCKET}",
    flush=True,
)


def save_pothole_context_crop(session_id: str, pothole_id, frame, x1, y1, x2, y2, margin_ratio: float = 0.6, min_margin_px: int = 30, max_width: int = 640):
    try:
        h, w = frame.shape[:2]
        bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
        pad_x = max(bw * margin_ratio, min_margin_px)
        pad_y = max(bh * margin_ratio, min_margin_px)

        cx1 = max(0, int(x1 - pad_x))
        cy1 = max(0, int(y1 - pad_y))
        cx2 = min(w, int(x2 + pad_x))
        cy2 = min(h, int(y2 + pad_y))
        if cx2 <= cx1 or cy2 <= cy1:
            return None

        crop = frame[cy1:cy2, cx1:cx2].copy()
        box_x1, box_y1 = int(x1 - cx1), int(y1 - cy1)
        box_x2, box_y2 = int(x2 - cx1), int(y2 - cy1)
        cv2.rectangle(crop, (box_x1, box_y1), (box_x2, box_y2), (0, 0, 255), 3)

        ch, cw = crop.shape[:2]
        if cw > max_width:
            scale = max_width / cw
            crop = cv2.resize(crop, (max_width, int(ch * scale)))

        session_dir = os.path.join(CAPTURES_DIR, str(session_id))
        os.makedirs(session_dir, exist_ok=True)
        crop_path = os.path.join(session_dir, f"{pothole_id}.jpg")
        cv2.imwrite(crop_path, crop, [cv2.IMWRITE_JPEG_QUALITY, 88])
        return crop_path
    except Exception as e:
        print(f"[Capture] failed to save context crop for pothole {pothole_id}: {e}", flush=True)
        return None


def build_pdf_report(session_id: str, pothole_list: list, source: str = "Live Drone Stream"):
    pdf_path = os.path.join(REPORTS_DIR, f"{session_id}.pdf")
    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
        leftMargin=1.4 * cm, rightMargin=1.4 * cm,
    )

    ACCENT = colors.HexColor("#19e68c")
    DARK = colors.HexColor("#0b1a14")
    TEXT_DARK = colors.HexColor("#0f172a")
    MUTED = colors.HexColor("#64748b")
    BORDER = colors.HexColor("#e2e8f0")
    CARD_BG = colors.HexColor("#f8fafc")
    CRITICAL = colors.HexColor("#ff5252")
    HIGH = colors.HexColor("#ffb000")
    MEDIUM = colors.HexColor("#eab308")

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("BrandTitle", parent=styles["Title"], textColor=colors.white, fontSize=20, leading=24, spaceAfter=2)
    subtitle_style = ParagraphStyle("BrandSubtitle", parent=styles["Normal"], textColor=ACCENT, fontSize=10, leading=13)
    section_style = ParagraphStyle("Section", parent=styles["Heading2"], textColor=TEXT_DARK, fontSize=13, spaceBefore=6, spaceAfter=6)
    label_style = ParagraphStyle("StatLabel", parent=styles["Normal"], textColor=MUTED, fontSize=8.5)
    value_style = ParagraphStyle("StatValue", parent=styles["Normal"], textColor=TEXT_DARK, fontSize=16, leading=19, fontName="Helvetica-Bold")
    detail_style = ParagraphStyle("Detail", parent=styles["Normal"], textColor=TEXT_DARK, fontSize=9.5, leading=15)
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], textColor=MUTED, fontSize=8, alignment=1)

    story = []
    total_cost = sum(p.get("cost", 0) for p in pothole_list)

    def severity_for(conf):
        if conf is None: return "MEDIUM", MEDIUM
        if conf >= 0.85: return "CRITICAL", CRITICAL
        if conf >= 0.75: return "HIGH", HIGH
        return "MEDIUM", MEDIUM

    header_table = Table(
        [[Paragraph("🛣  RoadGuard AI", title_style),
          Paragraph(datetime.now().strftime("%d %b %Y, %I:%M %p"), subtitle_style)]],
        colWidths=[13 * cm, 5.5 * cm],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (0, 0), 16),
        ("RIGHTPADDING", (1, 0), (1, 0), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)

    subheader_table = Table(
        [[Paragraph(f"Pothole Maintenance Report &nbsp;•&nbsp; Session {session_id} &nbsp;•&nbsp; {source}", subtitle_style)]],
        colWidths=[18.5 * cm],
    )
    subheader_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
    ]))
    story.append(subheader_table)
    story.append(Spacer(1, 16))

    stats_table = Table(
        [[
            Table([[Paragraph("TOTAL POTHOLES", label_style)], [Paragraph(str(len(pothole_list)), value_style)]], colWidths=[5.8 * cm]),
            Table([[Paragraph("TOTAL MAINTENANCE COST", label_style)], [Paragraph(f"Rs. {total_cost:,}", value_style)]], colWidths=[5.8 * cm]),
            Table([[Paragraph("REPORT SOURCE", label_style)], [Paragraph(source, detail_style)]], colWidths=[5.8 * cm]),
        ]],
        colWidths=[6.17 * cm, 6.17 * cm, 6.17 * cm],
    )
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
        ("BOX", (0, 0), (0, 0), 0.75, BORDER),
        ("BOX", (1, 0), (1, 0), 0.75, BORDER),
        ("BOX", (2, 0), (2, 0), 0.75, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("LINEBELOW", (0, 0), (-1, -1), 3, ACCENT),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 22))

    story.append(Paragraph("Detected Potholes", section_style))
    story.append(Spacer(1, 4))

    if not pothole_list:
        story.append(Paragraph("No potholes were detected in this session.", detail_style))

    for p in pothole_list:
        image_path = p.get("image_path")
        cell_image = None
        if image_path and os.path.exists(image_path):
            try:
                from PIL import Image as PILImage
                with PILImage.open(image_path) as im:
                    iw, ih = im.size
                target_w = 5.2 * cm
                target_h = target_w * (ih / iw)
                max_h = 4.0 * cm
                if target_h > max_h:
                    target_h = max_h
                    target_w = target_h * (iw / ih)
                cell_image = RLImage(image_path, width=target_w, height=target_h)
            except Exception:
                cell_image = RLImage(image_path, width=5.2 * cm, height=3.5 * cm)
        if cell_image is None:
            cell_image = Paragraph("No Image<br/>Captured", detail_style)

        sev_label, sev_color = severity_for(p.get("confidence"))
        conf_pct = f"{p.get('confidence', 0) * 100:.1f}%" if p.get("confidence") is not None else "N/A"

        badge = Table([[Paragraph(f"<font color='white'><b>{sev_label}</b></font>", ParagraphStyle("Badge", fontSize=7.5, alignment=1))]], colWidths=[2.2 * cm])
        badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), sev_color), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))

        detail = Paragraph(
            f"<b>Pothole&nbsp;#{p.get('id')}</b> &nbsp;·&nbsp; Confidence {conf_pct}<br/>"
            f"<font color='#64748b'>Width</font> {p.get('width_cm', 'N/A')} cm &nbsp;&nbsp;"
            f"<font color='#64748b'>Breadth</font> {p.get('breadth_cm', 'N/A')} cm &nbsp;&nbsp;"
            f"<font color='#64748b'>Depth</font> {p.get('depth_cm', 'N/A')} cm<br/>"
            f"<font color='#0f8a56'><b>Maintenance Cost: Rs. {p.get('cost', 0)}</b></font>",
            detail_style,
        )

        inner = Table([[badge, ""]], colWidths=[2.3 * cm, 0.1 * cm])
        inner.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0)]))

        row_table = Table([[cell_image, [inner, Spacer(1, 4), detail]]], colWidths=[5.6 * cm, 12.2 * cm])
        row_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LEFTPADDING", (0, 0), (0, -1), 10),
            ("LEFTPADDING", (1, 0), (1, -1), 12),
            ("LINEBEFORE", (0, 0), (0, -1), 3, sev_color),
        ]))
        story.append(row_table)
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Generated automatically by RoadGuard AI — Pothole Detection & Maintenance Costing", footer_style))

    doc.build(story)
    return pdf_path, total_cost


def upload_pdf_to_supabase(pdf_path: str, session_id: str):
    if not supabase_client:
        print(f"[Supabase] Skipping upload for {session_id} — client not configured.", flush=True)
        return None
    remote_path = f"{session_id}.pdf"
    try:
        with open(pdf_path, "rb") as f:
            data = f.read()
        supabase_client.storage.from_(SUPABASE_BUCKET).upload(
            remote_path,
            data,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        public_url = supabase_client.storage.from_(SUPABASE_BUCKET).get_public_url(remote_path)
        print(f"[Supabase] PDF uploaded successfully -> bucket={SUPABASE_BUCKET} path={remote_path} url={public_url}", flush=True)
        return public_url
    except Exception as e:
        print(f"[Supabase] upload failed for {session_id}: {e}", flush=True)
        return None


def send_report_email(pdf_path: str, session_id: str, total_cost, pothole_count: int, receiver_email: str, pdf_url: str = None):
    if not (SENDER_EMAIL and SENDER_APP_PASSWORD and receiver_email):
        print(f"[Email] Skipping: Sender({bool(SENDER_EMAIL)}) AppPass({bool(SENDER_APP_PASSWORD)}) Receiver({bool(receiver_email)})", flush=True)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SENDER_EMAIL
        msg["To"] = receiver_email
        msg["Subject"] = f"RoadGuard AI Report — {pothole_count} potholes, Rs. {total_cost}"

        text_body = (
            f"New pothole detection session completed.\n\n"
            f"Session ID: {session_id}\n"
            f"Total Potholes Detected: {pothole_count}\n"
            f"Total Estimated Maintenance Cost: Rs. {total_cost}\n"
        )
        if pdf_url:
            text_body += f"\nCloud copy (Supabase): {pdf_url}\n"
        msg.attach(MIMEText(text_body, "plain", "utf-8"))

        cta_button = (
            f'<a href="{pdf_url}" target="_blank" '
            f'style="display:inline-block;padding:12px 22px;background-color:#19e68c;'
            f'color:#03120b;font-weight:700;text-decoration:none;border-radius:8px;'
            f'font-family:Arial,Helvetica,sans-serif;font-size:14px;">Open PDF Report ↗</a>'
            if pdf_url else
            '<p style="color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:13px;">'
            'Cloud storage not configured — PDF attached to this email only.</p>'
        )

        html_body = f"""\
<html>
  <head><meta charset="utf-8"/></head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0"
                 style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0b1a14;padding:24px 28px;">
                <span style="color:#19e68c;font-size:20px;font-weight:700;">🛣 RoadGuard AI</span><br/>
                <span style="color:#9fb0a8;font-size:12.5px;">Pothole Maintenance Report</span>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 10px 28px;">
                <p style="color:#0f172a;font-size:14px;line-height:1.6;margin:0 0 18px 0;">
                  A pothole detection session has just completed. Summary below:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                               padding:14px 18px;width:48%;">
                      <span style="display:block;color:#64748b;font-size:11px;letter-spacing:.04em;">TOTAL POTHOLES</span>
                      <span style="display:block;color:#0f172a;font-size:22px;font-weight:700;">{pothole_count}</span>
                    </td>
                    <td style="width:4%;"></td>
                    <td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                               padding:14px 18px;width:48%;">
                      <span style="display:block;color:#64748b;font-size:11px;letter-spacing:.04em;">MAINTENANCE COST</span>
                      <span style="display:block;color:#0f8a56;font-size:22px;font-weight:700;">Rs. {total_cost:,}</span>
                    </td>
                  </tr>
                </table>
                <p style="color:#64748b;font-size:12.5px;margin:18px 0 4px 0;">Session ID: {session_id}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 28px 28px;">
                {cta_button}
                <p style="color:#94a3b8;font-size:11.5px;margin-top:18px;line-height:1.5;">
                  The full report (per-pothole photo, dimensions & cost breakdown) is attached as a PDF
                  and also stored in the cloud link above.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;">
                <span style="color:#94a3b8;font-size:10.5px;">Generated automatically by RoadGuard AI</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with open(pdf_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={session_id}.pdf")
        msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_APP_PASSWORD)
            server.send_message(msg)
        print(f"[Email] Sent successfully to {receiver_email}", flush=True)
        return True
    except Exception as e:
        print(f"[Email] sending failed: {e}", flush=True)
        return False


def process_session_report(session_id: str, pothole_list: list, source: str, receiver_email: str):
    try:
        pdf_path, total_cost = build_pdf_report(session_id, pothole_list, source=source)
        pdf_url = upload_pdf_to_supabase(pdf_path, session_id)
        
        send_report_email(pdf_path, session_id, total_cost, len(pothole_list), receiver_email=receiver_email, pdf_url=pdf_url)
        write_report_status(session_id, {
            "status": "ready",
            "pdf_url": pdf_url,
            "total_cost": total_cost,
            "pothole_count": len(pothole_list),
            "error": None,
        })
        print(f"[Report] {session_id} ready. Potholes={len(pothole_list)} Cost=Rs.{total_cost} URL={pdf_url}", flush=True)
    except Exception as e:
        print(f"[Report] generation failed for {session_id}: {e}", flush=True)
        traceback.print_exc()
        write_report_status(session_id, {"status": "error", "pdf_url": None, "error": str(e)})

# ===========================================================================
# 1. PULL MODEL: WEBSOCKET FOR REAL-TIME IP STREAM / USB CAM
# ===========================================================================
@app.websocket("/ws/drone-stream")
async def drone_stream_websocket(websocket: WebSocket, email: str = None):
    await websocket.accept()
    session_id = uuid.uuid4().hex[:12]
    
    try:
        init_data = await asyncio.wait_for(websocket.receive_json(), timeout=2.0)
        camera_url = init_data.get("camera_url", DRONE_IP_CAM_URL)
    except Exception:
        camera_url = DRONE_IP_CAM_URL

    if str(camera_url).isdigit(): 
        camera_url = int(camera_url)

    print(f"Connecting to Drone Camera Stream at: {camera_url} | session_id={session_id}", flush=True)
    cap = cv2.VideoCapture(camera_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  
    
    if not cap.isOpened():
        await websocket.send_json({"error": "Failed to connect to IP Camera stream."})
        await websocket.close()
        return

    session_pothole_data = {}

    try:
        while True:
            success, frame = cap.read()
            if not success:
                await asyncio.sleep(0.05)
                continue

            results = model.track(frame, tracker="bytetrack.yaml", persist=True, conf=0.60, verbose=False)
            annotated_frame = results[0].plot()

            detections = []
            critical, high, medium = 0, 0, 0
            boxes = results[0].boxes
            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    
                    track_id = int(box.id[0]) if box.id is not None else None
                    
                    if conf >= 0.85: critical += 1
                    elif conf >= 0.75: high += 1
                    else: medium += 1

                    width_cm, breadth_cm, depth_cm = estimate_pothole_dimensions(x1, y1, x2, y2, conf)
                    pothole_cost, volume_m3 = calculate_maintenance_cost(width_cm, breadth_cm, depth_cm)

                    if track_id is not None:
                        is_first_sighting = track_id not in session_pothole_data
                        image_path = None
                        if is_first_sighting:
                            image_path = save_pothole_context_crop(session_id, track_id, frame, x1, y1, x2, y2)
                        else:
                            image_path = session_pothole_data[track_id].get("image_path")

                        session_pothole_data[track_id] = {
                            "id": track_id, "confidence": conf, "width_cm": width_cm,
                            "breadth_cm": breadth_cm, "depth_cm": depth_cm,
                            "cost": pothole_cost, "image_path": image_path,
                        }

                    detections.append({
                        "id": track_id, "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                        "confidence": conf, "width_cm": width_cm, "breadth_cm": breadth_cm,
                        "depth_cm": depth_cm, "volume_m3": volume_m3, "estimated_cost": pothole_cost
                    })

            _, buffer = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            base64_frame = base64.b64encode(buffer).decode("utf-8")

            session_total_cost = sum(p["cost"] for p in session_pothole_data.values())

            payload = {
                "session_id": session_id,
                "image": f"data:image/jpeg;base64,{base64_frame}",
                "count": len(detections), "critical": critical, "high": high, "medium": medium,
                "estimated_cost": len(detections) * 250, 
                "session_total_maintenance_cost": session_total_cost,
                "session_unique_potholes": len(session_pothole_data),
                "detections": detections
            }

            await websocket.send_json(payload)
            await asyncio.sleep(0.005) 

    except WebSocketDisconnect:
        print("Frontend disconnected from Drone Stream.", flush=True)
    except Exception as e:
        print(f"Stream error: {e}", flush=True)
    finally:
        cap.release()
        pothole_list = list(session_pothole_data.values())
        total = sum(p["cost"] for p in pothole_list)
        print(f"Session {session_id} ended. Unique potholes: {len(pothole_list)} | Total cost: ₹{total}", flush=True)
        if pothole_list and email:
            try:
                write_report_status(session_id, {"status": "processing", "pdf_url": None, "error": None})
                threading.Thread(
                    target=process_session_report, args=(session_id, pothole_list, "Live IP Camera", email), daemon=True
                ).start()
            except Exception as e:
                write_report_status(session_id, {"status": "error", "pdf_url": None, "error": str(e)})

# ===========================================================================
# 2. PUSH MODEL (NEW USP): WEBSOCKET FOR DEVICE BROWSER CAMERA
# ===========================================================================
@app.websocket("/ws/device-stream")
async def device_stream_websocket(websocket: WebSocket, email: str = None):
    await websocket.accept()
    session_id = uuid.uuid4().hex[:12]
    print(f"Connecting to Device Browser Camera Stream | session_id={session_id}", flush=True)
    session_pothole_data = {}
    try:
        while True:
            data = await websocket.receive_json()
            base64_str = data.get("frame")
            if not base64_str:
                continue
            header, encoded = base64_str.split(",", 1) if "," in base64_str else ("", base64_str)
            img_bytes = base64.b64decode(encoded)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                continue
            
            results = model.track(frame, tracker="bytetrack.yaml", persist=True, conf=0.60, verbose=False)
            annotated_frame = results[0].plot()
            detections = []
            critical, high, medium = 0, 0, 0
            boxes = results[0].boxes

            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    track_id = int(box.id[0]) if box.id is not None else None

                    if conf >= 0.85: critical += 1
                    elif conf >= 0.75: high += 1
                    else: medium += 1
                    width_cm, breadth_cm, depth_cm = estimate_pothole_dimensions(x1, y1, x2, y2, conf)
                    pothole_cost, volume_m3 = calculate_maintenance_cost(width_cm, breadth_cm, depth_cm)

                    if track_id is not None:
                        is_first_sighting = track_id not in session_pothole_data
                        image_path = None
                        if is_first_sighting:
                            image_path = save_pothole_context_crop(session_id, track_id, frame, x1, y1, x2, y2)
                        else:
                            image_path = session_pothole_data[track_id].get("image_path")

                        session_pothole_data[track_id] = {
                            "id": track_id, "confidence": conf, "width_cm": width_cm,
                            "breadth_cm": breadth_cm, "depth_cm": depth_cm,
                            "cost": pothole_cost, "image_path": image_path,
                        }
                    detections.append({
                        "id": track_id, "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                        "confidence": conf, "width_cm": width_cm, "breadth_cm": breadth_cm,
                        "depth_cm": depth_cm, "volume_m3": volume_m3, "estimated_cost": pothole_cost
                    })
                    
            _, buffer = cv2.imencode(".jpg", annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            out_base64 = base64.b64encode(buffer).decode("utf-8")
            session_total_cost = sum(p["cost"] for p in session_pothole_data.values())
            
            payload = {
                "session_id": session_id,
                "image": f"data:image/jpeg;base64,{out_base64}",
                "count": len(detections), "critical": critical, "high": high, "medium": medium,
                "estimated_cost": len(detections) * 250,
                "session_total_maintenance_cost": session_total_cost,
                "session_unique_potholes": len(session_pothole_data),
                "detections": detections
            }
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        print("Frontend disconnected from Device Stream.", flush=True)
    except Exception as e:
        print(f"Device Stream error: {e}", flush=True)
    finally:
        pothole_list = list(session_pothole_data.values())
        total = sum(p["cost"] for p in pothole_list)
        print(f"Device Session {session_id} ended. Unique potholes: {len(pothole_list)} | Total cost: ₹{total}", flush=True)
        if pothole_list and email:
            try:
                write_report_status(session_id, {"status": "processing", "pdf_url": None, "error": None})
                threading.Thread(
                    target=process_session_report, args=(session_id, pothole_list, "Local Device Browser Camera", email), daemon=True
                ).start()
            except Exception as e:
                write_report_status(session_id, {"status": "error", "pdf_url": None, "error": str(e)})
        elif not email:
            print(f"[Warning] Session {session_id} ended without email in URL. Skipping report generation.", flush=True)

# ===========================================================================
# 3. BATCH UPLOAD FOR LARGE 100MB+ RECORDED VIDEOS
# ===========================================================================
@app.post("/api/v1/analyze-video")
async def analyze_video(file: UploadFile = File(...), email: str = None):
    file_ext = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = f"temp_uploads/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    cap = cv2.VideoCapture(file_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_skip = int(fps)
    
    total_potholes = 0
    critical, high, medium = 0, 0, 0
    frame_count = 0
    total_maintenance_cost = 0
    pothole_dimensions = []  
    batch_session_id = uuid.uuid4().hex[:12]
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        if frame_count % frame_skip == 0:
            results = model(frame, conf=0.60, verbose=False)
            if results[0].boxes:
                for box in results[0].boxes:
                    total_potholes += 1
                    conf = float(box.conf[0])
                    
                    if conf >= 0.85: critical += 1
                    elif conf >= 0.75: high += 1
                    else: medium += 1

                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    width_cm, breadth_cm, depth_cm = estimate_pothole_dimensions(x1, y1, x2, y2, conf)
                    pothole_cost, volume_m3 = calculate_maintenance_cost(width_cm, breadth_cm, depth_cm)
                    total_maintenance_cost += pothole_cost

                    pothole_label = f"B{total_potholes}"
                    image_path = save_pothole_context_crop(batch_session_id, pothole_label, frame, x1, y1, x2, y2)

                    pothole_dimensions.append({
                        "id": pothole_label, "frame": frame_count, "confidence": conf,
                        "width_cm": width_cm, "breadth_cm": breadth_cm, "depth_cm": depth_cm,
                        "volume_m3": volume_m3, "estimated_cost": pothole_cost,"cost": pothole_cost, "image_path": image_path,
                    })
                    
        frame_count += 1
        
    cap.release()
    os.remove(file_path)

    if pothole_dimensions and email:
        write_report_status(batch_session_id, {"status": "processing", "pdf_url": None, "error": None})
        threading.Thread(
            target=process_session_report,
            args=(batch_session_id, pothole_dimensions, "Batch Video Upload", email),
            daemon=True,
        ).start()

    return {
        "status": "success", "session_id": batch_session_id, "total_frames_analyzed": frame_count // frame_skip,
        "total_potholes": total_potholes, "severity_breakdown": {"critical": critical, "high": high, "medium": medium},
        "estimated_cost_inr": total_maintenance_cost, "pothole_dimensions": pothole_dimensions
    }

# ===========================================================================
# 4. REPORT STATUS API
# ===========================================================================
@app.get("/api/v1/reports/{session_id}/status")
def get_report_status(session_id: str):
    status_data = read_report_status(session_id)
    if not status_data:
        raise HTTPException(status_code=404, detail="Report status not found")
    return status_data

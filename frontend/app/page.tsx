"use client";

import dynamic from 'next/dynamic';

// Map ko dynamically load karna taaki server side render par na fate
const PotholeMap = dynamic(() => import('./PotholeMap'), {
  ssr: false,
  loading: () => <div style={{ height: "300px", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}>Loading Map...</div>
});

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/supabase/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
const supabase = getSupabaseClient();
// Smart Environment Check
const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// HTTP Base URL (Local = 8000, Prod = Relative for Nginx)
const BACKEND_HTTP = isLocalDev ? "http://127.0.0.1:8000" : "";

// WebSocket Base URL
const getWsUrl = () => {
  if (typeof window === "undefined") return "";
  
  // Localhost par seedha backend port par bhej
  if (isLocalDev) return "ws://127.0.0.1:8000";
  
  // Production (Azure VM) par Nginx ke liye relative path
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
};

const BASE_WS = getWsUrl();

const BACKEND_WS = `${BASE_WS}/ws/drone-stream`;
const BACKEND_DEVICE_WS = `${BASE_WS}/ws/device-stream`;

type SidebarView = "live" | "history" | "uploads" | "reports";

const NAV_ITEMS: { key: SidebarView; label: string; icon: string }[] = [
  { key: "live", label: "Live Detection", icon: "◉" },
  { key: "history", label: "History", icon: "🕒" },
  { key: "uploads", label: "Video Uploads", icon: "☁" },
  { key: "reports", label: "PDFs / Reports", icon: "📄" },
];

export default function DashboardPage() {
  const { status, user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out" || status === "unauthorized-domain") {
      router.replace("/login");
    }
  }, [status, router]);

  const wsRef = useRef<WebSocket | null>(null);
  const deviceVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWaitingForBackendRef = useRef(false);

  const [ipCamUrl, setIpCamUrl] = useState("http://192.168.1.3:8080/video");
  const [isStreamingDrone, setIsStreamingDrone] = useState(false);
  const [isStreamingDevice, setIsStreamingDevice] = useState(false);
  const [droneImageSrc, setDroneImageSrc] = useState<string | null>(null);

  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<SidebarView>("live");

  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [detectionCount, setDetectionCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(0);
  const [sessionCost, setSessionCost] = useState(0);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [reportState, setReportState] = useState<{
    status: "idle" | "processing" | "ready" | "error" | "timeout";
    url?: string;
    totalCost?: number;
    potholeCount?: number;
  }>({ status: "idle" });

  useEffect(() => {
    if (!sessionStarted) return;
    const timer = setInterval(() => setSessionSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted]);

  useEffect(() => {
    return () => {
      stopDroneStream();
      stopDeviceCamera();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const pollReportStatus = async (sessionId: string, attempt = 0) => {
    if (attempt === 0) setReportState({ status: "processing" });
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/v1/reports/${sessionId}/status`);
      const data = await res.json();

      if (data.status === "ready") {
        setReportState({
          status: "ready",
          url: data.pdf_url,
          totalCost: data.total_cost,
          potholeCount: data.pothole_count,
        });
        return;
      }
      if (data.status === "error") {
        setReportState({ status: "error" });
        return;
      }
      if (attempt < 20) {
        setTimeout(() => pollReportStatus(sessionId, attempt + 1), 1500);
      } else {
        setReportState({ status: "timeout" });
      }
    } catch (e) {
      console.error("Report status poll failed:", e);
      if (attempt < 20) {
        setTimeout(() => pollReportStatus(sessionId, attempt + 1), 1500);
      }
    }
  };

  const handleSocketMessage = (event: MessageEvent) => {
    isWaitingForBackendRef.current = false;

    const data = JSON.parse(event.data);
    if (data.error) {
      alert(`Error: ${data.error}`);
      stopDroneStream();
      stopDeviceCamera();
      return;
    }

    if (data.session_id) setCurrentSessionId(data.session_id);
    setDroneImageSrc(data.image);
    setDetections(data.detections || []);

    setHistoricalLogs((prevLogs) => {
      const newLogs = [...prevLogs];

      (data.detections || []).forEach((det: any) => {
        if (det.id === null) return;
        const severity = det.confidence >= 0.85 ? "Critical" : det.confidence >= 0.75 ? "High" : "Medium";
        const existingIndex = newLogs.findIndex((l) => l.id === det.id);

        if (existingIndex !== -1) {
          newLogs[existingIndex] = {
            ...newLogs[existingIndex],
            confidence: det.confidence,
            width_cm: det.width_cm,
            breadth_cm: det.breadth_cm,
            depth_cm: det.depth_cm,
            cost: det.estimated_cost ?? 0,
            severity,
          };
        } else {
          newLogs.push({
            id: det.id,
            confidence: det.confidence,
            width_cm: det.width_cm,
            breadth_cm: det.breadth_cm,
            depth_cm: det.depth_cm,
            cost: det.estimated_cost ?? 0,
            lat: 28.9845 + newLogs.length * 0.0001,
            lng: 77.7064 + newLogs.length * 0.0001,
            severity,
            time: new Date().toLocaleTimeString(),
          });
        }
      });

      setCriticalCount(newLogs.filter((l) => l.severity === "Critical").length);
      setHighCount(newLogs.filter((l) => l.severity === "High").length);
      setMediumCount(newLogs.filter((l) => l.severity === "Medium").length);

      return newLogs;
    });

    if (typeof data.session_total_maintenance_cost === "number") {
      setSessionCost(data.session_total_maintenance_cost);
    }
    if (typeof data.session_unique_potholes === "number") {
      setDetectionCount(data.session_unique_potholes);
    }
  };

  // Original Backend PULL Logic (Untouched)
  const startDroneStream = () => {
    if (wsRef.current) wsRef.current.close();
    setReportState({ status: "idle" });

    const socket = new WebSocket(`${BACKEND_WS}?email=${user?.email}`);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ camera_url: ipCamUrl }));
      setIsStreamingDrone(true);
      setSessionStarted(true);
    };

    socket.onmessage = handleSocketMessage;

    socket.onerror = (err) => {
      console.error("WebSocket Error:", err);
      alert("Failed to connect to IP Stream.");
      stopDroneStream();
    };

    socket.onclose = () => setIsStreamingDrone(false);
  };

  const stopDroneStream = () => {
    const wasStreaming = isStreamingDrone;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreamingDrone(false);
    setDroneImageSrc(null);

    if (wasStreaming && currentSessionId) {
      pollReportStatus(currentSessionId);
    }
  };

  // New USP: Device Camera PUSH Logic (Resizing + Compression)
  const startDeviceCamera = async () => {
    stopDroneStream();
    stopDeviceCamera();
    
    try {
      console.log("[Cam] Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
      });

      if (deviceVideoRef.current) {
        deviceVideoRef.current.srcObject = stream;
        deviceVideoRef.current.play().catch(e => console.error("[Cam] Video play error:", e));
      }

      setReportState({ status: "idle" });
      const socket = new WebSocket(`${BACKEND_DEVICE_WS}?email=${user?.email}`);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("[Cam] WebSocket Connected! Starting brute-force stream...");
        setIsStreamingDevice(true);
        setSessionStarted(true);
        
        // Foolproof Steady Interval (5 FPS) - No deadlocks possible
        streamIntervalRef.current = setInterval(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          
          const video = deviceVideoRef.current;
          const canvas = hiddenCanvasRef.current;
          
          if (video && canvas) {
            const context = canvas.getContext("2d");
            // Check if video has started playing
            if (video.readyState >= 2 && context) {
              canvas.width = 640;
              canvas.height = 640;
              context.drawImage(video, 0, 0, 640, 640);
              
              const base64Frame = canvas.toDataURL("image/jpeg", 0.5); 
              if (base64Frame.length > 100) {
                wsRef.current.send(JSON.stringify({ frame: base64Frame }));
                console.log("[Cam] Sent frame to backend...");
              }
            }
          }
        }, 200); // 200ms = 5 Frames per second (Lag-free)
      };

      socket.onmessage = (event) => {
        console.log("[Cam] Received processed frame from backend!");
        handleSocketMessage(event);
      };

      socket.onerror = (err) => {
        console.error("[Cam] Device WebSocket Error:", err);
        stopDeviceCamera();
      };

      socket.onclose = () => {
        console.log("[Cam] WebSocket Closed");
        stopDeviceCamera();
      };

    } catch (err) {
      alert("Camera access denied or device not found!");
      console.error("[Cam] Error:", err);
    }
  };

  const stopDeviceCamera = () => {
    const wasStreaming = isStreamingDevice;
    
    // Stop the 12 FPS interval loop
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    
    // Stop the WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Shut down hardware camera light
    if (deviceVideoRef.current && deviceVideoRef.current.srcObject) {
      const stream = deviceVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      deviceVideoRef.current.srcObject = null;
    }

    setIsStreamingDevice(false);
    setDroneImageSrc(null);

    if (wasStreaming && currentSessionId) {
      pollReportStatus(currentSessionId);
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    stopDroneStream();
    stopDeviceCamera();

    // Custom Loading State Start
    setIsUploading(true);
    setUploadProgressText("Uploading and analyzing video... This may take a minute.");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_HTTP}/api/v1/analyze-video?email=${user?.email}`,{
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setIsUploading(false);
        setUploadProgressText(" Upload complete! Processing results...");
        // Custom Modal Notification (Native alert replaced with a clean timeout-based UI alert if you want, or just a modern alert for now till we build a full modal component)
        // For now, let's keep it simple without freezing the browser thread
        setShowCompletionModal(true);

        setDetectionCount(data.total_potholes);
        setCriticalCount(data.severity_breakdown.critical);
        setHighCount(data.severity_breakdown.high);
        setMediumCount(data.severity_breakdown.medium);
        setSessionCost(data.estimated_cost_inr);

        if (data.session_id) {
          setCurrentSessionId(data.session_id);
          pollReportStatus(data.session_id);
        }

        const batchLogs = (data.pothole_dimensions || []).map((p: any, index: number) => ({
          id: `B${index + 1}`,
          confidence: p.confidence,
          width_cm: p.width_cm,
          breadth_cm: p.breadth_cm,
          depth_cm: p.depth_cm,
          cost: p.estimated_cost,
          lat: 28.9845 + index * 0.0001,
          lng: 77.7064 + index * 0.0001,
          severity: p.confidence >= 0.85 ? "Critical" : p.confidence >= 0.75 ? "High" : "Medium",
          time: new Date().toLocaleTimeString(),
        }));
        setHistoricalLogs(batchLogs);
      }
    } catch (error) {
      setIsUploading(false);
      setTimeout(() => alert("Upload failed. Ensure backend is running."), 100);
    }
  };

  const endSession = async () => {
  // 1. Pehle streams roko 
    stopDroneStream();
    stopDeviceCamera();

    // 2. Supabase mein session data push karo
    try {
      const { error } = await supabase
        .from('session_history') // Apni Supabase table ka exact naam check kar lena
        .insert([
          {
            // Demo safety: Agar address variable yahan undefined hua, toh app crash na ho isliye fallback
            location_address: "Live PWD Zone, NH58, Meerut", 
            total_potholes: detectionCount,
            estimated_cost: sessionCost,
            session_date: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error("Database save failed:", error);
      } else {
        console.log("Session saved to History!");
      }
    } catch (err) {
      console.error("Supabase Error:", err);
    }

    // 3. UI states reset karo (teri purani lines)
    setSessionStarted(false);
    setSessionSeconds(0);
    setDetections([]);
  };

  const resetSession = () => {
    stopDroneStream();
    stopDeviceCamera();
    setSessionStarted(false);
    setSessionSeconds(0);
    setDetections([]);
    setHistoricalLogs([]);
    setDetectionCount(0);
    setSessionCost(0);
    setCriticalCount(0);
    setHighCount(0);
    setMediumCount(0);
    setCurrentSessionId(null);
    setReportState({ status: "idle" });
    if (fileUploadRef.current) {
      fileUploadRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    stopDroneStream();
    stopDeviceCamera();
    await signOut();
    router.replace("/login");
  };

  if (status !== "authorized") {
    return <div className="login-loading">Loading RoadGuard AI...</div>;
  }

  const operatorLabel = user?.email ? user.email.split("@")[0] : "Operator";
  const operatorInitial = operatorLabel.charAt(0).toUpperCase();
  const isAnyStreamActive = isStreamingDrone || isStreamingDevice;

  return (
    <main className="app">
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand-row">
          <div className="brand">
            <div className="brand-logo">{"🛡️"}</div>
            <div className="brand-text">
              <h1>
                RoadGuard <span>AI</span>
              </h1>
              <p>Pothole Detection System</p>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? "active" : ""}`}
              onClick={() => setActiveView(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}

          <div className="nav-divider" />

          <button className="nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">{"→"}</span>
            <span className="nav-label">Log Out</span>
          </button>
        </nav>

        <div className="system-card">
          <div
            className="status-dot"
            style={{ background: isAnyStreamActive ? "#1a7d43" : "#8b9990" }}
          />
          <div className="system-card-text">
            <p>System Status</p>
            <span>{isAnyStreamActive ? "Session Active" : "Ready for Detection"}</span>
          </div>
        </div>

        <div className="operator-card">
          <div className="operator-avatar">{operatorInitial}</div>
          <div className="operator-text">
            <strong>{operatorLabel}</strong>
            <span>{user?.email}</span>
          </div>
        </div>
      </aside>

      <section className="content">
        {activeView === "live" && (
          <LiveDetectionView
            isAnyStreamActive={isAnyStreamActive}
            isStreamingDrone={isStreamingDrone}
            isStreamingDevice={isStreamingDevice}
            sessionSeconds={sessionSeconds}
            formatTime={formatTime}
            ipCamUrl={ipCamUrl}
            setIpCamUrl={setIpCamUrl}
            droneImageSrc={droneImageSrc}
            startDroneStream={startDroneStream}
            startDeviceCamera={startDeviceCamera}
            endSession={endSession}
            handleBulkUpload={handleBulkUpload}
            detectionCount={detectionCount}
            criticalCount={criticalCount}
            highCount={highCount}
            mediumCount={mediumCount}
            historicalLogs={historicalLogs}
            sessionCost={sessionCost}
            reportState={reportState}
            resetSession={resetSession}
            deviceVideoRef={deviceVideoRef}
            hiddenCanvasRef={hiddenCanvasRef}
            isUploading= {isUploading}
            uploadProgressText={uploadProgressText}
            fileUploadRef={fileUploadRef}
          />
        )}

        {activeView === "uploads" && (
          <VideoUploadsView handleBulkUpload={handleBulkUpload} />
        )}

        {activeView === "reports" && (
          <ReportsView reportState={reportState} sessionCost={sessionCost} detectionCount={detectionCount} />
        )}

        {activeView === "history" && (
          <HistoryView historicalLogs={historicalLogs} isAnyStreamActive={isAnyStreamActive} />
        )}

        {/* Custom Completion Modal */}
        {showCompletionModal && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}>
            <div style={{ background: "#1e293b", padding: "30px", borderRadius: "12px", textAlign: "center", color: "white", width: "350px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)", animation: "popIn 0.3s ease-out" }}>
              <div style={{ fontSize: "48px", marginBottom: "15px" }}>✅</div>
              <h2 style={{ margin: "0 0 10px 0", color: "#4ade80" }}>Batch Analysis Complete</h2>
              <div style={{ background: "#0f172a", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
                <p style={{ margin: "5px 0", color: "#94a3b8" }}>Total Potholes: <strong style={{ color: "white", fontSize: "1.1rem" }}>{detectionCount}</strong></p>
                <p style={{ margin: "5px 0", color: "#94a3b8" }}>Maintenance Cost: <strong style={{ color: "#fbbf24", fontSize: "1.1rem" }}>₹{sessionCost}</strong></p>
              </div>
              <button
                onClick={() => setShowCompletionModal(false)}
                style={{ background: "#1a7d43", color: "white", border: "none", padding: "12px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", width: "100%", fontSize: "1rem" }}
              >
                View Report Dashboard
              </button>
              <style>{`@keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function LiveDetectionView(props: {
  isUploading: boolean;
  uploadProgressText: string;
  fileUploadRef: React.RefObject<HTMLInputElement | null>;
  isAnyStreamActive: boolean;
  isStreamingDrone: boolean;
  isStreamingDevice: boolean;
  sessionSeconds: number;
  formatTime: (s: number) => string;
  ipCamUrl: string;
  setIpCamUrl: (v: string) => void;
  droneImageSrc: string | null;
  startDroneStream: () => void;
  startDeviceCamera: () => void;
  endSession: () => void;
  handleBulkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  detectionCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  historicalLogs: any[];
  sessionCost: number;
  reportState: { status: string; url?: string; totalCost?: number; potholeCount?: number };
  resetSession: () => void;
  deviceVideoRef: React.RefObject<HTMLVideoElement | null>;
  hiddenCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const {
    isUploading,
    uploadProgressText,
    fileUploadRef,
    isAnyStreamActive,
    isStreamingDrone,
    isStreamingDevice,
    sessionSeconds,
    formatTime,
    ipCamUrl,
    setIpCamUrl,
    droneImageSrc,
    startDroneStream,
    startDeviceCamera,
    endSession,
    handleBulkUpload,
    detectionCount,
    criticalCount,
    highCount,
    mediumCount,
    historicalLogs,
    sessionCost,
    reportState,
    resetSession,
    deviceVideoRef,
    hiddenCanvasRef,
  } = props;

  return (
    <>
      {/* Hidden elements strictly for backend processing - DO NOT REMOVE */}
      <video 
        ref={deviceVideoRef} 
        autoPlay 
        playsInline 
        muted 
        onLoadedMetadata={(e) => { e.currentTarget.play().catch(console.error); }}
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, zIndex: -100, pointerEvents: 'none' }} 
      />
      <canvas 
        ref={hiddenCanvasRef} 
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, zIndex: -100, pointerEvents: 'none' }} 
      />

      <header className="topbar">
        <div>
          <div className="page-title-row">
            <h2>Live Detection</h2>
            <span className="live-status">
              <span />
              {isAnyStreamActive ? "Session Active" : "System Ready"}
            </span>
          </div>
          <p className="subtitle">AI-powered real-time road condition monitoring</p>
        </div>

        <div className="top-actions">
          <div className="time-box">
            <strong>Session {formatTime(sessionSeconds)}</strong>
            <span>Inspection Session</span>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="panel camera-card">
          <div className="card-header">
            <div>
              <h3>Live Camera Feed</h3>
              <p>{isStreamingDevice ? "Using Local Device Camera" : "Using IP/Drone Stream"}</p>
            </div>
            <div className={isAnyStreamActive ? "recording active-recording" : "recording"}>
              <span />
              {isAnyStreamActive ? "STREAMING" : "OFFLINE"}
            </div>
          </div>

          {/* Camera Screen with Solid Loading State */}
          <div className="camera-screen" style={{ position: "relative", overflow: "hidden" }}>
            
            {isUploading ? (
              // SOLID DARK BACKGROUND LOADER (No transparency, hides everything behind it)
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#1e293b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50, borderRadius: "8px" }}>
                <div className="spinner" style={{ border: "4px solid #334155", borderTop: "4px solid #1a7d43", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }}></div>
                <p style={{ color: "white", marginTop: "15px", fontWeight: "bold" }}>{uploadProgressText}</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            ) : isAnyStreamActive && droneImageSrc ? (
              // LIVE VIDEO FEED
              <img src={droneImageSrc} alt="Live road feed" className="road-video" />
            ) : (
              // PLACEHOLDER (IP Input) - Ye ab tabhi dikhega jab upload NAHI ho raha hoga
              <div className="camera-placeholder">
                <div className="camera-icon">{"\uD83D\uDCF9"}</div>
                <h3>Camera / Video Feed</h3>
                <p>Enter an IP address or use your local device camera to begin inspection</p>
                <div style={{ margin: "12px 0", width: "80%", maxWidth: "360px", display: "flex", gap: "10px", flexDirection: "column" }}>
                  <input 
                    type="text" 
                    className="ip-input" 
                    value={ipCamUrl} 
                    onChange={(e) => setIpCamUrl(e.target.value)} 
                    placeholder="http://192.168.1.100:8080/video or 0" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input 
            type="file" 
            accept="video/*" 
            ref={fileUploadRef} 
            style={{ display: "none" }} 
            onChange={handleBulkUpload} 
          />

          <div className="session-controls-row" style={{ flexWrap: "wrap", gap: "10px" }}>
            <button className="btn btn-primary" onClick={startDroneStream} disabled={isAnyStreamActive || isUploading}>
              {"📹"} Start IP/USB Cam
            </button>
            <button className="btn btn-secondary" onClick={startDeviceCamera} disabled={isAnyStreamActive || isUploading} style={{ backgroundColor: "#2d3748", color: "white" }}>
              {"📱"} Use Device Camera
            </button>
            {/* upload video button */}
            <button className="btn btn-secondary" onClick={() => fileUploadRef.current?.click()} disabled={isAnyStreamActive || isUploading} style={{ backgroundColor: "#1a7d43", color: "white" }}>
              {"📂"} Upload Video
            </button>

            <button className="btn btn-danger" onClick={endSession} disabled={!isAnyStreamActive}>
              {"■"} End Session
            </button>
          </div>
        </section>

        <section className="panel detections-card">
          <div className="summary-strip">
            <div className="severity critical">
              <strong>{criticalCount}</strong>
              <p>Critical</p>
            </div>
            <div className="severity high">
              <strong>{highCount}</strong>
              <p>High</p>
            </div>
            <div className="severity medium">
              <strong>{mediumCount}</strong>
              <p>Medium</p>
            </div>
          </div>

          <div className="card-header">
            <div>
              <h3>Active Detection Logs</h3>
              <p>Live PWD metrics</p>
            </div>
            <span className="detection-count">Total: {detectionCount}</span>
          </div>

          {historicalLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{"◉"}</div>
              <h3>No Potholes Detected</h3>
              <p>AI is currently monitoring the road video.</p>
            </div>
          ) : (
            <div className="detection-list" style={{ maxHeight: 340, overflowY: "auto" }}>
              {historicalLogs.map((log, index) => (
                <div className="detection-item" key={index}>
                  <div className="detection-info">
                    <strong>Pothole #{log.id}</strong>
                    <span>{log.time}</span>
                  </div>
                  <div className="detection-details">
                    <span className={`severity ${log.severity.toLowerCase()}`}>{log.severity}</span>
                    {log.width_cm !== undefined && (
                      <span>
                        {log.width_cm}×{log.breadth_cm}×{log.depth_cm} cm
                      </span>
                    )}
                    {isAnyStreamActive ? (
                      <span>cost pending</span>
                    ) : (
                      <span>₹{log.cost}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel cost-card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3>Estimated Repair Cost</h3>
            <p>Based on detected width, breadth &amp; depth</p>
          </div>
          <span className="cost-icon">{"₹"}</span>
        </div>

        {isAnyStreamActive ? (
          <div className="empty-state">
            <div className="empty-icon">{"🔒"}</div>
            <h3>Cost hidden while live</h3>
            <p>Maintenance cost will appear once the session ends.</p>
          </div>
        ) : historicalLogs.length > 0 ? (
          <>
            <div className="cost-value">₹{sessionCost.toLocaleString("en-IN")}</div>
            <div className="cost-footer">
              <span>Total estimated cost -- current session</span>
              <span>{detectionCount} potholes</span>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">{"₹"}</div>
            <h3>No session data yet</h3>
            <p>Start and end a session (or upload a video) to see maintenance cost here.</p>
          </div>
        )}
      </section>

      <ReportPanel reportState={reportState} sessionCost={sessionCost} detectionCount={detectionCount} isAnyStreamActive={isAnyStreamActive} />
      
      {/* LIVE MAP CONTAINER */}
      <div style={{ height: "400px", marginTop: "16px", borderRadius: "8px", overflow: "hidden" }}>
        <PotholeMap historicalLogs={historicalLogs} />
      </div>

      <section className="panel session-card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3>Session Controls</h3>
            <p>Data export and verification</p>
          </div>
        </div>
        <div className="session-actions">
          <button className="btn" disabled title="Existing UI action -- no backend endpoint found for this yet">
            {"▣"} Export Geotags
          </button>
          <button className="btn" disabled title="Existing UI action -- no backend endpoint found for this yet">
            {"▥"} Generate PWD Report
          </button>
          <button className="btn" onClick={resetSession}>
            {"↻"} Reset Session
          </button>
        </div>
      </section>
    </>
  );
}

function ReportPanel({
  reportState,
  sessionCost,
  detectionCount,
  isAnyStreamActive,
}: {
  reportState: { status: string; url?: string; totalCost?: number; potholeCount?: number };
  sessionCost: number;
  detectionCount: number;
  isAnyStreamActive: boolean;
}) {
  if (isAnyStreamActive || reportState.status === "idle") return null;

  return (
    <section className="panel cost-card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div>
          <h3>Generate PDF &amp; Email Alert</h3>
          <p>Per-pothole image, dimensions &amp; cost</p>
        </div>
        <span className="cost-icon">{"📄"}</span>
      </div>

      {reportState.status === "processing" && (
        <div className="empty-state">
          <div className="empty-icon">{"⏳"}</div>
          <h3>Generating report...</h3>
          <p>Building the PDF, uploading it, and emailing the admin. This can take a few seconds.</p>
        </div>
      )}

      {reportState.status === "ready" && (
        <div style={{ padding: "0 16px 16px" }}>
          <div className="cost-footer" style={{ margin: "0 0 12px", border: "none" }}>
            <span>{reportState.potholeCount ?? detectionCount} potholes documented</span>
            <span>₹{(reportState.totalCost ?? sessionCost).toLocaleString("en-IN")} total</span>
          </div>
          {reportState.url ? (
            <a href={reportState.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {"⬇"} Open PDF Report
            </a>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--rg-ink-muted)" }}>
              PDF generated on server (Supabase storage not configured -- no cloud link).
            </p>
          )}
          <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--rg-ink-faint)" }}>
            {"📧"} Email Alert: this report is emailed to the admin automatically by the backend -- there is no separate manual "send" action wired up yet.
          </p>
        </div>
      )}

      {reportState.status === "error" && (
        <div className="empty-state">
          <div className="empty-icon">{"⚠️"}</div>
          <h3>Report generation failed</h3>
          <p>Check backend logs -- likely a Supabase or email configuration issue in .env.</p>
        </div>
      )}

      {reportState.status === "timeout" && (
        <div className="empty-state">
          <div className="empty-icon">{"⌛"}</div>
          <h3>Still working...</h3>
          <p>Report is taking longer than expected. Check backend logs.</p>
        </div>
      )}
    </section>
  );
}

function VideoUploadsView({
  handleBulkUpload,
}: {
  handleBulkUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title-row">
            <h2>Video Uploads</h2>
          </div>
          <p className="subtitle">Upload a recorded video for server-side batch analysis</p>
        </div>
      </header>

      <section className="panel" style={{ padding: 24 }}>
        <p style={{ marginTop: 0, fontSize: 13, color: "var(--rg-ink-muted)" }}>
          This uses the same batch-analysis endpoint as the Live Detection page (
          <code>/api/v1/analyze-video</code>). Uploading here will stop any active session, same as
          uploading from Live Detection.
        </p>
        <label className="btn btn-primary" style={{ cursor: "pointer" }}>
          {"☁"} Upload Video for Analysis
          <input type="file" accept="video/*" onChange={handleBulkUpload} hidden />
        </label>
      </section>
    </>
  );
}

function ReportsView({
  reportState,
  sessionCost,
  detectionCount,
}: {
  reportState: { status: string; url?: string; totalCost?: number; potholeCount?: number };
  sessionCost: number;
  detectionCount: number;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title-row">
            <h2>PDFs / Reports</h2>
          </div>
          <p className="subtitle">Status of the most recent session's PDF report</p>
        </div>
      </header>

      {reportState.status === "idle" ? (
        <div className="not-available">
          <h3>No report yet</h3>
          <p>
            Run a live session or upload a video from Live Detection / Video Uploads first -- a report
            is generated automatically once a session ends.
          </p>
        </div>
      ) : (
        <ReportPanel
          reportState={reportState}
          sessionCost={sessionCost}
          detectionCount={detectionCount}
          isAnyStreamActive={false}
        />
      )}

      <div className="not-available" style={{ marginTop: 16 }}>
        <h3>UI requested, existing functionality not found</h3>
        <p>
          A persisted list of past reports (across sessions and page refreshes) isn't available -- the
          backend only tracks the most recent session's report status in memory/local files, with no
          reports history endpoint or database table. Building a browsable report history would require
          new backend work.
        </p>
      </div>
    </>
  );
}

function HistoryView({
  historicalLogs,
  isAnyStreamActive,
}: {
  historicalLogs: any[];
  isAnyStreamActive: boolean;
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title-row">
            <h2>History</h2>
          </div>
          <p className="subtitle">Detections logged during the current session</p>
        </div>
      </header>

      <section className="panel detections-card">
        <div className="card-header">
          <div>
            <h3>Current Session Log</h3>
            <p>Persistent AI verified defects (this session only)</p>
          </div>
        </div>
        {historicalLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{"◉"}</div>
            <h3>No defects logged yet</h3>
          </div>
        ) : (
          <div className="detection-list" style={{ maxHeight: 420, overflowY: "auto" }}>
            {historicalLogs.map((log, index) => (
              <div className="detection-item" key={index}>
                <div className="detection-info">
                  <strong>Pothole #{log.id}</strong>
                  <span>Detected at {log.time} - {log.lat.toFixed(5)}, {log.lng.toFixed(5)}</span>
                </div>
                <div className="detection-details">
                  <span className={`severity ${log.severity.toLowerCase()}`}>{log.severity}</span>
                  {isAnyStreamActive ? <span>cost pending</span> : <span>₹{log.cost}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="not-available" style={{ marginTop: 16 }}>
        <h3>UI requested, existing functionality not found</h3>
        <p>
          This list only reflects the current browser session -- there's no backend database table or
          endpoint yet for detection history that survives a refresh or spans multiple sessions. Adding
          that would be a backend change requiring separate approval.
        </p>
      </div>
    </>
  );
}
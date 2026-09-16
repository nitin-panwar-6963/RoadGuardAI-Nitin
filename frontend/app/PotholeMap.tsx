"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const createPotholeIcon = (severity: string) => {
  const color = severity === "Critical" ? "#ef4444" : severity === "High" ? "#f97316" : "#eab308";
  return L.divIcon({
    className: "pothole-marker",
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const createUserIcon = () => {
  return L.divIcon({
    className: "user-marker",
    html: `<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #3b82f6;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

function AutoCenter({ logs, userLoc }: { logs: any[]; userLoc: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (logs.length > 0) {
      const latestLog = logs[logs.length - 1];
      map.setView([latestLog.lat, latestLog.lng], 18, { animate: true });
    } else {
      map.setView(userLoc, 18, { animate: true });
    }
  }, [logs, map, userLoc]);
  return null;
}

export default function PotholeMap({ historicalLogs }: { historicalLogs: any[] }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string>("Locating system coordinates...");
  const fallbackLocation: [number, number] = [28.9731, 77.6833]; 

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(fallbackLocation);
      setAddress("MIET, NH58, Meerut (Fallback)");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation([lat, lon]);
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
          .then(res => res.json())
          .then(data => {
            // Digging deeper for Indian street details
            const streetName = data.address?.road || data.address?.neighbourhood || data.address?.residential || data.address?.suburb || data.display_name.split(",")[0];
            
            const city = data.address?.city || data.address?.state_district || data.address?.town || "";
            
            // Preventing the "Meerut, Meerut" parrot echo
            let finalAddress = "";
            if (streetName.trim().toLowerCase() === city.trim().toLowerCase()) {
              // If it still clashes, grab the first two detailed chunks of the raw address
              finalAddress = data.display_name.split(",").slice(0, 2).join(", ");
            } else {
              finalAddress = `${streetName}, ${city}`;
            }
            
            setAddress(finalAddress);
          })
          .catch(() => setAddress("Location address unavailable"));
      },
      (error) => {
        console.warn("Location blocked by device. Using MIET fallback. Reason:", error.message);
        setUserLocation(fallbackLocation);
        setAddress("MIET, NH58, Meerut (GPS Offline)");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  if (!userLocation) {
    return (
      <div style={{ height: "100%", width: "100%", borderRadius: "8px", border: "1px solid #334155", background: "#1e293b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
        <div className="spinner" style={{ border: "3px solid #334155", borderTop: "3px solid #3b82f6", borderRadius: "50%", width: "30px", height: "30px", animation: "spin 1s linear infinite", marginBottom: "12px" }}></div>
        <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Connecting to Satellite...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", borderRadius: "8px", overflow: "hidden", border: "1px solid #334155", display: "flex", flexDirection: "column" }}>
      
      {/* ADDRESS BAR FIXED ABOVE MAP */}
      <div style={{ background: "#0f172a", padding: "12px 16px", color: "white", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #334155", flexShrink: 0 }}>
        <span style={{ fontSize: "20px" }}>📍</span>
        <div>
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Live PWD Zone</div>
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#e2e8f0" }}>{address}</div>
        </div>
      </div>

      {/* SATELLITE MAP CONTAINER */}
      <div style={{ flex: 1, width: "100%", position: "relative" }}>
        <MapContainer center={userLocation} zoom={18} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; Esri, Maxar, Earthstar Geographics'
          />
          <AutoCenter logs={historicalLogs} userLoc={userLocation} />
          
          <Marker position={userLocation} icon={createUserIcon()}>
            <Popup><strong style={{ color: "#0f172a" }}>You are here</strong></Popup>
          </Marker>
          
          {historicalLogs.map((log, idx) => (
            <Marker key={idx} position={[log.lat, log.lng]} icon={createPotholeIcon(log.severity)}>
              <Popup>
                <div style={{ color: "#0f172a", margin: 0 }}>
                  <strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>Pothole #{log.id}</strong>
                  <span>Severity: <b>{log.severity}</b></span><br/>
                  {log.cost > 0 && <span>Est. Cost: ₹{log.cost}</span>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
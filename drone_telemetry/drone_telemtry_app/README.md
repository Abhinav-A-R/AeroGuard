# AeroGuard — Drone Data Logger & Real-Time UAV Telemetry Platform

**AeroGuard** is an enterprise-grade real-time UAV (Unmanned Aerial Vehicle) ground control telemetry platform and flight safety system. It streams 6-DOF IMU data from lightweight microcontrollers (such as the ESP32-C3 Super Mini / MPU6050) to a ground laptop over Wi-Fi, UDP, and WebSockets.

---

## 🚀 Quickstart Guide

### 1. Navigate to Project Directory
```powershell
cd A:\drone\drone_telemetry\drone_telemtry_app
```

### 2. Start Backend Server (Terminal 1)
```powershell
node server/backend.js
```
* **HTTP & UDP Ingest Port**: `http://localhost:5000`
* **WebSocket Stream Port**: `ws://localhost:5001`

### 3. Start Frontend Web App (Terminal 2)
In a new terminal window:
```powershell
cd A:\drone\drone_telemetry\drone_telemtry_app
npm run dev
```
Open **`http://localhost:8443/`** in your browser.

---

## 🛠️ Verification & Build Commands

```powershell
# Type checking
npx tsc --noEmit

# Production build
npm run build
```

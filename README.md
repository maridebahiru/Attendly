# Real-Time Attendance Management System

A production-ready attendance management system built for the ZKTeco ZMM200_TFT platform, featuring real-time websocket updates, a FastAPI backend, and a dynamic React frontend.

## Features
- Background live capture from ZKTeco biometric terminal using `pyzk`
- WebSocket server pushing live punches to the frontend
- Automatic reconnection and offline sync mechanism
- Beautiful, responsive dashboard built with Vite, React, and TailwindCSS

## Device Quirks & Assumptions
- **ZMM200_TFT**: Uses specific properties in `pyzk`, sometimes returning `verify_type` within the `status` field depending on firmware versions. This code falls back gracefully across properties.
- **Connection Stability**: The system implements an automatic heartbeat and exponential backoff retry approach to address known pyzk intermittent connection issues, tracking real-time status dynamically.
- IP configuration defaults to `192.168.10.40:4370`.

## Installation & Setup

### 1. Backend 
Requires Python 3.9+
```bash
cd attendance-system/backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

# Start the server (runs on http://localhost:8000)
uvicorn main:app --reload
```

### 2. Frontend
Requires Node.js 18+
```bash
cd attendance-system/frontend
npm install
# Start the dev server (runs on http://localhost:5173)
npm run dev
```

The frontend runs locally and automatically proxies/communicates with the backend websockets and REST endpoints.

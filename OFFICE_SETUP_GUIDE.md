# Attendance System - Office Computer Setup Guide

This guide explains how to set up the **Biometric Bridge** on any office computer connected to the same network as the fingerprint reader (IP: `192.168.10.40`).

---

## Prerequisites
1. **Network Connection**: The computer must be connected to the office local network (LAN) via Wi-Fi or Ethernet.
2. **Python**: Python 3.10 or higher must be installed on the computer. (Ensure you check "Add Python to PATH" during installation).

---

## Step-by-Step Setup

### Step 1: Copy the Files
1. Copy the entire `attendance-system` directory to the office computer (e.g., via USB drive or Git download).

### Step 2: Initialize the Virtual Environment
Open **PowerShell** or **Command Prompt** in the `backend` folder and run the following commands:
1. Create a new virtual environment:
   ```cmd
   python -m venv venv
   ```
2. Activate the virtual environment and install dependencies:
   ```cmd
   venv\Scripts\pip install -r requirements.txt
   venv\Scripts\pip install asyncpg
   ```

### Step 3: Run the Bridge
1. Open the `backend` directory.
2. Double-click the file named **`run_office_bridge.bat`**.
3. It will connect to the fingerprint reader and start uploading all attendance logs directly to the Render cloud database. Keep this window open.

---

## Configuring the Public Render Website
To make sure the website at `https://attendlyfs.onrender.com` displays the synced records, you must point it to the same Postgres database:

1. Log in to your **Render Dashboard** (`https://dashboard.render.com`).
2. Go to your **Web Service** (representing your backend API).
3. Click the **Environment** tab on the left.
4. Add or edit the variable `DATABASE_URL` with this value:
   ```env
   postgresql://attendance_gfhy_user:DqpjIdw4g2GHnrxzVFRRIjOBUE3SiXnZ@dpg-d97pvv57vvec73cn3qeg-a.oregon-postgres.render.com/attendance_gfhy
   ```
5. Click **Save Changes** at the bottom. Render will rebuild and restart the website automatically.

Now, anyone can access the website from any computer/phone and see real-time updates!

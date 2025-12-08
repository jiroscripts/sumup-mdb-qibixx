# 🚀 Deployment Guide

This guide explains how to deploy the Kiosk software on a Raspberry Pi and how to recover from a crash.

## 📋 Prerequisites

- **Hardware:** Raspberry Pi 3B+ or 4 (or newer).
- **OS:** Raspberry Pi OS Lite (64-bit recommended).
- **Network:** Internet connection (Ethernet or Wi-Fi).
- **Supabase:** A configured Supabase project (see `scripts/init-supabase.sh`).

---

## 🍓 Raspberry Pi Setup (First Time)

1.  **Flash the SD Card:**
    - Use [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
    - Choose "Raspberry Pi OS Lite (64-bit)".
    - Click the "Gear" icon to enable SSH and set a username/password (e.g., `pi`/`raspberry`).

2.  **Connect & Clone:**
    - SSH into the Pi: `ssh pi@<IP_ADDRESS>`
    - Install Git: `sudo apt-get install -y git`
    - Clone the repo:
      ```bash
      git clone https://github.com/your-username/sumup-mdb-qibixx.git
      cd sumup-mdb-qibixx
      ```

3.  **Run Setup Script:**
    This script installs Docker and prepares the configuration.
    ```bash
    chmod +x setup.sh
    ./setup.sh
    ```

4.  **Configure Environment:**
    - Edit the `.env` file created by the script.
    - **IMPORTANT:** Do NOT include Stripe keys here. Only Kiosk credentials.
    ```bash
    nano .env
    ```
    - Set `KIOSK_EMAIL` (e.g., `kiosk-01@project.com`)
    - Set `KIOSK_PASSWORD` (e.g., `Kiosk2025!Secure`)
    - Set `MACHINE_ID` (e.g., `kiosk_hall_01`)

5.  **Start the Kiosk:**
    ```bash
    docker compose up -d --build
    ```
    The system will download dependencies, build the containers, and start the app.

---

## 🚑 Disaster Recovery (Crash)

If the SD card fails or the Pi crashes, follow these steps to restore service in < 15 minutes.

1.  **Flash a new SD Card** (See Step 1 above).
2.  **Run the Quick Install Command:**
    Copy-paste this block into the new Pi's terminal:

    ```bash
    # 1. Clone & Enter
    git clone https://github.com/your-username/sumup-mdb-qibixx.git
    cd sumup-mdb-qibixx

    # 2. Setup
    chmod +x setup.sh
    ./setup.sh

    # 3. Configure (You need your credentials!)
    nano .env
    # -> Paste your KIOSK_EMAIL, KIOSK_PASSWORD, SUPABASE_URL, etc.

    # 4. Launch
    docker compose up -d --build
    ```

3.  **Done!** The Kiosk will automatically reconnect to Supabase and resume operations.

---

## ☁️ Backend Setup (Supabase)

If you need to redeploy the backend (Supabase) to a new project:

1.  Ensure you have the Supabase CLI installed on your dev machine.
2.  Run the initialization script:
    ```bash
    ./scripts/init-supabase.sh
    ```
3.  Follow the interactive prompts to login and link your project.

---

## 🔐 Security Notes

- **Never** store `STRIPE_SECRET_KEY` on the Raspberry Pi.
- **Never** store `SUPABASE_SERVICE_ROLE_KEY` on the Raspberry Pi (unless absolutely necessary for legacy reasons).
- Use **Kiosk Users** (Email/Password) for authentication.
- If a Pi is stolen:
    1.  Go to Supabase Dashboard > Authentication > Users.
    2.  Delete or Ban the compromised Kiosk user (e.g., `kiosk-01@project.com`).
    3.  The stolen device will immediately lose access to the database.

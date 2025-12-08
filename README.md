# MDB Payment System (PoC)

This project simulates a Vending Machine payment system using a Raspberry Pi, Qibixx MDB Pi Hat, and Stripe.

## Project Structure

-   `mdb_bridge/`: **Python MDB Listener**. Handles MDB hardware logic and listens to Supabase Realtime events.
-   `kiosk/`: **React Kiosk App**. Displays UI on the DSI screen and listens to Supabase Realtime events.
-   `web/`: **React Mobile App**. The payment page that users open on their phone to pay.
-   `supabase/`: Database schema and Edge Functions.
-   `docs/`: Comprehensive project documentation.

## Documentation

For detailed information, please refer to the following guides:

-   [**Architecture & Data Flow**](docs/architecture.md): System overview and diagrams.
-   [**Hardware Setup**](docs/hardware_setup.md): Wiring and configuration for Raspberry Pi & Qibixx Hat.
-   [**Data Model & Events**](docs/api_reference.md): Database schema and Realtime protocol.
-   [**User Guide**](docs/user_guide.md): Installation and usage instructions.


## Prerequisites

-   Python 3.9+
-   Node.js 18+
-   Stripe Account (Secret Key/Webhook Secret)
-   Supabase Project

## Setup

1.  **Install Bridge Dependencies**:
    ```bash
    cd mdb_bridge
    pip install -r requirements.txt
    cd ..
    ```

2.  **Install Kiosk & Web Dependencies**:
    ```bash
    cd kiosk && npm install
    cd ../web && npm install
    cd ..
    ```

3.  **Configuration**:
    -   Create a `.env` file based on `.env.example`.
    -   Configure `MDB_SIMULATION_MODE=True` in `.env` to test without hardware.

## Running the System

```bash
# Run the system (Backend + Frontend + Web + Docs)
make dev

# Install dependencies
make install
```

-   **Frontend (Kiosk)**: [http://localhost:5173](http://localhost:5173)
-   **Web App (Mobile)**: [http://localhost:5174](http://localhost:5174)
-   **Backend**: Runs in background (logs to terminal)

## Simulation Guide

1.  **Open the Kiosk** ([http://localhost:5173](http://localhost:5173)).
2.  The **MDB Bridge** (in simulation mode) will automatically trigger a "Vend Request" every few seconds (configurable in `.env`).
3.  The screen will show a QR Code.
4.  Scan it with your phone (or open the URL in a new tab) to access the **Web App**.
5.  Complete the payment on the Web App.
6.  The Kiosk will update to "Payment Approved!" and the Bridge will approve the vend.

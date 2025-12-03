# SumUp MDB Payment System (PoC)

This project simulates a Vending Machine payment system using a Raspberry Pi, Qibixx MDB Pi Hat, and SumUp.

## Project Structure

-   `backend/`: Python FastAPI application. Handles MDB logic and SumUp API.
-   `frontend/`: React application. Displays UI on the DSI screen.
-   `docs/`: Comprehensive project documentation.

## Documentation

For detailed information, please refer to the following guides:

-   [**Architecture & Data Flow**](docs/architecture.md): System overview and diagrams.
-   [**Hardware Setup**](docs/hardware_setup.md): Wiring and configuration for Raspberry Pi & Qibixx Hat.
-   [**API Reference**](docs/api_reference.md): WebSocket protocol and Debug APIs.
-   [**User Guide**](docs/user_guide.md): Installation and usage instructions.


## Prerequisites

-   Python 3.9+
-   Node.js 18+
-   SumUp Developer Account (Client ID/Secret)

## Setup

1.  **Install Backend Dependencies**:
    ```bash
    cd backend
    pip install -r requirements.txt
    cd ..
    ```

2.  **Install Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

3.  **Configuration**:
    -   Edit `backend/config.py` or create a `.env` file with your SumUp credentials.
    -   By default, `MDB_SIMULATION_MODE` is `True`. Set to `False` to use real hardware.

## Running the System

```bash
chmod +x run.sh
./run.sh
```

-   **Frontend**: [http://localhost:5173](http://localhost:5173)
-   **Backend API**: [http://localhost:8000](http://localhost:8000)

## Simulation Guide

1.  Open the Frontend in your browser.
2.  You will see the "Debug Controls" panel at the bottom right.
3.  Click **"Simulate VMC Request (€2.50)"**.
    -   The screen should change to "Please pay €2.50".
    -   A QR Code will appear.
4.  Click **"Simulate Successful Payment"**.
    -   The screen should show "Payment Approved!".
    -   After 5 seconds, it returns to "Ready for order".

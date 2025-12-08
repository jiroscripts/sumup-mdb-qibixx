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

## Security Architecture 🛡️
This project implements a robust "Security by Design" approach:

1.  **Role-Based Access Control (RBAC)**:
    -   **Bridge Role**: Only the Python Bridge (`bridge-01`) can create vending sessions.
    -   **Display Role**: The Kiosk Frontend (`display-01`) has Read-Only access.
    -   **Atomic Sessions**: A custom RPC ensures only one session is active per machine at a time.

2.  **Secure Payments**:
    -   Strict `Decimal` type usage for all monetary values (no floating point errors).
    -   Server-side validation of amounts before dispensing.

## Testing 🧪
We use **Vitest** for comprehensive testing (Unit, Integration, E2E).

```bash
# Run all tests (Permissions, Payment Flow, Edge Cases)
make test
```

## Setup & Configuration
1.  **Install Dependencies**:
    ```bash
    make install
    ```

2.  **Configuration**:
    -   Create a `.env` file based on `.env.example`.
    -   **Critical**: Ensure you have separate credentials for Bridge and Display:
        ```bash
        BRIDGE_EMAIL="bridge-01@project.com"
        BRIDGE_PASSWORD="..."
        VITE_DISPLAY_EMAIL="display-01@project.com"
        VITE_DISPLAY_PASSWORD="..."
        ```

## Running the System
```bash
# Run with Docker (Recommended)
make docker-dev

# Run locally
make dev
```

-   **Frontend (Kiosk)**: [http://localhost:5173](http://localhost:5173) (or port 8080 with Docker)
-   **Web App (Mobile)**: [http://localhost:5174](http://localhost:5174)

## Simulation Guide
1.  **Open the Kiosk**.
2.  The **MDB Bridge** (in simulation mode) triggers a "Vend Request".
3.  The screen shows a QR Code.
4.  Scan it to access the **Web App**.
5.  Complete the payment.
6.  The Kiosk updates to "Payment Approved!" and the Bridge dispenses.

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import json
import asyncio
from .config import Config
from .mdb_service import MDBService
from .payment_service import PaymentService
import time

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SumUpMDB")

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
payment_service = PaymentService()
mdb_service = None # Initialized on startup

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")

manager = ConnectionManager()

# --- Background Tasks ---
async def poll_payment_status(checkout_id: str, timeout_seconds: int = 60):
    """
    Polls the payment service for the status of a checkout.
    Handles success, failure, and timeout.
    """
    logger.info(f"--- POLLER STARTED for {checkout_id} ---")
    start_time = time.time()

    while time.time() - start_time < timeout_seconds:
        try:
            status_data = payment_service.check_status(checkout_id)
            status = status_data.get("status")
            logger.info(f"Poller: Checkout {checkout_id} status: {status}")

            if status == "PAID":
                logger.info(f"Poller: Payment Successful for {checkout_id}")
                await manager.broadcast({"type": "STATE_CHANGE", "state": "SUCCESS"})
                if mdb_service:
                    mdb_service.approve_vend()
                return

            if status == "FAILED":
                logger.info(f"Poller: Payment Failed for {checkout_id}")
                await manager.broadcast({"type": "ERROR", "message": "Payment Failed"})
                if mdb_service:
                    mdb_service.deny_vend()
                return

        except Exception as e:
            logger.error(f"Poller Error: {e}")

        await asyncio.sleep(2) # Poll every 2 seconds

    # Timeout reached
    logger.warning(f"Poller: Timeout for {checkout_id}")
    await manager.broadcast({"type": "ERROR", "message": "Payment Timeout"})
    if mdb_service:
        mdb_service.deny_vend()

# Global reference to the main event loop
main_loop = None

# --- MDB Callbacks ---
def on_vend_request(amount):
    """Called when MDB Service detects a vend request"""
    logger.info(f"Processing Vend Request: {amount}")
    
    if not main_loop:
        logger.error("Main loop not captured, cannot broadcast")
        return

    # 1. Notify Frontend to show "Processing..."
    asyncio.run_coroutine_threadsafe(
        manager.broadcast({"type": "STATE_CHANGE", "state": "PROCESSING"}),
        main_loop
    )
    
    # 2. Create SumUp Checkout
    checkout = payment_service.create_checkout(amount)
    
    if "error" in checkout:
        logger.error(f"Checkout failed: {checkout['error']}")
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "ERROR", "message": "Payment Init Failed"}),
            main_loop
        )
        mdb_service.deny_vend()
        return

    # 3. Send QR Code to Frontend
    asyncio.run_coroutine_threadsafe(
        manager.broadcast({
            "type": "SHOW_QR", 
            "qr_url": checkout.get("qr_code_url"),
            "amount": amount,
            "checkout_id": checkout.get("id")
        }),
        main_loop
    )

    # 4. Start Polling for Payment Status (Background Task)
    logger.info(f"Scheduling poller for {checkout.get('id')}")
    try:
        future = asyncio.run_coroutine_threadsafe(
            poll_payment_status(checkout.get("id")),
            main_loop
        )
        # We can't await future here because we are in a sync thread, 
        # but we can add a done callback to log errors
        def handle_result(f):
            try:
                f.result()
            except Exception as e:
                logger.error(f"Poller Task Failed: {e}")
        future.add_done_callback(handle_result)
        
    except Exception as e:
        logger.error(f"Failed to schedule poller: {e}")

# --- Lifecycle ---
@app.on_event("startup")
async def startup_event():
    global mdb_service, main_loop
    main_loop = asyncio.get_running_loop()
    mdb_service = MDBService(on_vend_request_callback=on_vend_request)
    mdb_service.start()

@app.on_event("shutdown")
async def shutdown_event():
    if mdb_service:
        mdb_service.stop()

# --- API Endpoints ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info(f"New WebSocket connection attempt from {websocket.client}")
    await manager.connect(websocket)
    logger.info(f"WebSocket connected: {websocket.client}")
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WS message: {data}")
            # Handle messages from frontend if needed
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {websocket.client}")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.post("/api/simulate/vend/{amount}")
async def simulate_vend(amount: float):
    """Debug Endpoint: Simulate a VMC requesting a vend"""
    if mdb_service:
        mdb_service.simulate_vend_request(amount)
    return {"status": "simulated", "amount": amount}

@app.post("/api/simulate/payment/{checkout_id}")
async def simulate_payment(checkout_id: str):
    """Debug Endpoint: Simulate a successful payment for a checkout"""
    # Update the mock status to PAID. The background poller will pick this up.
    success = payment_service.mock_update_status(checkout_id, "PAID")
    
    if success:
        return {"status": "payment_simulated", "checkout_id": checkout_id}
    else:
        return {"status": "error", "message": "Checkout ID not found or not a mock transaction"}

if __name__ == "__main__":
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)

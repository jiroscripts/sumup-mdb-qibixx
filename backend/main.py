from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import json
import asyncio
from .config import Config
from .mdb_service import MDBService
from .payment_service import PaymentService

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

# --- MDB Callbacks ---
def on_vend_request(amount):
    """Called when MDB Service detects a vend request"""
    logger.info(f"Processing Vend Request: {amount}")
    
    # 1. Notify Frontend to show "Processing..."
    asyncio.run(manager.broadcast({"type": "STATE_CHANGE", "state": "PROCESSING"}))
    
    # 2. Create SumUp Checkout
    checkout = payment_service.create_checkout(amount)
    
    if "error" in checkout:
        logger.error(f"Checkout failed: {checkout['error']}")
        asyncio.run(manager.broadcast({"type": "ERROR", "message": "Payment Init Failed"}))
        mdb_service.deny_vend()
        return

    # 3. Send QR Code to Frontend
    asyncio.run(manager.broadcast({
        "type": "SHOW_QR", 
        "qr_url": checkout.get("qr_code_url"),
        "amount": amount,
        "checkout_id": checkout.get("id")
    }))

    # 4. Start Polling for Payment Status (Background Task)
    # Polling is replaced by the 'simulate_payment' callback from the Web App.
    pass

# --- Lifecycle ---
@app.on_event("startup")
async def startup_event():
    global mdb_service
    mdb_service = MDBService(on_vend_request_callback=on_vend_request)
    mdb_service.start()

@app.on_event("shutdown")
async def shutdown_event():
    if mdb_service:
        mdb_service.stop()

# --- API Endpoints ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle messages from frontend if needed
    except WebSocketDisconnect:
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
    # 1. Notify Frontend
    await manager.broadcast({"type": "STATE_CHANGE", "state": "SUCCESS"})
    
    # 2. Tell MDB Service to Approve
    if mdb_service:
        mdb_service.approve_vend()
        
    # 3. Reset to IDLE after a delay (handled by frontend or another event)
    return {"status": "payment_simulated"}

if __name__ == "__main__":
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)

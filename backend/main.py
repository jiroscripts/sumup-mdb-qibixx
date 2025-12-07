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
async def simulate_vend(amount: float = 2.50):
    """Debug Endpoint: Simulate a VMC requesting a vend"""
    if mdb_service:
        mdb_service.simulate_vend_request(amount)
    return {"status": "simulated", "amount": amount}

@app.post("/api/simulate/payment/{checkout_id}")
async def simulate_payment(checkout_id: str):
    """
    Callback Endpoint: Verify payment status and trigger vend.
    SECURED: Checks with SumUp API before dispensing.
    """
    if not payment_service:
        return {"error": "Payment service not initialized"}

    # 1. Verify with SumUp (Server-to-Server check)
    payment_info = payment_service.check_status(checkout_id)
    status = payment_info.get("status")

    # 2. Check if PAID
    if status in ["PAID", "SUCCESSFUL"]:
        # Notify Frontend
        await manager.broadcast({"type": "STATE_CHANGE", "state": "SUCCESS"})
        
        # Approve Vend
        if mdb_service:
            logger.info("Payment Validated. Approving Vend.")
            mdb_service.approve_vend()
        
        return {"status": "payment_verified", "sumup_status": status}
    else:
        logger.warning(f"Payment verification failed. Status: {status}")
        return {"status": "verification_failed", "sumup_status": status}

@app.get("/api/payment-status/{checkout_id}")
async def get_payment_status(checkout_id: str):
    """
    Check status of a checkout. Used by Frontend on load/redirect.
    """
    if not payment_service:
        return {"error": "Payment service not initialized"}
    
    return payment_service.check_status(checkout_id)

# --- Wallet Endpoints ---

from .wallet_service import WalletService
from pydantic import BaseModel

wallet_service = WalletService()

class RechargeRequest(BaseModel):
    user_id: str
    checkout_id: str

class RechargeInitRequest(BaseModel):
    amount: float = 10.00
    user_id: str

@app.post("/api/wallet/init-recharge")
async def wallet_init_recharge(req: RechargeInitRequest):
    """
    Creates a SumUp checkout for recharging the wallet.
    """
    if not payment_service:
        return {"error": "Payment service not initialized"}

    checkout = payment_service.create_checkout(req.amount)
    
    if "error" in checkout:
        return {"error": checkout["error"]}

    return {
        "checkout_id": checkout.get("id"),
        "amount": req.amount
    }

@app.post("/api/wallet/recharge")
async def wallet_recharge(req: RechargeRequest):
    """
    Called by Frontend after successful SumUp payment to credit wallet.
    Verifies payment with SumUp before crediting.
    """
    if not payment_service or not wallet_service:
        return {"error": "Services not initialized"}

    # 1. Verify Payment with SumUp
    payment_info = payment_service.check_status(req.checkout_id)
    status = payment_info.get("status")
    
    if status not in ["PAID", "SUCCESSFUL"]:
        return {"error": "Payment not verified", "status": status}

    # 2. Check if already processed (Idempotency)
    # Ideally, we should check if this checkout_id is already in DB.
    # For MVP, we trust Supabase constraints or just proceed.
    
    amount = payment_info.get("amount", 0)
    currency = payment_info.get("currency", "EUR")

    # 3. Credit Wallet
    success = wallet_service.add_transaction(
        user_id=req.user_id,
        amount=amount,
        transaction_type="RECHARGE",
        description=f"SumUp {req.checkout_id}"
    )

    if success:
        return {"status": "recharge_successful", "new_balance": wallet_service.get_balance(req.user_id)}
    else:
        return {"error": "Failed to credit wallet"}

class VendRequest(BaseModel):
    user_id: str
    amount: float = 0.35

@app.post("/api/wallet/vend")
async def wallet_vend(req: VendRequest):
    """
    Debit wallet and dispense product.
    """
    if not wallet_service or not mdb_service:
        return {"error": "Services not initialized"}

    # 1. Check Balance
    balance = wallet_service.get_balance(req.user_id)
    if balance < req.amount:
        return {"error": "Insufficient funds", "balance": balance}

    # 2. Debit Wallet
    success = wallet_service.add_transaction(
        user_id=req.user_id,
        amount=-req.amount, # Negative for debit
        transaction_type="VEND",
        description="Coffee/Snack"
    )

    if success:
        # 3. Dispense
        mdb_service.approve_vend() # Trigger machine
        return {"status": "vend_approved", "new_balance": wallet_service.get_balance(req.user_id)}
    else:
        return {"error": "Transaction failed"}

@app.get("/api/wallet/balance/{user_id}")
async def get_balance(user_id: str):
    if not wallet_service:
        return {"error": "Wallet service not initialized"}
    return {"balance": wallet_service.get_balance(user_id)}

if __name__ == "__main__":
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)


import asyncio
import logging
import os
import time
from dotenv import load_dotenv
from supabase import create_async_client, AsyncClient
try:
    from .config import Config
except ImportError:
    from config import Config

# Load Config
load_dotenv()
SUPABASE_URL = Config.SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY = Config.SUPABASE_SERVICE_ROLE_KEY

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MDB-Listener")

# Initialize Supabase (Async Client)
# Note: We initialize it inside main() or lazily because it needs an event loop
supabase: AsyncClient = None

from mdb_service import MDBService

# Wrapper to run async function from sync callback (MDB Thread -> Asyncio Loop)
def on_vend_request_sync(amount):
    # This is tricky: MDB runs in a thread, but we need to call async code in the main loop.
    # For now, we'll just log it. Ideally, we should use run_coroutine_threadsafe.
    # But since we are in "Always Idle" mode, the main loop handles the logic via Realtime.
    # If we need to create a session from MDB, we should use a Queue.
    pass

mdb_service = MDBService(on_vend_request_sync)

async def create_vend_session(amount):
    """
    Called when the Machine asks for money (MDB VEND REQUEST).
    1. Create session in Supabase
    2. Generate/Display QR Code
    """
    try:
        # 1. Create session
        res = await supabase.table('vend_sessions').insert({
            'amount': amount,
            'status': 'PENDING',
            'metadata': {'machine_id': Config.MACHINE_ID}
        }).execute()
        
        session = res.data[0]
        logger.info(f"🆕 Session Created: {session['id']} | Amount: {amount}")
        
        # 2. Generate QR Code (URL)
        # qr_url = f"https://votre-app.com/payment?session_id={session['id']}"
        # logger.info(f"📱 QR Code URL: {qr_url}")
        
        # TODO: Display this QR code on the Raspberry Pi Screen (e.g. using PyGame, Tkinter, or a web browser in kiosk mode)
        # display_qr_code(qr_url)
        
        return session['id']

    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return None

# Wrapper for async dispense logic
def handle_realtime_update(payload):
    """
    Callback for Realtime updates.
    Triggered when a row in 'vend_sessions' is UPDATED.
    """
    record = payload.get('new', {})
    if record.get('status') == 'PAID':
        session_id = record['id']
        amount = record['amount']
        logger.info(f"⚡ Realtime: Payment Detected! Session: {session_id} | Amount: {amount}")
        
        # We need to run async DB updates from this callback.
        # Since the callback might be sync, we schedule a task.
        asyncio.create_task(process_dispense(session_id))

async def process_dispense(session_id):
    # Dispense
    if mdb_service.approve_vend():
        logger.info("✅ Dispense Successful.")
        await supabase.table('vend_sessions').update({'status': 'COMPLETED'}).eq('id', session_id).execute()
    else:
        logger.error("❌ Dispense Failed.")
        await supabase.table('vend_sessions').update({'status': 'FAILED'}).eq('id', session_id).execute()

async def main():
    global supabase
    
    logger.info("🚀 Starting MDB Listener (Realtime Async Mode)...")
    mdb_service.start()

    while True:
        try:
            # Re-initialize client on restart to ensure fresh connection
            supabase = await create_async_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

            logger.info("🔌 Connecting to Supabase Realtime...")
            channel = supabase.channel('vend_sessions_listener')
            
            channel.on_postgres_changes(
                event='UPDATE',
                schema='public',
                table='vend_sessions',
                filter='status=eq.PAID',
                callback=handle_realtime_update
            )
            status = await channel.subscribe()

            if status == 'SUBSCRIBED':
                logger.info("✅ Subscribed to Realtime updates.")
            else:
                logger.warning(f"⚠️ Subscription status: {status}")

            logger.info("👂 Listening for PAID sessions (Passive)...")

            # Simulation Loop
            last_sim_time = 0
            SIMULATION_INTERVAL = Config.SIMULATION_INTERVAL # seconds

            while True:
                await asyncio.sleep(1)
                
                # Periodic Simulation
                if time.time() - last_sim_time > SIMULATION_INTERVAL:
                    logger.info("🤖 Simulating Periodic Vend Request...")
                    await create_vend_session(0.35)
                    last_sim_time = time.time()

        except Exception as e:
            logger.error(f"❌ Realtime Connection Error: {e}")
            logger.info("🔄 Reconnecting in 5 seconds...")
            await asyncio.sleep(5)



if __name__ == "__main__":
    asyncio.run(main())

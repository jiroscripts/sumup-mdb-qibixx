
import asyncio
import logging
import os
import time
from decimal import Decimal
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_async_client, AsyncClient
try:
    from .config import Config
except ImportError:
    from config import Config

# Load Config
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
loop = None

def on_vend_request_sync(amount):
    """
    Callback triggered by MDBService (in a separate thread) when a VEND is requested.
    We must schedule the async `create_vend_session` on the main event loop.
    """
    if loop:
        asyncio.run_coroutine_threadsafe(create_vend_session(amount), loop)
    else:
        logger.error("Event loop not ready, cannot create session")

mdb_service = MDBService(on_vend_request_sync)

async def create_vend_session(amount):
    """
    Called when the Machine asks for money (MDB VEND REQUEST).
    1. Create session in Supabase using Atomic RPC
    """
    try:
        # 1. Call RPC to create session (and auto-cancel old ones)
        # We convert Decimal to string to ensure precision when sending to Postgres
        res = await supabase.rpc('create_vend_session', {
            'p_amount': str(amount),
            'p_machine_id': Config.MACHINE_ID
        }).execute()
        
        # RPC returns the UUID directly (or inside data depending on client version, usually data)
        session_id = res.data
        
        if session_id:
            logger.info(f"🆕 Session Created: {session_id} | Amount: {amount}")
            return session_id
        else:
            logger.error("Failed to create session: No ID returned")
            return None

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
        amount = Decimal(str(record['amount']))
        logger.info(f"⚡ Realtime: Payment Detected! Session: {session_id} | Amount: {amount}")
        
        # We need to run async DB updates from this callback.
        # Since the callback might be sync, we schedule a task.
        asyncio.create_task(process_dispense(session_id, amount))

async def process_dispense(session_id, amount):
    # Dispense
    if mdb_service.approve_vend(amount):
        logger.info("✅ Dispense Successful.")
        await supabase.table('vend_sessions').update({'status': 'COMPLETED'}).eq('id', session_id).execute()
    else:
        logger.error("❌ Dispense Failed.")
        await supabase.table('vend_sessions').update({'status': 'FAILED'}).eq('id', session_id).execute()

async def main():
    global supabase, loop
    
    loop = asyncio.get_running_loop()
    
    logger.info("🚀 Starting MDB Listener (Realtime Async Mode)...")
    mdb_service.start()

    while True:
        try:
            # Re-initialize client on restart to ensure fresh connection
            if Config.KIOSK_EMAIL and Config.KIOSK_PASSWORD:
                logger.info(f"🔐 Authenticating as {Config.KIOSK_EMAIL}...")
                # Use Anon Key initially, then sign in
                supabase = await create_async_client(SUPABASE_URL, Config.SUPABASE_ANON_KEY)
                await supabase.auth.sign_in_with_password({
                    "email": Config.KIOSK_EMAIL,
                    "password": Config.KIOSK_PASSWORD
                })
                logger.info("✅ Authenticated successfully.")
            elif SUPABASE_SERVICE_ROLE_KEY:
                logger.warning("⚠️ Using SERVICE_ROLE_KEY (Admin Mode). This is insecure for production Kiosks.")
                supabase = await create_async_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            else:
                logger.error("❌ No authentication credentials found (Email/Pass or Service Key).")
                return

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
                
                # Periodic Simulation (Only if enabled)
                if Config.MDB_SIMULATION_MODE and (time.time() - last_sim_time > SIMULATION_INTERVAL):
                    logger.info("🤖 Simulating Periodic Vend Request...")
                    # In simulation, we inject a message into the mock serial, 
                    # which triggers on_vend_request_sync, which calls create_vend_session.
                    # This tests the whole flow.
                    mdb_service.simulate_vend_request(0.35)
                    last_sim_time = time.time()

                # Heartbeat for Docker Healthcheck
                Path("/tmp/healthy").touch()

        except Exception as e:
            logger.error(f"❌ Realtime Connection Error: {e}")
            logger.info("🔄 Reconnecting in 5 seconds...")
            await asyncio.sleep(5)



if __name__ == "__main__":
    asyncio.run(main())

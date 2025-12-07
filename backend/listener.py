import asyncio
import logging
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from realtime.connection import Socket

# Load Config
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MDB-Listener")

# Initialize Supabase (Admin Client)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Mock MDB Service (Replace with real MDBService import)
class MDBService:
    def approve_vend(self):
        logger.info("✅ MDB: Vend Approved! Dispensing product...")
        return True

    def deny_vend(self):
        logger.info("❌ MDB: Vend Denied.")

mdb_service = MDBService()

async def process_vend_request(payload):
    """
    Handles a new row in 'vend_requests'.
    1. Check Balance (Double Check)
    2. Debit Wallet
    3. Dispense Product
    4. Update Request Status
    """
    record = payload.get('record')
    if not record:
        return

    request_id = record['id']
    user_id = record['user_id']
    amount = float(record['amount'])
    status = record['status']

    if status != 'PENDING':
        return

    logger.info(f"🔔 New Vend Request: {request_id} | User: {user_id} | Amount: {amount}")

    try:
        # 1. Check Balance (Server-side verification)
        res = supabase.table('wallets').select('balance').eq('user_id', user_id).single().execute()
        balance = float(res.data['balance']) if res.data else 0.0

        if balance < amount:
            logger.warning(f"Insufficient funds: {balance} < {amount}")
            supabase.table('vend_requests').update({'status': 'DENIED'}).eq('id', request_id).execute()
            return

        # 2. Debit Wallet (Insert Transaction)
        # Note: The trigger will auto-update the wallet balance
        tx_res = supabase.table('transactions').insert({
            'user_id': user_id,
            'amount': -amount, # Negative for debit
            'type': 'VEND',
            'description': 'Coffee/Snack',
            'metadata': {'request_id': request_id}
        }).execute()

        # 3. Dispense Product
        dispense_success = mdb_service.approve_vend()

        if dispense_success:
            # 4. Update Request Status
            supabase.table('vend_requests').update({'status': 'COMPLETED'}).eq('id', request_id).execute()
            logger.info("✅ Vend Completed Successfully")
        else:
            # Refund if dispense failed? (Optional complex logic)
            logger.error("Dispense failed (Hardware error)")
            supabase.table('vend_requests').update({'status': 'FAILED'}).eq('id', request_id).execute()

    except Exception as e:
        logger.error(f"Error processing vend: {e}")
        supabase.table('vend_requests').update({'status': 'FAILED'}).eq('id', request_id).execute()

def on_postgres_changes(payload, **kwargs):
    """Callback for Realtime changes"""
    if payload.get('eventType') == 'INSERT':
        asyncio.run(process_vend_request(payload))

async def main():
    logger.info("🚀 Starting MDB Listener...")
    
    # Subscribe to Realtime changes on 'vend_requests'
    # Note: The python supabase client realtime support is evolving.
    # We use the underlying socket logic or polling if realtime is unstable in python.
    # For simplicity/stability in Python, polling is often used, but let's try Realtime channel.
    
    # channel = supabase.channel('vend-channel')
    # channel.on('postgres_changes', 
    #            event='INSERT', 
    #            schema='public', 
    #            table='vend_requests', 
    #            callback=on_postgres_changes).subscribe()
    
    # logger.info("Listening for vend requests...")
    # while True:
    #     await asyncio.sleep(1)

    # ALTERNATIVE: Polling Loop (More robust for simple Python scripts)
    logger.info("Polling for PENDING requests...")
    while True:
        try:
            # Fetch PENDING requests
            res = supabase.table('vend_requests').select('*').eq('status', 'PENDING').execute()
            requests = res.data

            for req in requests:
                await process_vend_request({'record': req})
            
        except Exception as e:
            logger.error(f"Polling error: {e}")
        
        await asyncio.sleep(2) # Poll every 2 seconds

if __name__ == "__main__":
    asyncio.run(main())

import logging
from supabase import create_client, Client
from .config import Config

logger = logging.getLogger(__name__)

class WalletService:
    def __init__(self):
        self.supabase: Client = None
        if Config.SUPABASE_URL and Config.SUPABASE_SERVICE_ROLE_KEY:
            try:
                self.supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)
                logger.info("Supabase Client Initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase: {e}")
        else:
            logger.warning("Supabase credentials missing. Wallet features disabled.")

    def get_balance(self, user_id: str) -> float:
        """
        Fetches the current balance for a user.
        Uses the 'user_balances' view if available, or sums transactions.
        """
        if not self.supabase:
            return 0.0

        try:
            # Option A: Query the view (Recommended)
            response = self.supabase.table("user_balances").select("balance").eq("user_id", user_id).execute()
            if response.data:
                return float(response.data[0]['balance'])
            return 0.0
        except Exception as e:
            logger.error(f"Error fetching balance for {user_id}: {e}")
            return 0.0

    def add_transaction(self, user_id: str, amount: float, transaction_type: str, description: str = None) -> bool:
        """
        Adds a transaction (Credit or Debit).
        amount: Positive for Recharge, Negative for Spend.
        """
        if not self.supabase:
            return False

        try:
            data = {
                "user_id": user_id,
                "amount": amount,
                "type": transaction_type,
                "description": description
            }
            self.supabase.table("transactions").insert(data).execute()
            logger.info(f"Transaction added: {user_id} | {amount} | {transaction_type}")
            return True
        except Exception as e:
            logger.error(f"Error adding transaction: {e}")
            return False

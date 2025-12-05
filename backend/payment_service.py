import requests
import time
import logging
from .config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PaymentService:
    def __init__(self):
        self.access_token = None
        self.token_expiry = 0
        # In-memory store for mock transactions: {checkout_id: status}
        self.mock_transactions = {}

    def _get_token(self):
        """
        Authenticates with SumUp to get a Bearer token.
        """
        if self.access_token and time.time() < self.token_expiry:
            return self.access_token

        # MOCK MODE Check
        if Config.SUMUP_CLIENT_ID == "your_client_id" or Config.SUMUP_CLIENT_ID == "demo_client_id":
            logger.warning("Using MOCK SumUp Token. Update .env for real payments.")
            return "mock_token_12345"

        # REAL MODE: Client Credentials Flow
        url = f"{Config.SUMUP_API_URL}/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": Config.SUMUP_CLIENT_ID,
            "client_secret": Config.SUMUP_CLIENT_SECRET,
            "scope": "payments"
        }
        
        try:
            response = requests.post(url, data=payload)
            response.raise_for_status()
            data = response.json()
            self.access_token = data["access_token"]
            # Expire 60s before actual expiry to be safe
            self.token_expiry = time.time() + data.get("expires_in", 3600) - 60
            return self.access_token
        except Exception as e:
            logger.error(f"Failed to get SumUp token: {e}")
            return None

    def create_checkout(self, amount: float, currency: str = "EUR"):
        """
        Creates a checkout session to get a QR code / Payment Link.
        """
        token = self._get_token()
        if not token:
            return {"error": "Authentication failed"}

        if token == "mock_token_12345":
            checkout_id = f"mock_chk_{int(time.time())}"
            # Store initial state as PENDING
            self.mock_transactions[checkout_id] = "PENDING"
            
            # Return a mock checkout response
            return {
                "id": checkout_id,
                "checkout_reference": "REF123",
                "amount": amount,
                "currency": currency,
                "status": "PENDING",
                # In a real app, this would be the QR code URL or data
                "qr_code_url": f"https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=sumup_mock_payment_{amount}", 
                "message": "MOCK CHECKOUT CREATED"
            }

        url = f"{Config.SUMUP_API_URL}/v0.1/checkouts"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "checkout_reference": f"ORDER-{int(time.time())}",
            "amount": amount,
            "currency": currency,
            "pay_to_email": "merchant@example.com", # TODO: Get from config or account
            "description": "Vending Machine Purchase"
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to create checkout: {e}")
            return {"error": str(e)}

    def check_status(self, checkout_id: str):
        """
        Checks the status of a payment.
        """
        if checkout_id.startswith("mock_chk_"):
            # Return the stored status, default to PENDING if not found
            status = self.mock_transactions.get(checkout_id, "PENDING")
            return {"status": status}

        token = self._get_token()
        url = f"{Config.SUMUP_API_URL}/v0.1/checkouts/{checkout_id}"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to check status: {e}")
            return {"error": str(e)}

    def mock_update_status(self, checkout_id: str, status: str):
        """
        Helper to manually update the status of a mock transaction.
        """
        if checkout_id in self.mock_transactions:
            self.mock_transactions[checkout_id] = status
            return True
        return False

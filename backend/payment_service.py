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

    def _get_token(self):
        """
        Authenticates with SumUp to get a Bearer token.
        TODO: Implement proper token refresh logic.
        """
        if self.access_token and time.time() < self.token_expiry:
            return self.access_token

        # TODO: This is a placeholder. Real implementation needs Client Credentials Flow.
        # For POC, we might just assume the user puts a valid token in .env or we implement the flow.
        # Let's implement a basic Client Credentials flow.
        
        url = f"{Config.SUMUP_API_URL}/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": Config.SUMUP_CLIENT_ID,
            "client_secret": Config.SUMUP_CLIENT_SECRET,
            "scope": "payments" # Adjust scope as needed
        }
        
        try:
            # response = requests.post(url, data=payload)
            # response.raise_for_status()
            # data = response.json()
            # self.access_token = data["access_token"]
            # self.token_expiry = time.time() + data["expires_in"] - 60
            
            # MOCK TOKEN for POC if credentials are default
            if Config.SUMUP_CLIENT_ID == "your_client_id":
                logger.warning("Using MOCK SumUp Token. Update .env for real payments.")
                return "mock_token_12345"
                
            # return self.access_token
            pass
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
            # Return a mock checkout response
            return {
                "id": f"mock_chk_{int(time.time())}",
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
            # Mock logic: Always return PAID after 5 seconds? 
            # For now, let's just say it's PENDING until we simulate a payment event.
            # We can handle this in the main loop or just return PAID immediately for the demo?
            # Let's return PENDING by default, and maybe have a "Simulate Payment" button too?
            # Or just random for now?
            return {"status": "PAID"} # Auto-approve for POC convenience unless we add a button.

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

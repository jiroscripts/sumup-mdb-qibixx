import requests
import time
import logging
import os
from .config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PaymentService:
    def __init__(self):
        self.access_token = None
        self.token_expiry = 0
        self.base_url = Config.SUMUP_API_URL
        self.api_key = Config.SUMUP_API_KEY

    def _get_token(self):
        """
        Authenticates with SumUp to get a Bearer token.
        """
        # 1. API Key (Direct)
        if Config.SUMUP_API_KEY:
            return Config.SUMUP_API_KEY

        if self.access_token and time.time() < self.token_expiry:
            return self.access_token

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

    def _get_merchant_email(self):
        """
        Fetches the merchant's email or code from SumUp API or config.
        """
        # 1. Use Configured Code if valid
        if Config.SUMUP_MERCHANT_CODE and Config.SUMUP_MERCHANT_CODE != "your_real_merchant_code":
            return Config.SUMUP_MERCHANT_CODE
        
        # 2. Fetch from API using Token/Key
        token = self._get_token()
        if not token:
             return None

        url = f"{Config.SUMUP_API_URL}/v0.1/me"
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Fetched Merchant Profile: {data}") 
            email = data.get("email") or data.get("merchant_profile", {}).get("merchant_code")
            logger.info(f"Resolved Pay To: {email}")
            return email
        except Exception as e:
            logger.error(f"Failed to fetch merchant profile: {e}")
            return None

    def _get_frontend_url(self):
        """
        Resolves the frontend URL.
        Priority:
        1. FRONTEND_URL env var (Tunnel/Prod)
        2. Auto-detected Local IP (Dev)
        3. Localhost fallback
        """
        url = os.getenv("FRONTEND_URL")
        if url:
            return url.rstrip('/')

        try:
            # "Exotic" but effective way to get the real local IP
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "127.0.0.1"
            
        return f"http://{local_ip}:5174"

    def create_checkout(self, amount: float, currency: str = "EUR"):
        """
        Creates a checkout session via SumUp API.
        """
        token = self._get_token()
        if not token:
            return {"error": "Authentication failed"}

        # Real API Call
        url = f"{self.base_url}/v0.1/checkouts"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        pay_to = self._get_merchant_email()
        if not pay_to:
             return {"error": "Could not resolve Merchant Email/Code."}

        frontend_url = self._get_frontend_url()

        payload = {
            "checkout_reference": f"ORDER-{int(time.time())}",
            "amount": round(amount, 2),
            "currency": currency,
            "pay_to_email": pay_to, 
            "description": "Vending Machine Purchase",
            "return_url": f"{frontend_url}/payment",
            "customer_email": "customer@example.com" 
        }
        
        # Handle merchant code vs email
        if "@" not in pay_to:
             del payload["pay_to_email"]
             payload["merchant_code"] = pay_to

        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Checkout Created: {data.get('id')}")
            
            # Construct QR Code URL
            data["qr_code_url"] = f"{frontend_url}/payment?checkout_id={data['id']}"
            return data
        except Exception as e:
            logger.error(f"Failed to create checkout: {e}")
            if hasattr(e, 'response') and e.response is not None:
                 logger.error(f"SumUp Error Body: {e.response.text}")
            return {"error": str(e)}

    def check_status(self, checkout_id: str):
        """
        Checks the status of a checkout via API.
        """
        if checkout_id.startswith("mock_chk_"):
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

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # SumUp API Configuration
    SUMUP_CLIENT_ID = os.getenv("SUMUP_CLIENT_ID", "your_client_id")
    SUMUP_CLIENT_SECRET = os.getenv("SUMUP_CLIENT_SECRET", "your_client_secret")
    SUMUP_MERCHANT_CODE = os.getenv("SUMUP_MERCHANT_CODE", "your_merchant_code")
    SUMUP_API_URL = "https://api.sumup.com"

    # MDB / Serial Configuration
    # Set to True to use Mock Serial (no hardware required)
    MDB_SIMULATION_MODE = os.getenv("MDB_SIMULATION_MODE", "True").lower() == "true"
    
    # Path to the real serial port (e.g., /dev/ttyAMA0 for Pi Hat)
    SERIAL_PORT = os.getenv("SERIAL_PORT", "/dev/ttyAMA0")
    BAUD_RATE = 9600 # Standard MDB baud rate, check Qibixx docs if different (often 115200 for the Hat interface itself)

    # Server Configuration
    HOST = "0.0.0.0"
    PORT = 8000

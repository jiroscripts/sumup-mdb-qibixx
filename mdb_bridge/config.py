import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # SumUp API Configuration
    # Option 1: API Key (Simpler, recommended for backend scripts)
    SUMUP_API_KEY = os.getenv("SUMUP_API_KEY")
    
    SUMUP_MERCHANT_CODE = os.getenv("SUMUP_MERCHANT_CODE") # Optional if we fetch from API
    SUMUP_API_URL = "https://api.sumup.com"

    # MDB / Serial Configuration
    # Set to True to use Mock Serial (no hardware required)
    MDB_SIMULATION_MODE = os.getenv("MDB_SIMULATION_MODE", "True").lower() == "true"
    
    # Path to the real serial port (e.g., /dev/ttyAMA0 for Pi Hat)
    MDB_SERIAL_PORT = os.getenv("MDB_SERIAL_PORT", "/dev/ttyUSB0")
    
    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    BAUD_RATE = 115200 # Qibixx MDB Pi Hat uses 115200 to talk to the Pi

    # Server Configuration
    HOST = "0.0.0.0"
    PORT = 8000

    # Application Configuration
    MACHINE_ID = os.getenv("MACHINE_ID")
    SIMULATION_INTERVAL = int(os.getenv("SIMULATION_INTERVAL", 30))

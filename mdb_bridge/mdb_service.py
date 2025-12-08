import serial
import time
import threading
import logging
import queue
from decimal import Decimal, InvalidOperation
try:
    from .config import Config
except ImportError:
    from config import Config

logger = logging.getLogger(__name__)

class MockSerial:
    """
    Simulates a serial port for testing without hardware.
    Allows injecting data into the 'read' buffer.
    """
    def __init__(self):
        self.in_waiting = 0
        self._buffer = queue.Queue()
        self.is_open = True
        logger.info("MockSerial initialized")

    def read(self, size=1):
        if self._buffer.empty():
            return b""
        data = self._buffer.get()
        return data

    def write(self, data):
        logger.info(f"[MOCK SERIAL WRITE] >> {data}")
        return len(data)

    def inject_data(self, data: bytes):
        """Helper to simulate data coming FROM the VMC"""
        logger.info(f"[MOCK SERIAL INJECT] << {data}")
        for byte in data:
            self._buffer.put(bytes([byte]))

    def close(self):
        self.is_open = False

class MDBService:
    def __init__(self, on_vend_request_callback):
        self.serial = None
        self.running = False
        self.thread = None
        self.on_vend_request = on_vend_request_callback
        
        # Buffer for incoming data
        self.buffer = b""
        self.current_vend_amount = None

    def start(self):
        self.running = True
        if Config.MDB_SIMULATION_MODE:
            self.serial = MockSerial()
        else:
            try:
                self.serial = serial.Serial(
                    Config.SERIAL_PORT, 
                    Config.BAUD_RATE, 
                    timeout=0.1
                )
            except Exception as e:
                logger.error(f"Failed to open serial port: {e}")
                return

        # Enable Cashless Device (Qibixx Protocol)
        self._send_command("C,1")

        self.thread = threading.Thread(target=self._loop)
        self.thread.daemon = True
        self.thread.start()
        logger.info("MDB Service started")

    def stop(self):
        self.running = False
        self._send_command("C,0") # Disable Cashless Device
        if self.serial:
            self.serial.close()

    def _loop(self):
        while self.running:
            try:
                if self.serial and self.serial.is_open:
                    # Read byte by byte to handle partial lines
                    chunk = self.serial.read(1)
                    if chunk:
                        self.buffer += chunk
                        if b'\n' in self.buffer:
                            line, self.buffer = self.buffer.split(b'\n', 1)
                            self._handle_message(line.decode('utf-8').strip())
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"Error in MDB loop: {e}")
                time.sleep(0.1)

    def _handle_message(self, message):
        logger.info(f"Received MDB Message: {message}")
        
        # Handle Status Messages
        if "STATUS,ENABLED" in message:
            logger.info("✅ Cashless Device ENABLED by VMC.")
        elif "STATUS,DISABLED" in message:
            logger.warning("⛔ Cashless Device DISABLED by VMC.")
        
        # Qibixx Protocol: c,STATUS,VEND,<amount>,<item>
        # Example: c,STATUS,VEND,1.00,2
        elif "STATUS,VEND" in message:
            try:
                parts = message.split(',')
                # parts[0] = c
                # parts[1] = STATUS
                # parts[2] = VEND
                # parts[3] = amount
                # parts[4] = item (optional sometimes)
                
                if len(parts) >= 4:
                    amount_str = parts[3]
                    amount = Decimal(amount_str)
                    self.current_vend_amount = amount
                    
                    logger.info(f"Vending Request for {amount} EUR")
                    if self.on_vend_request:
                        self.on_vend_request(amount)
            except ValueError:
                logger.error("Invalid VEND format")

    def _to_decimal(self, value):
        """Helper to safely convert to Decimal with 2 places"""
        try:
            return Decimal(str(value)).quantize(Decimal("0.00"))
        except (ValueError, TypeError, InvalidOperation):
            return None

    def approve_vend(self, paid_amount):
        """Sends APPROVE signal to VMC (C,VEND,<amount>)"""
        if self.current_vend_amount is None:
            logger.error("Cannot approve vend: No active vend request")
            return False

        # 1. Conversion & Validation
        paid_val = self._to_decimal(paid_amount)
        requested_val = self._to_decimal(self.current_vend_amount)

        # 2. Security Check (Si l'un est None ou s'ils sont différents => Erreur)
        if not paid_val or not requested_val or paid_val != requested_val:
            logger.error(f"🚨 SECURITY ALERT: Amount Mismatch or Invalid! Paid: {paid_val}, Requested: {requested_val}")
            return False

        # 3. Action
        self._send_command(f"C,VEND,{requested_val}")
        self.current_vend_amount = None
        return True
        
        # Removed else block as it is handled by the initial check

    def deny_vend(self):
        """Sends DENY signal to VMC (C,STOP)"""
        self._send_command("C,STOP")
        self.current_vend_amount = None # Reset state

    def _send_command(self, command):
        """Helper to send command with newline"""
        if self.serial:
            msg = f"{command}\n".encode('utf-8')
            self.serial.write(msg)

    # --- Simulation Helpers ---
    def simulate_vend_request(self, amount: float = 2.50):
        """Injects a fake VEND_REQ message into the serial reader"""
        if isinstance(self.serial, MockSerial):
            # Simulate Qibixx format
            msg = f"c,STATUS,VEND,{amount:.2f},1\n".encode('utf-8')
            self.serial.inject_data(msg)
        else:
            logger.warning("Cannot simulate vend request in Real Hardware mode")

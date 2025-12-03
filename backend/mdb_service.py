import serial
import time
import threading
import logging
import queue
from .config import Config

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

        self.thread = threading.Thread(target=self._loop)
        self.thread.daemon = True
        self.thread.start()
        logger.info("MDB Service started")

    def stop(self):
        self.running = False
        if self.serial:
            self.serial.close()

    def _loop(self):
        while self.running:
            try:
                if self.serial and self.serial.is_open:
                    # Simple line-based reading for POC
                    # In real MDB, this might be binary, but Qibixx often wraps it.
                    # We'll assume a newline-terminated ASCII protocol for this POC.
                    
                    # Read byte by byte to handle partial lines
                    chunk = self.serial.read(1)
                    if chunk:
                        self.buffer += chunk
                        if b'\n' in self.buffer:
                            line, self.buffer = self.buffer.split(b'\n', 1)
                            self._handle_message(line.decode('utf-8').strip())
                else:
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Error in MDB loop: {e}")
                time.sleep(1)

    def _handle_message(self, message):
        logger.info(f"Received MDB Message: {message}")
        
        # Protocol Logic (Simplified)
        # VMC sends: "VEND_REQ: <AMOUNT>"
        if message.startswith("VEND_REQ:"):
            try:
                _, amount_str = message.split(":")
                amount = float(amount_str.strip())
                logger.info(f"Vending Request for {amount} EUR")
                if self.on_vend_request:
                    self.on_vend_request(amount)
            except ValueError:
                logger.error("Invalid VEND_REQ format")

    def approve_vend(self):
        """Sends APPROVE signal to VMC"""
        msg = b"APPROVE\n"
        if self.serial:
            self.serial.write(msg)

    def deny_vend(self):
        """Sends DENY signal to VMC"""
        msg = b"DENY\n"
        if self.serial:
            self.serial.write(msg)

    # --- Simulation Helpers ---
    def simulate_vend_request(self, amount: float):
        """Injects a fake VEND_REQ message into the serial reader"""
        if isinstance(self.serial, MockSerial):
            msg = f"VEND_REQ: {amount:.2f}\n".encode('utf-8')
            self.serial.inject_data(msg)
        else:
            logger.warning("Cannot simulate vend request in Real Hardware mode")

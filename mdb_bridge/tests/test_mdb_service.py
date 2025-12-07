import unittest
from unittest.mock import MagicMock
import time
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mdb_service import MDBService, MockSerial
from config import Config

class TestMDBService(unittest.TestCase):
    def setUp(self):
        # Force simulation mode for tests
        Config.MDB_SIMULATION_MODE = True
        self.callback = MagicMock()
        self.service = MDBService(self.callback)
        self.service.start()

    def tearDown(self):
        self.service.stop()

    def test_vend_request_parsing(self):
        """Test that a valid VEND_REQ triggers the callback with correct amount"""
        # Inject data
        self.service.simulate_vend_request(1.50)
        
        # Wait for thread to process
        time.sleep(0.2)
        
        # Check callback
        self.callback.assert_called_with(1.50)

    def test_invalid_vend_request(self):
        """Test that invalid VEND_REQ does not trigger callback"""
        if isinstance(self.service.serial, MockSerial):
            self.service.serial.inject_data(b"VEND_REQ: INVALID\n")
            
        time.sleep(0.2)
        self.callback.assert_not_called()

if __name__ == '__main__':
    unittest.main()

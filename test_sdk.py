import sumup
import os
from dotenv import load_dotenv

load_dotenv()

print("Inspecting sumup package:")
print(dir(sumup))

# Try to find the Client class
if hasattr(sumup, 'Client'):
    print("Found Client class")
elif hasattr(sumup, 'SumUp'):
    print("Found SumUp class")
else:
    print("No obvious Client class found. Checking _client...")
    try:
        from sumup._client import Client
        print("Found Client in _client")
    except ImportError:
        print("Could not import Client from _client")

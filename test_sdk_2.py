from sumup import SumUp

try:
    client = SumUp(access_token="TEST_TOKEN")
    print("Success: Client initialized")
except Exception as e:
    print(f"Error: {e}")

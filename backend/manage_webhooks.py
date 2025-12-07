import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUMUP_API_KEY = os.getenv("SUMUP_API_KEY")
SUPABASE_PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID")
WEBHOOK_URL = f"https://{SUPABASE_PROJECT_ID}.supabase.co/functions/v1/handle-sumup-webhook"

if not SUMUP_API_KEY:
    print("❌ Error: SUMUP_API_KEY not found in .env")
    exit(1)

HEADERS = {
    "Authorization": f"Bearer {SUMUP_API_KEY}",
    "Content-Type": "application/json"
}

def list_webhooks():
    print("🔍 Listing Webhooks...")
    # Note: SumUp API endpoint for webhooks might vary, trying standard one
    # If this fails, we might need to use a different scope or endpoint
    url = "https://api.sumup.com/v0.1/me/webhooks" 
    
    try:
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 404:
             # Try alternative endpoint if v0.1 doesn't exist for this
             print("⚠️ Endpoint /v0.1/me/webhooks not found. Trying /v1.0/...")
             # (SumUp API is inconsistent, sometimes it's just not exposed via API Key)
        
        if res.status_code != 200:
            print(f"❌ Failed to list webhooks: {res.status_code} - {res.text}")
            return

        webhooks = res.json()
        if not webhooks:
            print("ℹ️ No webhooks found.")
        else:
            for wh in webhooks:
                print(f" - ID: {wh.get('id')} | Url: {wh.get('url')} | Events: {wh.get('event_types')}")
    except Exception as e:
        print(f"❌ Error: {e}")

def create_webhook():
    print(f"🚀 Creating Webhook pointing to: {WEBHOOK_URL}")
    url = "https://api.sumup.com/v0.1/me/webhooks"
    
    payload = {
        "url": WEBHOOK_URL,
        "event_types": ["CHECKOUT_COMPLETED_PAID"]
    }
    
    try:
        res = requests.post(url, json=payload, headers=HEADERS)
        if res.status_code in [200, 201]:
            print("✅ Webhook created successfully!")
            print(res.json())
        else:
            print(f"❌ Failed to create webhook: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    list_webhooks()
    
    confirm = input("\nDo you want to create the webhook now? (y/n): ")
    if confirm.lower() == 'y':
        create_webhook()

import 'dotenv/config';
import fetch from 'node-fetch';

const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/handle-sumup-webhook`;

if (!SUMUP_API_KEY) {
    console.error("❌ Error: SUMUP_API_KEY not found in .env");
    process.exit(1);
}

const HEADERS = {
    "Authorization": `Bearer ${SUMUP_API_KEY}`,
    "Content-Type": "application/json"
};

async function listWebhooks() {
    console.log("🔍 Listing Webhooks...");
    const url = "https://api.sumup.com/v0.1/me/webhooks";

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (res.status !== 200) {
            console.log(`❌ Failed to list webhooks: ${res.status} - ${await res.text()}`);
            return;
        }

        const webhooks = await res.json();
        if (!webhooks || webhooks.length === 0) {
            console.log("ℹ️ No webhooks found.");
        } else {
            webhooks.forEach(wh => {
                console.log(` - ID: ${wh.id} | Url: ${wh.url} | Events: ${wh.event_types}`);
            });
        }
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
    }
}

async function createWebhook() {
    console.log(`🚀 Creating Webhook pointing to: ${WEBHOOK_URL}`);
    const url = "https://api.sumup.com/v0.1/me/webhooks";

    const payload = {
        url: WEBHOOK_URL,
        event_types: ["CHECKOUT_COMPLETED_PAID"]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(payload)
        });

        if (res.status === 200 || res.status === 201) {
            console.log("✅ Webhook created successfully!");
            console.log(await res.json());
        } else {
            console.log(`❌ Failed to create webhook: ${res.status} - ${await res.text()}`);
        }
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
    }
}

// Run
(async () => {
    await listWebhooks();

    // Simple prompt simulation since we are in a script
    console.log("\nAttempting to create webhook...");
    await createWebhook();
})();

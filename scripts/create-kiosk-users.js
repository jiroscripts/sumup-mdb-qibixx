const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUsers() {
    const users = [
        {
            email: process.env.BRIDGE_EMAIL || 'bridge-01@project.com',
            password: process.env.BRIDGE_PASSWORD || 'Bridge2025!Secure',
            role: 'bridge',
            machine_id: 'pi_kiosk_1'
        },
        {
            email: process.env.DISPLAY_EMAIL || 'display-01@project.com',
            password: process.env.DISPLAY_PASSWORD || 'Display2025!Secure',
            role: 'display',
            machine_id: 'pi_kiosk_1'
        }
    ];

    console.log("🔄 Syncing Kiosk Users...");

    // 1. List existing users
    const { data: { users: existingUsers }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Error listing users:", listError);
        return;
    }

    for (const u of users) {
        const existing = existingUsers.find(eu => eu.email === u.email);

        if (existing) {
            console.log(`🔹 Updating ${u.email} (${u.role})...`);
            await supabase.auth.admin.updateUserById(existing.id, {
                password: u.password,
                app_metadata: { app_role: u.role },
                user_metadata: { machine_id: u.machine_id },
                email_confirm: true
            });
        } else {
            console.log(`✨ Creating ${u.email} (${u.role})...`);
            await supabase.auth.admin.createUser({
                email: u.email,
                password: u.password,
                email_confirm: true,
                app_metadata: { app_role: u.role },
                user_metadata: { machine_id: u.machine_id }
            });
        }
    }
    console.log("✅ Users synced successfully.");
}

createUsers();

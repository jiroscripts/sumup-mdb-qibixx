const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createKioskUser() {
    const email = process.env.VITE_KIOSK_EMAIL || 'kiosk-01@project.com';
    const password = process.env.VITE_KIOSK_PASSWORD || 'Kiosk2025!Secure';

    console.log(`Creating user ${email}...`);

    // 1. Check if user exists (by trying to sign in or list users)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        console.log('✅ User already exists. Updating password/metadata...');
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
                password: password,
                app_metadata: { app_role: 'kiosk' },
                user_metadata: { machine_id: 'pi_kiosk_1' },
                email_confirm: true
            }
        );
        if (updateError) {
            console.error('❌ Error updating user:', updateError);
        } else {
            console.log('✅ User updated successfully.');
        }
        return;
    }

    // 2. Create User
    const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        app_metadata: { app_role: 'kiosk' },
        user_metadata: { machine_id: 'pi_kiosk_1' }
    });

    if (error) {
        console.error('❌ Error creating user:', error);
    } else {
        console.log('✅ User created successfully:', data.user.id);

        // 3. Ensure Wallet exists (optional, handled by trigger usually but good to be safe)
        // Note: We can't insert into public.wallets easily from here without RLS bypass or service role client on public schema
    }
}

createKioskUser();

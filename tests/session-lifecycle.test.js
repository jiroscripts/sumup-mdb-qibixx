import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIDGE_EMAIL = process.env.BRIDGE_EMAIL || 'bridge-01@project.com';
const BRIDGE_PASSWORD = process.env.BRIDGE_PASSWORD || 'Bridge2025!Secure';

if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('Session Lifecycle & Concurrency', () => {
    const MACHINE_ID = 'test_machine_lifecycle_' + Date.now();

    // Helper to create a session via Bridge
    async function createSession(amount) {
        const bridgeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await bridgeClient.auth.signInWithPassword({
            email: BRIDGE_EMAIL,
            password: BRIDGE_PASSWORD
        });
        const { data, error } = await bridgeClient.rpc('create_vend_session', {
            p_amount: amount,
            p_machine_id: MACHINE_ID
        });
        if (error) throw error;
        return data; // session_id
    }

    it('should AUTO-CANCEL the previous session when a new one is created for the SAME machine', async () => {
        // 1. Create Session A
        const sessionA_ID = await createSession(1.50);

        // Verify A is PENDING
        const { data: sessionA_Initial } = await adminClient
            .from('vend_sessions')
            .select('status')
            .eq('id', sessionA_ID)
            .single();
        expect(sessionA_Initial.status).toBe('PENDING');

        // 2. Create Session B (Same Machine)
        const sessionB_ID = await createSession(2.00);

        // 3. Verify A is CANCELLED and B is PENDING
        const { data: sessionA_Final } = await adminClient
            .from('vend_sessions')
            .select('status')
            .eq('id', sessionA_ID)
            .single();

        const { data: sessionB_Final } = await adminClient
            .from('vend_sessions')
            .select('status')
            .eq('id', sessionB_ID)
            .single();

        expect(sessionA_Final.status).toBe('CANCELLED');
        expect(sessionB_Final.status).toBe('PENDING');
    });
});

import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRIDGE_EMAIL = process.env.BRIDGE_EMAIL || 'bridge-01@project.com';
const BRIDGE_PASSWORD = process.env.BRIDGE_PASSWORD || 'Bridge2025!Secure';

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for E2E tests.");
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('E2E Payment Flow', () => {
    const TEST_EMAIL = `test_client_${Date.now()}@example.com`;
    const TEST_PASSWORD = 'TestPassword123!';
    const MACHINE_ID = 'test_machine_e2e';
    const ITEM_PRICE = 2.50;
    const INITIAL_BALANCE = 10.00;
    let userId = null;
    let sessionId = null;

    afterAll(async () => {
        if (userId) {
            await adminClient.auth.admin.deleteUser(userId);
        }
    });

    it('should complete a full payment cycle', async () => {
        // 1. Create Test User
        const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            email_confirm: true
        });
        expect(userError).toBeNull();
        userId = userData.user.id;

        // 2. Credit Wallet
        const { error: walletError } = await adminClient
            .from('wallets')
            .insert({ user_id: userId, balance: INITIAL_BALANCE });
        expect(walletError).toBeNull();

        // 3. Bridge: Create Session
        const bridgeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await bridgeClient.auth.signInWithPassword({
            email: BRIDGE_EMAIL,
            password: BRIDGE_PASSWORD
        });

        const { data: sessionData, error: sessionError } = await bridgeClient.rpc('create_vend_session', {
            p_amount: ITEM_PRICE,
            p_machine_id: MACHINE_ID
        });
        expect(sessionError).toBeNull();
        sessionId = sessionData;
        expect(sessionId).toBeDefined();

        // 4. Client: Pay
        // Note: We simulate the Edge Function call by using Admin RPC directly
        // In a real scenario, the client calls an Edge Function which calls this RPC.
        const { data: paymentData, error: paymentError } = await adminClient.rpc('process_vend_payment', {
            p_session_id: sessionId,
            p_user_id: userId
        });
        expect(paymentError).toBeNull();
        expect(paymentData.success).toBe(true);
        expect(paymentData.new_balance).toBe(INITIAL_BALANCE - ITEM_PRICE);

        // 5. Verify State
        const { data: sessionCheck } = await adminClient
            .from('vend_sessions')
            .select('status')
            .eq('id', sessionId)
            .single();
        expect(sessionCheck.status).toBe('PAID');

        const { data: walletCheck } = await adminClient
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();
        expect(parseFloat(walletCheck.balance)).toBe(INITIAL_BALANCE - ITEM_PRICE);
    });
});

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

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for tests.");
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('Payment Edge Cases', () => {
    const MACHINE_ID = 'test_machine_edge';
    let userIds = [];

    // Helper to create a user with balance
    async function createUserWithBalance(balance) {
        const email = `test_edge_${Date.now()}_${Math.random()}@example.com`;
        const { data: userData } = await adminClient.auth.admin.createUser({
            email,
            password: 'TestPassword123!',
            email_confirm: true
        });
        const userId = userData.user.id;
        userIds.push(userId);

        if (balance > 0) {
            await adminClient.from('wallets').insert({ user_id: userId, balance });
        } else {
            // Ensure wallet exists even with 0 balance
            await adminClient.from('wallets').insert({ user_id: userId, balance: 0 });
        }
        return userId;
    }

    // Helper to create a session
    async function createSession(amount) {
        const bridgeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await bridgeClient.auth.signInWithPassword({
            email: BRIDGE_EMAIL,
            password: BRIDGE_PASSWORD
        });
        const { data } = await bridgeClient.rpc('create_vend_session', {
            p_amount: amount,
            p_machine_id: MACHINE_ID
        });
        return data; // session_id
    }

    afterAll(async () => {
        for (const uid of userIds) {
            await adminClient.auth.admin.deleteUser(uid);
        }
    });

    it('should REJECT payment if Insufficient Funds', async () => {
        const userId = await createUserWithBalance(0.50); // Only 0.50€
        const sessionId = await createSession(1.00);      // Item costs 1.00€

        const { error } = await adminClient.rpc('process_vend_payment', {
            p_session_id: sessionId,
            p_user_id: userId,
            p_idempotency_key: 'test_idempotency_insufficient_' + Date.now()
        });

        expect(error).toBeDefined();
        expect(error.message).toContain('Insufficient funds');

        // Verify session is NOT paid
        const { data: session } = await adminClient.from('vend_sessions').select('status').eq('id', sessionId).single();
        expect(session.status).toBe('PENDING');
    });

    it('should PREVENT Double Spending (Concurrent Requests)', async () => {
        const userId = await createUserWithBalance(10.00);
        const sessionId = await createSession(2.00);

        // Launch 2 payments simultaneously
        // Launch 2 payments simultaneously with DIFFERENT idempotency keys (to test race condition, not idempotency)
        // If we used the same key, the second one would just return success (idempotent replay).
        // Here we want to verify that the database LOCKS prevent double spending even if keys are different.
        const pay1 = adminClient.rpc('process_vend_payment', { p_session_id: sessionId, p_user_id: userId, p_idempotency_key: 'race_1_' + Date.now() });
        const pay2 = adminClient.rpc('process_vend_payment', { p_session_id: sessionId, p_user_id: userId, p_idempotency_key: 'race_2_' + Date.now() });

        const results = await Promise.allSettled([pay1, pay2]);

        // Count successes and failures
        const successes = results.filter(r => r.status === 'fulfilled' && !r.value.error);
        const failures = results.filter(r => (r.status === 'fulfilled' && r.value.error) || r.status === 'rejected');

        // Only ONE should succeed
        expect(successes.length).toBe(1);
        expect(failures.length).toBe(1);

        // Verify balance: Should be 8.00 (10 - 2), NOT 6.00
        const { data: wallet } = await adminClient.from('wallets').select('balance').eq('user_id', userId).single();
        expect(parseFloat(wallet.balance)).toBe(8.00);
    });

    it('should REJECT payment for already PAID session', async () => {
        const userId = await createUserWithBalance(10.00);
        const sessionId = await createSession(2.00);

        // First payment: Success
        const { error: err1 } = await adminClient.rpc('process_vend_payment', { p_session_id: sessionId, p_user_id: userId, p_idempotency_key: 'paid_1_' + Date.now() });
        expect(err1).toBeNull();

        // Second payment: Fail
        const { error: err2 } = await adminClient.rpc('process_vend_payment', { p_session_id: sessionId, p_user_id: userId, p_idempotency_key: 'paid_2_' + Date.now() });

        expect(err2).toBeDefined();
        // The error message depends on your RPC logic, usually "Session is not PENDING" or similar
        expect(err2.message).toMatch(/(Session already used|Session invalid)/i);
    });
});

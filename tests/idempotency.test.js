import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v7 as uuidv7 } from 'uuid';

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

describe('Database Integrity & Idempotency', () => {
    const MACHINE_ID = 'test_machine_idempotency';
    let userIds = [];

    // Helper to create a user with balance
    async function createUserWithBalance(balance) {
        const email = `test_idempotency_${Date.now()}_${Math.random()}@example.com`;
        const { data: userData } = await adminClient.auth.admin.createUser({
            email,
            password: 'TestPassword123!',
            email_confirm: true
        });
        const userId = userData.user.id;
        userIds.push(userId);

        await adminClient.from('wallets').insert({ user_id: userId, balance });
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

    it('should be IDEMPOTENT: Replaying the same request should return success but NOT charge twice', async () => {
        const INITIAL_BALANCE = 10.00;
        const PRICE = 2.00;
        const userId = await createUserWithBalance(INITIAL_BALANCE);
        const sessionId = await createSession(PRICE);
        const idempotencyKey = uuidv7();

        // 1. First Call
        const { data: res1, error: err1 } = await adminClient.rpc('process_vend_payment', {
            p_session_id: sessionId,
            p_user_id: userId,
            p_idempotency_key: idempotencyKey
        });

        expect(err1).toBeNull();
        expect(res1.success).toBe(true);
        expect(res1.new_balance).toBe(INITIAL_BALANCE - PRICE);

        // 2. Second Call (Replay with SAME key)
        const { data: res2, error: err2 } = await adminClient.rpc('process_vend_payment', {
            p_session_id: sessionId,
            p_user_id: userId,
            p_idempotency_key: idempotencyKey
        });

        // Should still be success (it returns the previous result)
        expect(err2).toBeNull();
        expect(res2.success).toBe(true);
        // Balance should be same as after first call (8.00), NOT 6.00
        expect(res2.new_balance).toBe(INITIAL_BALANCE - PRICE);

        // 3. Verify Database State
        const { data: wallet } = await adminClient
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        expect(parseFloat(wallet.balance)).toBe(INITIAL_BALANCE - PRICE);

        // Verify only ONE transaction exists for this key
        const { count } = await adminClient
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('idempotency_key', idempotencyKey);

        expect(count).toBe(1);
    });

    it('should PREVENT Double Debit: A single successful payment should only deduct once', async () => {
        // This tests the regression where we had both manual UPDATE and Trigger UPDATE
        const INITIAL_BALANCE = 20.00;
        const PRICE = 5.00;
        const userId = await createUserWithBalance(INITIAL_BALANCE);
        const sessionId = await createSession(PRICE);
        const idempotencyKey = uuidv7();

        const { error } = await adminClient.rpc('process_vend_payment', {
            p_session_id: sessionId,
            p_user_id: userId,
            p_idempotency_key: idempotencyKey
        });
        expect(error).toBeNull();

        // Check balance
        const { data: wallet } = await adminClient
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        // Should be 15.00. If it's 10.00, we have a double debit bug.
        expect(parseFloat(wallet.balance)).toBe(INITIAL_BALANCE - PRICE);
    });
});

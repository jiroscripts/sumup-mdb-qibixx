import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v7 as uuidv7 } from 'uuid';

dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe('Wallet Recharge Flow (Webhook Simulation)', () => {
    let userId = null;

    afterAll(async () => {
        if (userId) await adminClient.auth.admin.deleteUser(userId);
    });

    it('should CREDIT wallet when a RECHARGE transaction is inserted (Simulating Stripe Webhook)', async () => {
        // 1. Create User
        const email = `test_recharge_${Date.now()}@example.com`;
        const { data: userData } = await adminClient.auth.admin.createUser({
            email,
            password: 'TestPassword123!',
            email_confirm: true
        });
        userId = userData.user.id;

        // Ensure wallet exists (should be 0)
        await adminClient.rpc('_ensure_wallet_for_user', { p_user: userId });

        // 2. Simulate Stripe Webhook: Insert COMPLETED RECHARGE transaction
        const RECHARGE_AMOUNT = 50.00;
        const idempotencyKey = uuidv7();

        const { error } = await adminClient
            .from('transactions')
            .insert({
                user_id: userId,
                amount: RECHARGE_AMOUNT,
                type: 'RECHARGE',
                status: 'COMPLETED',
                description: 'Stripe Top-up',
                idempotency_key: idempotencyKey
            });

        expect(error).toBeNull();

        // 3. Verify Wallet Balance (Trigger should have fired)
        const { data: wallet } = await adminClient
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        expect(parseFloat(wallet.balance)).toBe(RECHARGE_AMOUNT);
    });

    it('should PREVENT duplicate recharges using Database Constraints', async () => {
        // Reuse the same user
        const RECHARGE_AMOUNT = 20.00;
        const idempotencyKey = uuidv7(); // Unique key for this test

        // 1. First Recharge
        const { error: err1 } = await adminClient
            .from('transactions')
            .insert({
                user_id: userId,
                amount: RECHARGE_AMOUNT,
                type: 'RECHARGE',
                status: 'COMPLETED',
                idempotency_key: idempotencyKey
            });
        expect(err1).toBeNull();

        // 2. Duplicate Recharge (Same Key)
        const { error: err2 } = await adminClient
            .from('transactions')
            .insert({
                user_id: userId,
                amount: RECHARGE_AMOUNT,
                type: 'RECHARGE',
                status: 'COMPLETED',
                idempotency_key: idempotencyKey
            });

        // Should fail due to UNIQUE constraint
        expect(err2).toBeDefined();
        expect(err2.code).toBe('23505'); // Postgres Unique Violation code

        // 3. Verify Balance (Should be 50 + 20 = 70, NOT 90)
        const { data: wallet } = await adminClient
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        // 50 (prev test) + 20 (this test) = 70
        expect(parseFloat(wallet.balance)).toBe(70.00);
    });
});

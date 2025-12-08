import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BRIDGE_EMAIL = process.env.BRIDGE_EMAIL || 'bridge-01@project.com';
const BRIDGE_PASSWORD = process.env.BRIDGE_PASSWORD || 'Bridge2025!Secure';
const DISPLAY_EMAIL = process.env.VITE_DISPLAY_EMAIL || 'display-01@project.com';
const DISPLAY_PASSWORD = process.env.VITE_DISPLAY_PASSWORD || 'Display2025!Secure';

describe('Security Permissions (RBAC)', () => {

    it('Anonymous User should NOT be able to create sessions', async () => {
        const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { error } = await anonClient.rpc('create_vend_session', {
            p_amount: 1.00,
            p_machine_id: 'test_machine'
        });
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Access denied/i);
    });

    it('Display User should NOT be able to create sessions', async () => {
        const displayClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await displayClient.auth.signInWithPassword({
            email: DISPLAY_EMAIL,
            password: DISPLAY_PASSWORD
        });

        const { error } = await displayClient.rpc('create_vend_session', {
            p_amount: 1.00,
            p_machine_id: 'test_machine'
        });
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Access denied/i);
    });

    it('Display User should be able to READ sessions', async () => {
        const displayClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await displayClient.auth.signInWithPassword({
            email: DISPLAY_EMAIL,
            password: DISPLAY_PASSWORD
        });

        const { error } = await displayClient
            .from('vend_sessions')
            .select('*')
            .limit(1);

        expect(error).toBeNull();
    });

    it('Bridge User SHOULD be able to create sessions', async () => {
        const bridgeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await bridgeClient.auth.signInWithPassword({
            email: BRIDGE_EMAIL,
            password: BRIDGE_PASSWORD
        });

        const { data, error } = await bridgeClient.rpc('create_vend_session', {
            p_amount: 1.00,
            p_machine_id: 'test_machine'
        });

        expect(error).toBeNull();
        expect(data).toBeDefined(); // UUID
    });
});

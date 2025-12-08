-- Create a default Kiosk User
-- Password: 'secure-password-for-kiosk-01'
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Fixed UUID
    'authenticated',
    'authenticated',
    'kiosk-01@project.com',
    extensions.crypt('Kiosk2025!Secure', extensions.gen_salt('bf')), -- ✅ Explicit schema
    now(),
    '{"provider": "email", "providers": ["email"], "app_role": "kiosk"}', -- ✅ Role Kiosk
    '{}',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Create a default Wallet for the Kiosk
INSERT INTO public.wallets (user_id, balance)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0.00)
ON CONFLICT (user_id) DO NOTHING;

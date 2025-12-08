import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { amount, user_id } = await req.json()

        if (!amount || !user_id) {
            throw new Error("Missing amount or user_id")
        }

        const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Server configuration error: Missing Env Vars")
        }

        const stripe = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: '2022-11-15',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // 1. Create Checkout Session on Stripe
        const webhookUrl = `${SUPABASE_URL}/functions/v1/checkout-session-completed`
        // Note: We don't strictly need a webhook URL here if we rely on client-side redirection, 
        // but for security and reliability (async), webhooks are better.
        // We'll assume the webhook function is deployed at /checkout-session-completed

        // Ensure amount is in cents for Stripe (EUR)
        const amountInCents = Math.round(amount * 100)

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Wallet Recharge',
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // success_url and cancel_url should ideally come from the client or be env vars
            // For now, we'll use a placeholder or the origin
            success_url: `${req.headers.get('origin') || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin') || 'http://localhost:3000'}/payment/cancel`,
            client_reference_id: user_id,
            metadata: {
                user_id: user_id,
                type: 'RECHARGE'
            }
        })

        // 2. Insert PENDING transaction in Supabase
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const { error: insertError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user_id,
                amount: amount,
                type: 'RECHARGE',
                status: 'PENDING',
                description: `Stripe ${session.id}`,
                metadata: { checkout_id: session.id }
            })

        if (insertError) {
            console.error("Failed to insert pending transaction", insertError)
        }

        return new Response(
            JSON.stringify({
                url: session.url,
                checkout_id: session.id
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        console.error("Error:", error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})

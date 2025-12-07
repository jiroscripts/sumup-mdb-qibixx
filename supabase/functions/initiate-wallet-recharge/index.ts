import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

        const SUMUP_API_KEY = Deno.env.get('SUMUP_API_KEY')
        const SUMUP_MERCHANT_CODE = Deno.env.get('SUMUP_MERCHANT_CODE')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Server configuration error: Missing Env Vars")
        }

        // 1. Create Checkout on SumUp
        const webhookUrl = `${SUPABASE_URL}/functions/v1/handle-sumup-webhook`
        const checkoutRef = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        const payload = {
            checkout_reference: checkoutRef,
            amount: amount,
            currency: 'EUR',
            description: 'Wallet Recharge',
            return_url: webhookUrl,
            merchant_code: SUMUP_MERCHANT_CODE
        }

        const SUMUP_API_URL = Deno.env.get('SUMUP_API_URL') || 'https://api.sumup.com'

        const response = await fetch(`${SUMUP_API_URL}/v0.1/checkouts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUMUP_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const data = await response.json()

        if (!response.ok) {
            console.error("SumUp Error:", data)
            throw new Error(data.message || "Failed to create checkout")
        }

        // 2. Insert PENDING transaction in Supabase
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const { error: insertError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user_id,
                amount: amount,
                type: 'RECHARGE',
                status: 'PENDING',
                description: `SumUp ${data.id}`,
                metadata: { checkout_id: data.id }
            })

        if (insertError) {
            console.error("Failed to insert pending transaction", insertError)
            // Note: If this fails, the webhook might still process it if we fix the DB later, 
            // but ideally we should cancel the checkout here.
        }

        return new Response(
            JSON.stringify({
                checkout_id: data.id,
                amount: data.amount
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})

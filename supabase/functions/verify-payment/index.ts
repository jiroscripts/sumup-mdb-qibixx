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
        const { checkout_id, user_id } = await req.json()

        if (!checkout_id || !user_id) {
            throw new Error("Missing checkout_id or user_id")
        }

        // 1. Verify Payment with SumUp
        const SUMUP_API_KEY = Deno.env.get('SUMUP_API_KEY')
        if (!SUMUP_API_KEY) throw new Error("Missing SumUp Config")

        const sumupRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkout_id}`, {
            headers: { 'Authorization': `Bearer ${SUMUP_API_KEY}` }
        })
        const paymentData = await sumupRes.json()

        if (paymentData.status !== 'PAID' && paymentData.status !== 'SUCCESSFUL') {
            throw new Error(`Payment not successful: ${paymentData.status}`)
        }

        // 2. Credit Wallet (Insert Transaction)
        // Use Service Role to ensure we can insert safely
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Check if already processed (Idempotency)
        const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('description', `SumUp ${checkout_id}`)
            .maybeSingle()

        if (existing) {
            return new Response(
                JSON.stringify({ status: 'recharge_successful', message: 'Already processed' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const { error: insertError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user_id,
                amount: paymentData.amount,
                type: 'RECHARGE',
                description: `SumUp ${checkout_id}`,
                metadata: { checkout_id: checkout_id, currency: paymentData.currency }
            })

        if (insertError) throw insertError

        return new Response(
            JSON.stringify({ status: 'recharge_successful', amount: paymentData.amount }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

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
        // 1. Get User from Auth Header
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error("Unauthorized")

        const reqBody = await req.json().catch(() => ({}))

        // 2. Use Admin Client for DB operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Check Balance
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', user.id)
            .single()

        if (!wallet || wallet.balance < reqBody.amount) {
            throw new Error("Insufficient funds")
        }

        // 4. Debit Wallet via Transaction (History + Trigger)
        const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                amount: -reqBody.amount, // Negative for debit
                type: 'VEND',
                status: 'COMPLETED',
                description: 'Coffee Purchase',
                metadata: { source: 'web_wallet' }
            })

        if (txError) throw new Error("Transaction failed. Please try again.")

        // 5. Create Vend Request
        const { error: vendError } = await supabaseAdmin
            .from('vend_requests')
            .insert({
                user_id: user.id,
                amount: reqBody.amount,
                status: 'PENDING'
            })

        if (vendError) {
            // CRITICAL: Refund if vend request fails!
            // Insert a refund transaction
            await supabaseAdmin
                .from('transactions')
                .insert({
                    user_id: user.id,
                    amount: reqBody.amount,
                    type: 'REFUND',
                    status: 'COMPLETED',
                    description: 'Refund for failed vend request'
                })

            throw new Error("Failed to create vend request")
        }

        return new Response(
            JSON.stringify({ success: true, new_balance: wallet.balance - reqBody.amount }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

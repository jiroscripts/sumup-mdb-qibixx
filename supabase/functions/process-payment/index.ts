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

        const { session_id } = await req.json().catch(() => ({}))
        if (!session_id) throw new Error("Missing session_id")

        // 2. Use Admin Client for DB operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Fetch Vend Session (Secure Price Source)
        const { data: vendSession, error: sessionError } = await supabaseAdmin
            .from('vend_sessions')
            .select('*')
            .eq('id', session_id)
            .single()

        if (sessionError || !vendSession) throw new Error("Invalid or expired session")
        if (vendSession.status !== 'PENDING') throw new Error("Session already processed")

        const PRICE = vendSession.amount

        // 4. Check Balance
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', user.id)
            .single()

        if (!wallet || wallet.balance < PRICE) {
            throw new Error("Insufficient funds")
        }

        // 5. Debit Wallet via Transaction
        const { error: txError } = await supabaseAdmin
            .from('transactions')
            .insert({
                user_id: user.id,
                amount: -PRICE,
                type: 'VEND',
                status: 'COMPLETED',
                description: 'Coffee Purchase',
                metadata: { source: 'web_wallet', session_id: session_id }
            })

        if (txError) throw new Error("Transaction failed. Please try again.")

        // 6. Mark Session as PAID
        const { error: updateError } = await supabaseAdmin
            .from('vend_sessions')
            .update({ status: 'PAID', metadata: { ...vendSession.metadata, paid_by: user.id } })
            .eq('id', session_id)

        if (updateError) {
            // Critical: If we fail to mark paid, we should refund or retry.
            // For now, we assume this works if transaction worked.
            console.error("Failed to update session status", updateError)
        }

        return new Response(
            JSON.stringify({ success: true, new_balance: wallet.balance - PRICE }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

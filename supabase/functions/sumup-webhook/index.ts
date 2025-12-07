import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        const event = await req.json()

        // 1. Validate Event Type
        if (event.event_type !== 'CHECKOUT_COMPLETED_PAID' && event.event_type !== 'CHECKOUT_STATUS_CHANGED') {
            return new Response('Ignored', { status: 200 })
        }

        const checkoutId = event.id
        const status = event.status

        if (!checkoutId) {
            return new Response('Missing ID', { status: 400 })
        }

        // 2. Validate Status (if provided)
        if (event.event_type === 'CHECKOUT_STATUS_CHANGED') {
            if (status !== 'PAID' && status !== 'SUCCESSFUL') {
                return new Response('Ignored', { status: 200 })
            }
        }

        const SUMUP_API_KEY = Deno.env.get('SUMUP_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!SUMUP_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Env Vars")
        }

        // 3. SECURITY: Verify with SumUp API (Zero Trust)
        const verifyRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
            headers: { 'Authorization': `Bearer ${SUMUP_API_KEY}` }
        })

        if (!verifyRes.ok) {
            throw new Error("Verification failed")
        }

        const verifyData = await verifyRes.json()
        if (verifyData.status !== 'PAID' && verifyData.status !== 'SUCCESSFUL') {
            return new Response('Verification mismatch', { status: 400 })
        }

        // 4. Update Transaction (Idempotent)
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const { data, error } = await supabaseAdmin
            .from('transactions')
            .update({ status: 'COMPLETED' })
            .eq('metadata->>checkout_id', checkoutId)
            .eq('status', 'PENDING') // Ensures we only credit once
            .select()

        if (error) throw error

        if (data.length > 0) {
            console.log(`Transaction ${checkoutId} completed successfully.`)
        } else {
            console.log(`Transaction ${checkoutId} already processed or not found.`)
        }

        return new Response('OK', { status: 200 })

    } catch (error) {
        console.error("Webhook Error:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})

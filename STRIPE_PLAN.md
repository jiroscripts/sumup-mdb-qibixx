
You have requested to switch from SumUp to Stripe. I have analyzed the codebase and identified the necessary changes.

**Plan:**
1.  [x] **Update `initiate-wallet-recharge`**: Replace SumUp API call with Stripe Checkout Session creation.
2.  [x] **Replace Webhook**: Create `checkout-session-completed` to handle `checkout.session.completed` events and verify Stripe signatures.
3.  [x] **Update Configuration**: Update `supabase/config.toml` and `.env`.

**Next Steps:**
-   Deploy functions to Supabase: `supabase functions deploy`
-   Set secrets in Supabase: `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...`

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const WalletPage = () => {
    const [session, setSession] = useState(null);
    const [balance, setBalance] = useState(0.00);
    const [loading, setLoading] = useState(true);
    const [rechargeAmount, setRechargeAmount] = useState(10.00);
    const [widgetStatus, setWidgetStatus] = useState('idle'); // idle, mounting, ready, paid, failed
    const widgetMounted = useRef(false);

    // 1. Auth & Initial Data
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchBalance(session.user.id);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchBalance(session.user.id);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Realtime Balance Updates
    useEffect(() => {
        if (!session) return;

        const channel = supabase
            .channel('wallet-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'wallets',
                    filter: `user_id=eq.${session.user.id}`
                },
                (payload) => {
                    console.log("Realtime balance update:", payload.new.balance);
                    setBalance(payload.new.balance);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session]);

    const fetchBalance = async (userId) => {
        const { data, error } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        if (!error && data) {
            setBalance(data.balance);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setBalance(0);
    };

    // 3. Recharge Flow
    const initRecharge = async () => {
        if (!session) return;
        setWidgetStatus('mounting');
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    amount: rechargeAmount,
                    user_id: session.user.id
                }
            });

            if (error) {
                alert("Failed to init recharge: " + error.message);
                setWidgetStatus('failed');
                return;
            }

            if (data.checkout_id) {
                mountWidget(data.checkout_id);
            }
        } catch (e) {
            console.error(e);
            setWidgetStatus('failed');
        }
    };

    const mountWidget = (id) => {
        if (widgetMounted.current) return;

        const mount = () => {
            if (!window.SumUpCard) {
                setWidgetStatus('failed');
                return;
            }

            try {
                window.SumUpCard.mount({
                    id: 'sumup-card-wallet',
                    checkoutId: id,
                    locale: 'fr-FR',
                    showGooglePay: true,
                    showApplePay: true,
                    onResponse: function (type, body) {
                        if (type === 'success') {
                            // Webhook will handle the credit. We just update UI.
                            setWidgetStatus('paid');
                            setTimeout(() => {
                                setWidgetStatus('idle');
                                widgetMounted.current = false;
                                document.getElementById('sumup-card-wallet').innerHTML = "";
                            }, 3000);
                        } else if (type === 'error') {
                            setWidgetStatus('failed');
                        }
                    }
                });
                widgetMounted.current = true;
                setWidgetStatus('ready');
            } catch (e) {
                setWidgetStatus('failed');
            }
        };
        setTimeout(mount, 100);
    };

    // 4. Vend Flow
    const handleVend = async () => {
        if (!session) return;
        if (!confirm("Dispense Coffee for €0.35?")) return;

        if (balance < 0.35) {
            alert("Insufficient funds");
            return;
        }

        const { error } = await supabase
            .from('vend_requests')
            .insert({
                user_id: session.user.id,
                amount: 0.35,
                status: 'PENDING'
            });

        if (error) {
            alert("Failed: " + error.message);
        } else {
            alert("Vend requested! Please wait...");
        }
    };

    // 5. Login UI
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);

    const handleLoginGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + "/wallet" }
        });
    };

    const handleLoginEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + "/wallet" },
        });
        setLoading(false);
        if (error) alert(error.message);
        else setEmailSent(true);
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

    if (!session) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
                <h1>My Wallet</h1>
                <p>Login to manage your balance.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                    <button onClick={handleLoginGoogle} style={{ padding: '12px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                        Login with Google
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#888' }}>
                        <hr style={{ flex: 1, borderColor: '#eee' }} /> <span style={{ padding: '0 10px', fontSize: '0.8em' }}>OR</span> <hr style={{ flex: 1, borderColor: '#eee' }} />
                    </div>
                    {emailSent ? (
                        <div style={{ background: '#d4edda', color: '#155724', padding: '15px', borderRadius: '5px' }}>✅ Magic link sent to <b>{email}</b>.</div>
                    ) : (
                        <form onSubmit={handleLoginEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
                            <button type="submit" style={{ padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Send Magic Link</button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>My Wallet</h1>
                <button onClick={handleLogout}>Logout</button>
            </div>

            <div style={{ background: '#f4f4f4', padding: '20px', borderRadius: '10px', marginTop: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9em', color: '#666' }}>Current Balance</p>
                <h2 style={{ fontSize: '2.5em', margin: '10px 0' }}>€{balance.toFixed(2)}</h2>
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3>Recharge</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    {[5, 10, 20].map(amt => (
                        <button key={amt} onClick={() => setRechargeAmount(amt)}
                            style={{ flex: 1, padding: '10px', background: rechargeAmount === amt ? '#007bff' : '#ddd', color: rechargeAmount === amt ? 'white' : 'black', border: 'none', borderRadius: '5px' }}>
                            €{amt}
                        </button>
                    ))}
                </div>

                {widgetStatus === 'idle' || widgetStatus === 'failed' ? (
                    <button onClick={initRecharge} style={{ width: '100%', padding: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1.1em' }}>
                        Pay €{rechargeAmount}
                    </button>
                ) : (
                    <div style={{ textAlign: 'center', padding: '10px', background: '#eee' }}>
                        {widgetStatus === 'paid' ? "Payment Successful! Updating balance..." : "Complete Payment below..."}
                    </div>
                )}
                <div id="sumup-card-wallet" style={{ marginTop: '20px' }}></div>
            </div>

            <div style={{ marginTop: '40px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                <h3>Actions</h3>
                <button onClick={handleVend} style={{ width: '100%', padding: '15px', background: '#ffc107', border: 'none', borderRadius: '5px', fontSize: '1.1em', fontWeight: 'bold' }}>
                    ☕ Buy Coffee (€0.35)
                </button>
            </div>
        </div>
    );
};

export default WalletPage;

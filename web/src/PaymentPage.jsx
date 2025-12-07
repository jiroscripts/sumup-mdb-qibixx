import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    const [session, setSession] = useState(null);
    const [vendSession, setVendSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // 1. Auth Check
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Fetch Session Data (Amount)
    useEffect(() => {
        if (!sessionId) {
            setTimeout(() => {
                setError("Session ID manquant");
                setLoading(false);
            }, 0);
            return;
        }

        const fetchSession = async () => {
            const { data, error } = await supabase
                .from('vend_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error || !data) {
                setError("Session invalide ou expirée");
            } else if (data.status !== 'PENDING') {
                setError("Cette commande a déjà été payée ou annulée");
            } else {
                setVendSession(data);
            }
            setLoading(false);
        };

        fetchSession();

        // Realtime listener for status change (e.g. if paid by someone else)
        const channel = supabase
            .channel(`session-${sessionId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vend_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
                if (payload.new.status !== 'PENDING') {
                    setError("Commande terminée (" + payload.new.status + ")");
                }
            })
            .subscribe();

        return () => supabase.removeChannel(channel);

    }, [sessionId]);

    const [success, setSuccess] = useState(false);

    const handlePayCoffee = async () => {
        if (!session || !vendSession) return;
        setProcessing(true);

        try {
            const { error } = await supabase.functions.invoke('process-payment', {
                body: { session_id: sessionId }
            });

            if (error) {
                alert("Paiement refusé : " + (error.message || "Erreur inconnue"));
                setProcessing(false);
            } else {
                setSuccess(true);
                // Optional: Auto-redirect after 3 seconds
                setTimeout(() => navigate('/wallet'), 3000);
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau");
            setProcessing(false);
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Chargement...</div>;

    if (success) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto' }}>
                <div style={{ fontSize: '5em', marginBottom: '20px' }}>✅</div>
                <h1 style={{ color: '#28a745' }}>Paiement Réussi !</h1>
                <p style={{ fontSize: '1.2em' }}>Votre café est en préparation.</p>
                <p style={{ color: '#666' }}>Montant débité : {vendSession?.amount} €</p>
                <button
                    onClick={() => navigate('/wallet')}
                    style={{ marginTop: '30px', padding: '12px 25px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1em' }}
                >
                    Retour au Wallet
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                <h2>Erreur</h2>
                <p>{error}</p>
                <button onClick={() => navigate('/wallet')}>Retour</button>
            </div>
        );
    }

    if (!session) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <h2>Connectez-vous pour payer</h2>
                <p>Montant à payer : <b>{vendSession?.amount} €</b></p>
                <button
                    onClick={() => navigate('/wallet')}
                    style={{ padding: '12px 20px', background: '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    Aller au Wallet / Connexion
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
            <h1>Paiement Machine</h1>
            <p>Montant à régler</p>
            <h2 style={{ fontSize: '2.5em', margin: '10px 0' }}>{vendSession?.amount} €</h2>

            <div style={{ margin: '40px 0' }}>
                <span style={{ fontSize: '4em' }}>☕</span>
            </div>

            <button
                onClick={handlePayCoffee}
                disabled={processing}
                style={{
                    width: '100%',
                    padding: '15px',
                    background: processing ? '#ccc' : '#ffc107',
                    color: 'black',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    cursor: processing ? 'not-allowed' : 'pointer'
                }}
            >
                {processing ? "Traitement..." : "Payer avec mon Wallet"}
            </button>

            <div style={{ marginTop: '20px' }}>
                <button
                    onClick={() => navigate('/wallet')}
                    style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
                >
                    Annuler
                </button>
            </div>
        </div>
    );
};

export default PaymentPage;

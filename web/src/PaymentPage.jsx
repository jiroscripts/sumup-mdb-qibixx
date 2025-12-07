import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';

const PaymentPage = () => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handlePayCoffee = async () => {
        if (!session) return;
        setProcessing(true);

        try {
            const { data, error } = await supabase.functions.invoke('pay-coffee', {
                body: { amount: 0.35 }
            });

            if (error) {
                alert("Paiement refusé : " + (error.message || "Erreur inconnue"));
            } else {
                alert("Paiement accepté ! Votre café arrive ☕");
                // Optionnel : Rediriger vers Wallet ou afficher un succès
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Chargement...</div>;

    if (!session) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <h2>Connectez-vous pour payer</h2>
                <p>Vous devez avoir un compte pour utiliser cette machine.</p>
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
            <h1>Machine à Café</h1>
            <p>Prix : 0.35 €</p>

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
                    Gérer mon solde
                </button>
            </div>
        </div>
    );
};

export default PaymentPage;

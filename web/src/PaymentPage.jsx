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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="text-6xl mb-6">✅</div>
                <h1 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">Paiement Réussi !</h1>
                <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">Votre café est en préparation.</p>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Montant débité : {vendSession?.amount} €</p>

                <button
                    onClick={() => navigate('/wallet')}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                    Retour au Wallet
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-2xl border border-red-100 dark:border-red-800 mb-6">
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Erreur</h2>
                    <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
                <button
                    onClick={() => navigate('/wallet')}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium underline"
                >
                    Retour
                </button>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Connectez-vous pour payer</h2>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl w-full mb-8">
                    <p className="text-gray-500 dark:text-gray-400 mb-1">Montant à payer</p>
                    <p className="text-4xl font-bold text-gray-900 dark:text-white">{vendSession?.amount} €</p>
                </div>

                <button
                    onClick={() => navigate('/wallet')}
                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-4 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
                >
                    Aller au Wallet / Connexion
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center max-w-md mx-auto text-center pt-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Paiement Machine</h1>
            <p className="text-gray-500 dark:text-gray-400">Montant à régler</p>
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mt-2 mb-8">{vendSession?.amount} €</h2>

            <div className="mb-12 animate-bounce">
                <span className="text-6xl">☕</span>
            </div>

            <button
                onClick={handlePayCoffee}
                disabled={processing}
                className="w-full bg-yellow-400 text-black text-xl font-bold py-4 px-6 rounded-2xl hover:bg-yellow-500 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
                {processing ? "Traitement..." : "Payer avec mon Wallet"}
            </button>

            <div className="mt-6">
                <button
                    onClick={() => navigate('/wallet')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                >
                    Annuler
                </button>
            </div>
        </div>
    );
};

export default PaymentPage;

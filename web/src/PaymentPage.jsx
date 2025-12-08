import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v7 as uuidv7 } from 'uuid';
import { supabase } from './supabaseClient';

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const navigate = useNavigate();

    const [session, setSession] = useState(null);
    const [vendSession, setVendSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // --- Auth & Session Management ---
    useEffect(() => {
        let isMounted = true;
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (isMounted) setSession(session);
        };

        getSession();

        const { subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) setSession(session);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // --- Fetch Vend Session & Realtime Updates ---
    useEffect(() => {
        if (!sessionId) {
            setError("Session ID manquant");
            setLoading(false);
            return;
        }

        let isMounted = true;

        const fetchSession = async () => {
            try {
                const { data, error } = await supabase
                    .from('vend_sessions')
                    .select('*')
                    .eq('id', sessionId)
                    .single();

                if (!isMounted) return;

                if (error || !data) {
                    setError("Session invalide ou expirée");
                } else if (data.status !== 'PENDING') {
                    setError(`Cette commande a déjà été payée ou annulée (${data.status})`);
                } else {
                    setVendSession(data);
                }
            } catch (e) {
                setError("Erreur lors de la récupération de la session");
                console.error(e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchSession();

        const channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'vend_sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    if (payload.new.status !== 'PENDING') {
                        setError(`Commande terminée (${payload.new.status})`);
                    } else {
                        setVendSession(payload.new);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    // --- Payment Handler ---
    const handlePayCoffee = async () => {
        if (!session || !vendSession) return;

        setProcessing(true);
        const idempotencyKey = uuidv7();

        try {
            const { error: funcError } = await supabase.functions.invoke('process-payment', {
                body: { session_id: sessionId, idempotency_key: idempotencyKey }
            });

            if (funcError) {
                const message =
                    typeof funcError === 'object' && funcError !== null
                        ? funcError.message || JSON.stringify(funcError)
                        : "Erreur inconnue";
                alert(`Paiement refusé : ${message}`);
            } else {
                setSuccess(true);
                setTimeout(() => navigate('/wallet'), 3000);
            }
        } catch (e) {
            console.error("Payment Error:", e);
            alert("Erreur réseau : " + (e.message || "Impossible de contacter le serveur"));
        } finally {
            setProcessing(false);
        }
    };

    // --- Render Helpers ---
    if (loading) return <Spinner />;

    if (success) return <Success vendSession={vendSession} navigate={navigate} />;

    if (error) return <ErrorMessage message={error} navigate={navigate} />;

    if (!session) return <LoginPrompt vendSession={vendSession} navigate={navigate} />;

    return <PaymentForm vendSession={vendSession} processing={processing} onPay={handlePayCoffee} navigate={navigate} />;
};

// --- Components ---
const Spinner = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
);

const Success = ({ vendSession, navigate }) => (
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

const ErrorMessage = ({ message, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-2xl border border-red-100 dark:border-red-800 mb-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Erreur</h2>
            <p className="text-red-700 dark:text-red-300">{message}</p>
        </div>
        <button
            onClick={() => navigate('/wallet')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium underline"
        >
            Retour
        </button>
    </div>
);

const LoginPrompt = ({ vendSession, navigate }) => (
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

const PaymentForm = ({ vendSession, processing, onPay, navigate }) => (
    <div className="flex flex-col items-center max-w-md mx-auto text-center pt-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Paiement Machine</h1>
        <p className="text-gray-500 dark:text-gray-400">Montant à régler</p>
        <h2 className="text-5xl font-bold text-gray-900 dark:text-white mt-2 mb-8">{vendSession?.amount} €</h2>

        <div className="mb-12 animate-bounce">
            <span className="text-6xl">☕</span>
        </div>

        <button
            onClick={onPay}
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

export default PaymentPage;

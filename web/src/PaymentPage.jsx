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
        console.log("PaymentPage Mounted. SessionID:", sessionId);
        // alert("Debug: PaymentPage Mounted"); // Uncomment if needed

        let isMounted = true;
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (isMounted) {
                    console.log("Session loaded:", session ? "User logged in" : "No user");
                    setSession(session);
                }
            } catch (err) {
                console.error("Auth check error:", err);
                // alert("Auth Error: " + err.message);
            }
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
            console.error("No session ID in URL");
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

    // --- Auto-Pay Logic ---
    useEffect(() => {
        if (session && vendSession && !processing && !success && !error) {
            console.log("Auto-paying for session:", vendSession.id);
            handlePayCoffee();
        }
    }, [session, vendSession]); // Dependencies: run when user or vend session is ready

    // --- Payment Handler ---
    const handlePayCoffee = async () => {
        if (!session || !vendSession) return;
        if (processing || success) return; // Prevent double trigger

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
                // Don't alert, set error state to show UI
                setError(`Paiement refusé : ${message}`);
            } else {
                setSuccess(true);
                setTimeout(() => navigate('/wallet'), 3000);
            }
        } catch (e) {
            console.error("Payment Error:", e);
            setError("Erreur réseau : " + (e.message || "Impossible de contacter le serveur"));
        } finally {
            setProcessing(false);
        }
    };

    // --- Render Helpers ---
    if (loading) return <Spinner />;

    if (success) return <Success vendSession={vendSession} navigate={navigate} />;

    if (error) return <ErrorMessage message={error} navigate={navigate} />;

    if (!session) return <LoginPrompt vendSession={vendSession} navigate={navigate} />;

    // Show Processing UI by default since we auto-pay
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto pt-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Paiement en cours...</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Montant : {vendSession?.amount} €</p>

            <div className="relative mb-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">☕</div>
            </div>

            <p className="text-sm text-gray-400 animate-pulse">Validation de la transaction...</p>
        </div>
    );
};

// --- Components ---
const Spinner = () => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Chargement...</p>
    </div>
);

const Success = ({ vendSession, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto animate-fade-in">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce-small">
            <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h1 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">Paiement Réussi !</h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">Votre café est en préparation.</p>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Montant débité : {vendSession?.amount} €</p>
        <button
            onClick={() => navigate('/wallet')}
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg"
        >
            Retour au Wallet
        </button>
    </div>
);

const ErrorMessage = ({ message, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 animate-fade-in">
        <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-2xl border border-red-100 dark:border-red-800 mb-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Paiement Échoué</h2>
            <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
        </div>
        <button
            onClick={() => navigate('/wallet')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium underline"
        >
            Retour au Wallet
        </button>
    </div>
);

const LoginPrompt = ({ vendSession, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-4">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 text-3xl">🔒</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Connexion Requise</h2>
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl w-full mb-8 border border-gray-100 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm uppercase tracking-wide">Montant à payer</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{vendSession?.amount} €</p>
        </div>
        <button
            onClick={() => navigate('/wallet')}
            className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
            Se connecter pour payer
        </button>
    </div>
);

export default PaymentPage;

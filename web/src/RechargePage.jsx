import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { useOutletContext, useNavigate } from 'react-router-dom';

const RechargePage = () => {
    const { session, authLoading } = useOutletContext();
    const [rechargeAmount, setRechargeAmount] = useState(10.00);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const initRecharge = async () => {
        if (!session) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('initiate-wallet-recharge', {
                body: {
                    amount: rechargeAmount,
                    user_id: session.user.id
                }
            });

            if (error) {
                alert("Erreur d'initialisation : " + error.message);
                setLoading(false);
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("Pas d'URL de paiement reçue");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau");
            setLoading(false);
        }
    };

    if (authLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 animate-fade-in">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6 text-3xl">🔒</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connexion Requise</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">Veuillez vous connecter pour recharger votre compte.</p>
                <button
                    onClick={() => navigate('/wallet')}
                    className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-xl font-bold hover:scale-105 transition-all shadow-lg"
                >
                    Aller à la connexion
                </button>
            </div>
        );
    }

    const amounts = [5, 10, 20, 50];

    return (
        <div className="flex flex-col items-center max-w-md mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
                    💳
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Recharger</h1>
                <p className="text-gray-500 dark:text-gray-400">Sélectionnez un montant à ajouter</p>
            </div>

            {/* Amount Grid */}
            <div className="grid grid-cols-2 gap-4 w-full mb-10">
                {amounts.map((amount) => (
                    <button
                        key={amount}
                        onClick={() => setRechargeAmount(amount)}
                        disabled={loading}
                        className={`relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed
                            ${rechargeAmount === amount
                                ? 'border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-blue-300 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        {rechargeAmount === amount && (
                            <div className="absolute top-3 right-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                        )}
                        <span className="text-sm font-medium opacity-80 mb-1">Montant</span>
                        <span className="text-3xl font-bold tracking-tight">{amount} €</span>
                    </button>
                ))}
            </div>

            {/* Summary & Action */}
            <div className="w-full bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Nouveau solde estimé</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                        + {rechargeAmount.toFixed(2)} €
                    </span>
                </div>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-4"></div>
                <button
                    onClick={initRecharge}
                    disabled={loading}
                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg font-bold py-4 px-6 rounded-2xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-3"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                            <span>Traitement...</span>
                        </>
                    ) : (
                        <>
                            <span>Payer {rechargeAmount} €</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </>
                    )}
                </button>
            </div>

            <p className="text-xs text-center text-gray-400 max-w-xs mx-auto">
                Paiement sécurisé via EasyTransac. Votre solde est mis à jour instantanément.
            </p>
        </div>
    );
};

export default RechargePage;

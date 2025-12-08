import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PaymentSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get('session_id');
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);

        const redirect = setTimeout(() => {
            navigate('/wallet');
        }, 5000);

        return () => {
            clearInterval(timer);
            clearTimeout(redirect);
        };
    }, [navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-4 animate-fade-in">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8 animate-bounce-small shadow-lg shadow-green-500/20">
                <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Recharge Réussie !</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">Votre solde a été mis à jour.</p>

            {sessionId && (
                <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 rounded-2xl mb-8 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 font-mono uppercase tracking-wider mb-1">ID de Transaction</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">{sessionId.slice(0, 18)}...</p>
                </div>
            )}

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-8 overflow-hidden max-w-xs mx-auto">
                <div
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / 5) * 100}%` }}
                ></div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Redirection vers le wallet dans {countdown}s...</p>

            <button
                onClick={() => navigate('/wallet')}
                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-4 rounded-xl font-bold hover:scale-105 transition-all shadow-lg w-full max-w-xs"
            >
                Retour au Wallet
            </button>
        </div>
    );
};

export default PaymentSuccessPage;

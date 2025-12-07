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
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto p-4">
            <div className="text-6xl mb-6 animate-pulse">✅</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-8">Your wallet has been recharged.</p>

            {sessionId && (
                <div className="bg-gray-50 px-4 py-2 rounded-lg mb-8">
                    <p className="text-xs text-gray-400 font-mono">Session ID: {sessionId.slice(0, 10)}...</p>
                </div>
            )}

            <p className="text-sm text-gray-500 mb-6">Redirecting to wallet in {countdown} seconds...</p>

            <button
                onClick={() => navigate('/wallet')}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
                Go to Wallet Now
            </button>
        </div>
    );
};

export default PaymentSuccessPage;

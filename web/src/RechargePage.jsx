import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { useOutletContext, useNavigate } from 'react-router-dom';

const RechargePage = () => {
    const { session } = useOutletContext();
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
                alert("Failed to init recharge: " + error.message);
                setLoading(false);
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("No payment URL returned");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            alert("Network error");
            setLoading(false);
        }
    };

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
                <p className="text-gray-600 mb-4">Please login to recharge your wallet.</p>
                <button
                    onClick={() => navigate('/wallet')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    const amounts = [5, 10, 20, 50];

    return (
        <div className="flex flex-col items-center max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Recharge Wallet</h1>

            <div className="grid grid-cols-2 gap-4 w-full mb-8">
                {amounts.map((amount) => (
                    <button
                        key={amount}
                        onClick={() => setRechargeAmount(amount)}
                        disabled={loading}
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all group disabled:opacity-50 disabled:cursor-not-allowed
                            ${rechargeAmount === amount
                                ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-900 dark:border-blue-500 dark:text-blue-300'
                                : 'border-gray-100 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-gray-700'
                            }`}
                    >
                        <span className={`text-3xl font-bold ${rechargeAmount === amount ? 'text-blue-600 dark:text-blue-300' : 'text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>€{amount}</span>
                    </button>
                ))}
            </div>

            <div className="w-full mb-6"> {/* Added margin-bottom for spacing */}
                <button
                    onClick={initRecharge}
                    disabled={loading}
                    className="w-full bg-green-600 text-white text-lg font-semibold py-4 px-6 rounded-2xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    {loading ? "Processing..." : `Pay €${rechargeAmount}`}
                </button>
            </div>
        </div>
    );
};

export default RechargePage;

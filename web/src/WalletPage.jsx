import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useOutletContext, useNavigate } from 'react-router-dom';

const WalletPage = () => {
    const { session } = useOutletContext();
    const [balance, setBalance] = useState(0.00);
    const [loading, setLoading] = useState(false);

    // Login State
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (session) {
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
            fetchBalance(session.user.id);
        }
    }, [session]);

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
                    setBalance(payload.new.balance);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session]);


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

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome Back</h1>
                    <p className="text-gray-500 dark:text-gray-400">Login to manage your wallet</p>
                </div>

                <div className="w-full space-y-4">
                    <button
                        onClick={handleLoginGoogle}
                        className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or with email</span>
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    </div>

                    {emailSent ? (
                        <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-4 rounded-xl text-center border border-green-100 dark:border-green-800">
                            ✅ Magic link sent to <b>{email}</b>
                        </div>
                    ) : (
                        <form onSubmit={handleLoginEmail} className="space-y-3">
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                {loading ? "Sending..." : "Send Magic Link"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
            <div className="w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-colors">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Current Balance</p>
                <h2 className="text-5xl font-bold text-gray-900 dark:text-white">€{balance.toFixed(2)}</h2>
            </div>

            <div className="w-full">
                <button
                    onClick={() => navigate('/recharge')}
                    className="w-full bg-blue-600 dark:bg-blue-500 text-white text-lg font-semibold py-4 px-6 rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                    + Add Funds
                </button>
            </div>

            <div className="w-full mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 px-1">Recent Activity</h3>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                    <div className="p-8 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                        <p>No recent transactions</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletPage;

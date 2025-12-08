import React, { useState, useEffect, useRef } from 'react'; // useRef is used for scannerRef
import { supabase } from './supabaseClient';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

const WalletPage = () => {
    const { session, authLoading } = useOutletContext();
    const [balance, setBalance] = useState(0.00);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // --- Login State ---
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    // --- Scanner State ---
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef(null);

    // --- Data Fetching ---
    useEffect(() => {
        if (!session) return;

        const fetchData = async () => {
            const userId = session.user.id;

            // 1. Get Balance
            const { data: wallet } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .maybeSingle();

            if (wallet) setBalance(wallet.balance);

            // 2. Get Recent Transactions
            const { data: txs } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (txs) setTransactions(txs);

            setLoading(false);
        };

        fetchData();

        // --- Realtime Updates ---
        const channel = supabase
            .channel('wallet-updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${session.user.id}` },
                (payload) => setBalance(payload.new.balance)
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${session.user.id}` },
                (payload) => setTransactions(prev => [payload.new, ...prev].slice(0, 5))
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session]);

    // --- Scanner Logic ---
    useEffect(() => {
        if (showScanner && session) {
            // Delay initialization to ensure DOM is ready
            const timer = setTimeout(() => {
                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                const startConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

                html5QrCode.start(
                    { facingMode: "environment" },
                    startConfig,
                    (decodedText) => {
                        console.log("Scanned:", decodedText);
                        try {
                            const url = new URL(decodedText);
                            const sessionId = url.searchParams.get('session_id');

                            if (sessionId) {
                                html5QrCode.stop().then(() => {
                                    setShowScanner(false);
                                    navigate(`/payment?session_id=${sessionId}`);
                                }).catch(err => console.error("Failed to stop scanner", err));
                            }
                        } catch (e) {
                            console.error("Error parsing URL", e);
                            if (decodedText.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                                html5QrCode.stop().then(() => {
                                    setShowScanner(false);
                                    navigate(`/payment?session_id=${decodedText}`);
                                }).catch(err => console.error("Failed to stop scanner", err));
                            }
                        }
                    }
                ).catch(err => {
                    console.error("Error starting scanner", err);
                    alert("Erreur démarrage caméra: " + err);
                    setShowScanner(false);
                });
            }, 300); // 300ms delay

            return () => {
                clearTimeout(timer);
                if (scannerRef.current && scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(err => console.error("Failed to stop scanner cleanup", err));
                }
            };
        }
    }, [showScanner, session, navigate]);


    // --- Handlers ---
    const handleLoginGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + "/wallet" }
        });
    };

    const handleLoginEmail = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + "/wallet" },
        });
        setLoginLoading(false);
        if (error) alert(error.message);
        else setEmailSent(true);
    };

    const handleStartScanner = () => {
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
                setShowScanner(true);
            } else {
                alert("Aucune caméra détectée.");
            }
        }).catch(err => {
            console.error("Camera permission error", err);
            alert("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
        });
    };

    // --- Render: Loading ---
    if (authLoading || (session && loading)) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    // --- Render: Not Logged In ---
    if (!session) return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-sm mx-auto w-full px-4">
            <div className="text-center mb-10">
                <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                    👋
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Bienvenue</h1>
                <p className="text-gray-500 dark:text-gray-400">Connectez-vous pour accéder à votre wallet</p>
            </div>

            <div className="w-full space-y-4">
                <button
                    onClick={handleLoginGoogle}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3.5 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuer avec Google
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-widest">Ou par email</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                </div>

                {emailSent ? (
                    <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-4 rounded-xl text-center border border-green-100 dark:border-green-800 animate-fade-in">
                        ✅ Lien magique envoyé à <b>{email}</b>
                    </div>
                ) : (
                    <form onSubmit={handleLoginEmail} className="space-y-3">
                        <input
                            type="email"
                            placeholder="votre@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                        />
                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold py-3.5 px-4 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 shadow-lg"
                        >
                            {loginLoading ? "Envoi..." : "Recevoir mon lien de connexion"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );

    // --- Render: Scanner Overlay ---
    if (showScanner) return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Scanner QR Code</h2>
                    <button
                        onClick={() => setShowScanner(false)}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div className="p-0 bg-black">
                    <div id="reader" className="w-full"></div>
                </div>
                <div className="p-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pointez votre caméra vers le QR code de la machine.</p>
                </div>
            </div>
        </div>
    );

    // --- Render: Main Wallet UI ---
    return (
        <div className="flex flex-col gap-8 w-full max-w-md mx-auto pb-20 animate-fade-in">

            {/* 1. Digital Card */}
            <div className="relative w-full aspect-[1.586] rounded-3xl overflow-hidden shadow-2xl transform transition-transform hover:scale-[1.02] duration-300">
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black dark:from-gray-800 dark:via-gray-900 dark:to-black"></div>

                {/* Decorative Circles */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>

                {/* Content */}
                <div className="relative h-full p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mb-1">Solde Actuel</p>
                            <h2 className="text-4xl font-bold tracking-tight">
                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(balance)}
                            </h2>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                            <span className="text-xs font-bold tracking-wider">MDB PAY</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Titulaire</p>
                            <p className="font-medium tracking-wide truncate max-w-[200px]">
                                {session.user.email.split('@')[0]}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="flex gap-1 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-[10px] text-green-400 font-medium uppercase">Actif</span>
                            </div>
                            <p className="text-gray-500 text-xs font-mono">**** **** **** 4242</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => navigate('/recharge')}
                    className="flex flex-col items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <div className="bg-white/20 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </div>
                    <span className="font-semibold">Recharger</span>
                </button>
                <button
                    onClick={handleStartScanner}
                    className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                >
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                    </div>
                    <span className="font-semibold">Scanner</span>
                </button>
            </div>

            {/* 3. Recent Activity */}
            <div>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Activité Récente</h3>
                    <button className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">Voir tout</button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                            <p>Aucune transaction récente</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'RECHARGE'
                                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                            {tx.type === 'RECHARGE' ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {tx.type === 'RECHARGE' ? 'Rechargement' : 'Café / Distributeur'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-bold ${tx.type === 'RECHARGE' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'
                                        }`}>
                                        {tx.type === 'RECHARGE' ? '+' : ''}
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.abs(tx.amount))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletPage;

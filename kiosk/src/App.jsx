import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { supabase } from './supabaseClient';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID;
const DISPLAY_EMAIL = import.meta.env.VITE_DISPLAY_EMAIL;
const DISPLAY_PASSWORD = import.meta.env.VITE_DISPLAY_PASSWORD;

function App() {
    const [status, setStatus] = useState("IDLE"); // IDLE, SHOW_QR, SUCCESS, ERROR
    const [message, setMessage] = useState("Booting...");
    const [qrData, setQrData] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [amount, setAmount] = useState(0);
    const [logs, setLogs] = useState([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const addLog = React.useCallback((msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 10));
    }, []);

    // 1. Authenticate Kiosk
    useEffect(() => {
        const login = async () => {
            if (!DISPLAY_EMAIL || !DISPLAY_PASSWORD) {
                addLog("❌ Missing Credentials in .env");
                setMessage("Config Error: Missing Credentials");
                return;
            }

            addLog(`🔐 Authenticating as ${DISPLAY_EMAIL}...`);
            const { error } = await supabase.auth.signInWithPassword({
                email: DISPLAY_EMAIL,
                password: DISPLAY_PASSWORD
            });

            if (error) {
                console.error("Login failed:", error);
                addLog(`❌ Login Failed: ${error.message}`);
                setMessage("Authentication Failed");
            } else {
                addLog("✅ Authenticated successfully");
                setIsAuthenticated(true);
                setMessage("Ready for order");
            }
        };

        login();
    }, [addLog]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const resetState = () => {
        setStatus("IDLE");
        setMessage("Ready for order");
        setQrData(null);
        setCurrentSessionId(null);
    };

    const handleNewSession = React.useCallback((session) => {
        setCurrentSessionId(session.id);
        setAmount(session.amount);

        const baseUrl = import.meta.env.VITE_WEB_APP_URL || "http://localhost:5174";
        const paymentUrl = `${baseUrl}/payment?session_id=${session.id}`;

        addLog(`URL: ${paymentUrl}`);
        console.log("Payment URL:", paymentUrl);

        setQrData(paymentUrl);
        setStatus("SHOW_QR");
        setMessage(`Please pay €${session.amount} by scanning`);
    }, [addLog]);

    const handleSessionUpdate = React.useCallback((session) => {
        if (session.status === 'PAID' || session.status === 'COMPLETED') {
            setStatus("SUCCESS");
            setMessage("Payment Approved! Dispensing...");
            addLog("Payment Received!");

            setTimeout(() => {
                resetState();
            }, 5000);
        } else if (session.status === 'FAILED') {
            setStatus("ERROR");
            setMessage("Payment Failed or Cancelled");
            setTimeout(() => resetState(), 3000);
        }
    }, [addLog]);

    useEffect(() => {
        if (!isAuthenticated) return;

        setTimeout(() => addLog("Connecting to Supabase Realtime..."), 0);

        const channel = supabase
            .channel('kiosk-updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vend_sessions' }, (payload) => {
                const session = payload.new;
                if (session.metadata?.machine_id !== MACHINE_ID) return;

                addLog(`New Session: ${session.id} (${session.amount}€)`);
                handleNewSession(session);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vend_sessions' }, (payload) => {
                const session = payload.new;
                if (session.id === currentSessionId) {
                    handleSessionUpdate(session);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') addLog("Connected to Realtime");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentSessionId, handleNewSession, handleSessionUpdate, addLog, isAuthenticated]);

    const [showWalletQr, setShowWalletQr] = useState(false);

    const toggleWalletQr = () => {
        setShowWalletQr(prev => !prev);
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-sans transition-colors duration-200 overflow-hidden relative">

            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Wallet QR Modal */}
            {showWalletQr && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowWalletQr(false)}>
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border border-gray-100 dark:border-gray-800 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
                            📱
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Ouvrir le Wallet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">Scannez pour accéder à votre compte</p>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 inline-block mb-8 shadow-inner">
                            <QRCode value={`${import.meta.env.VITE_WEB_APP_URL || "http://localhost:5174"}/wallet`} size={220} />
                        </div>

                        <button
                            onClick={() => setShowWalletQr(false)}
                            className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}

            {/* Left Panel: Status & QR */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
                {/* Header Controls */}
                <div className="absolute left-6 top-6 flex gap-3">
                    <button
                        onClick={toggleTheme}
                        className="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm border border-gray-200/50 dark:border-gray-700/50"
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button
                        onClick={toggleWalletQr}
                        className="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm border border-gray-200/50 dark:border-gray-700/50"
                        title="Show Wallet QR"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                    </button>
                </div>

                {/* Main Content Card */}
                <div className="w-full max-w-lg text-center">
                    <div className="mb-12">
                        <div className="inline-flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md px-6 py-2 rounded-full border border-gray-200/50 dark:border-gray-700/50 shadow-sm mb-6">
                            <span className="text-2xl">☕</span>
                            <span className="font-bold text-gray-900 dark:text-white tracking-tight">MDB Kiosk</span>
                        </div>

                        <h1 className={`text-4xl md:text-5xl font-bold transition-all duration-500 ${status === 'SUCCESS' ? 'text-green-500 dark:text-green-400' :
                                status === 'ERROR' ? 'text-red-500 dark:text-red-400' :
                                    'text-gray-900 dark:text-white'
                            }`}>
                            {status === 'IDLE' ? "Prêt à servir" :
                                status === 'SHOW_QR' ? "Paiement requis" :
                                    status === 'SUCCESS' ? "Paiement validé !" :
                                        status === 'ERROR' ? "Erreur" : message}
                        </h1>

                        {status !== 'IDLE' && status !== 'SUCCESS' && status !== 'ERROR' && (
                            <p className="text-xl text-gray-500 dark:text-gray-400 mt-4 animate-fade-in">{message}</p>
                        )}
                    </div>

                    <div className="relative min-h-[300px] flex items-center justify-center">
                        {status === "SHOW_QR" && qrData && (
                            <div className="bg-white p-6 rounded-3xl shadow-2xl animate-fade-in-up transform transition-all hover:scale-105 duration-300 relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative bg-white p-2 rounded-2xl">
                                    <QRCode value={qrData} size={250} />
                                </div>
                                <div className="mt-6 flex items-center justify-center gap-2 text-gray-900 font-bold">
                                    <span className="text-2xl">{amount} €</span>
                                    <span className="text-sm font-normal text-gray-500 uppercase tracking-wider">à régler</span>
                                </div>
                            </div>
                        )}

                        {status === "SUCCESS" && (
                            <div className="animate-bounce-small">
                                <div className="w-40 h-40 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
                                    <svg className="w-20 h-20 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400">Préparation de votre boisson...</p>
                            </div>
                        )}

                        {status === "ERROR" && (
                            <div className="animate-shake">
                                <div className="w-40 h-40 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
                                    <svg className="w-20 h-20 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400">Transaction annulée</p>
                            </div>
                        )}

                        {status === "IDLE" && (
                            <div className="flex flex-col items-center animate-pulse-slow opacity-50">
                                <div className="w-64 h-64 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl flex items-center justify-center mb-4">
                                    <span className="text-6xl grayscale opacity-50">☕</span>
                                </div>
                                <p className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest text-sm">En attente de sélection</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Terminal Logs */}
            <div className="w-full md:w-[400px] h-64 md:h-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/40 backdrop-blur-xl p-4 flex flex-col transition-all">
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">System Logs</span>
                </div>

                <div className="flex-1 bg-gray-900/90 rounded-2xl p-4 font-mono text-xs shadow-inner overflow-hidden flex flex-col border border-gray-800/50">
                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
                        {logs.length === 0 && <span className="text-gray-600 italic">_ system ready...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="break-all flex gap-2 animate-fade-in">
                                <span className="text-blue-500 font-bold">➜</span>
                                <span className="text-gray-300">{log}</span>
                            </div>
                        ))}
                        <div className="w-2 h-4 bg-blue-500 animate-pulse mt-2"></div>
                    </div>
                </div>

                <div className="mt-4 px-2 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest">
                    <span>ID: {MACHINE_ID?.slice(0, 8)}...</span>
                    <span className={`flex items-center gap-1.5 ${isAuthenticated ? 'text-green-500' : 'text-red-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isAuthenticated ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        {isAuthenticated ? 'Online' : 'Offline'}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default App;

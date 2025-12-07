import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { supabase } from './supabaseClient';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID;

function App() {
    const [status, setStatus] = useState("IDLE"); // IDLE, SHOW_QR, SUCCESS, ERROR
    const [message, setMessage] = useState("Ready for order");
    const [qrData, setQrData] = useState(null);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [amount, setAmount] = useState(0);
    const [logs, setLogs] = useState([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    const addLog = React.useCallback((msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 10));
    }, []);

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
    }, [currentSessionId, handleNewSession, handleSessionUpdate, addLog]);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6 text-center font-sans transition-colors duration-200">
            <header className="mb-8 relative">
                <button
                    onClick={toggleTheme}
                    className="absolute right-0 top-0 p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
                    <span className="text-5xl">☕</span>
                    <span>Kiosk Display</span>
                </h1>
                <div className={`text-2xl font-semibold transition-colors duration-300 ${status === 'SUCCESS' ? 'text-green-600 dark:text-green-400' :
                    status === 'ERROR' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-200'
                    }`}>
                    {message}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center">
                {status === "SHOW_QR" && qrData && (
                    <div className="bg-white p-8 rounded-3xl shadow-2xl animate-fade-in">
                        <QRCode value={qrData} size={300} />
                        <p className="text-gray-900 font-bold text-xl mt-4">Scan to Pay €{amount}</p>
                    </div>
                )}

                {status === "SUCCESS" && (
                    <div className="text-9xl animate-bounce">✅</div>
                )}

                {status === "IDLE" && (
                    <div className="text-gray-500 dark:text-gray-400 text-xl animate-pulse">
                        Waiting for selection...
                    </div>
                )}
            </main>

            <footer className="mt-auto pt-8 w-full max-w-2xl mx-auto">
                <div className="text-left bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-lg font-mono">
                    <div className="flex items-center gap-2 mb-2 border-b border-gray-800 pb-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-500 ml-2">system@kiosk:~</span>
                    </div>
                    <div className="text-xs text-green-400 space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                        {logs.length === 0 && <span className="opacity-50 text-gray-500">_ waiting for input...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="break-all">
                                <span className="text-blue-400 mr-2">➜</span>
                                {log}
                            </div>
                        ))}
                        <div className="animate-pulse">_</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;

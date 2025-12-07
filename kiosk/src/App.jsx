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

    const addLog = (msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 10));
    };

    useEffect(() => {
        addLog("Connecting to Supabase Realtime...");

        const channel = supabase
            .channel('kiosk-updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vend_sessions' }, (payload) => {
                const session = payload.new;
                // Filter by machine_id
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
    }, [currentSessionId]); // Re-subscribe if currentSessionId changes? No, ref is better but let's keep it simple.

    const handleNewSession = (session) => {
        setCurrentSessionId(session.id);
        setAmount(session.amount);
        // Generate URL for the mobile app
        // Assuming the mobile app is hosted at the same domain but different port or path
        // For dev: http://localhost:5174/payment?session_id=...
        // For prod: https://votre-domaine.com/payment?session_id=...

        // We'll use a hardcoded base URL for dev for now, or relative if served together
        const baseUrl = import.meta.env.VITE_WEB_APP_URL || "http://localhost:5174";
        const paymentUrl = `${baseUrl}/payment?session_id=${session.id}`;

        addLog(`URL: ${paymentUrl}`); // Log URL for debug
        console.log("Payment URL:", paymentUrl);

        setQrData(paymentUrl);
        setStatus("SHOW_QR");
        setMessage(`Please pay €${session.amount} by scanning`);
    };

    const handleSessionUpdate = (session) => {
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
    };

    const resetState = () => {
        setStatus("IDLE");
        setMessage("Ready for order");
        setQrData(null);
        setCurrentSessionId(null);
    };

    return (
        <div className="app-container" style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif', background: '#222', color: '#fff', minHeight: '100vh' }}>
            <h1>☕ Kiosk Display</h1>
            <h2 style={{ color: status === 'SUCCESS' ? '#4caf50' : '#fff' }}>{message}</h2>

            {status === "SHOW_QR" && qrData && (
                <div className="qr-container" style={{ margin: '30px auto', background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px' }}>
                    <QRCode value={qrData} size={256} />
                    <p style={{ color: 'black', marginTop: '10px' }}>Scan to Pay {amount}€</p>
                </div>
            )}

            {status === "SUCCESS" && (
                <div style={{ fontSize: '5em' }}>✅</div>
            )}

            <div style={{ textAlign: 'left', fontSize: '0.8em', color: '#888', marginTop: '40px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #444', padding: '10px', background: '#000' }}>
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </div>
    );
}

export default App;

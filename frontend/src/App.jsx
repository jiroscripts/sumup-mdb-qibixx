import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';

const API_URL = "/api"; // Use proxy
const WS_URL = `ws://${window.location.host}/ws`; // Use proxy via current host

function App() {
    const [status, setStatus] = useState("IDLE"); // IDLE, PROCESSING, SHOW_QR, SUCCESS, ERROR
    const [message, setMessage] = useState("Ready for order");
    const [qrData, setQrData] = useState(null);
    const [amount, setAmount] = useState(0);
    const [checkoutId, setCheckoutId] = useState(null);
    const ws = useRef(null);

    const [wsStatus, setWsStatus] = useState("DISCONNECTED");
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev].slice(0, 10));
    };

    useEffect(() => {
        let socket = new WebSocket(WS_URL);
        ws.current = socket;

        socket.onopen = () => {
            console.log("WebSocket Connected");
            setWsStatus("CONNECTED");
            addLog("WS Connected");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WS Message:", data);
            addLog(`WS Rx: ${data.type}`);

            switch (data.type) {
                case "STATE_CHANGE":
                    setStatus(data.state);
                    if (data.state === "PROCESSING") setMessage("Processing Request...");
                    if (data.state === "SUCCESS") {
                        setMessage("Payment Approved! Dispensing...");
                        setTimeout(() => {
                            setStatus("IDLE");
                            setMessage("Ready for order");
                            setQrData(null);
                        }, 5000);
                    }
                    break;
                case "SHOW_QR":
                    setStatus("SHOW_QR");
                    setQrData(data.qr_url);
                    setAmount(data.amount);
                    setCheckoutId(data.checkout_id);
                    setMessage(`Please pay €${data.amount.toFixed(2)}`);
                    break;
                case "ERROR":
                    setStatus("ERROR");
                    setMessage(data.message);
                    setTimeout(() => setStatus("IDLE"), 3000);
                    break;
                default:
                    break;
            }
        };

        socket.onclose = (event) => {
            console.log("WebSocket Disconnected", event);
            setWsStatus("DISCONNECTED");
            addLog(`WS Disconnected: ${event.code}`);

            // Simple reconnect logic
            setTimeout(() => {
                // If the component is still mounted (we can't easily check this without ref, 
                // but we can check if ws.current is still THIS socket or null)
                // Actually, let's just trigger a re-render or let the user reload for now.
                // Or better: The dependency array is empty, so this effect runs once.
                // If we want auto-reconnect, we need a dependency or a recursive function.
                // For now, let's just log it.
            }, 3000);
        };

        socket.onerror = (err) => {
            console.error("WebSocket Error:", err);
            addLog("WS Error");
        };

        return () => {
            socket.close();
        };
    }, []);

    // Debug Functions
    const simulateVend = async () => {
        addLog("Simulating Vend...");
        try {
            // API_URL is "/api", so we append "/simulate/vend/..." -> "/api/simulate/vend/..."
            const response = await fetch(`${API_URL}/simulate/vend/2.50`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.text();
                console.error('Simulate vend failed:', err);
                setMessage('Simulate vend failed');
                addLog(`Vend Failed: ${err}`);
                return;
            }
            console.log('Simulate vend OK');
            addLog("Vend Req Sent");
        } catch (e) {
            console.error('Network error during simulate vend:', e);
            setMessage('Network error');
            addLog(`Vend Net Error: ${e.message}`);
        }
    };

    const simulatePayment = async () => {
        if (!checkoutId) {
            setMessage('No checkout ID');
            addLog("No Checkout ID");
            return;
        }
        addLog(`Simulating Pay: ${checkoutId}`);
        try {
            const response = await fetch(`${API_URL}/simulate/payment/${checkoutId}`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.text();
                console.error('Simulate payment failed:', err);
                setMessage('Simulate payment failed');
                addLog(`Pay Failed: ${err}`);
                return;
            }
            console.log('Simulate payment OK');
            addLog("Pay Req Sent");
        } catch (e) {
            console.error('Network error during simulate payment:', e);
            setMessage('Network error');
            addLog(`Pay Net Error: ${e.message}`);
        }
    };

    return (
        <div className="App">
            <div className="card">
                <h1>SumUp Vending</h1>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div className={`status-badge status-${status.toLowerCase()}`}>
                        {status}
                    </div>
                    <div className="status-badge" style={{ background: wsStatus === 'CONNECTED' ? '#28a745' : '#dc3545' }}>
                        WS: {wsStatus}
                    </div>
                </div>

                <h2>{message}</h2>

                {status === "SHOW_QR" && qrData && (
                    <div className="qr-container">
                        <QRCode value={qrData} size={256} />
                    </div>
                )}

                {status === "PROCESSING" && (
                    <div className="loader">Loading...</div>
                )}

                <div style={{ textAlign: 'left', fontSize: '0.8em', color: '#888', marginTop: '20px', maxHeight: '100px', overflowY: 'auto', border: '1px solid #444', padding: '5px' }}>
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            </div>

            {/* Debug Panel - Hidden in Production ideally */}
            <div className="debug-panel">
                <h3>Debug Controls <span style={{ fontSize: '0.8em', fontWeight: 'normal' }}>({status})</span></h3>
                <button className="action-vend" onClick={simulateVend}>
                    🛒 Simulate VMC Request (€2.50)
                </button>
                <button className="action-pay" onClick={simulatePayment}>
                    💳 Simulate Successful Payment
                </button>
                <button className="action-pay" onClick={simulatePayment}>
                    💳 Simulate Successful Payment
                </button>
                <button className="action-reset" onClick={() => { setStatus("IDLE"); setMessage("Ready for order"); setQrData(null); }} style={{ borderLeft: "3px solid #666", marginTop: "10px" }}>
                    🔄 Reset State
                </button>
            </div>
        </div>
    );
}

export default App;

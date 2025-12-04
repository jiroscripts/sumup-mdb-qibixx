import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode.react';

const API_URL = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws";

function App() {
    const [status, setStatus] = useState("IDLE"); // IDLE, PROCESSING, SHOW_QR, SUCCESS, ERROR
    const [message, setMessage] = useState("Ready for order");
    const [qrData, setQrData] = useState(null);
    const [amount, setAmount] = useState(0);
    const [checkoutId, setCheckoutId] = useState(null);
    const ws = useRef(null);

    useEffect(() => {
        let timeoutId = null;

        const connectWebSocket = () => {
            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log("WebSocket Connected");
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log("WS Message:", data);

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

            ws.current.onclose = () => {
                console.log("WebSocket Disconnected. Reconnecting...");
                timeoutId = setTimeout(connectWebSocket, 3000);
            };

            ws.current.onerror = (err) => {
                console.error("WebSocket Error:", err);
                ws.current.close();
            };
        };

        connectWebSocket();

        return () => {
            if (ws.current) {
                ws.current.onclose = null; // Prevent reconnection on unmount
                ws.current.close();
            }
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    // Debug Functions
    const simulateVend = async () => {
        try {
            const response = await fetch(`${API_URL}/api/simulate/vend/2.50`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.text();
                console.error('Simulate vend failed:', err);
                setMessage('Simulate vend failed');
                return;
            }
            console.log('Simulate vend OK');
        } catch (e) {
            console.error('Network error during simulate vend:', e);
            setMessage('Network error');
        }
    };

    const simulatePayment = async () => {
        if (!checkoutId) {
            setMessage('No checkout ID');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/simulate/payment/${checkoutId}`, { method: 'POST' });
            if (!response.ok) {
                const err = await response.text();
                console.error('Simulate payment failed:', err);
                setMessage('Simulate payment failed');
                return;
            }
            console.log('Simulate payment OK');
        } catch (e) {
            console.error('Network error during simulate payment:', e);
            setMessage('Network error');
        }
    };

    return (
        <div className="App">
            <div className="card">
                <h1>SumUp Vending</h1>

                <div className={`status-badge status-${status.toLowerCase()}`}>
                    {status}
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
            </div>

            {/* Debug Panel - Hidden in Production ideally */}
            <div className="debug-panel">
                <h3>Debug Controls</h3>
                <button className="action-vend" onClick={simulateVend} disabled={status !== "IDLE"}>
                    🛒 Simulate VMC Request (€2.50)
                </button>
                <button className="action-pay" onClick={simulatePayment} disabled={status !== "SHOW_QR"}>
                    💳 Simulate Successful Payment
                </button>
            </div>
        </div>
    );
}

export default App;

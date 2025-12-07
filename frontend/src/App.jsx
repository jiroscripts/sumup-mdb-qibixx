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
            addLog("WS Disconnected");
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, []);



    // --- Wallet Functions ---

    const simulateVend = async () => {
        try {
            await fetch(`${API_URL}/simulate/vend/2.50`, { method: 'POST' });
            addLog("Simulated Vend Request");
        } catch (e) {
            addLog("Simulate Vend Error");
        }
    };

    const simulatePayment = async () => {
        if (!checkoutId) {
            alert("No active checkout to pay!");
            return;
        }
        try {
            await fetch(`${API_URL}/simulate/payment/${checkoutId}`, { method: 'POST' });
            addLog("Simulated Payment");
        } catch (e) {
            addLog("Simulate Payment Error");
        }
    };

    return (
        <div className="app-container" style={{ textAlign: 'center', padding: '20px' }}>
            <h1>SumUp MDB Display</h1>
            <h2>{message}</h2>
            <p>Status: {status} | WS: {wsStatus}</p>

            {status === "SHOW_QR" && qrData && (
                <div className="qr-container" style={{ margin: '20px auto' }}>
                    <QRCode value={qrData} size={256} />
                </div>
            )}

            {status === "PROCESSING" && (
                <div className="loader">Loading...</div>
            )}

            <div style={{ textAlign: 'left', fontSize: '0.8em', color: '#888', marginTop: '20px', maxHeight: '100px', overflowY: 'auto', border: '1px solid #444', padding: '5px' }}>
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>

            {/* Debug Panel */}
            <div className="debug-panel" style={{ marginTop: '30px', padding: '10px', borderTop: '1px solid #ccc' }}>
                <h3>Debug Controls</h3>
                <button className="action-vend" onClick={simulateVend} style={{ marginRight: '10px' }}>
                    🛒 Simulate VMC Request (€2.50)
                </button>
                <button className="action-pay" onClick={simulatePayment} style={{ marginRight: '10px' }}>
                    💳 Simulate Successful Payment
                </button>
                <button className="action-reset" onClick={() => { setStatus("IDLE"); setMessage("Ready for order"); setQrData(null); }}>
                    🔄 Reset State
                </button>
            </div>
        </div>
    );
}

export default App;

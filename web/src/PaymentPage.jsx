import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const checkoutId = searchParams.get('checkout_id');

    const [status, setStatus] = useState('initializing'); // initializing, ready, processing, paid, failed
    const [errorDetails, setErrorDetails] = useState(null);
    const widgetMounted = useRef(false);

    // 1. Helper to notify backend
    const notifyBackend = async (id) => {
        try {
            await fetch(`http://${window.location.hostname}:8000/api/simulate/payment/${id}`, { method: 'POST' });
        } catch (err) {
            console.error("Failed to notify backend:", err);
        }
    };

    // 2. Helper to check status (for 3DS return)
    const checkPaymentStatus = async (id) => {
        try {
            const res = await fetch(`http://${window.location.hostname}:8000/api/payment-status/${id}`);
            const data = await res.json();

            if (data.status === 'PAID' || data.status === 'SUCCESSFUL') {
                return true;
            }
            return false;
        } catch (e) {
            console.error("Status check failed", e);
            return false;
        }
    };

    // 3. Mount Widget Logic
    const mountWidget = (id) => {
        if (widgetMounted.current) return;
        if (!window.SumUpCard) return;

        try {
            window.SumUpCard.mount({
                checkoutId: id,
                locale: 'fr-FR',
                showGooglePay: true,
                showApplePay: true,
                onResponse: async function (type, body) {
                    if (type === 'success') {
                        if (body.status === 'PAID' || body.status === 'SUCCESSFUL') {
                            setStatus('paid');
                            setErrorDetails(body);
                            await notifyBackend(id);
                        } else {
                            setStatus('failed');
                            setErrorDetails(body);
                        }
                    } else if (type === 'error') {
                        setStatus('failed');
                        setErrorDetails({ type: type, ...body });
                    } else {
                        // Type 'sent' or others: The widget is working (e.g. 3DS redirect).
                        // Do NOT set failed. Just log.
                        console.log("Widget processing...", type);
                    }
                }
            });
            widgetMounted.current = true;
            setStatus('ready');
        } catch (e) {
            console.error("Mount Error:", e);
            setStatus('failed');
            setErrorDetails({ message: "Widget Mount Failed" });
        }
    };

    // 4. Main Effect: Load Script & Handle Flow
    useEffect(() => {
        if (!checkoutId) {
            setErrorDetails({ message: "No Checkout ID provided" });
            setStatus('failed');
            return;
        }

        // A. Check if already paid (Handling 3DS Redirect Return)
        checkPaymentStatus(checkoutId).then(isPaid => {
            if (isPaid) {
                setStatus('paid');
                notifyBackend(checkoutId);
                return;
            }

            // B. If not paid, Load SDK
            if (!document.getElementById('sumup-sdk')) {
                const script = document.createElement('script');
                script.id = 'sumup-sdk';
                script.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
                script.async = true;

                script.onload = () => mountWidget(checkoutId);
                script.onerror = () => {
                    setStatus('failed');
                    setErrorDetails({ message: "Failed to load SumUp SDK" });
                };
                document.body.appendChild(script);
            } else {
                // SDK already loaded (navigated back or hot reload)
                if (window.SumUpCard) {
                    mountWidget(checkoutId);
                } else {
                    // Wait a bit? Or just rely on onload if it's still loading
                    // For safety in React dev mode:
                    const interval = setInterval(() => {
                        if (window.SumUpCard) {
                            clearInterval(interval);
                            mountWidget(checkoutId);
                        }
                    }, 100);
                }
            }
        });

        return () => {
            // Cleanup if needed
        };
    }, [checkoutId]);


    // --- RENDER ---
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
            <h2>Paiement Borne</h2>

            {/* Status Messages */}
            {status === 'initializing' && <p>Chargement...</p>}

            {status === 'paid' && (
                <div style={{ padding: '20px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '8px' }}>
                    <h3>✅ Paiement Réussi</h3>
                    <p>Votre produit est en cours de distribution.</p>
                </div>
            )}

            {status === 'failed' && (
                <div style={{ padding: '20px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '8px' }}>
                    <h3>❌ Échec du paiement</h3>
                    <p>Veuillez réessayer.</p>
                    {errorDetails && (
                        <pre style={{ textAlign: 'left', fontSize: '11px', marginTop: '10px', overflowX: 'auto' }}>
                            {JSON.stringify(errorDetails, null, 2)}
                        </pre>
                    )}
                </div>
            )}

            {/* Widget Container - Always render it, but hide if paid/failed to avoid flicker */}
            <div id="sumup-card" style={{ display: (status === 'ready' || status === 'initializing') ? 'block' : 'none' }}></div>

        </div>
    );
};

export default PaymentPage;

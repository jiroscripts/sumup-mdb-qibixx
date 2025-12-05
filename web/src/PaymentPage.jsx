import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const checkoutId = searchParams.get('checkout_id');
    const [status, setStatus] = useState('loading');
    const mounted = React.useRef(false);

    useEffect(() => {
        if (mounted.current) return; // Prevent double mount
        mounted.current = true;

        if (!checkoutId) {
            setStatus('error_no_id');
            return;
        }

        // Load SumUp Widget Script dynamically
        const script = document.createElement('script');
        script.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
        script.async = true;

        script.onload = () => {
            setStatus('ready');
            if (window.SumUpCard) {
                try {
                    window.SumUpCard.mount({
                        checkoutId: checkoutId,
                        showGooglePay: true, // Attempt to enable Google Pay
                        showApplePay: true,  // Attempt to enable Apple Pay
                        onResponse: function (type, body) {
                            console.log('SumUp Response:', type, body);
                            if (type === 'success') {
                                setStatus('paid');
                                // Notify Backend
                                const backendUrl = `http://${window.location.hostname}:8000/api/simulate/payment/${checkoutId}`;
                                fetch(backendUrl, {
                                    method: 'POST'
                                }).catch(err => console.error("Failed to notify backend:", err));
                            } else {
                                setStatus('failed');
                            }
                        }
                    });
                } catch (e) {
                    console.error("SumUp Mount Error:", e);
                    setStatus('mount_error');
                }
            }
        };

        script.onerror = () => {
            setStatus('script_error');
        };

        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [checkoutId]);

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
            <h1>Paiement Vending Machine</h1>

            {status === 'loading' && <p>Chargement du module de paiement...</p>}
            {status === 'error_no_id' && <p style={{ color: 'red' }}>Erreur : Aucun ID de paiement fourni.</p>}
            {status === 'script_error' && <p style={{ color: 'red' }}>Erreur de chargement de SumUp.</p>}
            {status === 'mount_error' && <p style={{ color: 'red' }}>Erreur d'initialisation du widget.</p>}

            <div id="sumup-card"></div>

            {status === 'paid' && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '5px' }}>
                    <h2>Paiement Réussi !</h2>
                    <p>Votre produit est en cours de distribution.</p>
                </div>
            )}

            {status === 'failed' && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '5px' }}>
                    <h2>Échec du paiement</h2>
                    <p>Veuillez réessayer.</p>
                </div>
            )}
        </div>
    );
};

export default PaymentPage;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import PaymentPage from './PaymentPage';
import WalletPage from './WalletPage';
import RechargePage from './RechargePage';
import PaymentSuccessPage from './PaymentSuccessPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/payment" element={<PaymentPage />} />
                    <Route path="/payment/success" element={<PaymentSuccessPage />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/recharge" element={<RechargePage />} />
                    <Route path="/" element={
                        <div className="text-center p-12">
                            <h1>Vending Machine Web App</h1>
                            <p>Scan the QR code on the machine to pay.</p>
                        </div>
                    } />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PaymentPage from './PaymentPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/" element={
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <h1>Vending Machine Web App</h1>
                        <p>Scan the QR code on the machine to pay.</p>
                    </div>
                } />
            </Routes>
        </Router>
    );
}

export default App;

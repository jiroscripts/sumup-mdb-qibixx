import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Layout = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [session, setSession] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const handleLogin = () => {
        navigate('/wallet');
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">☕</span>
                        <span>Vending</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>

                        {session && (
                            <nav className="hidden sm:flex gap-6">
                                <Link
                                    to="/wallet"
                                    className={`text-sm font-medium transition-colors ${location.pathname === '/wallet' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                                >
                                    Wallet
                                </Link>
                                <Link
                                    to="/recharge"
                                    className={`text-sm font-medium transition-colors ${location.pathname === '/recharge' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
                                >
                                    Recharge
                                </Link>
                            </nav>
                        )}

                        {session ? (
                            <button onClick={handleLogout} className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors">
                                Logout
                            </button>
                        ) : (
                            <button onClick={handleLogin} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                                Login
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Nav (Visible only on small screens if logged in) */}
                {session && (
                    <div className="sm:hidden flex justify-around border-t border-gray-100 dark:border-gray-700 py-2 bg-white dark:bg-gray-800">
                        <Link
                            to="/wallet"
                            className={`text-sm font-medium px-4 py-1 rounded-full ${location.pathname === '/wallet' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            Wallet
                        </Link>
                        <Link
                            to="/recharge"
                            className={`text-sm font-medium px-4 py-1 rounded-full ${location.pathname === '/recharge' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                            Recharge
                        </Link>
                    </div>
                )}
            </header>

            <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6">
                <Outlet context={{ session }} />
            </main>

            <footer className="py-6 text-center text-sm text-gray-400">
                <p>&copy; 2025 Vending Co.</p>
            </footer>
        </div>
    );
};

export default Layout;

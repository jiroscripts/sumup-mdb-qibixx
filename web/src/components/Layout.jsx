import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Layout = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [session, setSession] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setAuthLoading(false);
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



    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 font-sans">
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-colors duration-200">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                            ☕
                        </div>
                        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">MDB Pay</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                            )}
                        </button>

                        {session && (
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                title="Déconnexion"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Nav Pills (Visible only if logged in) */}
                {session && (
                    <div className="max-w-md mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                        <Link
                            to="/wallet"
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all ${location.pathname === '/wallet'
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            Wallet
                        </Link>
                        <Link
                            to="/recharge"
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all ${location.pathname === '/recharge'
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            Recharger
                        </Link>
                    </div>
                )}
            </header>

            <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6">
                <Outlet context={{ session, authLoading }} />
            </main>

            <footer className="py-6 text-center text-sm text-gray-400">
                <p>&copy; 2025 Vending Co.</p>
            </footer>
        </div>
    );
};

export default Layout;

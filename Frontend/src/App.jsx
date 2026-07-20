import React, { useState, useEffect } from 'react';
import { ThemeProvider, Button, Text } from '@gravity-ui/uikit';
import '@gravity-ui/uikit/styles/styles.css';
import Packages from './pages/Packages';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('login'); // 'login' və ya 'register'

    // Proqram açılanda istifadəçinin daxil olub-olmadığını localStroage-dən yoxlayırıq
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    // Çıxış Etmək (Logout)
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setAuthMode('login');
    };

    return (
        <ThemeProvider theme="dark">
            <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9' }}>

                {/* HEADER / NAVIGATSIYA */}
                <header style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    padding: '16px 32px',
                    borderBottom: '1px solid #30363d',
                    backgroundColor: '#161b22'
                }}>
                    <Text variant="header-2" style={{ color: '#58a6ff' }}>📦 CargoMS</Text>

                    {user && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <Text variant="body-2">
                                👤 {user.fullName} <strong style={{ color: '#58a6ff' }}>({user.role})</strong>
                            </Text>
                            <Button view="flat-danger" onClick={handleLogout}>
                                Çıxış Et
                            </Button>
                        </div>
                    )}
                </header>

                {/* ANA MƏZMUN */}
                <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
                    {user ? (
                        <Packages />
                    ) : authMode === 'login' ? (
                        <Login
                            onLoginSuccess={(userData) => setUser(userData)}
                            switchToRegister={() => setAuthMode('register')}
                        />
                    ) : (
                        <Register
                            switchToLogin={() => setAuthMode('login')}
                        />
                    )}
                </main>

            </div>
        </ThemeProvider>
    );
}

export default App;
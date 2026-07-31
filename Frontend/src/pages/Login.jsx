import React, { useState } from 'react';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const Login = ({ onLoginSuccess, switchToRegister, switchToForgotPassword }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });

            // Token və istifadəçi məlumatlarını brauzerin yaddaşına (localStorage) yazırıq
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            onLoginSuccess(response.data.user);
        } catch (err) {
            setError(err.response?.data?.message || 'Giriş zamanı xəta baş verdi!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', overflow: 'hidden' }}>
            <div className="glow-orb" style={{ width: '420px', height: '420px', top: '10%', left: '50%', transform: 'translateX(-50%)', opacity: 0.25 }} />
            <Card
                className="fade-in-up"
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '380px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    backgroundColor: '#161b22',
                    border: '1px solid #30363d'
                }}
            >

                <div>
                    <Text variant="header-2" className="gradient-text">Xoş gəlmisiniz</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        Davam etmək üçün hesabınıza daxil olun.
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Email</Text>
                        <TextInput
                            type="email"
                            placeholder="example@mail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            size="l"
                        />
                    </div>

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Şifrə</Text>
                        <TextInput
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            size="l"
                        />
                        <div style={{ textAlign: 'right', marginTop: '6px' }}>
                            <span
                                onClick={switchToForgotPassword}
                                style={{ color: '#a78bfa', cursor: 'pointer', fontSize: '13px' }}
                            >
                                Şifrəni unutdum?
                            </span>
                        </div>
                    </div>

                    <Button
                        view="action"
                        size="xl"
                        type="submit"
                        loading={loading}
                        className="pill-btn"
                        style={{ marginTop: '8px', background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                    >
                        Daxil ol
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Text variant="body-1" color="secondary">
                        Hesabınız yoxdur?{' '}
                        <span
                            onClick={switchToRegister}
                            style={{ color: '#a78bfa', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Qeydiyyatdan keçin
                        </span>
                    </Text>
                </div>

            </Card>
        </div>
    );
};

export default Login;
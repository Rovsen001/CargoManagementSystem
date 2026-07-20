import React, { useState } from 'react';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const Login = ({ onLoginSuccess, switchToRegister }) => {
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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Card style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div>
                    <Text variant="header-2">Xoş gəlmisiniz 👋</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        Davam etmək üçün hesabınıza daxil olun.
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#ffdede', color: '#a00', borderRadius: '6px', fontSize: '14px' }}>
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
                    </div>

                    <Button view="action" size="xl" type="submit" loading={loading} style={{ marginTop: '8px' }}>
                        Daxil ol
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Text variant="body-1" color="secondary">
                        Hesabınız yoxdur?{' '}
                        <span
                            onClick={switchToRegister}
                            style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}
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
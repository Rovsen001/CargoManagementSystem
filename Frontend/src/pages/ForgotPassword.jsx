import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const ForgotPassword = ({ switchToLogin }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err) {
            setError(err.response?.data?.message || t('auth.genericError'));
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
                    <Text variant="header-2" className="gradient-text">{t('auth.forgotTitle')}</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        {t('auth.forgotSubtitle')}
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {sent ? (
                    <div style={{ padding: '12px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                        {t('auth.forgotSent')}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('auth.email')}</Text>
                            <TextInput
                                type="email"
                                placeholder="example@mail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                size="l"
                            />
                        </div>

                        <Button
                            view="action"
                            size="xl"
                            type="submit"
                            loading={loading}
                            className="pill-btn"
                            style={{ marginTop: '8px', background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                        >
                            {t('auth.sendResetLink')}
                        </Button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Text variant="body-1" color="secondary">
                        <span
                            onClick={switchToLogin}
                            style={{ color: '#a78bfa', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {t('auth.backToLogin')}
                        </span>
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default ForgotPassword;

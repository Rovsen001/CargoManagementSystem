import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const ResetPassword = ({ token, switchToLogin }) => {
    const { t } = useTranslation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError(t('auth.passwordTooShort'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('auth.passwordsMismatch'));
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, newPassword });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || t('auth.resetError'));
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
                    <Text variant="header-2" className="gradient-text">{t('auth.resetTitle')}</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        {t('auth.resetSubtitle')}
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {success ? (
                    <>
                        <div style={{ padding: '12px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                            {t('auth.resetSuccess')}
                        </div>
                        <Button
                            view="action"
                            size="xl"
                            onClick={switchToLogin}
                            className="pill-btn"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                        >
                            {t('auth.goToLogin')}
                        </Button>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('auth.newPassword')}</Text>
                            <TextInput
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                size="l"
                            />
                        </div>

                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('auth.newPasswordConfirm')}</Text>
                            <TextInput
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                            {t('auth.resetBtn')}
                        </Button>
                    </form>
                )}

                {!success && (
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
                )}
            </Card>
        </div>
    );
};

export default ResetPassword;

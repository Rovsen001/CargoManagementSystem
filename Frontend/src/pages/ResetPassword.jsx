import React, { useState } from 'react';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const ResetPassword = ({ token, switchToLogin }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Şifrələr bir-biri ilə üst-üstə düşmür!');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, newPassword });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Şifrə yenilənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Card style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <Text variant="header-2">Yeni Şifrə Təyin Et 🔒</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        Hesabınız üçün yeni şifrə daxil edin.
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
                            Şifrəniz uğurla yeniləndi! İndi yeni şifrənizlə daxil ola bilərsiniz.
                        </div>
                        <Button view="action" size="xl" onClick={switchToLogin}>Girişə keç</Button>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Yeni Şifrə</Text>
                            <TextInput
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                size="l"
                            />
                        </div>

                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Yeni Şifrə Təkrarı</Text>
                            <TextInput
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                size="l"
                            />
                        </div>

                        <Button view="action" size="xl" type="submit" loading={loading} style={{ marginTop: '8px' }}>
                            Şifrəni Yenilə
                        </Button>
                    </form>
                )}

                {!success && (
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <Text variant="body-1" color="secondary">
                            <span
                                onClick={switchToLogin}
                                style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Girişə qayıt
                            </span>
                        </Text>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ResetPassword;

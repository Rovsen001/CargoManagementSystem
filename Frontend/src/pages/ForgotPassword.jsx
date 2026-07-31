import React, { useState } from 'react';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const ForgotPassword = ({ switchToLogin }) => {
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
            setError(err.response?.data?.message || 'Xəta baş verdi, yenidən cəhd edin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Card style={{ width: '380px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <Text variant="header-2">Şifrəni Unutdum</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        Qeydiyyatdan keçdiyiniz email ünvanını daxil edin, bərpa linki göndərəcəyik.
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {sent ? (
                    <div style={{ padding: '12px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                        Əgər bu email qeydiyyatdan keçibsə, bərpa linki göndərildi. Zəhmət olmasa poçt qutunuzu (və spam qovluğunu) yoxlayın.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

                        <Button view="action" size="xl" type="submit" loading={loading} style={{ marginTop: '8px' }}>
                            Bərpa Linki Göndər
                        </Button>
                    </form>
                )}

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
            </Card>
        </div>
    );
};

export default ForgotPassword;

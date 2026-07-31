import React, { useState } from 'react';
import { Card, Text, TextInput, Button } from '@gravity-ui/uikit';
import api from '../services/api';

const Register = ({ switchToLogin }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        // Frontend tərəfində ilk yoxlama
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            setError('Zəhmət olmasa bütün xanaları doldurun!');
            return;
        }

        if (password.length < 6) {
            setError('Şifrə ən azı 6 simvoldan ibarət olmalıdır!');
            return;
        }

        if (password !== confirmPassword) {
            setError('Şifrələr bir-biri ilə üst-üstə düşmür!');
            return;
        }

        setLoading(true);

        try {
            await api.post('/auth/register', {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                password,
                confirmPassword
            });

            setSuccessMsg('Qeydiyyat uğurludur! Girişə yönləndirilirsiniz...');
            setTimeout(() => {
                switchToLogin();
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Qeydiyyat xətası baş verdi!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Card style={{ width: '440px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div>
                    <Text variant="header-2">Hesab Yarat</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        CargoMS sisteminə qoşulmaq üçün məlumatlarınızı daxil edin.
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Ad və Soyad (Yan-yana) */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Ad *</Text>
                            <TextInput
                                placeholder="Əli"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                size="l"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Soyad *</Text>
                            <TextInput
                                placeholder="Əliyev"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                size="l"
                            />
                        </div>
                    </div>

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Email *</Text>
                        <TextInput
                            type="email"
                            placeholder="example@mail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            size="l"
                        />
                    </div>

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Şifrə *</Text>
                        <TextInput
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            size="l"
                        />
                    </div>

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Şifrə Təkrarı *</Text>
                        <TextInput
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            size="l"
                        />
                    </div>

                    <Button view="action" size="xl" type="submit" loading={loading} style={{ marginTop: '8px' }}>
                        Qeydiyyatdan Keç
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Text variant="body-1" color="secondary">
                        Hesabınız var?{' '}
                        <span
                            onClick={switchToLogin}
                            style={{ color: '#58a6ff', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Daxil olun
                        </span>
                    </Text>
                </div>

            </Card>
        </div>
    );
};

export default Register;
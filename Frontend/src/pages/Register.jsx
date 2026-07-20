import React, { useState } from 'react';
import { Card, Text, TextInput, Button, Select } from '@gravity-ui/uikit';
import api from '../services/api';

const Register = ({ switchToLogin }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(['Customer']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            await api.post('/auth/register', {
                fullName,
                email,
                password,
                role: role[0]
            });

            setSuccessMsg('Qeydiyyat uğurla tamamlandı! Giriş səhifəsinə yönləndirilirsiniz...');
            setTimeout(() => {
                switchToLogin();
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Qeydiyyat zamanı xəta baş verdi!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Card style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div>
                    <Text variant="header-2">Yeni Hesab Yarat 🚀</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                        Məlumatlarınızı daxil edərək sistemə qoşulun.
                    </Text>
                </div>

                {error && (
                    <div style={{ padding: '10px', backgroundColor: '#ffdede', color: '#a00', borderRadius: '6px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{ padding: '10px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '6px', fontSize: '14px' }}>
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Ad və Soyad</Text>
                        <TextInput
                            placeholder="Əli Əliyev"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            size="l"
                        />
                    </div>

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

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Rol Seçin</Text>
                        <Select
                            value={role}
                            onUpdate={(val) => setRole(val)}
                            options={[
                                { value: 'Customer', content: 'Müştəri (Customer)' },
                                { value: 'Admin', content: 'Admin' }
                            ]}
                            size="l"
                            width="max"
                        />
                    </div>

                    <Button view="action" size="xl" type="submit" loading={loading} style={{ marginTop: '8px' }}>
                        Qeydiyyatdan Keç
                    </Button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <Text variant="body-1" color="secondary">
                        Artıq hesabınız var?{' '}
                        <span
                            onClick={switchToLogin}
                            style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}
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
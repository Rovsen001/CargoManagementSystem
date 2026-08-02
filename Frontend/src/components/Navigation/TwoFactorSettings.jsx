import React, { useState, useEffect } from 'react';
import { Text, Button, TextInput, Label } from '@gravity-ui/uikit';
import QRCode from 'qrcode';
import api from '../../services/api';

const TwoFactorSettings = () => {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [setupData, setSetupData] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });
    const [busy, setBusy] = useState(false);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const response = await api.get('/auth/2fa/status');
            setEnabled(response.data.enabled);
        } catch (err) {
            console.error("2FA statusu çəkilərkən xəta:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const startSetup = async () => {
        setMsg({ text: '', type: '' });
        setBusy(true);
        try {
            const response = await api.post('/auth/2fa/setup');
            setSetupData(response.data);
            const dataUrl = await QRCode.toDataURL(response.data.otpauthUrl, { width: 180, margin: 1 });
            setQrDataUrl(dataUrl);
        } catch (err) {
            setMsg({ text: err.response?.data?.message || '2FA quraşdırılarkən xəta baş verdi.', type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const confirmSetup = async () => {
        setMsg({ text: '', type: '' });
        setBusy(true);
        try {
            await api.post('/auth/2fa/verify-setup', { token: verifyCode });
            setMsg({ text: '2FA uğurla aktivləşdirildi!', type: 'success' });
            setSetupData(null);
            setQrDataUrl('');
            setVerifyCode('');
            setEnabled(true);
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Kod yanlışdır.', type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const disable2FA = async () => {
        setMsg({ text: '', type: '' });
        setBusy(true);
        try {
            await api.post('/auth/2fa/disable', { token: disableCode });
            setMsg({ text: '2FA deaktiv edildi.', type: 'success' });
            setDisableCode('');
            setEnabled(false);
        } catch (err) {
            setMsg({ text: err.response?.data?.message || 'Kod yanlışdır.', type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    if (loading) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="subheader-1">İki Addımlı Doğrulama (2FA)</Text>
                <Label theme={enabled ? 'success' : 'normal'}>{enabled ? 'Aktiv' : 'Qeyri-aktiv'}</Label>
            </div>

            {msg.text && (
                <div style={{
                    padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                    backgroundColor: msg.type === 'error' ? '#3d1618' : '#13231b',
                    color: msg.type === 'error' ? '#ff7b72' : '#56d364',
                    border: `1px solid ${msg.type === 'error' ? '#f85149' : '#2ea043'}`
                }}>
                    {msg.text}
                </div>
            )}

            {enabled ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Text variant="body-2" color="secondary">
                        Deaktiv etmək üçün autentifikasiya tətbiqinizdəki cari kodu daxil edin.
                    </Text>
                    <TextInput placeholder="000000" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
                    <Button view="outlined-danger" onClick={disable2FA} loading={busy}>Deaktiv Et</Button>
                </div>
            ) : setupData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                    {qrDataUrl && <img src={qrDataUrl} alt="2FA QR kod" width={160} height={160} style={{ background: '#fff', padding: '8px', borderRadius: '8px' }} />}
                    <Text variant="caption-2" color="secondary" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
                        Əl ilə daxil etmək üçün: <strong>{setupData.secret}</strong>
                    </Text>
                    <TextInput placeholder="000000" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} style={{ width: '100%' }} />
                    <Button view="action" onClick={confirmSetup} loading={busy} style={{ width: '100%' }}>Təsdiqlə və Aktivləşdir</Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Text variant="body-2" color="secondary">
                        Hesabınızı əlavə qorumaq üçün Google Authenticator kimi bir tətbiqlə 2FA aktivləşdirin.
                    </Text>
                    <Button view="outlined" onClick={startSetup} loading={busy}>Aktivləşdir</Button>
                </div>
            )}
        </div>
    );
};

export default TwoFactorSettings;

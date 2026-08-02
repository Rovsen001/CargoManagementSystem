// frontend/src/components/Home/TrackingWidget.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, TextInput, Button, Text, Alert, Label, Icon } from '@gravity-ui/uikit';
import { Magnifier, ShieldCheck } from '@gravity-ui/icons';
import QRCode from 'qrcode';
import api from '../../services/api';

const TrackingWidget = () => {
    const { t, i18n } = useTranslation();
    const [trackingCode, setTrackingCode] = useState('');
    const [packageData, setPackageData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');

    const dateLocale = i18n.language === 'en' ? 'en-GB' : 'az-AZ';

    const handleTrack = async (e) => {
        e.preventDefault();
        if (!trackingCode.trim()) return;

        setLoading(true);
        setError('');
        setPackageData(null);

        try {
            const response = await api.get(`/public/track/${trackingCode.trim()}`);
            setPackageData(response.data);
        } catch (err) {
            setError(t('tracking.notFound'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (packageData?.trackingNumber) {
            QRCode.toDataURL(packageData.trackingNumber, { width: 96, margin: 1 })
                .then(setQrDataUrl)
                .catch(() => setQrDataUrl(''));
        } else {
            setQrDataUrl('');
        }
    }, [packageData]);

    return (
        <Card
            view="outlined"
            style={{
                padding: '24px',
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
        >
            <div>
                <div style={{ marginBottom: '16px' }}>
                    <Text variant="header-2" style={{ color: '#ffffff' }}>{t('tracking.title')}</Text>
                    <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {t('tracking.subtitle')}
                    </Text>
                </div>

                <form onSubmit={handleTrack} style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flexGrow: 1 }}>
                        <TextInput
                            size="l"
                            placeholder={t('tracking.placeholder')}
                            value={trackingCode}
                            onUpdate={(value) => setTrackingCode(value)}
                            hasClear
                            disabled={loading}
                        />
                    </div>
                    <Button
                        size="l"
                        view="action"
                        type="submit"
                        loading={loading}
                    >
                        <Button.Icon>
                            <Magnifier />
                        </Button.Icon>
                        {t('tracking.search')}
                    </Button>
                </form>
            </div>

            <div style={{ marginTop: '16px' }}>
                {error && (
                    <Alert theme="danger" title={t('calculator.errorTitle')} message={error} />
                )}

                {packageData && (
                    <Card view="outlined" style={{ padding: '16px', marginTop: '12px', backgroundColor: '#0d1117', borderColor: '#30363d' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div>
                                <Text variant="subheader-2" style={{ display: 'block', marginBottom: '8px', color: '#ffffff' }}>
                                    {t('tracking.trackingNumber')}: <Text color="primary">{packageData.trackingNumber}</Text>
                                </Text>
                                <Text variant="body-1" style={{ display: 'block' }}>
                                    {t('tracking.status')}: <Text color="positive">{packageData.status || t('tracking.notSet')}</Text>
                                </Text>
                                <Text variant="body-1" color="secondary" style={{ display: 'block' }}>
                                    {t('tracking.weight')}: {packageData.weight != null ? `${parseFloat(packageData.weight).toFixed(2)} kq` : '-'}
                                </Text>
                                <Text variant="body-1" color="secondary" style={{ display: 'block' }}>
                                    {t('tracking.price')}: {packageData.price != null ? `$${parseFloat(packageData.price).toFixed(2)}` : '-'}
                                </Text>
                                {packageData.isInsured && (
                                    <Label theme="success" icon={<Icon data={ShieldCheck} size={14} />} style={{ marginTop: '6px' }}>
                                        {t('tracking.insured')} (${parseFloat(packageData.declaredValue).toFixed(2)})
                                    </Label>
                                )}
                            </div>
                            {qrDataUrl && (
                                <img src={qrDataUrl} alt="QR" width={72} height={72} style={{ background: '#fff', padding: '4px', borderRadius: '6px', flexShrink: 0 }} />
                            )}
                        </div>

                        {packageData.history && packageData.history.length > 0 && (
                            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #21262d' }}>
                                <Text variant="caption-2" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                                    {t('tracking.history')}
                                </Text>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {packageData.history.map((h, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                backgroundColor: idx === packageData.history.length - 1 ? '#a78bfa' : '#30363d',
                                                flexShrink: 0
                                            }} />
                                            <Text variant="body-2" style={{ color: idx === packageData.history.length - 1 ? '#ffffff' : '#8b949e', fontWeight: idx === packageData.history.length - 1 ? 600 : 400 }}>
                                                {h.status}
                                            </Text>
                                            <Text variant="caption-2" color="secondary" style={{ marginLeft: 'auto' }}>
                                                {new Date(h.changedAt).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </Card>
    );
};

export default TrackingWidget;

// frontend/src/components/Home/TrackingWidget.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { Card, TextInput, Button, Text, Alert } from '@gravity-ui/uikit';
import { Magnifier } from '@gravity-ui/icons';

const TrackingWidget = () => {
    const [trackingCode, setTrackingCode] = useState('');
    const [packageData, setPackageData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleTrack = async (e) => {
        e.preventDefault();
        if (!trackingCode.trim()) return;

        setLoading(true);
        setError('');
        setPackageData(null);

        try {
            const response = await axios.get(`/api/public/track/${trackingCode}`);
            setPackageData(response.data);
        } catch (err) {
            setError('Bağlama tapılmadı. Zəhmət olmasa izləmə kodunu düzgün daxil edin.');
        } finally {
            setLoading(false);
        }
    };

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
                    <Text variant="header-2" style={{ color: '#ffffff' }}>🔍 Bağlamanı İzləyin</Text>
                    <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Real vaxt rejimində bağlamanızın harada olduğunu öyrənin
                    </Text>
                </div>

                <form onSubmit={handleTrack} style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flexGrow: 1 }}>
                        <TextInput
                            size="l"
                            placeholder="İzləmə kodu (Məs: TR123456789)"
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
                        Axtar
                    </Button>
                </form>
            </div>

            <div style={{ marginTop: '16px' }}>
                {error && (
                    <Alert theme="danger" title="Xəta" message={error} />
                )}

                {packageData && (
                    <Card view="outlined" style={{ padding: '16px', marginTop: '12px', backgroundColor: '#0d1117', borderColor: '#30363d' }}>
                        <Text variant="subheader-2" style={{ display: 'block', marginBottom: '8px', color: '#ffffff' }}>
                            Status: <Text color="positive">{packageData.status_az || packageData.status}</Text>
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ display: 'block' }}>
                            Çıxış ölkəsi: {packageData.origin_country || 'Türkiyə'}
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ display: 'block' }}>
                            Son yenilənmə: {packageData.updated_at ? new Date(packageData.updated_at).toLocaleDateString('az-AZ') : 'Bugün'}
                        </Text>
                    </Card>
                )}
            </div>
        </Card>
    );
};

export default TrackingWidget;
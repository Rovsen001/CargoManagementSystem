import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Loader } from '@gravity-ui/uikit';
import api from '../services/api';

const StorageSettings = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saving, setSaving] = useState(false);

    const [freeDays, setFreeDays] = useState('');
    const [dailyRate, setDailyRate] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await api.get('/storage-settings');
            setFreeDays(String(response.data.freeDays));
            setDailyRate(String(response.data.dailyRate));
        } catch (err) {
            setError(err.response?.data?.message || 'Tənzimləmələr yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaveError('');
        setSaveSuccess(false);
        const freeDaysNum = parseInt(freeDays);
        const dailyRateNum = parseFloat(dailyRate);
        if (isNaN(freeDaysNum) || freeDaysNum < 0) {
            setSaveError('Pulsuz saxlama günləri düzgün, mənfi olmayan bir rəqəm olmalıdır!');
            return;
        }
        if (isNaN(dailyRateNum) || dailyRateNum < 0) {
            setSaveError('Günlük tarif düzgün, mənfi olmayan bir rəqəm olmalıdır!');
            return;
        }
        setSaving(true);
        try {
            await api.put('/storage-settings', { freeDays: freeDaysNum, dailyRate: dailyRateNum });
            setSaveSuccess(true);
        } catch (err) {
            setSaveError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <Loader size="l" />
            </div>
        );
    }

    if (error) {
        return (
            <Card style={{ padding: '24px', borderColor: '#f85149' }}>
                <Text color="danger">{error}</Text>
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">Anbar Saxlama Tənzimləmələri</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    Bağlamalar filialda pulsuz saxlanma müddətindən sonra günlük haqqa görə hesablanır.
                </Text>
            </div>

            <Card style={{ padding: '24px', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {saveError && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {saveError}
                    </div>
                )}
                {saveSuccess && (
                    <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                        Tənzimləmələr yadda saxlanıldı.
                    </div>
                )}

                <div>
                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Pulsuz Saxlama Müddəti (gün) *</Text>
                    <TextInput type="number" min="0" step="1" value={freeDays} onChange={(e) => { setFreeDays(e.target.value); setSaveSuccess(false); }} />
                </div>
                <div>
                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Günlük Saxlama Tarifi ($) *</Text>
                    <TextInput type="number" min="0" step="0.01" value={dailyRate} onChange={(e) => { setDailyRate(e.target.value); setSaveSuccess(false); }} />
                </div>

                <Button
                    view="action"
                    onClick={handleSave}
                    loading={saving}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none', alignSelf: 'flex-end' }}
                >
                    Yadda saxla
                </Button>
            </Card>
        </div>
    );
};

export default StorageSettings;

import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Label, Loader, Modal, Icon } from '@gravity-ui/uikit';
import { Plus, TrashBin } from '@gravity-ui/icons';
import api from '../services/api';

const CustomsDuty = () => {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [deMinimisThreshold, setDeMinimisThreshold] = useState('');
    const [defaultDutyRatePercent, setDefaultDutyRatePercent] = useState('');
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsError, setSettingsError] = useState('');
    const [settingsSuccess, setSettingsSuccess] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newPrefix, setNewPrefix] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [newRate, setNewRate] = useState('');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [ratesRes, settingsRes] = await Promise.all([
                api.get('/customs-duty-rates'),
                api.get('/customs-duty-settings')
            ]);
            setRates(Array.isArray(ratesRes.data) ? ratesRes.data : []);
            setDeMinimisThreshold(String(settingsRes.data.deMinimisThreshold));
            setDefaultDutyRatePercent(String(settingsRes.data.defaultDutyRatePercent));
        } catch (err) {
            setError(err.response?.data?.message || 'Məlumatlar yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleSaveSettings = async () => {
        setSettingsError('');
        setSettingsSuccess(false);
        const thresholdNum = parseFloat(deMinimisThreshold);
        const rateNum = parseFloat(defaultDutyRatePercent);
        if (isNaN(thresholdNum) || thresholdNum < 0) {
            setSettingsError('De minimis həddi düzgün, mənfi olmayan bir rəqəm olmalıdır!');
            return;
        }
        if (isNaN(rateNum) || rateNum < 0) {
            setSettingsError('Defolt rüsum faizi düzgün, mənfi olmayan bir rəqəm olmalıdır!');
            return;
        }
        setSettingsSaving(true);
        try {
            await api.put('/customs-duty-settings', { deMinimisThreshold: thresholdNum, defaultDutyRatePercent: rateNum });
            setSettingsSuccess(true);
        } catch (err) {
            setSettingsError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSettingsSaving(false);
        }
    };

    const openCreateModal = () => {
        setNewPrefix('');
        setNewCategory('');
        setNewRate('');
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSaveRate = async () => {
        setFormError('');
        if (!newPrefix.trim() || !newCategory.trim() || newRate === '') {
            setFormError('Bütün xanaları doldurun.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/customs-duty-rates', { hsCodePrefix: newPrefix, category: newCategory, dutyRatePercent: newRate });
            setIsModalOpen(false);
            fetchAll();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (rate) => {
        if (!window.confirm(`"${rate.category}" (${rate.hsCodePrefix}) tarifini silmək istədiyinizə əminsiniz?`)) return;
        try {
            await api.delete(`/customs-duty-rates/${rate.id}`);
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Silinərkən xəta baş verdi.');
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
                <Text variant="header-2" className="gradient-text">Gömrük Rüsumu Kalkulyatoru</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    HS koduna görə rüsum tarifləri və ümumi tənzimləmələr.
                </Text>
            </div>

            <Card style={{ padding: '24px', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Text variant="subheader-1">Ümumi Tənzimləmələr</Text>
                {settingsError && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                        {settingsError}
                    </div>
                )}
                {settingsSuccess && (
                    <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                        Tənzimləmələr yadda saxlanıldı.
                    </div>
                )}
                <div>
                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>De Minimis Həddi ($) *</Text>
                    <TextInput type="number" min="0" step="0.01" value={deMinimisThreshold} onChange={(e) => { setDeMinimisThreshold(e.target.value); setSettingsSuccess(false); }} />
                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Bu dəyərdən aşağı bağlamalar gömrük rüsumundan azaddır.
                    </Text>
                </div>
                <div>
                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Defolt Rüsum Faizi (%) *</Text>
                    <TextInput type="number" min="0" step="0.01" value={defaultDutyRatePercent} onChange={(e) => { setDefaultDutyRatePercent(e.target.value); setSettingsSuccess(false); }} />
                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        HS koduna uyğun tarif tapılmadıqda istifadə olunur.
                    </Text>
                </div>
                <Button
                    view="action"
                    onClick={handleSaveSettings}
                    loading={settingsSaving}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none', alignSelf: 'flex-end' }}
                >
                    Yadda saxla
                </Button>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="subheader-1">HS Kodu Tarif Cədvəli</Text>
                <Button
                    view="action"
                    onClick={openCreateModal}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                >
                    <Icon data={Plus} /> Yeni Tarif
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {rates.map((r) => (
                    <Card key={r.id} style={{ padding: '14px 16px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text style={{ display: 'block', color: '#f0f6fc', fontWeight: 600 }}>{r.category}</Text>
                            <Label theme="info" size="xs" style={{ marginTop: '4px' }}>HS: {r.hsCodePrefix}xxx</Label>
                            <Label theme="warning" size="xs" style={{ marginTop: '4px', marginLeft: '6px' }}>{parseFloat(r.dutyRatePercent).toFixed(2)}%</Label>
                        </div>
                        <Button size="s" view="flat-danger" onClick={() => handleDelete(r)}>
                            <Icon data={TrashBin} />
                        </Button>
                    </Card>
                ))}
                {rates.length === 0 && (
                    <Text color="secondary">Hələ tarif əlavə edilməyib. Bu halda bütün bağlamalara defolt faiz tətbiq olunacaq.</Text>
                )}
            </div>

            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div style={{ padding: '28px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Text variant="header-1">Yeni Tarif</Text>

                    {formError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {formError}
                        </div>
                    )}

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>HS Kodu Prefiksi (rəqəmlər) *</Text>
                        <TextInput placeholder="Məs: 61" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Kateqoriya *</Text>
                        <TextInput placeholder="Məs: Geyim" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Rüsum Faizi (%) *</Text>
                        <TextInput type="number" min="0" step="0.01" placeholder="Məs: 15" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
                        <Button view="flat" onClick={() => setIsModalOpen(false)}>Ləğv et</Button>
                        <Button
                            view="action"
                            onClick={handleSaveRate}
                            loading={saving}
                            className="pill-btn"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                        >
                            Yadda saxla
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomsDuty;

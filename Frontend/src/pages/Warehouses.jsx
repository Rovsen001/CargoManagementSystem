import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Label, Loader, Modal, Icon } from '@gravity-ui/uikit';
import { Plus, Pencil, TrashBin } from '@gravity-ui/icons';
import api from '../services/api';

const emptyForm = {
    name: '', country: '', flag: '', addressLine1: '', addressLine2: '',
    city: '', postalCode: '', phone: '', ratePerKg: '', isActive: true
};

const Warehouses = () => {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/warehouses');
            setWarehouses(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Anbarlar yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const openCreateModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (wh) => {
        setEditingId(wh.id);
        setForm({
            name: wh.name || '', country: wh.country || '', flag: wh.flag || '',
            addressLine1: wh.addressLine1 || '', addressLine2: wh.addressLine2 || '',
            city: wh.city || '', postalCode: wh.postalCode || '', phone: wh.phone || '',
            ratePerKg: String(wh.ratePerKg ?? ''), isActive: wh.isActive
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        setFormError('');
        if (!form.name.trim() || !form.country.trim() || !form.addressLine1.trim()) {
            setFormError('Anbar adı, ölkə və ünvan mütləqdir.');
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/warehouses/${editingId}`, form);
            } else {
                await api.post('/warehouses', form);
            }
            setIsModalOpen(false);
            fetchWarehouses();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (wh) => {
        if (!window.confirm(`"${wh.name}" anbarını silmək istədiyinizə əminsiniz?`)) return;
        try {
            await api.delete(`/warehouses/${wh.id}`);
            fetchWarehouses();
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <Text variant="header-2" className="gradient-text">Anbarlar</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Xarici anbarları idarə edin, ünvan və kq-başına tarifi təyin edin.
                    </Text>
                </div>
                <Button
                    view="action"
                    size="l"
                    onClick={openCreateModal}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                >
                    <Icon data={Plus} /> Yeni Anbar
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {warehouses.map((wh) => (
                    <Card key={wh.id} className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Text variant="subheader-2" style={{ color: '#ffffff' }}>{wh.flag} {wh.name}</Text>
                            <Label theme={wh.isActive ? 'success' : 'normal'}>{wh.isActive ? 'Aktiv' : 'Passiv'}</Label>
                        </div>
                        <Text variant="body-2" color="secondary">{wh.country}</Text>
                        <Text variant="body-2" color="secondary" style={{ fontSize: '13px' }}>
                            {wh.addressLine1}{wh.city ? `, ${wh.city}` : ''}
                        </Text>
                        <Label theme="info" size="s" style={{ alignSelf: 'flex-start' }}>${parseFloat(wh.ratePerKg).toFixed(2)}/kq</Label>

                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #21262d' }}>
                            <Button size="s" view="flat-secondary" onClick={() => openEditModal(wh)}>
                                <Icon data={Pencil} /> Redaktə et
                            </Button>
                            <Button size="s" view="flat-danger" onClick={() => handleDelete(wh)}>
                                <Icon data={TrashBin} /> Sil
                            </Button>
                        </div>
                    </Card>
                ))}
                {warehouses.length === 0 && (
                    <Text color="secondary">Hələ anbar əlavə edilməyib.</Text>
                )}
            </div>

            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div style={{ padding: '28px', width: '480px', maxWidth: '90vw', backgroundColor: '#161b22', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Text variant="header-1">{editingId ? 'Anbarı Redaktə Et' : 'Yeni Anbar'}</Text>

                    {formError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {formError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 2 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Anbar Adı *</Text>
                            <TextInput placeholder="Məs: İstanbul Anbarı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Bayraq</Text>
                            <TextInput placeholder="🇹🇷" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Ölkə *</Text>
                        <TextInput placeholder="Məs: Türkiyə" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                    </div>

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Ünvan Sətri 1 *</Text>
                        <TextInput value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
                    </div>

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Ünvan Sətri 2</Text>
                        <TextInput value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Şəhər</Text>
                            <TextInput value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Poçt Kodu</Text>
                            <TextInput value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Telefon</Text>
                            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Kq başına tarif ($) *</Text>
                            <TextInput type="number" min="0" step="0.01" value={form.ratePerKg} onChange={(e) => setForm({ ...form, ratePerKg: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
                        <Button view="flat" onClick={() => setIsModalOpen(false)}>Ləğv et</Button>
                        <Button
                            view="action"
                            onClick={handleSave}
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

export default Warehouses;

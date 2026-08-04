import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Label, Loader, Modal, Icon } from '@gravity-ui/uikit';
import { Plus, TrashBin } from '@gravity-ui/icons';
import api from '../services/api';

const CATEGORY_THEME = {
    'Silah': 'danger',
    'Partlayıcı': 'danger',
    'Narkotik': 'danger',
    'Təhlükəli': 'warning',
    'Maliyyə': 'info',
    'Digər': 'normal'
};

const ProhibitedTerms = () => {
    const [terms, setTerms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTerm, setNewTerm] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchTerms = async () => {
        setLoading(true);
        try {
            const response = await api.get('/prohibited-terms');
            setTerms(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Siyahı yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTerms();
    }, []);

    const openCreateModal = () => {
        setNewTerm('');
        setNewCategory('');
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        setFormError('');
        if (!newTerm.trim() || !newCategory.trim()) {
            setFormError('Açar söz və kateqoriya mütləqdir.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/prohibited-terms', { term: newTerm, category: newCategory });
            setIsModalOpen(false);
            fetchTerms();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (t) => {
        if (!window.confirm(`"${t.term}" açar sözünü silmək istədiyinizə əminsiniz?`)) return;
        try {
            await api.delete(`/prohibited-terms/${t.id}`);
            fetchTerms();
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
                    <Text variant="header-2" className="gradient-text">Qadağan Olunmuş Mallar</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Bağlama bəyanı zamanı mal təsvirində avtomatik yoxlanılan açar sözlər siyahısı.
                    </Text>
                </div>
                <Button
                    view="action"
                    size="l"
                    onClick={openCreateModal}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                >
                    <Icon data={Plus} /> Yeni Açar Söz
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                {terms.map((t) => (
                    <Card key={t.id} style={{ padding: '14px 16px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Text style={{ display: 'block', color: '#f0f6fc', fontWeight: 600 }}>{t.term}</Text>
                            <Label theme={CATEGORY_THEME[t.category] || 'normal'} size="xs" style={{ marginTop: '4px' }}>{t.category}</Label>
                        </div>
                        <Button size="s" view="flat-danger" onClick={() => handleDelete(t)}>
                            <Icon data={TrashBin} />
                        </Button>
                    </Card>
                ))}
                {terms.length === 0 && (
                    <Text color="secondary">Hələ açar söz əlavə edilməyib.</Text>
                )}
            </div>

            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div style={{ padding: '28px', width: '400px', maxWidth: '90vw', backgroundColor: '#161b22', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Text variant="header-1">Yeni Açar Söz</Text>

                    {formError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {formError}
                        </div>
                    )}

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Açar Söz *</Text>
                        <TextInput placeholder="Məs: silah" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Kateqoriya *</Text>
                        <TextInput placeholder="Məs: Silah" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
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

export default ProhibitedTerms;

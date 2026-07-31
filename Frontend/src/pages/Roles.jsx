import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Label, Loader, Modal, Checkbox, Icon } from '@gravity-ui/uikit';
import { Plus, Pencil, TrashBin, ShieldCheck } from '@gravity-ui/icons';
import api from '../services/api';

const Roles = () => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null); // null = yeni rol
    const [formName, setFormName] = useState('');
    const [formPermissions, setFormPermissions] = useState([]);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rolesRes, permsRes] = await Promise.all([
                api.get('/roles'),
                api.get('/permissions')
            ]);
            setRoles(rolesRes.data);
            setPermissions(permsRes.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Rollar yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreateModal = () => {
        setEditingRole(null);
        setFormName('');
        setFormPermissions([]);
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (role) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormPermissions(role.permissions);
        setFormError('');
        setIsModalOpen(true);
    };

    const togglePermission = (key) => {
        setFormPermissions((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const handleSave = async () => {
        setFormError('');
        if (!formName.trim()) {
            setFormError('Rol adını daxil edin.');
            return;
        }

        setSaving(true);
        try {
            if (editingRole) {
                await api.put(`/roles/${editingRole.id}`, { name: formName, permissionKeys: formPermissions });
            } else {
                await api.post('/roles', { name: formName, permissionKeys: formPermissions });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Yadda saxlanarkən xəta baş verdi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role) => {
        if (role.userCount > 0) {
            alert(`Bu rol ${role.userCount} istifadəçiyə təyin edilib. Əvvəlcə onların rolunu dəyişin.`);
            return;
        }
        if (!window.confirm(`"${role.name}" rolunu silmək istədiyinizə əminsiniz?`)) return;

        try {
            await api.delete(`/roles/${role.id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Silinərkən xəta baş verdi.');
        }
    };

    const categories = [...new Set(permissions.map((p) => p.category))];

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
                    <Text variant="header-2" className="gradient-text">Rollar və İcazələr</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Sistemdəki rolları idarə edin, yeni rol yaradın və hər birinə icazələr təyin edin.
                    </Text>
                </div>
                <Button
                    view="action"
                    size="l"
                    onClick={openCreateModal}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                >
                    <Icon data={Plus} /> Yeni Rol
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {roles.map((role) => (
                    <Card key={role.id} className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {role.isSuperAdmin && <Icon data={ShieldCheck} style={{ color: '#f5a623' }} />}
                                <Text variant="subheader-2" style={{ color: '#ffffff' }}>{role.name}</Text>
                            </div>
                            <Label theme="info">{role.userCount} istifadəçi</Label>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {role.isSuperAdmin ? (
                                <Label theme="warning">Bütün icazələr (struktur olaraq)</Label>
                            ) : role.permissions.length > 0 ? (
                                role.permissions.map((key) => {
                                    const perm = permissions.find((p) => p.key === key);
                                    return <Label key={key} theme="normal" size="s">{perm ? perm.label : key}</Label>;
                                })
                            ) : (
                                <Text variant="caption-2" color="secondary">Heç bir icazəsi yoxdur</Text>
                            )}
                        </div>

                        {!role.isSuperAdmin && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #21262d' }}>
                                <Button size="s" view="flat-secondary" onClick={() => openEditModal(role)}>
                                    <Icon data={Pencil} /> Redaktə et
                                </Button>
                                <Button size="s" view="flat-danger" onClick={() => handleDelete(role)}>
                                    <Icon data={TrashBin} /> Sil
                                </Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div style={{ padding: '28px', width: '520px', maxWidth: '90vw', backgroundColor: '#161b22', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <Text variant="header-1">{editingRole ? 'Rolu Redaktə Et' : 'Yeni Rol Yarat'}</Text>

                    {formError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {formError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Rol Adı</Text>
                        <TextInput
                            placeholder="Məs: Anbar Nəzarətçisi"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            size="l"
                        />
                    </div>

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '10px', display: 'block' }}>İcazələr</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '320px', overflowY: 'auto' }}>
                            {categories.map((category) => (
                                <div key={category}>
                                    <Text variant="caption-2" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                        {category}
                                    </Text>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {permissions.filter((p) => p.category === category).map((perm) => (
                                            <Checkbox
                                                key={perm.key}
                                                checked={formPermissions.includes(perm.key)}
                                                onUpdate={() => togglePermission(perm.key)}
                                            >
                                                {perm.label}
                                            </Checkbox>
                                        ))}
                                    </div>
                                </div>
                            ))}
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

export default Roles;

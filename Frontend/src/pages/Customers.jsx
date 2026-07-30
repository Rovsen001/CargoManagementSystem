import React, { useState, useEffect } from 'react';
import { Table, Text, Card, Loader, Select, Label, TextInput, Icon } from '@gravity-ui/uikit';
import { Magnifier } from '@gravity-ui/icons';
import api from '../services/api';

const Customers = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                api.get('/users'),
                api.get('/roles/names')
            ]);
            setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
            setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
        } catch (error) {
            console.error("Məlumatlar çəkilərkən xəta:", error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRoleChange = async (userId, newRole) => {
        setUpdatingId(userId);
        try {
            await api.put(`/users/${userId}/role`, { role: newRole });
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        } catch (error) {
            console.error("Rol yenilənərkən xəta:", error);
            alert("Rol yenilənərkən xəta baş verdi.");
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredUsers = users.filter((u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const q = searchQuery.toLowerCase().trim();
        return fullName.includes(q) || (u.email || '').toLowerCase().includes(q);
    });

    const roleTheme = { Admin: 'warning', 'Super Admin': 'warning', Staff: 'success', Manager: 'success', Courier: 'success', Customer: 'info' };

    const columns = [
        { id: 'id', name: 'ID', meta: { width: '60px' } },
        {
            id: 'name',
            name: 'Ad Soyad',
            template: (item) => (
                <Text style={{ fontWeight: 600 }}>
                    {item.firstName || item.lastName ? `${item.firstName || ''} ${item.lastName || ''}`.trim() : '—'}
                </Text>
            )
        },
        { id: 'email', name: 'Email' },
        {
            id: 'role',
            name: 'Rol',
            template: (item) => <Label theme={roleTheme[item.role] || 'normal'}>{item.role}</Label>
        },
        {
            id: 'createdAt',
            name: 'Qeydiyyat Tarixi',
            template: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString('az-AZ') : '—'
        },
        {
            id: 'actions',
            name: 'Rolu Dəyiş',
            template: (item) => (
                <Select
                    value={[item.role]}
                    onUpdate={(val) => handleRoleChange(item.id, val[0])}
                    options={roles.map((r) => ({ value: r.name, content: r.name }))}
                    size="s"
                    disabled={updatingId === item.id || item.id === currentUser.id}
                    width="180px"
                />
            )
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2">👥 Müştəri və İstifadəçi Siyahısı</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    Sistemdəki bütün istifadəçiləri idarə edin və rollarını dəyişdirin.
                </Text>
            </div>

            <Card style={{ padding: '16px' }}>
                <TextInput
                    placeholder="Ad, soyad və ya email ilə axtar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    hasClearable
                    size="l"
                    leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                />
            </Card>

            <Text variant="caption-2" color="secondary">
                Göstərilir: <strong>{filteredUsers.length}</strong> / {users.length} istifadəçi
            </Text>

            <Card style={{ padding: '8px', overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><Loader size="l" /></div>
                ) : filteredUsers.length > 0 ? (
                    <Table data={filteredUsers} columns={columns} />
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Text variant="subheader-1" color="secondary">İstifadəçi tapılmadı.</Text>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Customers;

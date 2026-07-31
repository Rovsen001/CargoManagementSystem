// Frontend/src/components/Home/AdminHome.jsx
import React, { useState, useEffect } from 'react';
import { Card, Text, Button, Avatar, Label, Loader } from '@gravity-ui/uikit';
import { ShieldCheck, Gear, ArrowRight, Box, Person, Wallet, ChartLine, CircleExclamation } from '@gravity-ui/icons';
import api from '../../services/api';

const AdminHome = ({ user, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [packageStats, setPackageStats] = useState(null);
    const [revenue, setRevenue] = useState({ totalRevenue: 0, monthRevenue: 0 });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersRes, statsRes, revenueRes] = await Promise.all([
                    api.get('/users'),
                    api.get('/packages/stats'),
                    api.get('/finance/admin-summary')
                ]);
                setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
                setPackageStats(statsRes.data);
                setRevenue(revenueRes.data);
            } catch (error) {
                console.error("Admin panel məlumatları çəkilərkən xəta:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getUserInitials = () => {
        if (!user) return 'A';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'A';
    };

    const todayCount = users.filter((u) => {
        if (!u.createdAt) return false;
        const created = new Date(u.createdAt);
        const now = new Date();
        return created.toDateString() === now.toDateString();
    }).length;

    const recentUsers = [...users]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <Loader size="l" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Executive Greeting Banner */}
            <Card
                view="raised"
                style={{
                    padding: '28px 32px',
                    background: 'linear-gradient(135deg, #231908 0%, #161b22 100%)',
                    border: '1px solid #d97706',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Avatar
                        text={getUserInitials()}
                        size="xl"
                        theme="warning"
                        style={{ border: '2px solid #f59e0b' }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>
                                Sistem İdarəetmə Paneli — {user.firstName || user.fullName || 'Admin'}
                            </Text>
                            <Label theme="warning" size="m">Administrator</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            Qeydiyyatlı istifadəçilər: <span style={{ color: '#56d364', fontWeight: 600 }}>{users.length}</span> | Cəmi bağlamalar: <span style={{ color: '#56d364', fontWeight: 600 }}>{packageStats?.total || 0}</span>
                        </Text>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        size="l"
                        view="action"
                        onClick={() => onNavigate && onNavigate('dashboard')}
                    >
                        <Button.Icon><ChartLine /></Button.Icon>
                        Analitika Dashboard
                    </Button>
                    <Button
                        size="l"
                        view="outlined-warning"
                        onClick={() => onNavigate && onNavigate('finance')}
                    >
                        <Button.Icon><Wallet /></Button.Icon>
                        Maliyyə Nəzarəti
                    </Button>
                </div>
            </Card>

            {/* System KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Qeydiyyatlı İstifadəçilər</Text>
                        <Person style={{ color: '#58a6ff' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {users.length} Müştəri
                    </Text>
                    <Text variant="caption-2" style={{ color: '#56d364', marginTop: '4px', display: 'block' }}>
                        +{todayCount} yeni bu gün
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Cəmi Bağlamalar</Text>
                        <Box style={{ color: '#e3b341' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {packageStats?.total || 0} Bağlama
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        {packageStats?.declared || 0}-i bəyan olunub
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Ümumi Gəlir (AZN)</Text>
                        <Wallet style={{ color: '#56d364' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#56d364', marginTop: '12px', display: 'block' }}>
                        ₼ {parseFloat(revenue.totalRevenue || 0).toFixed(2)}
                    </Text>
                    <Text variant="caption-2" style={{ color: '#58a6ff', marginTop: '4px', display: 'block' }}>
                        Bu ay: ₼ {parseFloat(revenue.monthRevenue || 0).toFixed(2)}
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Prosesdə Bağlamalar</Text>
                        <CircleExclamation style={{ color: '#f85149' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#f85149', marginTop: '12px', display: 'block' }}>
                        {(packageStats?.onTheWay || 0) + (packageStats?.customs || 0)} Bağlama
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        Yolda və ya gömrükdə
                    </Text>
                </Card>
            </div>

            {/* Admin Actions & Recent Registrations Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <Card view="outlined" style={{ padding: '24px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <Text variant="header-2" style={{ color: '#ffffff', marginBottom: '16px', display: 'block' }}>
                        Sürətli Admin Keçidləri
                    </Text>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <Button size="l" view="flat-secondary" onClick={() => onNavigate && onNavigate('customers')}>
                            <Button.Icon><Person /></Button.Icon> Müştəri Siyahısı
                        </Button>
                        <Button size="l" view="flat-secondary" onClick={() => onNavigate && onNavigate('packages')}>
                            <Button.Icon><Box /></Button.Icon> Bütün Bağlamalar
                        </Button>
                        <Button size="l" view="flat-secondary" onClick={() => onNavigate && onNavigate('finance')}>
                            <Button.Icon><Wallet /></Button.Icon> Maliyyə Auditi
                        </Button>
                        <Button size="l" view="flat-secondary" onClick={() => onNavigate && onNavigate('reports')}>
                            <Button.Icon><ChartLine /></Button.Icon> Hesabatlar
                        </Button>
                    </div>
                </Card>

                <Card view="outlined" style={{ padding: '24px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <Text variant="header-2" style={{ color: '#ffffff', marginBottom: '16px', display: 'block' }}>
                        Son Qeydiyyatlar
                    </Text>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentUsers.length > 0 ? recentUsers.map((u) => (
                            <div key={u.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d'
                            }}>
                                <Text style={{ color: '#f0f6fc', fontWeight: 500 }}>{u.firstName} {u.lastName}</Text>
                                <Label theme={u.role === 'Admin' ? 'warning' : 'info'} size="s">{u.role}</Label>
                            </div>
                        )) : (
                            <Text color="secondary">Hələ istifadəçi yoxdur.</Text>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdminHome;

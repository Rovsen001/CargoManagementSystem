// Frontend/src/components/Home/AdminHome.jsx
import React from 'react';
import { Card, Text, Button, Avatar, Label, Alert } from '@gravity-ui/uikit';
import { ShieldCheck, Gear, ArrowRight, Box, Person, Wallet, ChartLine, CircleExclamation } from '@gravity-ui/icons';

const AdminHome = ({ user, onNavigate }) => {
    const getUserInitials = () => {
        if (!user) return 'A';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'A';
    };

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
                                Sistem İdarəetmə Paneli — {user.firstName || user.fullName || 'Admin'} 🛡️
                            </Text>
                            <Label theme="warning" size="m">Administrator</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            Sistem Vəziyyəti: <span style={{ color: '#56d364', fontWeight: 600 }}>Tam Stabil (99.9% Uptime)</span> | Aktiv DB Bağlantıları: 42
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
                        1,420 Müştəri
                    </Text>
                    <Text variant="caption-2" style={{ color: '#56d364', marginTop: '4px', display: 'block' }}>
                        +12 yeni bu gün
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Bugünkü Bağlamalar</Text>
                        <Box style={{ color: '#e3b341' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        384 Bağlama
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        142-si bəyan olunub
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Aylıq Gəlir (AZN)</Text>
                        <Wallet style={{ color: '#56d364' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#56d364', marginTop: '12px', display: 'block' }}>
                        ₼ 18,450.00
                    </Text>
                    <Text variant="caption-2" style={{ color: '#58a6ff', marginTop: '4px', display: 'block' }}>
                        Geçən aydan +15.4% çox
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Təcili Təsdiq Gözləyən</Text>
                        <CircleExclamation style={{ color: '#f85149' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#f85149', marginTop: '12px', display: 'block' }}>
                        7 Əməliyyat
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        Xüsusi bəyannamələr
                    </Text>
                </Card>
            </div>

            {/* Admin Actions & Alerts Grid */}
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
                        Sistem Xəbərdarlıqları
                    </Text>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Alert theme="warning" title="İstanbul Anbarı Doluluq Həddi" message="İstanbul anbarının fiziki tutumu 85%-ə çatmışdır. Qruplaşdırılmış uçuş planlaşdırın." />
                        <Alert theme="info" title="Avtomatik Bəyanat Yeniləməsi" message="MS SQL verilənlər bazası nüsxəsi saat 04:00-da uğurla tamamlandı." />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AdminHome;

// Frontend/src/components/Home/CustomerHome.jsx
import React, { useState, useEffect } from 'react';
import { Card, Text, Button, Avatar, Label, Loader } from '@gravity-ui/uikit';
import { Box, Plus, Wallet, ArrowRight, ShieldCheck } from '@gravity-ui/icons';
import api from '../../services/api';

const CustomerHome = ({ user, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [activePackages, setActivePackages] = useState([]);
    const [archivedCount, setArchivedCount] = useState(0);
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [activeRes, archivedRes, balanceRes] = await Promise.all([
                    api.get(`/packages?archived=false&userId=${user.id}&role=${user.role}`),
                    api.get(`/packages?archived=true&userId=${user.id}&role=${user.role}`),
                    api.get(`/finance/my-balance?userId=${user.id}`)
                ]);
                setActivePackages(Array.isArray(activeRes.data) ? activeRes.data : []);
                setArchivedCount(Array.isArray(archivedRes.data) ? archivedRes.data.length : 0);
                setBalance(balanceRes.data.balance || 0);
            } catch (error) {
                console.error("Müştəri paneli məlumatları çəkilərkən xəta:", error);
            } finally {
                setLoading(false);
            }
        };
        if (user?.id) fetchData();
    }, [user]);

    const getUserInitials = () => {
        if (!user) return 'C';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'C';
    };

    const arrivedCount = activePackages.filter((p) => p.status === 'Filialda').length;
    const onTheWayCount = activePackages.filter((p) => p.status === 'Yoldadır' || p.status === 'Gömrükdə').length;
    const recentPackages = [...activePackages].sort((a, b) => b.id - a.id).slice(0, 3);

    const statusTheme = { 'Bəyan edildi': 'info', 'Yoldadır': 'warning', 'Gömrükdə': 'danger', 'Filialda': 'success' };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <Loader size="l" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header Greeting Banner */}
            <Card
                view="raised"
                style={{
                    padding: '28px 32px',
                    background: 'linear-gradient(135deg, #161b22 0%, #1c2638 100%)',
                    border: '1px solid #30363d',
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
                        theme="normal"
                        style={{ border: '2px solid #1f6feb' }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>
                                Xoş gəldiniz, {user.firstName || user.fullName || 'Müştəri'}!
                            </Text>
                            <Label theme="info" size="m">Müştəri Portalı</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            Müştəri Kodu: <strong style={{ color: '#58a6ff' }}>#C-{user.id ? user.id + 10400 : '10492'}</strong> | Hesab Statusu: <span style={{ color: '#56d364' }}>Aktiv</span>
                        </Text>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        size="l"
                        view="action"
                        onClick={() => onNavigate && onNavigate('packages')}
                    >
                        <Button.Icon><Plus /></Button.Icon>
                        Yeni Bağlama Bəyan Et
                    </Button>
                    <Button
                        size="l"
                        view="outlined"
                        onClick={() => onNavigate && onNavigate('finance')}
                    >
                        <Button.Icon><Wallet /></Button.Icon>
                        Balansı Artır
                    </Button>
                </div>
            </Card>

            {/* Quick Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <Card view="outlined" className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Aktiv Bağlamalar</Text>
                        <Box style={{ color: '#1f6feb' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {activePackages.length} Bağlama
                    </Text>
                    <Text variant="caption-2" style={{ color: '#58a6ff', marginTop: '4px', display: 'block' }}>
                        {onTheWayCount} yoldadır, {arrivedCount} anbardadır
                    </Text>
                </Card>

                <Card view="outlined" className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Cari Balans</Text>
                        <Wallet style={{ color: '#56d364' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#56d364', marginTop: '12px', display: 'block' }}>
                        ₼ {parseFloat(balance).toFixed(2)}
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        Maliyyə səhifəsindən artırın
                    </Text>
                </Card>

                <Card view="outlined" className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Təhvil Alınacaq</Text>
                        <Box style={{ color: '#e3b341' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {arrivedCount} Bağlama
                    </Text>
                    <Text variant="caption-2" style={{ color: '#e3b341', marginTop: '4px', display: 'block' }}>
                        Bakı Baş Anbarı
                    </Text>
                </Card>

                <Card view="outlined" className="hover-lift" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Tamamlanmış Bağlamalar</Text>
                        <ShieldCheck style={{ color: '#a371f7' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {archivedCount}
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        Arxivlənmiş bağlamalar
                    </Text>
                </Card>
            </div>

            {/* Recent Activity / Packages Table Summary */}
            <Card view="outlined" style={{ padding: '24px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <Text variant="header-2" style={{ color: '#ffffff' }}>Son Bağlamalarınız</Text>
                        <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                            Son bəyan edilən və yolda olan bağlamalarınızın cari vəziyyəti
                        </Text>
                    </div>
                    <Button view="flat-info" onClick={() => onNavigate && onNavigate('packages')}>
                        Hamısına bax <Button.Icon><ArrowRight /></Button.Icon>
                    </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentPackages.length > 0 ? recentPackages.map((pkg) => (
                        <div key={pkg.id} style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 1fr 1fr 1fr',
                            padding: '12px 16px',
                            backgroundColor: '#0d1117',
                            borderRadius: '8px',
                            alignItems: 'center',
                            border: '1px solid #21262d'
                        }}>
                            <Text style={{ fontWeight: 600, color: '#f0f6fc' }}>{pkg.trackingNumber}</Text>
                            <Text color="secondary">{pkg.weight || '-'}</Text>
                            <div><Label theme={statusTheme[pkg.status] || 'normal'}>{pkg.status || 'Təyin edilməyib'}</Label></div>
                            <Text style={{ color: '#56d364', fontWeight: 600 }}>{pkg.price || '-'}</Text>
                        </div>
                    )) : (
                        <Text color="secondary" style={{ padding: '20px 0', textAlign: 'center', display: 'block' }}>
                            Hələ aktiv bağlamanız yoxdur.
                        </Text>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default CustomerHome;

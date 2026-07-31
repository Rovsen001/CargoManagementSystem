// Frontend/src/components/Home/StaffHome.jsx
import React, { useState, useEffect } from 'react';
import { Card, Text, Button, Avatar, Label, Loader } from '@gravity-ui/uikit';
import { Box, Rocket, ShieldCheck } from '@gravity-ui/icons';
import api from '../../services/api';

const StaffHome = ({ user, onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/packages/stats');
                setStats(response.data);
            } catch (error) {
                console.error("Anbar statistikası çəkilərkən xəta:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const getUserInitials = () => {
        if (!user) return 'M';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'M';
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <Loader size="l" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Operational Banner */}
            <Card
                view="raised"
                style={{
                    padding: '28px 32px',
                    background: 'linear-gradient(135deg, #161b22 0%, #1e261f 100%)',
                    border: '1px solid #2ea043',
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
                        style={{ border: '2px solid #56d364' }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>
                                Anbar və Əməliyyat Paneli — {user.firstName || user.fullName || 'Personal'}
                            </Text>
                            <Label theme="success" size="m">{user.role || 'Personal'}</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            Sistemdəki cəmi bağlama sayı: <strong style={{ color: '#56d364' }}>{stats?.total || 0}</strong>
                        </Text>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                        size="l"
                        view="action"
                        onClick={() => onNavigate && onNavigate('packages')}
                    >
                        <Button.Icon><Box /></Button.Icon>
                        Bağlamaları İdarə Et
                    </Button>
                </div>
            </Card>

            {/* Warehouse KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Yeni Bəyan Edilmiş</Text>
                        <Rocket style={{ color: '#58a6ff' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {stats?.declared || 0} Bağlama
                    </Text>
                    <Text variant="caption-2" style={{ color: '#58a6ff', marginTop: '4px', display: 'block' }}>
                        Anbara qəbul gözləyir
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Yolda / Gömrükdə</Text>
                        <Box style={{ color: '#e3b341' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#ffffff', marginTop: '12px', display: 'block' }}>
                        {(stats?.onTheWay || 0) + (stats?.customs || 0)} Bağlama
                    </Text>
                    <Text variant="caption-2" style={{ color: '#e3b341', marginTop: '4px', display: 'block' }}>
                        Çeşidlənməyə hazırlaşır
                    </Text>
                </Card>

                <Card view="outlined" style={{ padding: '20px', backgroundColor: '#161b22', borderColor: '#30363d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="body-1" color="secondary">Filialda / Təhvil Verilib</Text>
                        <ShieldCheck style={{ color: '#56d364' }} size={22} />
                    </div>
                    <Text variant="header-3" style={{ color: '#56d364', marginTop: '12px', display: 'block' }}>
                        {stats?.arrived || 0} Bağlama
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                        Müştərilərə təhvilə hazır / verilib
                    </Text>
                </Card>
            </div>
        </div>
    );
};

export default StaffHome;

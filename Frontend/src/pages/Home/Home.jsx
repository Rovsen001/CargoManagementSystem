// frontend/src/pages/Home/Home.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import HeroSection from '../../components/Home/HeroSection';
import TrackingWidget from '../../components/Home/TrackingWidget';
import CalculatorWidget from '../../components/Home/CalculatorWidget';
import CustomerHome from '../../components/Home/CustomerHome';
import AdminHome from '../../components/Home/AdminHome';
import StaffHome from '../../components/Home/StaffHome';
import { Card, Text } from '@gravity-ui/uikit';
import { Box, Rocket, ShieldCheck, Clock } from '@gravity-ui/icons';

const Home = ({ user, onNavigate, onNavigateLogin, onNavigateRegister }) => {
    const { t } = useTranslation();
    // 1. İSTİFADƏÇİ GİRİŞ ETMƏYİBSƏ (QONAQ REJİMİ)
    if (!user) {
        return (
            <main style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
                {/* 1.1 Hero Qarşılama Section */}
                <HeroSection
                    onNavigateLogin={onNavigateLogin}
                    onNavigateRegister={onNavigateRegister}
                />

                {/* 1.2 İzləmə və Kalkulyator Vidjetləri (Grid şəklində yan-yana) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <TrackingWidget />
                    <CalculatorWidget />
                </div>

                {/* 1.3 Üstünlüklər və Xidmətlər Section */}
                <Card view="raised" style={{ padding: '32px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                        <Text variant="header-2" style={{ color: '#ffffff' }}>{t('features.title')}</Text>
                        <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                            {t('features.subtitle')}
                        </Text>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                        <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #21262d' }}>
                            <Box size={24} style={{ color: '#1f6feb', marginBottom: '10px' }} />
                            <Text variant="subheader-1" style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                                {t('features.fastDeliveryTitle')}
                            </Text>
                            <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                                {t('features.fastDeliveryDesc')}
                            </Text>
                        </div>

                        <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #21262d' }}>
                            <Rocket size={24} style={{ color: '#56d364', marginBottom: '10px' }} />
                            <Text variant="subheader-1" style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                                {t('features.courierTitle')}
                            </Text>
                            <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                                {t('features.courierDesc')}
                            </Text>
                        </div>

                        <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #21262d' }}>
                            <ShieldCheck size={24} style={{ color: '#e3b341', marginBottom: '10px' }} />
                            <Text variant="subheader-1" style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                                {t('features.insuranceTitle')}
                            </Text>
                            <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                                {t('features.insuranceDesc')}
                            </Text>
                        </div>

                        <div style={{ padding: '16px', backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #21262d' }}>
                            <Clock size={24} style={{ color: '#a371f7', marginBottom: '10px' }} />
                            <Text variant="subheader-1" style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                                {t('features.supportTitle')}
                            </Text>
                            <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                                {t('features.supportDesc')}
                            </Text>
                        </div>
                    </div>
                </Card>
            </main>
        );
    }

    // 2. İSTİFADƏÇİ GİRİŞ EDİBSƏ — İCAZƏSİNƏ UYĞUN QARŞILAMA EKRANI
    const hasElevatedAccess = user.isSuperAdmin || (user.permissions && user.permissions.length > 0);
    const hasAdminAccess = user.isSuperAdmin || user.permissions?.includes('users.view');

    return (
        <main style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
            {hasAdminAccess ? (
                <AdminHome user={user} onNavigate={onNavigate} />
            ) : hasElevatedAccess ? (
                <StaffHome user={user} onNavigate={onNavigate} />
            ) : (
                <CustomerHome user={user} onNavigate={onNavigate} />
            )}
        </main>
    );
};

export default Home;
// Frontend/src/components/Home/HeroSection.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, Label } from '@gravity-ui/uikit';
import { Box, ArrowRight, ShieldCheck, Clock, Globe, Rocket } from '@gravity-ui/icons';
import Hero3D from './Hero3D';

const HeroSection = ({ onNavigateLogin, onNavigateRegister }) => {
    const { t } = useTranslation();
    return (
        <div
            style={{
                position: 'relative',
                marginBottom: '32px',
                padding: '48px 32px',
                background: 'linear-gradient(180deg, #0d1117 0%, #131826 100%)',
                border: '1px solid #241a33',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)'
            }}
        >
            {/* Arxa fonda əsl 3D fırlanan qlobus/nüvə səhnəsi */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <Hero3D />
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
                {/* Left Column: Heading, Subtitle & Actions */}
                <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <Label theme="info" size="m" style={{ marginBottom: '12px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                            {t('hero.badge')}
                        </Label>
                        <Text
                            variant="display-1"
                            className="gradient-text"
                            style={{
                                fontWeight: 800,
                                lineHeight: 1.15,
                                display: 'block',
                                marginTop: '8px',
                                fontSize: '42px'
                            }}
                        >
                            {t('hero.title')}
                        </Text>
                    </div>

                    <Text variant="body-2" color="secondary" style={{ fontSize: '15px', lineHeight: 1.6 }}>
                        {t('hero.subtitle')}
                    </Text>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                        <Button
                            size="xl"
                            view="action"
                            onClick={onNavigateRegister}
                            className="pill-btn"
                            style={{
                                padding: '0 28px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                                border: 'none'
                            }}
                        >
                            {t('hero.createAccount')} <Button.Icon><ArrowRight /></Button.Icon>
                        </Button>
                        <Button
                            size="xl"
                            view="outlined"
                            onClick={onNavigateLogin}
                            className="pill-btn"
                            style={{ padding: '0 28px' }}
                        >
                            {t('hero.login')}
                        </Button>
                    </div>

                    {/* Features Badges */}
                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #241a33' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock style={{ color: '#56d364' }} />
                            <Text variant="caption-2" color="secondary">{t('hero.feature247')}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck style={{ color: '#a78bfa' }} />
                            <Text variant="caption-2" color="secondary">{t('hero.featureInsured')}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe style={{ color: '#e3b341' }} />
                            <Text variant="caption-2" color="secondary">{t('hero.featureGlobal')}</Text>
                        </div>
                    </div>
                </div>

                {/* Right Column: Visual Feature Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Card
                        view="outlined"
                        className="hover-lift float-anim fade-in-up fade-in-up-delay-1"
                        style={{
                            padding: '20px',
                            backgroundColor: 'rgba(22, 27, 34, 0.6)',
                            backdropFilter: 'blur(12px)',
                            borderColor: '#30363d',
                            borderRadius: '16px'
                        }}
                    >
                        <Box size={28} style={{ color: '#a78bfa', marginBottom: '12px' }} />
                        <Text variant="subheader-2" style={{ display: 'block', color: '#ffffff', marginBottom: '6px' }}>
                            {t('hero.card1Title')}
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                            {t('hero.card1Desc')}
                        </Text>
                    </Card>

                    <Card
                        view="outlined"
                        className="hover-lift float-anim fade-in-up fade-in-up-delay-2"
                        style={{
                            padding: '20px',
                            backgroundColor: 'rgba(22, 27, 34, 0.6)',
                            backdropFilter: 'blur(12px)',
                            borderColor: '#30363d',
                            borderRadius: '16px',
                            animationDuration: '7s'
                        }}
                    >
                        <Rocket size={28} style={{ color: '#2ea043', marginBottom: '12px' }} />
                        <Text variant="subheader-2" style={{ display: 'block', color: '#ffffff', marginBottom: '6px' }}>
                            {t('hero.card2Title')}
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                            {t('hero.card2Desc')}
                        </Text>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default HeroSection;

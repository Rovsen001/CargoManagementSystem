// Frontend/src/components/Home/HeroSection.jsx
import React from 'react';
import { Card, Text, Button, Label } from '@gravity-ui/uikit';
import { Box, ArrowRight, ShieldCheck, Clock, Globe, Rocket } from '@gravity-ui/icons';

const HeroSection = ({ onNavigateLogin, onNavigateRegister }) => {
    return (
        <Card
            view="raised"
            style={{
                padding: '40px 32px',
                marginBottom: '32px',
                background: 'linear-gradient(135deg, #161b22 0%, #1f293d 100%)',
                border: '1px solid #30363d',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
                {/* Left Column: Heading, Subtitle & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <Label theme="info" size="m" style={{ marginBottom: '12px' }}>
                            🚀 Sürətli & Etibarlı Kargo Xidməti
                        </Label>
                        <Text
                            variant="display-1"
                            style={{
                                color: '#ffffff',
                                fontWeight: 800,
                                lineHeight: 1.2,
                                display: 'block',
                                marginTop: '8px'
                            }}
                        >
                            Dünyadan Qapınıza Xəyal Etdiyiniz Sürətlə
                        </Text>
                    </div>

                    <Text variant="body-2" color="secondary" style={{ fontSize: '15px', lineHeight: 1.6 }}>
                        CargoMS ilə Türkiyə, ABŞ və Avropadan olan sifarişlərinizi real vaxtda izləyin, 
                        çatdırılma xərclərini dərhal hesablayın və anbarlarımızdan maneəsiz təhvil alın.
                    </Text>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                        <Button
                            size="xl"
                            view="action"
                            onClick={onNavigateRegister}
                            style={{ padding: '0 24px', fontWeight: 600 }}
                        >
                            Hesab Yarat <Button.Icon><ArrowRight /></Button.Icon>
                        </Button>
                        <Button
                            size="xl"
                            view="outlined"
                            onClick={onNavigateLogin}
                            style={{ padding: '0 24px' }}
                        >
                            Daxil Ol
                        </Button>
                    </div>

                    {/* Features Badges */}
                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #30363d' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock style={{ color: '#56d364' }} />
                            <Text variant="caption-2" color="secondary">24/7 Dəstək & İzləmə</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck style={{ color: '#58a6ff' }} />
                            <Text variant="caption-2" color="secondary">Sığortalı Çatdırılma</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe style={{ color: '#e3b341' }} />
                            <Text variant="caption-2" color="secondary">Qlobal Şəbəkə</Text>
                        </div>
                    </div>
                </div>

                {/* Right Column: Visual Feature Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Card view="outlined" style={{ padding: '20px', backgroundColor: '#0d1117', borderColor: '#30363d' }}>
                        <Box size={28} style={{ color: '#1f6feb', marginBottom: '12px' }} />
                        <Text variant="subheader-2" style={{ display: 'block', color: '#ffffff', marginBottom: '6px' }}>
                            Ağıllı Anbar
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                            Bütün bağlamalarınız xarici anbara daxil olan kimi avtomatik bəyan edilir.
                        </Text>
                    </Card>

                    <Card view="outlined" style={{ padding: '20px', backgroundColor: '#0d1117', borderColor: '#30363d' }}>
                        <Rocket size={28} style={{ color: '#2ea043', marginBottom: '12px' }} />
                        <Text variant="subheader-2" style={{ display: 'block', color: '#ffffff', marginBottom: '6px' }}>
                            Ekspress Uçuşlar
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ fontSize: '13px' }}>
                            Həftədə 5 dəfə müntəzəm avia-reyslər vasitəsilə 2-4 iş gününə çatdırılma.
                        </Text>
                    </Card>
                </div>
            </div>
        </Card>
    );
};

export default HeroSection;

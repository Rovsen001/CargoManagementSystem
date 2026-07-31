// Frontend/src/components/Footer/Footer.jsx
import React from 'react';
import { Text, Label, Button } from '@gravity-ui/uikit';
import { Box, ShieldCheck, Clock, Globe } from '@gravity-ui/icons';

const Footer = ({ onNavigate }) => {
    return (
        <footer style={{
            backgroundColor: '#161b22',
            borderTop: '1px solid #30363d',
            padding: '48px 40px 24px 40px',
            marginTop: 'auto',
            color: '#8b949e'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
                gap: '40px',
                paddingBottom: '36px',
                borderBottom: '1px solid #21262d'
            }}>
                {/* Column 1: Brand & Bio */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: '#1f6feb', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                            <Box size={20} style={{ color: '#ffffff' }} />
                        </div>
                        <Text variant="header-2" style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                            CargoMS
                        </Text>
                    </div>

                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                        CargoMS — Türkiyə, ABŞ və Avropa ölkələrindən onlayn sifariş etdiyiniz bağlamaların 
                        etibarlı və sürətli şəkildə Azərbaycana çatdırılmasını həyata keçirən innovativ kargo xidmətidir.
                    </Text>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <Label theme="info" size="s">Visa & Mastercard</Label>
                        <Label theme="success" size="s">3D Secure</Label>
                        <Label theme="warning" size="s">SSL Encrypted</Label>
                    </div>
                </div>

                {/* Column 2: Quick Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>Naviqasiya</Text>
                    <a href="#home" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('home'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>Ana Səhifə</a>
                    <a href="#packages" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('packages'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>Bağlamalarım</a>
                    <a href="#finance" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('finance'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>Maliyyə və Balans</a>
                    <a href="#warehouses" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('warehouses'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>Xarici Anbarlar</a>
                </div>

                {/* Column 3: Rules & FAQ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>Faydalı</Text>
                    <span style={{ fontSize: '14px' }}>Bəyannamə Qaydaları</span>
                    <span style={{ fontSize: '14px' }}>Qadağan Olunmuş Mallar</span>
                    <span style={{ fontSize: '14px' }}>Daşınma Tarifləri</span>
                    <span style={{ fontSize: '14px' }}>Tez-tez Verilən Suallar</span>
                </div>

                {/* Column 4: Contact & Office */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>Əlaqə & Filial</Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        <strong>*0011</strong> / +994 (12) 490-00-11
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        support@cargoms.az
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        Bakı şəhəri, Nəsimi r-nu, Nizami küç. 142
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px' }}>
                        İş saatları: B.e - Şənbə: 09:00 - 20:00
                    </Text>
                </div>
            </div>

            {/* Bottom Copyright & Rights */}
            <div style={{
                maxWidth: '1200px',
                margin: '20px auto 0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px'
            }}>
                <Text color="secondary">© 2026 CargoMS Logistics Management System. Bütün hüquqlar qorunur.</Text>
                <Text color="secondary">Məxfilik Siyasəti | İstifadəçi Şərtləri</Text>
            </div>
        </footer>
    );
};

export default Footer;

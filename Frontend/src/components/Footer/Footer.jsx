// Frontend/src/components/Footer/Footer.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Label, Button } from '@gravity-ui/uikit';
import { Box, ShieldCheck, Clock, Globe } from '@gravity-ui/icons';

const Footer = ({ onNavigate }) => {
    const { t } = useTranslation();
    return (
        <footer className="footer-root" style={{
            backgroundColor: '#161b22',
            borderTop: '1px solid #30363d',
            padding: '48px 40px 24px 40px',
            marginTop: 'auto',
            color: '#8b949e'
        }}>
            <div className="footer-grid" style={{
                maxWidth: '1200px',
                margin: '0 auto',
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
                        {t('footer.bio')}
                    </Text>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <Label theme="info" size="s">Visa & Mastercard</Label>
                        <Label theme="success" size="s">3D Secure</Label>
                        <Label theme="warning" size="s">SSL Encrypted</Label>
                    </div>
                </div>

                {/* Column 2: Quick Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>{t('footer.navigation')}</Text>
                    <a href="#home" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('home'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>{t('nav.home')}</a>
                    <a href="#packages" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('packages'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>{t('nav.packages')}</a>
                    <a href="#finance" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('finance'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>{t('nav.finance')}</a>
                    <a href="#warehouses" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate('warehouses'); }} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px' }}>{t('nav.warehouses')}</a>
                </div>

                {/* Column 3: Rules & FAQ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>{t('footer.useful')}</Text>
                    <span style={{ fontSize: '14px' }}>{t('footer.declarationRules')}</span>
                    <span style={{ fontSize: '14px' }}>{t('footer.bannedGoods')}</span>
                    <span style={{ fontSize: '14px' }}>{t('footer.rates')}</span>
                    <span style={{ fontSize: '14px' }}>{t('footer.faq')}</span>
                </div>

                {/* Column 4: Contact & Office */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '4px' }}>{t('footer.contact')}</Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        <strong>*0011</strong> / +994 (12) 490-00-11
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        support@cargoms.az
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '14px' }}>
                        {t('footer.address')}
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ marginTop: '4px' }}>
                        {t('footer.hours')}
                    </Text>
                </div>
            </div>

            {/* Bottom Copyright & Rights */}
            <div className="footer-bottom-row" style={{
                maxWidth: '1200px',
                margin: '20px auto 0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px'
            }}>
                <Text color="secondary">{t('footer.rights')}</Text>
                <Text color="secondary">{t('footer.legal')}</Text>
            </div>
        </footer>
    );
};

export default Footer;

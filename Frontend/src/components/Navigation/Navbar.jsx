// Frontend/src/components/Navigation/Navbar.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Avatar, Label, Icon } from '@gravity-ui/uikit';
import { Box, Wallet, Plus, Gear, ArrowRightFromSquare, Globe, Bars, Xmark } from '@gravity-ui/icons';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar = ({
    user,
    activePage,
    authMode,
    onNavigate,
    onNavigateAuth,
    onOpenPayment,
    onOpenProfile,
    balance
}) => {
    const { t } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const getUserInitials = () => {
        if (!user) return 'U';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'U';
    };

    const handleMobileNavigate = (page) => {
        setMobileMenuOpen(false);
        onNavigate(page);
    };

    return (
        <header className="navbar-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#161b22',
            borderBottom: '1px solid #30363d',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
            {/* Left: Brand Logo & Tagline */}
            <div
                onClick={() => onNavigate('home')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', minWidth: 0 }}
            >
                <div style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                    padding: '10px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexShrink: 0,
                    boxShadow: '0 0 16px rgba(139, 92, 246, 0.45)'
                }}>
                    <Icon data={Box} size={22} style={{ color: '#ffffff' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <Text variant="header-2" style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                        CargoMS
                    </Text>
                    <Text variant="caption-2" color="secondary" className="navbar-brand-tagline" style={{ display: 'block', fontSize: '11px' }}>
                        {t('nav.tagline')}
                    </Text>
                </div>
            </div>

            {/* Center: Main Website Navigation Menu */}
            <nav className="navbar-desktop-nav" style={{ alignItems: 'center', gap: '8px' }}>
                <Button
                    view={activePage === 'home' ? 'action' : 'flat-secondary'}
                    size="l"
                    onClick={() => onNavigate('home')}
                >
                    {t('nav.home')}
                </Button>

                {user && (
                    <>
                        <Button
                            view={activePage === 'packages' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('packages')}
                        >
                            {t('nav.packages')}
                        </Button>
                        <Button
                            view={activePage === 'finance' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('finance')}
                        >
                            {t('nav.finance')}
                        </Button>
                        <Button
                            view={activePage === 'warehouses' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('warehouses')}
                        >
                            {t('nav.warehouses')}
                        </Button>
                        <Button
                            view={activePage === 'support' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('support')}
                        >
                            {t('nav.support')}
                        </Button>
                        <Button
                            view={activePage === 'claims' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('claims')}
                        >
                            {t('nav.claims')}
                        </Button>
                    </>
                )}

                {!user && (
                    <>
                        <Button
                            view={activePage === 'services' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('home')}
                        >
                            {t('nav.services')}
                        </Button>
                        <Button
                            view={activePage === 'tracking' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigate('home')}
                        >
                            {t('nav.tracking')}
                        </Button>
                    </>
                )}
            </nav>

            {/* Right: Balance Pill & User Account Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="navbar-balance-amount" style={{ display: 'contents' }}>
                    <LanguageSwitcher />
                </div>
                {user ? (
                    <>
                        <NotificationBell />

                        {/* Interactive Balance Badge Pill */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#0d1117',
                            border: '1px solid #30363d',
                            padding: '6px 14px',
                            borderRadius: '30px'
                        }}>
                            <div className="navbar-balance-amount" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Wallet style={{ color: '#56d364' }} size={18} />
                                <Text variant="body-2" style={{ fontWeight: 'bold', color: '#56d364', fontSize: '15px' }}>
                                    ₼ {parseFloat(balance || 0).toFixed(2)}
                                </Text>
                            </div>
                            <Button
                                size="xs"
                                view="action"
                                style={{ borderRadius: '50%', width: '24px', height: '24px', padding: 0 }}
                                title={t('customerHome.topUp')}
                                onClick={onOpenPayment}
                            >
                                <Plus size={14} />
                            </Button>
                        </div>

                        {/* Customer Avatar & Profile Card Trigger */}
                        <div
                            onClick={onOpenProfile}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 14px',
                                backgroundColor: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '30px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#30363d';
                                e.currentTarget.style.borderColor = '#8b949e';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#21262d';
                                e.currentTarget.style.borderColor = '#30363d';
                            }}
                        >
                            <Avatar
                                text={getUserInitials()}
                                size="m"
                                theme={user.role === 'Admin' ? 'warning' : 'normal'}
                            />
                            <div className="navbar-user-text" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '2px' }}>
                                <Text variant="body-2" style={{ fontWeight: 600, color: '#f0f6fc', lineHeight: 1.2 }}>
                                    {user.firstName ? `${user.firstName} ${user.lastName}` : user.fullName}
                                </Text>
                                <Text variant="caption-2" color="secondary" style={{ fontSize: '11px' }}>
                                    #C-{user.id ? user.id + 10400 : '10492'}
                                </Text>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="navbar-balance-amount" style={{ display: 'flex', gap: '10px' }}>
                        <Button
                            view={authMode === 'login' ? 'action' : 'flat-secondary'}
                            size="l"
                            onClick={() => onNavigateAuth('login')}
                        >
                            {t('nav.login')}
                        </Button>
                        <Button
                            view={authMode === 'register' ? 'action' : 'outlined'}
                            size="l"
                            onClick={() => onNavigateAuth('register')}
                        >
                            {t('nav.register')}
                        </Button>
                    </div>
                )}

                {/* Mobile Hamburger Toggle */}
                <Button
                    className="navbar-hamburger-btn"
                    view="flat-secondary"
                    size="l"
                    onClick={() => setMobileMenuOpen((o) => !o)}
                    style={{ padding: '0 8px' }}
                >
                    <Icon data={mobileMenuOpen ? Xmark : Bars} size={20} />
                </Button>
            </div>

            {/* Mobile Dropdown Panel */}
            <div className={`navbar-mobile-panel${mobileMenuOpen ? ' navbar-mobile-panel-open' : ''}`} style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                flexDirection: 'column',
                gap: '4px',
                backgroundColor: '#161b22',
                borderBottom: '1px solid #30363d',
                boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                padding: '12px 16px 16px'
            }}>
                <Button view={activePage === 'home' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('home')}>
                    {t('nav.home')}
                </Button>
                {user && (
                    <>
                        <Button view={activePage === 'packages' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('packages')}>
                            {t('nav.packages')}
                        </Button>
                        <Button view={activePage === 'finance' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('finance')}>
                            {t('nav.finance')}
                        </Button>
                        <Button view={activePage === 'warehouses' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('warehouses')}>
                            {t('nav.warehouses')}
                        </Button>
                        <Button view={activePage === 'support' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('support')}>
                            {t('nav.support')}
                        </Button>
                        <Button view={activePage === 'claims' ? 'action' : 'flat-secondary'} size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('claims')}>
                            {t('nav.claims')}
                        </Button>
                    </>
                )}
                {!user && (
                    <>
                        <Button view="flat-secondary" size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('home')}>
                            {t('nav.services')}
                        </Button>
                        <Button view="flat-secondary" size="l" width="max" style={{ justifyContent: 'flex-start' }} onClick={() => handleMobileNavigate('home')}>
                            {t('nav.tracking')}
                        </Button>
                    </>
                )}

                <div style={{ borderTop: '1px solid #30363d', marginTop: '8px', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <LanguageSwitcher />
                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="body-2" style={{ fontWeight: 'bold', color: '#56d364' }}>
                                ₼ {parseFloat(balance || 0).toFixed(2)}
                            </Text>
                            <Button size="s" view="outlined" onClick={() => { setMobileMenuOpen(false); onOpenProfile(); }}>
                                {t('nav.profile', 'Profil')}
                            </Button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button size="s" view="flat-secondary" onClick={() => { setMobileMenuOpen(false); onNavigateAuth('login'); }}>
                                {t('nav.login')}
                            </Button>
                            <Button size="s" view="outlined" onClick={() => { setMobileMenuOpen(false); onNavigateAuth('register'); }}>
                                {t('nav.register')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;

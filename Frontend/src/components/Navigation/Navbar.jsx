// Frontend/src/components/Navigation/Navbar.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text, Avatar, Label, Icon } from '@gravity-ui/uikit';
import { Box, Wallet, Plus, Gear, ArrowRightFromSquare, Globe } from '@gravity-ui/icons';
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
    const getUserInitials = () => {
        if (!user) return 'U';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'U';
    };

    return (
        <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 40px',
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
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
                <div style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                    padding: '10px',
                    borderRadius: '10px',
                    display: 'flex',
                    boxShadow: '0 0 16px rgba(139, 92, 246, 0.45)'
                }}>
                    <Icon data={Box} size={22} style={{ color: '#ffffff' }} />
                </div>
                <div>
                    <Text variant="header-2" style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                        CargoMS
                    </Text>
                    <Text variant="caption-2" color="secondary" style={{ display: 'block', fontSize: '11px' }}>
                        {t('nav.tagline')}
                    </Text>
                </div>
            </div>

            {/* Center: Main Website Navigation Menu */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <LanguageSwitcher />
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '2px' }}>
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
                    <div style={{ display: 'flex', gap: '10px' }}>
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
            </div>
        </header>
    );
};

export default Navbar;

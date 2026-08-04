import React, { useState, useEffect } from 'react';
import { ThemeProvider, Button, Text, Icon, Avatar, Label, Modal, TextInput, Card } from '@gravity-ui/uikit';
import { Box, Gear } from '@gravity-ui/icons';
import '@gravity-ui/uikit/styles/styles.css';
import Navbar from './components/Navigation/Navbar';
import NotificationBell from './components/Navigation/NotificationBell';
import TwoFactorSettings from './components/Navigation/TwoFactorSettings';
import Footer from './components/Footer/Footer';
import PaymentModal from './components/Payment/PaymentModal';
import WarehouseAddressesModal from './components/Home/WarehouseAddressesModal';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard';
import Packages from './pages/Packages';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Roles from './pages/Roles';
import Warehouses from './pages/Warehouses';
import AuditLog from './pages/AuditLog';
import ProhibitedTerms from './pages/ProhibitedTerms';
import Support from './pages/Support';
import FinancePage from './pages/FinancePage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import api from './services/api';

function App() {
    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('home'); // 'home', 'login', 'register', 'forgot', 'reset'
    const [resetToken, setResetToken] = useState(null);

    // Active Page state for Navigation
    const [activePage, setActivePage] = useState('home'); // 'home', 'packages', 'finance', 'warehouses', 'dashboard', 'customers', 'reports'

    // Balance state synced for Header Navbar
    const [userBalance, setUserBalance] = useState(45.50);
    const [paymentNotice, setPaymentNotice] = useState(null); // { type: 'success' | 'cancelled' }

    // Modals
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Profile Change Password state
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passMsg, setPassMsg] = useState({ text: '', type: '' });
    const [passLoading, setPassLoading] = useState(false);

    // Profile Edit (name/email) state
    const [profileFirstName, setProfileFirstName] = useState('');
    const [profileLastName, setProfileLastName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            if (parsed.balance !== undefined) {
                setUserBalance(parsed.balance);
            }
        }

        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('resetToken');
        if (tokenFromUrl) {
            setResetToken(tokenFromUrl);
            setAuthMode('reset');
            window.history.replaceState({}, '', window.location.pathname);
        }

        const paymentStatus = params.get('payment');
        if (paymentStatus === 'success' || paymentStatus === 'cancelled') {
            setPaymentNotice({ type: paymentStatus });
            window.history.replaceState({}, '', window.location.pathname);

            if (paymentStatus === 'success' && savedUser) {
                api.get('/finance/my-balance').then((res) => {
                    const newBalance = res.data.balance || 0;
                    setUserBalance(newBalance);
                    const parsed = JSON.parse(savedUser);
                    const updated = { ...parsed, balance: newBalance };
                    localStorage.setItem('user', JSON.stringify(updated));
                    setUser(updated);
                }).catch((err) => console.error("Balans yenilənərkən xəta:", err));
            }
        }
    }, []);

    const openProfile = () => {
        if (user) {
            setProfileFirstName(user.firstName || '');
            setProfileLastName(user.lastName || '');
            setProfileEmail(user.email || '');
            setProfileMsg({ text: '', type: '' });
        }
        setIsProfileOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileMsg({ text: '', type: '' });

        if (!profileFirstName.trim() || !profileLastName.trim() || !profileEmail.trim()) {
            setProfileMsg({ text: 'Zəhmət olmasa bütün xanaları doldurun!', type: 'error' });
            return;
        }

        setProfileLoading(true);
        try {
            const res = await api.put('/auth/profile', {
                firstName: profileFirstName.trim(),
                lastName: profileLastName.trim(),
                email: profileEmail.trim()
            });
            const updatedUser = { ...user, ...res.data.user };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setProfileMsg({ text: res.data.message || 'Profil yeniləndi!', type: 'success' });
        } catch (err) {
            setProfileMsg({ text: err.response?.data?.message || 'Profil yenilənərkən xəta baş verdi!', type: 'error' });
        } finally {
            setProfileLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setIsProfileOpen(false);
        setAuthMode('home');
        setActivePage('home');
    };

    const onLoginSuccess = (userData) => {
        setUser(userData);
        if (userData.balance !== undefined) {
            setUserBalance(userData.balance);
        }
        setActivePage('home');
    };

    const getUserInitials = () => {
        if (!user) return 'U';
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        }
        return user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'U';
    };

    const handleTopUpSuccess = async (amountVal) => {
        const newBal = parseFloat(userBalance) + parseFloat(amountVal);
        setUserBalance(newBal);
        if (user) {
            const updated = { ...user, balance: newBal };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            try {
                await api.post('/finance/top-up', { amount: amountVal });
            } catch (err) {
                console.error("Backend top-up notification failed, updated locally:", err);
            }
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPassMsg({ text: '', type: '' });

        if (!oldPassword || !newPassword) {
            setPassMsg({ text: 'Zəhmət olmasa bütün xanaları doldurun!', type: 'error' });
            return;
        }

        if (newPassword.length < 6) {
            setPassMsg({ text: 'Yeni şifrə ən azı 6 simvoldan ibarət olmalıdır!', type: 'error' });
            return;
        }

        setPassLoading(true);
        try {
            const res = await api.post('/auth/change-password', {
                oldPassword,
                newPassword
            });
            setPassMsg({ text: res.data.message || 'Şifrə yeniləndi!', type: 'success' });
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setPassMsg({ text: err.response?.data?.message || 'Şifrə dəyişdirilərkən xəta baş verdi!', type: 'error' });
        } finally {
            setPassLoading(false);
        }
    };

    // İcazə əsaslı yoxlamalar (rol adı deyil, DB-dən gələn permissions massivinə görə)
    const hasPermission = (key) => Boolean(user?.isSuperAdmin || user?.permissions?.includes(key));
    const isSuperAdminUser = Boolean(user?.isSuperAdmin);
    const hasAdminAccess = isSuperAdminUser || hasPermission('users.view');

    // Ən azı bir yüksəldilmiş icazəsi olan istifadəçilər üçün backoffice interfeysi
    const isAdminOrStaff = user && (isSuperAdminUser || (user.permissions && user.permissions.length > 0));

    return (
        <ThemeProvider theme="dark">
            <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9', display: 'flex', flexDirection: 'column' }}>

                {/* IF CUSTOMER OR GUEST: RENDER MODERN WEBSITE NAVBAR */}
                {!isAdminOrStaff ? (
                    <Navbar
                        user={user}
                        activePage={activePage}
                        authMode={authMode}
                        onNavigate={(page) => {
                            setActivePage(page);
                            setAuthMode('home');
                        }}
                        onNavigateAuth={(mode) => setAuthMode(mode)}
                        onOpenPayment={() => setIsPaymentModalOpen(true)}
                        onOpenProfile={openProfile}
                        balance={userBalance}
                    />
                ) : (
                    /* IF ADMIN / STAFF: RENDER ADMINISTRATIVE BACKOFFICE HEADER */
                    <header style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 32px',
                        borderBottom: '1px solid #30363d',
                        backgroundColor: '#161b22',
                        position: 'sticky',
                        top: 0,
                        zIndex: 100
                    }}>
                        <div
                            onClick={() => setActivePage('home')}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        >
                            <div style={{ backgroundColor: '#d97706', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                                <Icon data={Box} size={20} style={{ color: '#ffffff' }} />
                            </div>
                            <div>
                                <Text variant="header-2" style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                                    CargoMS Admin & Staff Control
                                </Text>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <NotificationBell />
                            <div
                                onClick={openProfile}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '6px 14px',
                                    backgroundColor: '#21262d',
                                    border: '1px solid #30363d',
                                    borderRadius: '30px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    userSelect: 'none'
                                }}
                            >
                                <Avatar
                                    text={getUserInitials()}
                                    size="m"
                                    theme="warning"
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '4px' }}>
                                    <Text variant="body-2" style={{ fontWeight: 600, color: '#f0f6fc', lineHeight: 1.2 }}>
                                        {user.firstName ? `${user.firstName} ${user.lastName}` : user.fullName}
                                    </Text>
                                    <Label size="xs" theme="warning">{user.role}</Label>
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                {/* MAIN CONTENT AREA */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* ADMIN / STAFF SIDEBAR (ONLY SHOWN FOR BACKOFFICE MANAGEMENT) */}
                    {isAdminOrStaff && (
                        <aside style={{
                            width: '240px',
                            backgroundColor: '#161b22',
                            borderRight: '1px solid #30363d',
                            padding: '24px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <Button
                                view={activePage === 'home' ? 'action' : 'flat-secondary'}
                                width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                onClick={() => setActivePage('home')}
                            >
                                Ana Səhifə
                            </Button>
                            <Button
                                view={activePage === 'dashboard' ? 'action' : 'flat-secondary'}
                                width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                onClick={() => setActivePage('dashboard')}
                            >
                                Dashboard
                            </Button>
                            <Button
                                view={activePage === 'packages' ? 'action' : 'flat-secondary'}
                                width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                onClick={() => setActivePage('packages')}
                            >
                                Bağlamalar
                            </Button>
                            <Button
                                view={activePage === 'finance' ? 'action' : 'flat-secondary'}
                                width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                onClick={() => setActivePage('finance')}
                            >
                                Maliyyə və Balans
                            </Button>
                            <Button
                                view={activePage === 'support' ? 'action' : 'flat-secondary'}
                                width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                onClick={() => setActivePage('support')}
                            >
                                Dəstək
                            </Button>
                            {hasPermission('users.view') && (
                                <Button
                                    view={activePage === 'customers' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('customers')}
                                >
                                    Müştərilər
                                </Button>
                            )}
                            {hasPermission('reports.view') && (
                                <Button
                                    view={activePage === 'reports' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('reports')}
                                >
                                    Hesabatlar
                                </Button>
                            )}
                            {hasPermission('warehouses.manage') && (
                                <Button
                                    view={activePage === 'manage-warehouses' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('manage-warehouses')}
                                >
                                    Anbarlar
                                </Button>
                            )}
                            {isSuperAdminUser && (
                                <Button
                                    view={activePage === 'roles' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('roles')}
                                >
                                    Rollar
                                </Button>
                            )}
                            {hasPermission('audit.view') && (
                                <Button
                                    view={activePage === 'audit-log' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('audit-log')}
                                >
                                    Audit Qeydləri
                                </Button>
                            )}
                            {isSuperAdminUser && (
                                <Button
                                    view={activePage === 'prohibited-terms' ? 'action' : 'flat-secondary'}
                                    width="max" size="l" style={{ justifyContent: 'flex-start' }}
                                    onClick={() => setActivePage('prohibited-terms')}
                                >
                                    Qadağan Olunmuş Mallar
                                </Button>
                            )}

                            <div style={{ marginTop: 'auto', borderTop: '1px solid #30363d', paddingTop: '16px' }}>
                                <Button
                                    view="flat-secondary"
                                    width="max"
                                    style={{ justifyContent: 'flex-start' }}
                                    onClick={openProfile}
                                >
                                    <Icon data={Gear} style={{ marginRight: '8px' }} /> Profil Və Ayarlar
                                </Button>
                            </div>
                        </aside>
                    )}

                    {/* CONTENT BODY */}
                    <main style={{ flex: 1, padding: '32px 24px', overflowY: 'auto' }}>
                        {paymentNotice && (
                            <div style={{
                                marginBottom: '20px', padding: '14px 18px', borderRadius: '10px',
                                backgroundColor: paymentNotice.type === 'success' ? '#13231b' : '#3d1618',
                                border: `1px solid ${paymentNotice.type === 'success' ? '#2ea043' : '#f85149'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <Text style={{ color: paymentNotice.type === 'success' ? '#56d364' : '#ff7b72' }}>
                                    {paymentNotice.type === 'success'
                                        ? 'Ödəniş uğurla tamamlandı! Balansınız yeniləndi.'
                                        : 'Ödəniş ləğv edildi.'}
                                </Text>
                                <Button size="s" view="flat" onClick={() => setPaymentNotice(null)}>Bağla</Button>
                            </div>
                        )}
                        {user ? (
                            <>
                                {activePage === 'home' && (
                                    <Home
                                        user={user}
                                        onNavigate={(page) => setActivePage(page)}
                                    />
                                )}
                                {activePage === 'packages' && <Packages />}
                                {activePage === 'finance' && <FinancePage />}
                                {activePage === 'support' && <Support />}
                                {activePage === 'warehouses' && <WarehouseAddressesModal user={user} />}
                                {activePage === 'dashboard' && <Dashboard />}
                                {activePage === 'customers' && (
                                    hasPermission('users.view') ? <Customers /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                                {activePage === 'reports' && (
                                    hasPermission('reports.view') ? <Reports /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                                {activePage === 'roles' && (
                                    isSuperAdminUser ? <Roles /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                                {activePage === 'manage-warehouses' && (
                                    hasPermission('warehouses.manage') ? <Warehouses /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                                {activePage === 'audit-log' && (
                                    hasPermission('audit.view') ? <AuditLog /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                                {activePage === 'prohibited-terms' && (
                                    isSuperAdminUser ? <ProhibitedTerms /> : (
                                        <Text color="danger" variant="header-1">Bu səhifəyə giriş icazəniz yoxdur.</Text>
                                    )
                                )}
                            </>
                        ) : authMode === 'home' ? (
                            <Home
                                user={null}
                                onNavigateLogin={() => setAuthMode('login')}
                                onNavigateRegister={() => setAuthMode('register')}
                            />
                        ) : authMode === 'login' ? (
                            <Login
                                onLoginSuccess={onLoginSuccess}
                                switchToRegister={() => setAuthMode('register')}
                                switchToForgotPassword={() => setAuthMode('forgot')}
                            />
                        ) : authMode === 'forgot' ? (
                            <ForgotPassword
                                switchToLogin={() => setAuthMode('login')}
                            />
                        ) : authMode === 'reset' ? (
                            <ResetPassword
                                token={resetToken}
                                switchToLogin={() => setAuthMode('login')}
                            />
                        ) : (
                            <Register
                                switchToLogin={() => setAuthMode('login')}
                            />
                        )}
                    </main>
                </div>

                {/* IF CUSTOMER OR GUEST: RENDER WEBSITE FOOTER */}
                {!isAdminOrStaff && (
                    <Footer onNavigate={(page) => setActivePage(page)} />
                )}

                {/* GLOBAL PAYMENT MODAL */}
                <PaymentModal
                    open={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    currentBalance={userBalance}
                    onPaymentSuccess={handleTopUpSuccess}
                    userId={user ? user.id : null}
                />

                {/* PROFILE MODAL */}
                {user && (
                    <Modal open={isProfileOpen} onClose={() => setIsProfileOpen(false)}>
                        <div style={{ padding: '28px', width: '450px', backgroundColor: '#161b22', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #30363d', paddingBottom: '16px' }}>
                                <Avatar text={getUserInitials()} size="xl" theme={hasAdminAccess ? 'warning' : 'normal'} />
                                <div>
                                    <Text variant="header-2" style={{ color: '#ffffff' }}>
                                        {user.firstName ? `${user.firstName} ${user.lastName}` : user.fullName}
                                    </Text>
                                    <Text variant="body-1" color="secondary" style={{ display: 'block' }}>{user.email}</Text>
                                    <div style={{ marginTop: '6px' }}>
                                        <Label theme={hasAdminAccess ? 'warning' : 'info'}>{user.role} Hesabı</Label>
                                    </div>
                                </div>
                            </div>

                            <Card style={{ padding: '16px', backgroundColor: '#0d1117', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text color="secondary">Müştəri ID Kodu:</Text>
                                    <Text style={{ fontWeight: 'bold', color: '#58a6ff' }}>#C-{user.id ? user.id + 10400 : '10492'}</Text>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text color="secondary">Hesab Statusu:</Text>
                                    <Text style={{ color: '#56d364', fontWeight: 'bold' }}>Aktiv</Text>
                                </div>
                            </Card>

                            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <Text variant="subheader-1">Profil Məlumatları</Text>

                                {profileMsg.text && (
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        backgroundColor: profileMsg.type === 'error' ? '#3d1618' : '#13231b',
                                        color: profileMsg.type === 'error' ? '#ff7b72' : '#56d364',
                                        border: `1px solid ${profileMsg.type === 'error' ? '#f85149' : '#2ea043'}`
                                    }}>
                                        {profileMsg.text}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <Text variant="caption-2" style={{ marginBottom: '4px', display: 'block' }}>Ad</Text>
                                        <TextInput
                                            value={profileFirstName}
                                            onChange={(e) => setProfileFirstName(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <Text variant="caption-2" style={{ marginBottom: '4px', display: 'block' }}>Soyad</Text>
                                        <TextInput
                                            value={profileLastName}
                                            onChange={(e) => setProfileLastName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Text variant="caption-2" style={{ marginBottom: '4px', display: 'block' }}>Email</Text>
                                    <TextInput
                                        type="email"
                                        value={profileEmail}
                                        onChange={(e) => setProfileEmail(e.target.value)}
                                    />
                                </div>

                                <Button view="outlined" type="submit" loading={profileLoading} style={{ marginTop: '4px' }}>
                                    Profili Yadda Saxla
                                </Button>
                            </form>

                            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <Text variant="subheader-1">Şifrəni Yenilə</Text>

                                {passMsg.text && (
                                    <div style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        backgroundColor: passMsg.type === 'error' ? '#3d1618' : '#13231b',
                                        color: passMsg.type === 'error' ? '#ff7b72' : '#56d364',
                                        border: `1px solid ${passMsg.type === 'error' ? '#f85149' : '#2ea043'}`
                                    }}>
                                        {passMsg.text}
                                    </div>
                                )}

                                <div>
                                    <Text variant="caption-2" style={{ marginBottom: '4px', display: 'block' }}>Cari Şifrə</Text>
                                    <TextInput
                                        type="password"
                                        placeholder="••••••••"
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Text variant="caption-2" style={{ marginBottom: '4px', display: 'block' }}>Yeni Şifrə</Text>
                                    <TextInput
                                        type="password"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>

                                <Button view="outlined" type="submit" loading={passLoading} style={{ marginTop: '4px' }}>
                                    Şifrəni Dəyişdir
                                </Button>
                            </form>

                            {(isSuperAdminUser || user.role === 'Admin') && (
                                <div style={{ borderTop: '1px solid #30363d', paddingTop: '16px' }}>
                                    <TwoFactorSettings />
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid #30363d', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                                <Button view="flat" onClick={() => setIsProfileOpen(false)}>Bağla</Button>
                                <Button view="outlined-danger" onClick={handleLogout}>
                                    Hesabdan Çıxış Et
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </ThemeProvider>
    );
}

export default App;
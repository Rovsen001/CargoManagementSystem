import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Text } from '@gravity-ui/uikit';
import { Box } from '@gravity-ui/icons';

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--g-color-base-background)' }}>
            {/* Sol Menyu */}
            <div style={{ width: '250px', backgroundColor: 'var(--g-color-base-generic)', borderRight: '1px solid var(--g-color-line-generic)' }}>
                <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid var(--g-color-line-generic)' }}>
                    <Text variant="display-1" color="primary">KARQO</Text>
                </div>
                <div style={{ padding: '10px' }}>
                    <Button
                        view={location.pathname.includes('packages') || location.pathname === '/' ? 'normal' : 'flat'}
                        size="l" width="max" onClick={() => navigate('/packages')}
                    >
                        <Button.Icon><Box /></Button.Icon>
                        Bağlamalar
                    </Button>
                </div>
            </div>

            {/* Əsas Hissə */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ height: '64px', borderBottom: '1px solid var(--g-color-line-generic)', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                    <Text variant="header-1">İdarəetmə Paneli</Text>
                </header>
                <main style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
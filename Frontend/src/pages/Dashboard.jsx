import React, { useState, useEffect } from 'react';
import { Card, Text, Loader } from '@gravity-ui/uikit';
import api from '../services/api';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/packages/stats');
                setStats(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Statistika çəkilərkən xəta:", error);
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <Loader size="l" />;

    // Kartların dizaynı üçün ümumi stil funksiyası
    const cardStyle = {
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '200px',
        flex: 1,
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)'
    };

    return (
        <div>
            <Text variant="header-2" style={{ marginBottom: '24px', display: 'block' }}>Xoş gəldiniz!</Text>

            {/* Statistika Kartları Konteyneri */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>

                <Card style={cardStyle} theme="info">
                    <Text variant="body-2" color="secondary">Cəmi Bağlamalar</Text>
                    <Text variant="display-2">{stats?.total || 0}</Text>
                </Card>

                <Card style={cardStyle} theme="success">
                    <Text variant="body-2" color="secondary">Bəyan Edilənlər</Text>
                    <Text variant="display-2">{stats?.declared || 0}</Text>
                </Card>

                <Card style={cardStyle} theme="warning">
                    <Text variant="body-2" color="secondary">Yolda Olanlar</Text>
                    <Text variant="display-2">{stats?.onTheWay || 0}</Text>
                </Card>

                <Card style={cardStyle} theme="danger">
                    <Text variant="body-2" color="secondary">Gömrükdəkilər</Text>
                    <Text variant="display-2">{stats?.customs || 0}</Text>
                </Card>

                <Card style={cardStyle} theme="normal">
                    <Text variant="body-2" color="secondary">Filialda Olanlar</Text>
                    <Text variant="display-2">{stats?.arrived || 0}</Text>
                </Card>

            </div>
        </div>
    );
};

export default Dashboard;
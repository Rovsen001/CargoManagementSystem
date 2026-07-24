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

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <Loader size="l" />
            </div>
        );
    }

    // Faiz hesablama funksiyası
    const getPercent = (value) => {
        if (!stats?.total) return 0;
        return Math.round((value / stats.total) * 100);
    };

    // Qrafik üçün məlumat strukturumuz
    const chartData = [
        { label: 'Bəyan edildi', value: stats?.declared || 0, color: '#5282ff', theme: 'info' },
        { label: 'Yoldadır', value: stats?.onTheWay || 0, color: '#f5a623', theme: 'warning' },
        { label: 'Gömrükdə', value: stats?.customs || 0, color: '#ff5c5c', theme: 'danger' },
        { label: 'Filialda', value: stats?.arrived || 0, color: '#3fb950', theme: 'success' },
    ];

    // Sütunların hündürlüyünü vizual olaraq tənzimləmək üçün ən böyük dəyəri tapırıq
    const maxBarValue = Math.max(...chartData.map(d => d.value), 1);

    // Kartların ümumi stili
    const cardStyle = {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '180px',
        flex: 1,
        backgroundColor: '#161b22',
        border: '1px solid #30363d'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div>
                <Text variant="header-2" style={{ color: '#fff', marginBottom: '4px', display: 'block' }}>Xoş gəldiniz! 👋</Text>
                <Text variant="body-1" color="secondary">Karqo sistemindəki son vəziyyət və analitika.</Text>
            </div>

            {/* 1. Üst Sıra: Statistika Kartları */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <Card style={cardStyle}>
                    <Text variant="body-2" color="secondary">Cəmi Bağlamalar</Text>
                    <Text variant="display-2" style={{ color: '#fff' }}>{stats?.total || 0}</Text>
                </Card>
                {chartData.map((item, index) => (
                    <Card key={index} style={cardStyle}>
                        <Text variant="body-2" color="secondary">{item.label}</Text>
                        <Text variant="display-2" style={{ color: item.color }}>{item.value}</Text>
                    </Card>
                ))}
            </div>

            {/* 2. Alt Sıra: Vizual Qrafiklər Bölməsi */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>

                {/* SOL TƏRƏF: Sütun Qrafiki (Bar Chart) */}
                <Card style={{ padding: '24px', flex: 1, minWidth: '320px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Text variant="subheader-2" style={{ color: '#fff' }}>📊 Bağlama Statuslarının Sütun Qrafiki</Text>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '220px', paddingTop: '20px', borderBottom: '1px solid #30363d' }}>
                        {chartData.map((item, index) => {
                            const barHeight = (item.value / maxBarValue) * 150 + 10;
                            return (
                                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '50px' }}>
                                    <Text variant="body-2" style={{ fontWeight: 'bold', color: '#fff' }}>{item.value}</Text>
                                    <div style={{
                                        width: '100%',
                                        height: `${barHeight}px`,
                                        backgroundColor: item.color,
                                        borderRadius: '6px 6px 0 0',
                                        transition: 'height 0.5s ease-in-out'
                                    }} />
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                        {chartData.map((item, index) => (
                            <div key={index} style={{ width: '70px' }}>
                                <Text variant="caption-1" color="secondary" style={{ display: 'block', lineHeight: '1.2' }}>{item.label}</Text>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* SAĞ TƏRƏF: Faizlə Proqres Paneli (Progress Chart) */}
                <Card style={{ padding: '24px', flex: 1, minWidth: '320px', backgroundColor: '#161b22', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Text variant="subheader-2" style={{ color: '#fff' }}>📈 Ümumi Paylanma Faizi</Text>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: 'center', height: '100%' }}>
                        {chartData.map((item, index) => {
                            const percent = getPercent(item.value);
                            return (
                                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text variant="body-2" style={{ fontWeight: '500', color: '#fff' }}>{item.label}</Text>
                                        <Text variant="body-2" color="secondary">{percent}% ({item.value} ədəd)</Text>
                                    </div>
                                    <div style={{ width: '100%', height: '10px', backgroundColor: '#21262d', borderRadius: '5px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${percent}%`,
                                            height: '100%',
                                            backgroundColor: item.color,
                                            borderRadius: '5px',
                                            transition: 'width 0.5s ease-in-out'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Dashboard;
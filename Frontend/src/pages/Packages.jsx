import React, { useState, useEffect } from 'react';
import { Table, Label, Text, Loader } from '@gravity-ui/uikit';
import api from '../services/api';

const Packages = () => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            // api.js faylından istifadə edirik, tam link yazmağa ehtiyac yoxdur
            const response = await api.get('/packages');
            setPackages(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Xəta:", error);
            setLoading(false);
        }
    };

    const columns = [
        { id: 'id', name: 'ID' },
        {
            id: 'trackingNumber', name: 'Trek Nömrəsi',
            template: (item) => <Text variant="subheader-2">{item.trackingNumber}</Text>
        },
        { id: 'weight', name: 'Çəki' },
        { id: 'price', name: 'Məbləğ' },
        {
            id: 'status', name: 'Status',
            template: (item) => {
                let theme = 'info';
                if (item.status === 'Yoldadır') theme = 'warning';
                if (item.status === 'Gömrükdə') theme = 'danger';
                return <Label theme={theme}>{item.status}</Label>;
            }
        },
    ];

    return (
        <div>
            <Text variant="header-2" style={{ marginBottom: '20px', display: 'block' }}>Bağlamalarım</Text>
            {loading ? <Loader size="l" /> : <Table data={packages} columns={columns} />}
        </div>
    );
};

export default Packages;
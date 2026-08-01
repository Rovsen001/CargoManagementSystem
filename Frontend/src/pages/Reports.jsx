import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, Label, Table, Loader, Icon } from '@gravity-ui/uikit';
import { ArrowDownToSquare, ChartLine } from '@gravity-ui/icons';
import api from '../services/api';

const formatDate = (date) => date.toISOString().slice(0, 10);

const Reports = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [from, setFrom] = useState(formatDate(thirtyDaysAgo));
    const [to, setTo] = useState(formatDate(today));
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const fetchReport = async () => {
        if (from > to) {
            setError('Başlanğıc tarix son tarixdən sonra ola bilməz.');
            setData(null);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/reports/summary?from=${from}&to=${to}`);
            setData(response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Hesabat yüklənərkən xəta baş verdi.');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const statusTheme = { 'Bəyan edildi': 'info', 'Yoldadır': 'warning', 'Gömrükdə': 'danger', 'Filialda': 'success' };

    const columns = [
        { id: 'id', name: 'ID', meta: { width: '60px' } },
        { id: 'trackingNumber', name: 'Trek Nömrəsi' },
        { id: 'weight', name: 'Çəki', template: (item) => `${parseFloat(item.weight).toFixed(2)} kq` },
        { id: 'price', name: 'Qiymət', template: (item) => `$${parseFloat(item.price).toFixed(2)}` },
        {
            id: 'status',
            name: 'Status',
            template: (item) => <Label theme={statusTheme[item.status] || 'normal'}>{item.status || 'Təyin edilməyib'}</Label>
        },
        {
            id: 'createdAt',
            name: 'Tarix',
            template: (item) => item.createdAt ? new Date(item.createdAt).toLocaleString('az-AZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
        }
    ];

    const handleExportExcel = () => {
        if (!data || data.packages.length === 0) return alert("Eksport üçün məlumat yoxdur!");

        const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          th { background-color: #1a2332; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #ccc; }
          td { padding: 8px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <h2>Hesabat: ${from} — ${to}</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>Trek Nömrəsi</th><th>Çəki</th><th>Qiymət</th><th>Status</th><th>Tarix</th></tr>
          </thead>
          <tbody>
            ${data.packages.map(pkg => `
              <tr>
                <td>${pkg.id}</td>
                <td><b>${pkg.trackingNumber || ''}</b></td>
                <td>${parseFloat(pkg.weight).toFixed(2)} kq</td>
                <td>$${parseFloat(pkg.price).toFixed(2)}</td>
                <td>${pkg.status || ''}</td>
                <td>${pkg.createdAt ? new Date(pkg.createdAt).toLocaleString('az-AZ') : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

        const blob = new Blob(['﻿' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Hesabat_${from}_${to}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const cardStyle = {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 1,
        backgroundColor: '#161b22',
        border: '1px solid #30363d'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">Hesabatlar</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    Tarix aralığına görə bağlama və gəlir hesabatlarına baxın, Excel formatında export edin.
                </Text>
            </div>

            <Card style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Başlanğıc tarix</Text>
                    <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} size="l" />
                </div>
                <div>
                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Son tarix</Text>
                    <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} size="l" />
                </div>
                <Button
                    view="action"
                    size="l"
                    onClick={fetchReport}
                    loading={loading}
                    className="pill-btn"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                >
                    <Icon data={ChartLine} /> Hesabatı Göstər
                </Button>
                <Button view="outlined" size="l" onClick={handleExportExcel}>
                    <Icon data={ArrowDownToSquare} /> Excel-ə Çıxar
                </Button>
            </Card>

            {error && (
                <Card style={{ padding: '16px', borderColor: '#f85149' }}>
                    <Text color="danger">{error}</Text>
                </Card>
            )}

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Loader size="l" /></div>
            ) : data ? (
                <>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <Card className="hover-lift" style={cardStyle}>
                            <Text variant="body-2" color="secondary">Seçilmiş Dövrdə Bağlamalar</Text>
                            <Text variant="display-2" style={{ color: '#fff' }}>{data.totalPackages}</Text>
                        </Card>
                        <Card className="hover-lift" style={cardStyle}>
                            <Text variant="body-2" color="secondary">Seçilmiş Dövrdə Gəlir</Text>
                            <Text variant="display-2" style={{ color: '#56d364' }}>₼ {parseFloat(data.totalRevenue).toFixed(2)}</Text>
                        </Card>
                        <Card className="hover-lift" style={cardStyle}>
                            <Text variant="body-2" color="secondary">Bəyan edildi</Text>
                            <Text variant="display-2" style={{ color: '#5282ff' }}>{data.statusBreakdown.declared}</Text>
                        </Card>
                        <Card className="hover-lift" style={cardStyle}>
                            <Text variant="body-2" color="secondary">Yoldadır / Gömrükdə</Text>
                            <Text variant="display-2" style={{ color: '#f5a623' }}>{data.statusBreakdown.onTheWay + data.statusBreakdown.customs}</Text>
                        </Card>
                        <Card className="hover-lift" style={cardStyle}>
                            <Text variant="body-2" color="secondary">Filialda / Verildi</Text>
                            <Text variant="display-2" style={{ color: '#3fb950' }}>{data.statusBreakdown.arrived}</Text>
                        </Card>
                    </div>

                    <Card style={{ padding: '8px', overflowX: 'auto' }}>
                        {data.packages.length > 0 ? (
                            <Table data={data.packages} columns={columns} />
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <Text variant="subheader-1" color="secondary">Seçilmiş tarix aralığında bağlama tapılmadı.</Text>
                            </div>
                        )}
                    </Card>
                </>
            ) : null}
        </div>
    );
};

export default Reports;

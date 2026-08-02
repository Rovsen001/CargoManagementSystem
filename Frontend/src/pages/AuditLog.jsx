import React, { useState, useEffect } from 'react';
import { Card, Text, Label, Loader, Select } from '@gravity-ui/uikit';
import api from '../services/api';

const ACTION_LABELS = {
    'package.priceOverride': 'Qiymət əl ilə dəyişdirildi',
    'package.editAll': 'Bağlama redaktə edildi (admin səlahiyyəti ilə)',
    'package.assignCourier': 'Kuryer təyinatı dəyişdirildi',
    'package.restore': 'Bağlama arxivdən bərpa edildi',
    'package.hardDelete': 'Bağlama həmişəlik silindi',
    'user.roleChange': 'İstifadəçi rolu dəyişdirildi',
    'role.create': 'Yeni rol yaradıldı',
    'role.update': 'Rol yeniləndi',
    'role.delete': 'Rol silindi',
    'warehouse.create': 'Anbar yaradıldı',
    'warehouse.update': 'Anbar yeniləndi',
    'warehouse.delete': 'Anbar silindi'
};

const ACTION_THEME = {
    'package.hardDelete': 'danger',
    'role.delete': 'danger',
    'warehouse.delete': 'danger',
    'user.roleChange': 'warning',
    'package.priceOverride': 'warning',
    'role.create': 'success',
    'warehouse.create': 'success'
};

const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionFilter, setActionFilter] = useState(['ALL']);

    const fetchLogs = async (action) => {
        setLoading(true);
        try {
            const params = action && action !== 'ALL' ? { action } : {};
            const response = await api.get('/audit-log', { params });
            setLogs(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Audit qeydləri yüklənərkən xəta baş verdi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(actionFilter[0]);
    }, [actionFilter]);

    const renderDetails = (detailsStr) => {
        if (!detailsStr) return '—';
        try {
            const obj = JSON.parse(detailsStr);
            return Object.entries(obj)
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ') || '—';
        } catch {
            return detailsStr;
        }
    };

    if (loading && logs.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <Loader size="l" />
            </div>
        );
    }

    if (error) {
        return (
            <Card style={{ padding: '24px', borderColor: '#f85149' }}>
                <Text color="danger">{error}</Text>
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">Audit Qeydləri</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    Sistemdə görülmüş həssas admin əməliyyatlarının tarixçəsi.
                </Text>
            </div>

            <div style={{ maxWidth: '320px' }}>
                <Select
                    value={actionFilter}
                    onUpdate={(val) => setActionFilter(val)}
                    options={[
                        { value: 'ALL', content: 'Bütün Əməliyyatlar' },
                        ...Object.entries(ACTION_LABELS).map(([key, label]) => ({ value: key, content: label }))
                    ]}
                    width="max"
                />
            </div>

            <Card style={{ padding: '8px', overflowX: 'auto' }}>
                {logs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Text variant="subheader-1" color="secondary">Qeyd tapılmadı.</Text>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #30363d' }}>
                                <th style={{ padding: '10px 12px', color: '#8b949e', fontSize: '13px' }}>Tarix</th>
                                <th style={{ padding: '10px 12px', color: '#8b949e', fontSize: '13px' }}>İstifadəçi</th>
                                <th style={{ padding: '10px 12px', color: '#8b949e', fontSize: '13px' }}>Əməliyyat</th>
                                <th style={{ padding: '10px 12px', color: '#8b949e', fontSize: '13px' }}>Hədəf</th>
                                <th style={{ padding: '10px 12px', color: '#8b949e', fontSize: '13px' }}>Detallar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #21262d' }}>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#c9d1d9', whiteSpace: 'nowrap' }}>
                                        {new Date(log.createdAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                                        <Text style={{ display: 'block' }}>{log.firstName ? `${log.firstName} ${log.lastName}` : log.email}</Text>
                                        <Text variant="caption-2" color="secondary">{log.userRole}</Text>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <Label theme={ACTION_THEME[log.action] || 'normal'}>
                                            {ACTION_LABELS[log.action] || log.action}
                                        </Label>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#8b949e' }}>
                                        {log.targetType} #{log.targetId}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '13px', color: '#8b949e', maxWidth: '360px' }}>
                                        {renderDetails(log.details)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
};

export default AuditLog;

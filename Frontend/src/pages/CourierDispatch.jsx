import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, Label, Loader, Select, Icon, Checkbox } from '@gravity-ui/uikit';
import { PersonWorker } from '@gravity-ui/icons';
import api from '../services/api';

const CourierDispatch = () => {
    const { t } = useTranslation();

    const [workload, setWorkload] = useState([]);
    const [workloadLoading, setWorkloadLoading] = useState(true);

    const [awaiting, setAwaiting] = useState([]);
    const [awaitingLoading, setAwaitingLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [courierId, setCourierId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');
    const [assignSuccess, setAssignSuccess] = useState('');

    const fetchWorkload = async () => {
        setWorkloadLoading(true);
        try {
            const res = await api.get('/couriers/workload');
            setWorkload(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('İş yükü çəkilərkən xəta:', err);
        } finally {
            setWorkloadLoading(false);
        }
    };

    const fetchAwaiting = async () => {
        setAwaitingLoading(true);
        try {
            const res = await api.get('/packages/awaiting-courier');
            setAwaiting(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Bağlamalar çəkilərkən xəta:', err);
        } finally {
            setAwaitingLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkload();
        fetchAwaiting();
    }, []);

    const toggleSelect = (id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.length === awaiting.length ? [] : awaiting.map((p) => p.id));
    };

    const handleBatchAssign = async () => {
        setAssignError('');
        setAssignSuccess('');
        if (selectedIds.length === 0) {
            setAssignError(t('localHub.selectPackagesError'));
            return;
        }
        if (!courierId) {
            setAssignError(t('courierDispatch.selectCourierError'));
            return;
        }
        setAssigning(true);
        try {
            const res = await api.post('/packages/batch-assign-courier', { packageIds: selectedIds, courierId });
            setAssignSuccess(t('courierDispatch.batchAssignSuccess', { count: res.data.assignedCount }));
            setSelectedIds([]);
            fetchWorkload();
            fetchAwaiting();
        } catch (err) {
            setAssignError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">{t('courierDispatch.pageTitle')}</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    {t('courierDispatch.pageSubtitle')}
                </Text>
            </div>

            <div>
                <Text variant="header-3" style={{ marginBottom: '12px', display: 'block' }}>{t('courierDispatch.workloadTitle')}</Text>
                {workloadLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader size="l" /></div>
                ) : workload.length === 0 ? (
                    <Card style={{ padding: '30px', textAlign: 'center' }}>
                        <Text color="secondary">—</Text>
                    </Card>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                        {workload.map((c) => (
                            <Card key={c.id} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Icon data={PersonWorker} style={{ color: '#8b949e' }} />
                                    <Text style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</Text>
                                </div>
                                <Text variant="caption-2" color="secondary">{c.email}</Text>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <Label theme="warning">{t('courierDispatch.activeDeliveriesLabel')}: {c.activeCount}</Label>
                                    <Label theme="success">{t('courierDispatch.deliveredLabel')}: {c.deliveredCount}</Label>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <Text variant="header-3" style={{ marginBottom: '12px', display: 'block' }}>{t('courierDispatch.awaitingTitle')}</Text>

                {assignError && (
                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px', marginBottom: '10px' }}>
                        {assignError}
                    </div>
                )}
                {assignSuccess && (
                    <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px', marginBottom: '10px' }}>
                        {assignSuccess}
                    </div>
                )}

                {awaitingLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader size="l" /></div>
                ) : awaiting.length === 0 ? (
                    <Card style={{ padding: '30px', textAlign: 'center' }}>
                        <Text color="secondary">{t('courierDispatch.noAwaiting')}</Text>
                    </Card>
                ) : (
                    <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <Checkbox checked={selectedIds.length === awaiting.length} onUpdate={toggleSelectAll}>
                                {t('localHub.selectAllLabel')}
                            </Checkbox>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div style={{ minWidth: '220px' }}>
                                    <Select
                                        value={courierId ? [courierId] : []}
                                        onUpdate={(val) => setCourierId(val[0])}
                                        options={workload.map((c) => ({ value: String(c.id), content: `${c.firstName} ${c.lastName}` }))}
                                        placeholder={t('courierDispatch.assignToCourierLabel')}
                                        width="max"
                                    />
                                </div>
                                <Button view="action" onClick={handleBatchAssign} loading={assigning}>
                                    {t('courierDispatch.batchAssignButton')}
                                </Button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {awaiting.map((p) => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                                    <Checkbox checked={selectedIds.includes(p.id)} onUpdate={() => toggleSelect(p.id)} />
                                    <div style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 600 }}>{p.trackingNumber}</Text>
                                        <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>
                                            {p.firstName} {p.lastName} ({p.email}) · {parseFloat(p.weight).toFixed(2)} kq · {p.shelfLocation || t('localHub.noShelfLocation')}
                                        </Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default CourierDispatch;

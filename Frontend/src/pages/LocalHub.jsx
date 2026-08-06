import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, TextInput, Label, Loader, Icon, RadioButton, Checkbox } from '@gravity-ui/uikit';
import { Magnifier, Check, Box, PersonWorker } from '@gravity-ui/icons';
import api from '../services/api';

const LocalHub = () => {
    const { t } = useTranslation();

    const [tab, setTab] = useState('shelving');

    // --- Shelving tab ---
    const [scanValue, setScanValue] = useState('');
    const scanInputRef = useRef(null);
    const [searching, setSearching] = useState(false);
    const [foundPackage, setFoundPackage] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [shelfLocationInput, setShelfLocationInput] = useState('');
    const [shelfError, setShelfError] = useState('');
    const [shelfSuccess, setShelfSuccess] = useState('');
    const [assigning, setAssigning] = useState(false);

    const [shelfMap, setShelfMap] = useState([]);
    const [shelfMapLoading, setShelfMapLoading] = useState(true);

    // --- Dispatch tab ---
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [pendingPackages, setPendingPackages] = useState([]);
    const [pendingLoading, setPendingLoading] = useState(false);
    const [selectedPackageIds, setSelectedPackageIds] = useState([]);
    const [otpSent, setOtpSent] = useState(false);
    const [otpSending, setOtpSending] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [dispatchError, setDispatchError] = useState('');
    const [dispatchSuccess, setDispatchSuccess] = useState('');
    const [confirming, setConfirming] = useState(false);

    const fetchShelfMap = async () => {
        setShelfMapLoading(true);
        try {
            const res = await api.get('/shelf-map');
            setShelfMap(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Şkaf xəritəsi çəkilərkən xəta:', err);
        } finally {
            setShelfMapLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'shelving') {
            fetchShelfMap();
            setTimeout(() => scanInputRef.current?.focus(), 50);
        }
    }, [tab]);

    const handleScanSubmit = async (e) => {
        e.preventDefault();
        const query = scanValue.trim();
        if (!query) return;
        setSearching(true);
        setShelfError('');
        setShelfSuccess('');
        setFoundPackage(null);
        setNotFound(false);
        try {
            const res = await api.get('/packages/lookup', { params: { trackingNumber: query } });
            if (res.data.found && res.data.exact && res.data.package.status === 'Filialda') {
                setFoundPackage(res.data.package);
                setShelfLocationInput(res.data.package.shelfLocation || '');
            } else {
                setNotFound(true);
            }
        } catch (err) {
            setShelfError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setSearching(false);
        }
    };

    const resetShelvingForm = () => {
        setScanValue('');
        setFoundPackage(null);
        setNotFound(false);
        setShelfLocationInput('');
        setShelfError('');
        setShelfSuccess('');
        setTimeout(() => scanInputRef.current?.focus(), 50);
    };

    const handleAssignShelf = async () => {
        if (!foundPackage) return;
        setShelfError('');
        if (!shelfLocationInput.trim()) {
            setShelfError(t('warehouseOperator.warehouseRequiredError'));
            return;
        }
        setAssigning(true);
        try {
            await api.put(`/packages/${foundPackage.id}/shelf-location`, { shelfLocation: shelfLocationInput.trim() });
            setShelfSuccess(t('localHub.shelfAssignedSuccess'));
            fetchShelfMap();
            setTimeout(resetShelvingForm, 1200);
        } catch (err) {
            setShelfError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setAssigning(false);
        }
    };

    const shelfZones = (() => {
        const zones = {};
        shelfMap.forEach((p) => {
            const zone = (p.shelfLocation || '').split('-')[0] || '—';
            if (!zones[zone]) zones[zone] = [];
            zones[zone].push(p);
        });
        return zones;
    })();

    // --- Dispatch logic ---
    useEffect(() => {
        if (tab !== 'dispatch') return;
        const timeout = setTimeout(async () => {
            if (customerQuery.trim().length < 2) {
                setCustomerResults([]);
                return;
            }
            try {
                const res = await api.get('/customers/search', { params: { q: customerQuery.trim() } });
                setCustomerResults(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Müştəri axtarışı xətası:', err);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [customerQuery, tab]);

    const selectCustomer = async (customer) => {
        setSelectedCustomer(customer);
        setCustomerResults([]);
        setCustomerQuery('');
        setSelectedPackageIds([]);
        setOtpSent(false);
        setOtpCode('');
        setDispatchError('');
        setDispatchSuccess('');
        setPendingLoading(true);
        try {
            const res = await api.get(`/customers/${customer.id}/pending-pickup`);
            setPendingPackages(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Bağlamalar çəkilərkən xəta:', err);
        } finally {
            setPendingLoading(false);
        }
    };

    const togglePackageSelect = (id) => {
        setSelectedPackageIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        setSelectedPackageIds(selectedPackageIds.length === pendingPackages.length ? [] : pendingPackages.map((p) => p.id));
    };

    const handleSendOtp = async () => {
        setDispatchError('');
        if (selectedPackageIds.length === 0) {
            setDispatchError(t('localHub.selectPackagesError'));
            return;
        }
        setOtpSending(true);
        try {
            await api.post(`/customers/${selectedCustomer.id}/dispatch-otp`);
            setOtpSent(true);
        } catch (err) {
            setDispatchError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setOtpSending(false);
        }
    };

    const handleConfirmDispatch = async () => {
        setDispatchError('');
        if (!otpCode.trim()) {
            setDispatchError(t('localHub.otpRequiredError'));
            return;
        }
        setConfirming(true);
        try {
            await api.post(`/customers/${selectedCustomer.id}/dispatch-confirm`, {
                code: otpCode.trim(),
                packageIds: selectedPackageIds
            });
            setDispatchSuccess(t('localHub.dispatchSuccessMessage'));
            setPendingPackages((prev) => prev.filter((p) => !selectedPackageIds.includes(p.id)));
            setSelectedPackageIds([]);
            setOtpSent(false);
            setOtpCode('');
        } catch (err) {
            setDispatchError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">{t('localHub.pageTitle')}</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    {t('localHub.pageSubtitle')}
                </Text>
            </div>

            <RadioButton
                size="l"
                value={tab}
                onUpdate={setTab}
                options={[
                    { value: 'shelving', content: t('localHub.shelvingTab') },
                    { value: 'dispatch', content: t('localHub.dispatchTab') }
                ]}
            />

            {tab === 'shelving' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <form onSubmit={handleScanSubmit}>
                            <TextInput
                                controlRef={scanInputRef}
                                autoFocus
                                size="xl"
                                placeholder={t('localHub.scanPackagePlaceholder')}
                                value={scanValue}
                                onChange={(e) => setScanValue(e.target.value)}
                                leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                            />
                        </form>

                        {searching && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Loader size="s" /> <Text color="secondary">{t('warehouseOperator.searching')}</Text>
                            </div>
                        )}

                        {shelfError && (
                            <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                                {shelfError}
                            </div>
                        )}
                        {shelfSuccess && (
                            <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                                {shelfSuccess}
                            </div>
                        )}

                        {notFound && (
                            <Card style={{ padding: '16px' }}>
                                <Text color="danger">{t('localHub.notFoundOrNotAtBranch')}</Text>
                            </Card>
                        )}

                        {foundPackage && (
                            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <Text variant="subheader-1">{t('localHub.packageFoundLabel')} {foundPackage.trackingNumber}</Text>
                                {foundPackage.shelfLocation && (
                                    <Text variant="body-2" color="secondary">{t('localHub.currentShelfLabel')} <strong>{foundPackage.shelfLocation}</strong></Text>
                                )}
                                <div>
                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('localHub.shelfLocationLabel')}</Text>
                                    <TextInput
                                        placeholder={t('localHub.shelfLocationPlaceholder')}
                                        value={shelfLocationInput}
                                        onChange={(e) => setShelfLocationInput(e.target.value)}
                                    />
                                </div>
                                <Button view="action" size="l" onClick={handleAssignShelf} loading={assigning} style={{ alignSelf: 'flex-start' }}>
                                    <Icon data={Box} /> {t('localHub.assignShelfButton')}
                                </Button>
                            </Card>
                        )}

                        {(foundPackage || notFound) && (
                            <Button view="flat" onClick={resetShelvingForm} style={{ alignSelf: 'flex-start' }}>
                                {t('localHub.scanAnotherButton')}
                            </Button>
                        )}
                    </div>

                    <div>
                        <Text variant="header-3" style={{ marginBottom: '12px', display: 'block' }}>{t('localHub.occupancyTitle')}</Text>
                        {shelfMapLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader size="l" /></div>
                        ) : Object.keys(shelfZones).length === 0 ? (
                            <Card style={{ padding: '30px', textAlign: 'center' }}>
                                <Text color="secondary">{t('localHub.occupancyEmpty')}</Text>
                            </Card>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                                {Object.entries(shelfZones).map(([zone, pkgs]) => (
                                    <Card key={zone} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text variant="subheader-2">{t('localHub.zoneLabel')} {zone}</Text>
                                            <Label theme="info">{t('localHub.packagesCountLabel', { count: pkgs.length })}</Label>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                                            {pkgs.map((p) => (
                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #21262d' }}>
                                                    <Text variant="caption-2" style={{ fontWeight: 600 }}>{p.shelfLocation}</Text>
                                                    <Text variant="caption-2" color="secondary">{p.trackingNumber}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'dispatch' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
                    <TextInput
                        size="l"
                        placeholder={t('warehouseOperator.customerSearchPlaceholder')}
                        value={customerQuery}
                        onChange={(e) => { setCustomerQuery(e.target.value); }}
                        leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                    />

                    {customerResults.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {customerResults.map((c) => (
                                <Card key={c.id} type="action" className="hover-lift" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => selectCustomer(c)}>
                                    <Text style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</Text>
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{c.email} · #C-{c.id + 10400}</Text>
                                </Card>
                            ))}
                        </div>
                    )}

                    {selectedCustomer && (
                        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text variant="subheader-1">{selectedCustomer.firstName} {selectedCustomer.lastName}</Text>
                                <Text variant="caption-2" color="secondary">{selectedCustomer.email}</Text>
                            </div>

                            <Text variant="subheader-2">{t('localHub.pendingPickupTitle')}</Text>

                            {pendingLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader size="m" /></div>
                            ) : pendingPackages.length === 0 ? (
                                <Text color="secondary">{t('localHub.noPendingPickup')}</Text>
                            ) : (
                                <>
                                    <Checkbox checked={selectedPackageIds.length === pendingPackages.length} onUpdate={toggleSelectAll}>
                                        {t('localHub.selectAllLabel')}
                                    </Checkbox>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {pendingPackages.map((p) => (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                                                <Checkbox checked={selectedPackageIds.includes(p.id)} onUpdate={() => togglePackageSelect(p.id)} />
                                                <div style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: 600 }}>{p.trackingNumber}</Text>
                                                    <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>
                                                        {parseFloat(p.weight).toFixed(2)} kq · ${parseFloat(p.price).toFixed(2)} · {p.shelfLocation || t('localHub.noShelfLocation')}
                                                    </Text>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {dispatchError && (
                                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                                            {dispatchError}
                                        </div>
                                    )}
                                    {dispatchSuccess && (
                                        <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                                            {dispatchSuccess}
                                        </div>
                                    )}

                                    {!otpSent ? (
                                        <Button view="action" size="l" onClick={handleSendOtp} loading={otpSending} style={{ alignSelf: 'flex-start' }}>
                                            <Icon data={PersonWorker} /> {t('localHub.sendOtpButton')}
                                        </Button>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <Text variant="caption-2" color="secondary">{t('localHub.otpSentMessage')}</Text>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                                <div style={{ flex: 1 }}>
                                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('localHub.otpCodeLabel')}</Text>
                                                    <TextInput placeholder={t('localHub.otpCodePlaceholder')} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                                                </div>
                                                <Button view="outlined" onClick={handleSendOtp} loading={otpSending}>{t('localHub.resendOtpButton')}</Button>
                                            </div>
                                            <Button view="action" size="l" onClick={handleConfirmDispatch} loading={confirming} style={{ alignSelf: 'flex-start' }}>
                                                <Icon data={Check} /> {t('localHub.confirmDispatchButton')}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default LocalHub;

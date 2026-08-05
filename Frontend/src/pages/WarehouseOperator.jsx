import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, TextInput, TextArea, Label, Loader, Modal, Select, Icon, RadioButton } from '@gravity-ui/uikit';
import { Magnifier, Camera, Check, Xmark, PersonWorker } from '@gravity-ui/icons';
import api from '../services/api';

const API_ORIGIN = 'http://localhost:5000';

const WarehouseOperator = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'en' ? 'en-US' : 'az-AZ';

    const [tab, setTab] = useState('scan');
    const [warehouses, setWarehouses] = useState([]);

    // --- Scanner tab ---
    const [scanValue, setScanValue] = useState('');
    const inputRef = useRef(null);
    const [searching, setSearching] = useState(false);
    const [lookupResult, setLookupResult] = useState(null);
    const [lastQuery, setLastQuery] = useState('');

    const [actualWeight, setActualWeight] = useState('');
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');
    const [notes, setNotes] = useState('');
    const [unidentifiedWarehouseId, setUnidentifiedWarehouseId] = useState('');

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [submitting, setSubmitting] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    // --- Exception Resolver tab ---
    const [exceptions, setExceptions] = useState([]);
    const [exceptionsLoading, setExceptionsLoading] = useState(true);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [assignWarehouseId, setAssignWarehouseId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState('');

    useEffect(() => {
        api.get('/warehouses').then((res) => setWarehouses(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    }, []);

    useEffect(() => {
        if (tab === 'scan') {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [tab, lookupResult]);

    const fetchExceptions = async () => {
        setExceptionsLoading(true);
        try {
            const res = await api.get('/unidentified-parcels');
            setExceptions(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('İstisnalar çəkilərkən xəta:', err);
        } finally {
            setExceptionsLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'exceptions') fetchExceptions();
    }, [tab]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((tr) => tr.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const resetScanForm = () => {
        setScanValue('');
        setLookupResult(null);
        setActualWeight('');
        setLength('');
        setWidth('');
        setHeight('');
        setNotes('');
        setUnidentifiedWarehouseId('');
        setPhotoFile(null);
        setPhotoPreviewUrl(null);
        stopCamera();
        setActionError('');
        setActionSuccess('');
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleScanSubmit = async (e) => {
        e.preventDefault();
        const query = scanValue.trim();
        if (!query) return;
        setSearching(true);
        setActionError('');
        setActionSuccess('');
        try {
            const res = await api.get('/packages/lookup', { params: { trackingNumber: query } });
            setLookupResult(res.data);
            setLastQuery(query);
            if (res.data.found && res.data.exact) {
                setActualWeight(res.data.package.weight != null ? String(res.data.package.weight) : '');
            }
        } catch (err) {
            setActionError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setSearching(false);
        }
    };

    const volumetricWeight = (() => {
        const l = parseFloat(length) || 0, w = parseFloat(width) || 0, h = parseFloat(height) || 0;
        if (l <= 0 || w <= 0 || h <= 0) return null;
        return Math.round((l * w * h / 6000) * 100) / 100;
    })();
    const physicalWeightNum = parseFloat(actualWeight) || 0;
    const chargeableWeight = volumetricWeight != null ? Math.max(physicalWeightNum, volumetricWeight) : physicalWeightNum;
    const volumetricIsHigher = volumetricWeight != null && volumetricWeight > physicalWeightNum;

    const startCamera = async () => {
        setActionError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setCameraActive(true);
            setTimeout(() => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            }, 50);
        } catch (err) {
            setActionError(t('warehouseOperator.cameraError'));
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setPhotoFile(file);
            setPhotoPreviewUrl(URL.createObjectURL(blob));
            stopCamera();
        }, 'image/jpeg', 0.9);
    };

    const handleConfirmReceiving = async () => {
        if (!lookupResult?.package) return;
        setActionError('');
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('actualWeight', String(chargeableWeight || actualWeight));
            if (length) formData.append('length', length);
            if (width) formData.append('width', width);
            if (height) formData.append('height', height);
            if (photoFile) formData.append('photo', photoFile);
            await api.put(`/packages/${lookupResult.package.id}/confirm-receiving`, formData);
            setActionSuccess(t('warehouseOperator.confirmedSuccess'));
            setTimeout(resetScanForm, 1200);
        } catch (err) {
            setActionError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogUnidentified = async () => {
        setActionError('');
        if (!unidentifiedWarehouseId) {
            setActionError(t('warehouseOperator.warehouseRequiredError'));
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('trackingNumber', lastQuery);
            formData.append('warehouseId', unidentifiedWarehouseId);
            if (actualWeight) formData.append('weight', actualWeight);
            if (length) formData.append('length', length);
            if (width) formData.append('width', width);
            if (height) formData.append('height', height);
            if (notes) formData.append('notes', notes);
            if (photoFile) formData.append('photo', photoFile);
            await api.post('/unidentified-parcels', formData);
            setActionSuccess(t('warehouseOperator.loggedSuccess'));
            setTimeout(resetScanForm, 1200);
        } catch (err) {
            setActionError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setSubmitting(false);
        }
    };

    const openAssignModal = (parcel) => {
        setAssignTarget(parcel);
        setCustomerQuery('');
        setCustomerResults([]);
        setSelectedCustomer(null);
        setAssignWarehouseId(parcel.warehouseId ? String(parcel.warehouseId) : '');
        setAssignError('');
        setIsAssignModalOpen(true);
    };

    useEffect(() => {
        if (!isAssignModalOpen) return;
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
    }, [customerQuery, isAssignModalOpen]);

    const handleAssign = async () => {
        setAssignError('');
        if (!selectedCustomer) {
            setAssignError(t('claims.selectPackageError'));
            return;
        }
        if (!assignWarehouseId) {
            setAssignError(t('warehouseOperator.warehouseRequiredError'));
            return;
        }
        setAssigning(true);
        try {
            await api.post(`/unidentified-parcels/${assignTarget.id}/assign`, {
                userId: selectedCustomer.id,
                warehouseId: assignWarehouseId
            });
            setIsAssignModalOpen(false);
            fetchExceptions();
        } catch (err) {
            setAssignError(err.response?.data?.message || 'Xəta baş verdi.');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <Text variant="header-2" className="gradient-text">{t('warehouseOperator.pageTitle')}</Text>
                <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                    {t('warehouseOperator.pageSubtitle')}
                </Text>
            </div>

            <RadioButton
                size="l"
                value={tab}
                onUpdate={setTab}
                options={[
                    { value: 'scan', content: t('warehouseOperator.scanTab') },
                    { value: 'exceptions', content: t('warehouseOperator.exceptionsTab') }
                ]}
            />

            {tab === 'scan' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
                    <form onSubmit={handleScanSubmit}>
                        <TextInput
                            controlRef={inputRef}
                            autoFocus
                            size="xl"
                            placeholder={t('warehouseOperator.scanPlaceholder')}
                            value={scanValue}
                            onChange={(e) => setScanValue(e.target.value)}
                            leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                        />
                    </form>
                    <Text variant="caption-2" color="secondary">{t('warehouseOperator.scanHint')}</Text>

                    {searching && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px' }}>
                            <Loader size="s" /> <Text color="secondary">{t('warehouseOperator.searching')}</Text>
                        </div>
                    )}

                    {actionError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {actionError}
                        </div>
                    )}
                    {actionSuccess && (
                        <div style={{ padding: '10px', backgroundColor: '#13231b', color: '#56d364', border: '1px solid #2ea043', borderRadius: '6px', fontSize: '14px' }}>
                            {actionSuccess}
                        </div>
                    )}

                    {lookupResult && !searching && (
                        <>
                            {lookupResult.found && lookupResult.exact && (
                                <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text variant="subheader-1">{t('warehouseOperator.foundPackageTitle')} — {lookupResult.package.trackingNumber}</Text>
                                        <Label theme="info">{lookupResult.package.status}</Label>
                                    </div>
                                    <Text variant="body-2" color="secondary">
                                        {t('warehouseOperator.ownerLabel')} <strong>{lookupResult.package.ownerFirstName} {lookupResult.package.ownerLastName}</strong> ({lookupResult.package.ownerEmail})
                                    </Text>
                                    <Text variant="body-2" color="secondary">
                                        {t('warehouseOperator.warehouseLabelColon')} <strong>{lookupResult.package.warehouseName}</strong> · {t('warehouseOperator.currentWeightLabel')} <strong>{parseFloat(lookupResult.package.weight).toFixed(2)} kq</strong>
                                    </Text>

                                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>{t('warehouseOperator.dimensionsTitle')}</Text>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.actualWeightLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.01" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.lengthLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.widthLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.heightLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
                                        </div>
                                    </div>

                                    {volumetricWeight != null && (
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            <div style={{
                                                flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px',
                                                backgroundColor: !volumetricIsHigher ? 'rgba(139, 92, 246, 0.15)' : '#0d1117',
                                                border: `1px solid ${!volumetricIsHigher ? '#8b5cf6' : '#21262d'}`
                                            }}>
                                                <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{t('warehouseOperator.actualWeightLabel')}</Text>
                                                <Text variant="subheader-2">{physicalWeightNum.toFixed(2)} kq</Text>
                                                {!volumetricIsHigher && <Text variant="caption-2" style={{ color: '#a78bfa' }}>{t('warehouseOperator.physicalHeavier')}</Text>}
                                            </div>
                                            <div style={{
                                                flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px',
                                                backgroundColor: volumetricIsHigher ? 'rgba(139, 92, 246, 0.15)' : '#0d1117',
                                                border: `1px solid ${volumetricIsHigher ? '#8b5cf6' : '#21262d'}`
                                            }}>
                                                <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{t('warehouseOperator.volumetricWeightLabel')}</Text>
                                                <Text variant="subheader-2">{volumetricWeight.toFixed(2)} kq</Text>
                                                {volumetricIsHigher && <Text variant="caption-2" style={{ color: '#a78bfa' }}>{t('warehouseOperator.volumetricHeavier')}</Text>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: '160px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#13231b', border: '1px solid #2ea043' }}>
                                                <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{t('warehouseOperator.chargeableWeightLabel')}</Text>
                                                <Text variant="subheader-2" style={{ color: '#56d364' }}>{chargeableWeight.toFixed(2)} kq</Text>
                                                <Button size="xs" view="flat" onClick={() => setActualWeight(String(chargeableWeight))} style={{ marginTop: '4px' }}>
                                                    {t('warehouseOperator.useChargeableWeight')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>{t('warehouseOperator.photoTitle')}</Text>
                                    {photoPreviewUrl ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img src={photoPreviewUrl} alt={t('warehouseOperator.photoTitle')} style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #30363d' }} />
                                            <Button view="outlined" size="s" onClick={() => { setPhotoFile(null); setPhotoPreviewUrl(null); }}>
                                                <Icon data={Xmark} />
                                            </Button>
                                        </div>
                                    ) : cameraActive ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '360px', borderRadius: '8px', border: '1px solid #30363d' }} />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <Button view="action" size="s" onClick={capturePhoto}><Icon data={Check} /> {t('warehouseOperator.capturePhotoButton')}</Button>
                                                <Button view="flat" size="s" onClick={stopCamera}>{t('warehouseOperator.stopCameraButton')}</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Button view="outlined" size="s" onClick={startCamera}><Icon data={Camera} /> {t('warehouseOperator.takePhotoButton')}</Button>
                                            <Text variant="caption-2" color="secondary">{t('warehouseOperator.uploadPhotoLabel')}</Text>
                                            <input type="file" accept="image/*" onChange={(e) => {
                                                const f = e.target.files[0];
                                                if (f) { setPhotoFile(f); setPhotoPreviewUrl(URL.createObjectURL(f)); }
                                            }} />
                                        </div>
                                    )}

                                    <Button view="action" size="l" onClick={handleConfirmReceiving} loading={submitting} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                                        {t('warehouseOperator.confirmReceivingButton')}
                                    </Button>
                                </Card>
                            )}

                            {lookupResult.found && !lookupResult.exact && (
                                <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <Text variant="subheader-1">{t('warehouseOperator.multipleMatchesTitle')}</Text>
                                    {lookupResult.matches.map((m) => (
                                        <Card key={m.id} type="action" className="hover-lift" style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => {
                                            setLookupResult({ found: true, exact: true, package: m });
                                            setActualWeight(m.weight != null ? String(m.weight) : '');
                                        }}>
                                            <Text style={{ fontWeight: 600 }}>{m.trackingNumber}</Text>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{m.ownerFirstName} {m.ownerLastName} · {m.status}</Text>
                                        </Card>
                                    ))}
                                </Card>
                            )}

                            {!lookupResult.found && (
                                <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <Text variant="subheader-1" color="danger">{t('warehouseOperator.notFoundTitle')}</Text>
                                    <Text variant="body-2" color="secondary">{t('warehouseOperator.notFoundDesc', { trackingNumber: lastQuery })}</Text>

                                    <div>
                                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.warehouseLabelColon')}</Text>
                                        <Select
                                            value={unidentifiedWarehouseId ? [unidentifiedWarehouseId] : []}
                                            onUpdate={(val) => setUnidentifiedWarehouseId(val[0])}
                                            options={warehouses.map((w) => ({ value: String(w.id), content: `${w.flag || ''} ${w.name}` }))}
                                            placeholder={t('packages.warehousePlaceholder')}
                                            width="max"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.actualWeightLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.01" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.lengthLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.widthLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
                                        </div>
                                        <div>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.heightLabel')}</Text>
                                            <TextInput type="number" min="0" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
                                        </div>
                                    </div>
                                    {volumetricWeight != null && (
                                        <Text variant="caption-2" color="secondary">{t('warehouseOperator.volumetricWeightLabel')}: <strong>{volumetricWeight.toFixed(2)} kq</strong></Text>
                                    )}
                                    <div>
                                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.notesLabel')}</Text>
                                        <TextArea placeholder={t('warehouseOperator.notesPlaceholder')} value={notes} onUpdate={setNotes} rows={2} />
                                    </div>

                                    <Text variant="subheader-2">{t('warehouseOperator.photoTitle')}</Text>
                                    {photoPreviewUrl ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img src={photoPreviewUrl} alt={t('warehouseOperator.photoTitle')} style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #30363d' }} />
                                            <Button view="outlined" size="s" onClick={() => { setPhotoFile(null); setPhotoPreviewUrl(null); }}>
                                                <Icon data={Xmark} />
                                            </Button>
                                        </div>
                                    ) : cameraActive ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '360px', borderRadius: '8px', border: '1px solid #30363d' }} />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <Button view="action" size="s" onClick={capturePhoto}><Icon data={Check} /> {t('warehouseOperator.capturePhotoButton')}</Button>
                                                <Button view="flat" size="s" onClick={stopCamera}>{t('warehouseOperator.stopCameraButton')}</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Button view="outlined" size="s" onClick={startCamera}><Icon data={Camera} /> {t('warehouseOperator.takePhotoButton')}</Button>
                                            <Text variant="caption-2" color="secondary">{t('warehouseOperator.uploadPhotoLabel')}</Text>
                                            <input type="file" accept="image/*" onChange={(e) => {
                                                const f = e.target.files[0];
                                                if (f) { setPhotoFile(f); setPhotoPreviewUrl(URL.createObjectURL(f)); }
                                            }} />
                                        </div>
                                    )}

                                    <Button view="action" size="l" onClick={handleLogUnidentified} loading={submitting} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                                        {t('warehouseOperator.logUnidentifiedButton')}
                                    </Button>
                                </Card>
                            )}

                            <Button view="flat" onClick={resetScanForm} style={{ alignSelf: 'flex-start' }}>
                                {t('warehouseOperator.scanAnotherButton')}
                            </Button>
                        </>
                    )}
                </div>
            )}

            {tab === 'exceptions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <Text variant="header-3">{t('warehouseOperator.exceptionsTitle')}</Text>
                        <Text variant="body-2" color="secondary">{t('warehouseOperator.exceptionsDesc')}</Text>
                    </div>

                    {exceptionsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader size="l" /></div>
                    ) : exceptions.length === 0 ? (
                        <Card style={{ padding: '40px', textAlign: 'center' }}>
                            <Text color="secondary">{t('warehouseOperator.noExceptions')}</Text>
                        </Card>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                            {exceptions.map((p) => (
                                <Card key={p.id} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 600 }}>{p.trackingNumber}</Text>
                                        <Label theme="warning">{p.status}</Label>
                                    </div>
                                    {p.photoUrl && (
                                        <img src={`${API_ORIGIN}${p.photoUrl}`} alt={p.trackingNumber} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #30363d' }} />
                                    )}
                                    <Text variant="caption-2" color="secondary">{p.warehouseName || '—'} · {p.weight != null ? `${parseFloat(p.weight).toFixed(2)} kq` : '—'}</Text>
                                    {p.notes && <Text variant="caption-2" color="secondary">{p.notes}</Text>}
                                    <Text variant="caption-2" color="secondary">
                                        {t('warehouseOperator.scannedByLabel')} {p.scannedByFirstName} {p.scannedByLastName} · {new Date(p.createdAt).toLocaleDateString(locale)}
                                    </Text>
                                    <Button view="action" size="s" onClick={() => openAssignModal(p)} style={{ marginTop: '4px' }}>
                                        <Icon data={PersonWorker} /> {t('warehouseOperator.assignButton')}
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Modal open={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <Text variant="header-1">{t('warehouseOperator.assignModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{assignTarget?.trackingNumber}</Text>

                    {assignError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {assignError}
                        </div>
                    )}

                    <div>
                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>{t('warehouseOperator.assignWarehouseLabel')}</Text>
                        <Select
                            value={assignWarehouseId ? [assignWarehouseId] : []}
                            onUpdate={(val) => setAssignWarehouseId(val[0])}
                            options={warehouses.map((w) => ({ value: String(w.id), content: `${w.flag || ''} ${w.name}` }))}
                            placeholder={t('packages.warehousePlaceholder')}
                            width="max"
                        />
                    </div>

                    <TextInput
                        placeholder={t('warehouseOperator.customerSearchPlaceholder')}
                        value={customerQuery}
                        onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null); }}
                        leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                    />

                    {selectedCustomer ? (
                        <Card style={{ padding: '10px 14px', backgroundColor: 'rgba(139, 92, 246, 0.12)', border: '1px solid #8b5cf6' }}>
                            <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{t('warehouseOperator.selectedCustomerLabel')}</Text>
                            <Text style={{ fontWeight: 600 }}>{selectedCustomer.firstName} {selectedCustomer.lastName} ({selectedCustomer.email})</Text>
                        </Card>
                    ) : customerResults.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                            {customerResults.map((c) => (
                                <Card key={c.id} type="action" className="hover-lift" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => setSelectedCustomer(c)}>
                                    <Text style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</Text>
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{c.email} · #C-{c.id + 10400}</Text>
                                </Card>
                            ))}
                        </div>
                    ) : customerQuery.trim().length >= 2 ? (
                        <Text variant="caption-2" color="secondary">{t('warehouseOperator.noCustomersFound')}</Text>
                    ) : null}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsAssignModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleAssign} loading={assigning}>{t('warehouseOperator.assignConfirmButton')}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default WarehouseOperator;

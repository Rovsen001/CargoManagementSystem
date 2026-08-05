import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, TextInput, TextArea, Label, Loader, Modal, Select, Icon } from '@gravity-ui/uikit';
import { Plus, ArrowLeft, ShieldExclamation } from '@gravity-ui/icons';
import api from '../services/api';

const API_ORIGIN = 'http://localhost:5000';

const Claims = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'en' ? 'en-US' : 'az-AZ';
    const STATUS_THEME = { 'Açıq': 'info', 'Baxılır': 'warning', 'Təsdiqləndi': 'success', 'Rədd edildi': 'danger' };
    const STATUS_LABEL = {
        'Açıq': t('claims.statusOpen'),
        'Baxılır': t('claims.statusUnderReview'),
        'Təsdiqləndi': t('claims.statusApproved'),
        'Rədd edildi': t('claims.statusRejected')
    };
    const TYPE_LABEL = { 'Zədə': t('claims.typeDamage'), 'İtki': t('claims.typeLoss') };

    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const hasPermission = (key) => Boolean(currentUser.isSuperAdmin || currentUser.permissions?.includes(key));
    const canReview = hasPermission('packages.editAll');

    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedClaimId, setSelectedClaimId] = useState(null);
    const [claimDetail, setClaimDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [resolveStatus, setResolveStatus] = useState('Baxılır');
    const [resolveAmount, setResolveAmount] = useState('');
    const [resolveNote, setResolveNote] = useState('');
    const [resolveSaving, setResolveSaving] = useState(false);
    const [resolveError, setResolveError] = useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [myPackages, setMyPackages] = useState([]);
    const [newPackageId, setNewPackageId] = useState('');
    const [newType, setNewType] = useState('Zədə');
    const [newDescription, setNewDescription] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newPhotoFile, setNewPhotoFile] = useState(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const response = await api.get('/claims');
            setClaims(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("İddialar çəkilərkən xəta:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, []);

    const openClaim = async (id) => {
        setSelectedClaimId(id);
        setDetailLoading(true);
        try {
            const response = await api.get(`/claims/${id}`);
            setClaimDetail(response.data);
            setResolveStatus(response.data.status === 'Açıq' ? 'Baxılır' : response.data.status);
            setResolveAmount(response.data.resolvedAmount || '');
            setResolveNote(response.data.resolutionNote || '');
            setResolveError('');
        } catch (err) {
            console.error("İddia detalı çəkilərkən xəta:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleResolve = async () => {
        setResolveError('');
        if (resolveStatus === 'Təsdiqləndi' && (!resolveAmount || parseFloat(resolveAmount) <= 0)) {
            setResolveError(t('claims.resolvedAmountPositiveError'));
            return;
        }
        setResolveSaving(true);
        try {
            await api.put(`/claims/${selectedClaimId}/status`, {
                status: resolveStatus,
                resolvedAmount: resolveAmount,
                resolutionNote: resolveNote
            });
            await openClaim(selectedClaimId);
            fetchClaims();
        } catch (err) {
            setResolveError(err.response?.data?.message || t('claims.updateError'));
        } finally {
            setResolveSaving(false);
        }
    };

    const openCreateModal = async () => {
        setCreateError('');
        setNewPackageId('');
        setNewType('Zədə');
        setNewDescription('');
        setNewAmount('');
        setNewPhotoFile(null);
        setIsCreateModalOpen(true);
        try {
            const response = await api.get('/packages');
            const list = Array.isArray(response.data?.data) ? response.data.data : (Array.isArray(response.data) ? response.data : []);
            setMyPackages(list);
        } catch (err) {
            console.error("Bağlamalar çəkilərkən xəta:", err);
        }
    };

    const handleCreateClaim = async () => {
        setCreateError('');
        if (!newPackageId) {
            setCreateError(t('claims.selectPackageError'));
            return;
        }
        if (!newDescription.trim()) {
            setCreateError(t('claims.descriptionRequiredError'));
            return;
        }
        setCreating(true);
        try {
            const formData = new FormData();
            formData.append('packageId', newPackageId);
            formData.append('type', newType);
            formData.append('description', newDescription);
            if (newAmount) formData.append('requestedAmount', newAmount);
            if (newPhotoFile) formData.append('photo', newPhotoFile);

            await api.post('/claims', formData);
            setIsCreateModalOpen(false);
            fetchClaims();
        } catch (err) {
            setCreateError(err.response?.data?.message || t('claims.submitError'));
        } finally {
            setCreating(false);
        }
    };

    if (selectedClaimId) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Button view="flat" onClick={() => { setSelectedClaimId(null); setClaimDetail(null); }} style={{ alignSelf: 'flex-start' }}>
                    <Icon data={ArrowLeft} /> {t('auth.back')}
                </Button>

                {detailLoading || !claimDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <Text variant="header-2" className="gradient-text">
                                    {t('claims.claimTitle', { type: TYPE_LABEL[claimDetail.type] || claimDetail.type, trackingNumber: claimDetail.trackingNumber })}
                                </Text>
                                <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                    {claimDetail.firstName} {claimDetail.lastName} ({claimDetail.email})
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[claimDetail.status] || 'normal'}>{STATUS_LABEL[claimDetail.status] || claimDetail.status}</Label>
                        </div>

                        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Text variant="subheader-2">{t('claims.descriptionLabel')}</Text>
                            <Text variant="body-2" style={{ whiteSpace: 'pre-wrap' }}>{claimDetail.description}</Text>
                            {claimDetail.requestedAmount != null && (
                                <Text variant="body-2" color="secondary">{t('claims.requestedAmountLabel', { amount: parseFloat(claimDetail.requestedAmount).toFixed(2) })}</Text>
                            )}
                            {claimDetail.photoUrl && (
                                <a href={`${API_ORIGIN}${claimDetail.photoUrl}`} target="_blank" rel="noopener noreferrer">
                                    <img src={`${API_ORIGIN}${claimDetail.photoUrl}`} alt={t('claims.proofAlt')} style={{ maxWidth: '240px', borderRadius: '8px', border: '1px solid #30363d' }} />
                                </a>
                            )}
                            <Text variant="caption-2" color="secondary">
                                {t('claims.submittedLabel', { date: new Date(claimDetail.createdAt).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
                            </Text>
                            {claimDetail.resolvedAt && (
                                <Text variant="caption-2" color="secondary">
                                    {t('claims.resolvedLabel', { date: new Date(claimDetail.resolvedAt).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}
                                    {claimDetail.resolvedAmount != null && t('claims.resolvedAmountSuffix', { amount: parseFloat(claimDetail.resolvedAmount).toFixed(2) })}
                                </Text>
                            )}
                            {claimDetail.resolutionNote && (
                                <Text variant="body-2" color="secondary">{t('claims.noteLabel', { note: claimDetail.resolutionNote })}</Text>
                            )}
                        </Card>

                        {canReview && (
                            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <Text variant="subheader-1">{t('claims.reviewTitle')}</Text>

                                {resolveError && (
                                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                                        {resolveError}
                                    </div>
                                )}

                                <div>
                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.statusLabel')}</Text>
                                    <Select
                                        value={[resolveStatus]}
                                        onUpdate={(val) => setResolveStatus(val[0])}
                                        options={[
                                            { value: 'Baxılır', content: t('claims.statusUnderReview') },
                                            { value: 'Təsdiqləndi', content: t('claims.statusApproved') },
                                            { value: 'Rədd edildi', content: t('claims.statusRejected') }
                                        ]}
                                        width="max"
                                    />
                                </div>
                                {resolveStatus === 'Təsdiqləndi' && (
                                    <div>
                                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.resolvedAmountFieldLabel')}</Text>
                                        <TextInput type="number" min="0" step="0.01" value={resolveAmount} onChange={(e) => setResolveAmount(e.target.value)} />
                                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                            {t('claims.resolvedAmountHint')}
                                        </Text>
                                    </div>
                                )}
                                <div>
                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.noteFieldLabel')}</Text>
                                    <TextArea value={resolveNote} onUpdate={(val) => setResolveNote(val)} rows={3} />
                                </div>
                                <Button view="action" onClick={handleResolve} loading={resolveSaving} style={{ alignSelf: 'flex-end' }}>
                                    {t('claims.saveButton')}
                                </Button>
                            </Card>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <Text variant="header-2" className="gradient-text">
                        {canReview ? t('claims.allClaimsTitle') : t('claims.myClaimsTitle')}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {canReview ? t('claims.allClaimsDesc') : t('claims.myClaimsDesc')}
                    </Text>
                </div>
                {!canReview && (
                    <Button view="action" size="l" onClick={openCreateModal} className="pill-btn" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}>
                        <Icon data={Plus} /> {t('claims.newClaimButton')}
                    </Button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
            ) : claims.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                    <Icon data={ShieldExclamation} size={32} style={{ color: '#8b949e', marginBottom: '8px' }} />
                    <Text variant="subheader-1" color="secondary" style={{ display: 'block' }}>{t('claims.noClaimsFound')}</Text>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {claims.map((c) => (
                        <Card
                            key={c.id}
                            type="action"
                            className="hover-lift"
                            style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
                            onClick={() => openClaim(c.id)}
                        >
                            <div>
                                <Text variant="subheader-2" style={{ color: '#ffffff' }}>{TYPE_LABEL[c.type] || c.type} — {c.trackingNumber}</Text>
                                {canReview && (
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                        {c.firstName} {c.lastName} ({c.email})
                                    </Text>
                                )}
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                    {new Date(c.createdAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    {c.requestedAmount != null && ` · ${t('claims.requestedAmountLabel', { amount: parseFloat(c.requestedAmount).toFixed(2) })}`}
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[c.status] || 'normal'}>{STATUS_LABEL[c.status] || c.status}</Label>
                        </Card>
                    ))}
                </div>
            )}

            <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('claims.newClaimModalTitle')}</Text>

                    {createError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {createError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.packageLabel')}</Text>
                        <Select
                            value={newPackageId ? [String(newPackageId)] : []}
                            onUpdate={(val) => setNewPackageId(val[0])}
                            options={myPackages.map((p) => ({ value: String(p.id), content: `${p.trackingNumber} (${p.status})` }))}
                            placeholder={t('claims.packagePlaceholder')}
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.typeLabel')}</Text>
                        <Select
                            value={[newType]}
                            onUpdate={(val) => setNewType(val[0])}
                            options={[{ value: 'Zədə', content: t('claims.typeDamage') }, { value: 'İtki', content: t('claims.typeLoss') }]}
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.descriptionFieldLabel')}</Text>
                        <TextArea placeholder={t('claims.descriptionPlaceholder')} value={newDescription} onUpdate={(val) => setNewDescription(val)} rows={4} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.requestedAmountFieldLabel')}</Text>
                        <TextInput type="number" min="0" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.proofPhotoLabel')}</Text>
                        <input type="file" accept="image/*" onChange={(e) => setNewPhotoFile(e.target.files[0] || null)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsCreateModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleCreateClaim} loading={creating}>{t('claims.submitButton')}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Claims;

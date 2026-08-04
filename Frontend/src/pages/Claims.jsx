import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, TextArea, Label, Loader, Modal, Select, Icon } from '@gravity-ui/uikit';
import { Plus, ArrowLeft, ShieldExclamation } from '@gravity-ui/icons';
import api from '../services/api';

const API_ORIGIN = 'http://localhost:5000';
const STATUS_THEME = { 'Açıq': 'info', 'Baxılır': 'warning', 'Təsdiqləndi': 'success', 'Rədd edildi': 'danger' };

const Claims = () => {
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
            setResolveError('Təsdiqlənmiş məbləğ müsbət rəqəm olmalıdır!');
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
            setResolveError(err.response?.data?.message || "Yenilənərkən xəta baş verdi.");
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
            setCreateError('Bağlama seçin!');
            return;
        }
        if (!newDescription.trim()) {
            setCreateError('Təsvir daxil edin!');
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
            setCreateError(err.response?.data?.message || "İddia təqdim edilərkən xəta baş verdi.");
        } finally {
            setCreating(false);
        }
    };

    if (selectedClaimId) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Button view="flat" onClick={() => { setSelectedClaimId(null); setClaimDetail(null); }} style={{ alignSelf: 'flex-start' }}>
                    <Icon data={ArrowLeft} /> Geri
                </Button>

                {detailLoading || !claimDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <Text variant="header-2" className="gradient-text">{claimDetail.type} İddiası — {claimDetail.trackingNumber}</Text>
                                <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                    {claimDetail.firstName} {claimDetail.lastName} ({claimDetail.email})
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[claimDetail.status] || 'normal'}>{claimDetail.status}</Label>
                        </div>

                        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Text variant="subheader-2">Təsvir</Text>
                            <Text variant="body-2" style={{ whiteSpace: 'pre-wrap' }}>{claimDetail.description}</Text>
                            {claimDetail.requestedAmount != null && (
                                <Text variant="body-2" color="secondary">Tələb olunan məbləğ: ${parseFloat(claimDetail.requestedAmount).toFixed(2)}</Text>
                            )}
                            {claimDetail.photoUrl && (
                                <a href={`${API_ORIGIN}${claimDetail.photoUrl}`} target="_blank" rel="noopener noreferrer">
                                    <img src={`${API_ORIGIN}${claimDetail.photoUrl}`} alt="Sübut" style={{ maxWidth: '240px', borderRadius: '8px', border: '1px solid #30363d' }} />
                                </a>
                            )}
                            <Text variant="caption-2" color="secondary">
                                Təqdim edilib: {new Date(claimDetail.createdAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {claimDetail.resolvedAt && (
                                <Text variant="caption-2" color="secondary">
                                    Həll edilib: {new Date(claimDetail.resolvedAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {claimDetail.resolvedAmount != null && ` — Təsdiqlənmiş məbləğ: $${parseFloat(claimDetail.resolvedAmount).toFixed(2)}`}
                                </Text>
                            )}
                            {claimDetail.resolutionNote && (
                                <Text variant="body-2" color="secondary">Qeyd: {claimDetail.resolutionNote}</Text>
                            )}
                        </Card>

                        {canReview && (
                            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <Text variant="subheader-1">İddiaya Baxış</Text>

                                {resolveError && (
                                    <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                                        {resolveError}
                                    </div>
                                )}

                                <div>
                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Status</Text>
                                    <Select
                                        value={[resolveStatus]}
                                        onUpdate={(val) => setResolveStatus(val[0])}
                                        options={[
                                            { value: 'Baxılır', content: 'Baxılır' },
                                            { value: 'Təsdiqləndi', content: 'Təsdiqləndi' },
                                            { value: 'Rədd edildi', content: 'Rədd edildi' }
                                        ]}
                                        width="max"
                                    />
                                </div>
                                {resolveStatus === 'Təsdiqləndi' && (
                                    <div>
                                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Təsdiqlənmiş Məbləğ ($) *</Text>
                                        <TextInput type="number" min="0" step="0.01" value={resolveAmount} onChange={(e) => setResolveAmount(e.target.value)} />
                                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                            Təsdiqlənərsə, bu məbləğ avtomatik müştərinin balansına əlavə ediləcək.
                                        </Text>
                                    </div>
                                )}
                                <div>
                                    <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Qeyd (könüllü)</Text>
                                    <TextArea value={resolveNote} onUpdate={(val) => setResolveNote(val)} rows={3} />
                                </div>
                                <Button view="action" onClick={handleResolve} loading={resolveSaving} style={{ alignSelf: 'flex-end' }}>
                                    Yadda saxla
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
                        {canReview ? 'Bütün Zədə/İtki İddiaları' : 'Zədə/İtki İddialarım'}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {canReview ? 'Müştərilərin zədə və itki iddialarını nəzərdən keçirin.' : 'Zədələnmiş və ya itmiş bağlamalarınız üçün iddia təqdim edin.'}
                    </Text>
                </div>
                {!canReview && (
                    <Button view="action" size="l" onClick={openCreateModal} className="pill-btn" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}>
                        <Icon data={Plus} /> Yeni İddia
                    </Button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
            ) : claims.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                    <Icon data={ShieldExclamation} size={32} style={{ color: '#8b949e', marginBottom: '8px' }} />
                    <Text variant="subheader-1" color="secondary" style={{ display: 'block' }}>İddia tapılmadı.</Text>
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
                                <Text variant="subheader-2" style={{ color: '#ffffff' }}>{c.type} — {c.trackingNumber}</Text>
                                {canReview && (
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                        {c.firstName} {c.lastName} ({c.email})
                                    </Text>
                                )}
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                    {new Date(c.createdAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    {c.requestedAmount != null && ` · Tələb: $${parseFloat(c.requestedAmount).toFixed(2)}`}
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[c.status] || 'normal'}>{c.status}</Label>
                        </Card>
                    ))}
                </div>
            )}

            <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Yeni İddia</Text>

                    {createError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {createError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Bağlama *</Text>
                        <Select
                            value={newPackageId ? [String(newPackageId)] : []}
                            onUpdate={(val) => setNewPackageId(val[0])}
                            options={myPackages.map((p) => ({ value: String(p.id), content: `${p.trackingNumber} (${p.status})` }))}
                            placeholder="Bağlama seçin"
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>İddia Növü *</Text>
                        <Select
                            value={[newType]}
                            onUpdate={(val) => setNewType(val[0])}
                            options={[{ value: 'Zədə', content: 'Zədə' }, { value: 'İtki', content: 'İtki' }]}
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Təsvir *</Text>
                        <TextArea placeholder="Baş verən problemi ətraflı izah edin..." value={newDescription} onUpdate={(val) => setNewDescription(val)} rows={4} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Tələb Olunan Məbləğ ($) (könüllü)</Text>
                        <TextInput type="number" min="0" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Sübut Şəkli (könüllü)</Text>
                        <input type="file" accept="image/*" onChange={(e) => setNewPhotoFile(e.target.files[0] || null)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsCreateModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleCreateClaim} loading={creating}>Təqdim Et</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Claims;

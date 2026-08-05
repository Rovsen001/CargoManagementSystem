import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Table,
    Button,
    TextInput,
    Select,
    Modal,
    Text,
    Label,
    Card,
    Loader,
    RadioButton,
    Icon,
    Checkbox,
    Pagination
} from '@gravity-ui/uikit';
import {
    Magnifier,
    Plus,
    TrashBin,
    ArrowDownToSquare,
    Pencil,
    ArrowRotateLeft,
    Xmark,
    Clock,
    PersonWorker,
    QrCode,
    ShieldCheck,
    FileText,
    Layers,
    WeightHanging,
    Wallet,
    Percent
} from '@gravity-ui/icons';
import api from '../services/api';
import BarcodeModal from '../components/Packages/BarcodeModal';
import { generateCommercialInvoice } from '../utils/commercialInvoice';

const API_ORIGIN = 'http://localhost:5000';

const Packages = () => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'en' ? 'en-US' : 'az-AZ';

    const STATUS_LABEL = {
        'Bəyan edildi': t('packages.statusDeclared'),
        'Yoldadır': t('packages.statusInTransit'),
        'Gömrükdə': t('packages.statusCustoms'),
        'Filialda': t('packages.statusAtBranch'),
        'Təhvil verildi': t('packages.statusDelivered'),
        'Konsolidasiya edildi': t('packages.statusConsolidated')
    };
    const statusLabel = (status) => STATUS_LABEL[status] || status || t('packages.statusNotSet');

    // Daxil olan istifadəçini localStroage-dən götürürük
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const hasPermission = (key) => Boolean(currentUser.isSuperAdmin || currentUser.permissions?.includes(key));
    const canViewAll = hasPermission('packages.viewAll');
    const canChangeStatus = hasPermission('packages.changeStatus');
    const canRestore = hasPermission('packages.restore');
    const canHardDelete = hasPermission('packages.hardDelete');
    const canAssignCourier = hasPermission('packages.assignCourier');
    const isCourierUser = hasPermission('packages.viewAssigned');
    const canConsolidate = hasPermission('packages.editAll');

    const PAGE_SIZE = 15;

    const [packages, setPackages] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState([]);

    const [activeTab, setActiveTab] = useState('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(['ALL']);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormData, setAddFormData] = useState({ trackingNumber: '', weight: '', warehouseId: '', isInsured: false, declaredValue: '', hsCode: '', itemDescription: '', countryOfOrigin: '' });
    const INSURANCE_RATE = 0.02;

    // Çəki/Qiymət ədəd sahələrinin düzgün, mənfi olmayan rəqəm olduğunu yoxlayır
    const validateNonNegativeNumber = (value, fieldName) => {
        const num = parseFloat(value);
        if (value === '' || isNaN(num)) return t('packages.weightFieldError', { field: fieldName });
        if (num < 0) return t('packages.weightNegativeError', { field: fieldName });
        return null;
    };

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ id: null, trackingNumber: '', weight: '', price: '', status: '', warehouseId: '', isInsured: false, declaredValue: '', hsCode: '', itemDescription: '', countryOfOrigin: '' });

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTrackingNumber, setHistoryTrackingNumber] = useState('');

    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [barcodeTarget, setBarcodeTarget] = useState(null);

    const [couriers, setCouriers] = useState([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [assignCourierId, setAssignCourierId] = useState('');
    const [assignSaving, setAssignSaving] = useState(false);

    const [selectedForConsolidation, setSelectedForConsolidation] = useState([]);
    const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);
    const [consolidateTrackingNumber, setConsolidateTrackingNumber] = useState('');
    const [consolidateActualWeight, setConsolidateActualWeight] = useState('');
    const [consolidateSaving, setConsolidateSaving] = useState(false);
    const [consolidateError, setConsolidateError] = useState('');

    const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
    const [receivingTarget, setReceivingTarget] = useState(null);
    const [receivingActualWeight, setReceivingActualWeight] = useState('');
    const [receivingPhotoFile, setReceivingPhotoFile] = useState(null);
    const [receivingSaving, setReceivingSaving] = useState(false);
    const [receivingError, setReceivingError] = useState('');

    const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
    const [storageTarget, setStorageTarget] = useState(null);
    const [storageFeeData, setStorageFeeData] = useState(null);
    const [storageLoading, setStorageLoading] = useState(false);
    const [storagePaying, setStoragePaying] = useState(false);
    const [storageError, setStorageError] = useState('');

    const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
    const [dutyTarget, setDutyTarget] = useState(null);
    const [dutyData, setDutyData] = useState(null);
    const [dutyLoading, setDutyLoading] = useState(false);
    const [dutyPaying, setDutyPaying] = useState(false);
    const [dutyError, setDutyError] = useState('');

    const openBarcodeModal = (item) => {
        setBarcodeTarget(item);
        setIsBarcodeModalOpen(true);
    };

    const openHistoryModal = async (item) => {
        setHistoryTrackingNumber(item.trackingNumber);
        setIsHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const response = await api.get(`/packages/${item.id}/history`);
            setHistoryData(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Tarixçə çəkilərkən xəta:", error);
            setHistoryData([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Bazadan Məlumatları Çəkmək (Rola uyğun olaraq, səhifələnmə və server-tərəfli filtrlərlə)
    const fetchPackages = async () => {
        setLoading(true);
        try {
            const isArchived = activeTab === 'archived';
            const response = await api.get('/packages', {
                params: {
                    archived: isArchived,
                    page,
                    limit: PAGE_SIZE,
                    search: searchQuery.trim() || undefined,
                    status: selectedStatus[0] !== 'ALL' ? selectedStatus[0] : undefined
                }
            });
            if (Array.isArray(response.data?.data)) {
                setPackages(response.data.data);
                setTotal(response.data.total || 0);
            } else {
                setPackages([]);
                setTotal(0);
            }
        } catch (error) {
            console.error("Məlumat çəkilərkən xəta:", error);
            setPackages([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, [activeTab, page, searchQuery, selectedStatus]);

    const handleTabChange = (val) => {
        setActiveTab(val);
        setPage(1);
    };

    const handleSearchChange = (value) => {
        setSearchQuery(value);
        setPage(1);
    };

    const handleStatusFilterChange = (val) => {
        setSelectedStatus(val);
        setPage(1);
    };

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const response = await api.get('/warehouses');
                setWarehouses(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("Anbarlar çəkilərkən xəta:", error);
            }
        };
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (!canAssignCourier) return;
        const fetchCouriers = async () => {
            try {
                const response = await api.get('/couriers');
                setCouriers(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("Kuryerlər çəkilərkən xəta:", error);
            }
        };
        fetchCouriers();
    }, [canAssignCourier]);

    const openAssignModal = (item) => {
        setAssignTarget(item);
        setAssignCourierId(item.assignedCourierId ? String(item.assignedCourierId) : '');
        setIsAssignModalOpen(true);
    };

    const handleAssignCourier = async () => {
        if (!assignTarget) return;
        setAssignSaving(true);
        try {
            await api.put(`/packages/${assignTarget.id}/assign-courier`, {
                courierId: assignCourierId || null
            });
            setIsAssignModalOpen(false);
            fetchPackages();
        } catch (error) {
            alert(error.response?.data?.message || t('packages.courierAssignError'));
        } finally {
            setAssignSaving(false);
        }
    };

    const handleCourierStatusUpdate = async (id, newStatus) => {
        try {
            await api.put(`/packages/${id}/courier-status`, { status: newStatus });
            fetchPackages();
        } catch (error) {
            alert(error.response?.data?.message || t('packages.statusUpdateError'));
        }
    };

    const toggleConsolidationSelect = (item) => {
        setSelectedForConsolidation((prev) =>
            prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
        );
    };

    const openConsolidateModal = () => {
        setConsolidateTrackingNumber('');
        setConsolidateActualWeight('');
        setConsolidateError('');
        setIsConsolidateModalOpen(true);
    };

    const selectedPackagesForConsolidation = packages.filter((p) => selectedForConsolidation.includes(p.id));
    const totalDeclaredWeight = selectedPackagesForConsolidation.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);

    const handleConsolidate = async () => {
        setConsolidateError('');
        if (!consolidateTrackingNumber.trim()) {
            setConsolidateError(t('packages.consolidateTrackingNumberRequired'));
            return;
        }
        const weightError = validateNonNegativeNumber(consolidateActualWeight, t('packages.realWeightFieldName'));
        if (weightError || parseFloat(consolidateActualWeight) <= 0) {
            setConsolidateError(t('packages.realWeightPositiveError'));
            return;
        }
        setConsolidateSaving(true);
        try {
            await api.post('/packages/consolidate', {
                packageIds: selectedForConsolidation,
                trackingNumber: consolidateTrackingNumber,
                actualWeight: consolidateActualWeight
            });
            setIsConsolidateModalOpen(false);
            setSelectedForConsolidation([]);
            fetchPackages();
        } catch (error) {
            setConsolidateError(error.response?.data?.message || t('packages.consolidateSubmitError'));
        } finally {
            setConsolidateSaving(false);
        }
    };

    const openReceivingModal = (item) => {
        setReceivingTarget(item);
        setReceivingActualWeight(item.weight || '');
        setReceivingPhotoFile(null);
        setReceivingError('');
        setIsReceivingModalOpen(true);
    };

    const handleConfirmReceiving = async () => {
        setReceivingError('');
        const weightError = validateNonNegativeNumber(receivingActualWeight, t('packages.realWeightFieldName'));
        if (weightError || parseFloat(receivingActualWeight) <= 0) {
            setReceivingError(t('packages.realWeightPositiveError'));
            return;
        }
        setReceivingSaving(true);
        try {
            const formData = new FormData();
            formData.append('actualWeight', receivingActualWeight);
            if (receivingPhotoFile) {
                formData.append('photo', receivingPhotoFile);
            }
            await api.put(`/packages/${receivingTarget.id}/confirm-receiving`, formData);
            setIsReceivingModalOpen(false);
            fetchPackages();
        } catch (error) {
            setReceivingError(error.response?.data?.message || t('packages.receivingConfirmError'));
        } finally {
            setReceivingSaving(false);
        }
    };

    const openStorageModal = async (item) => {
        setStorageTarget(item);
        setStorageFeeData(null);
        setStorageError('');
        setIsStorageModalOpen(true);
        setStorageLoading(true);
        try {
            const response = await api.get(`/packages/${item.id}/storage-fee`);
            setStorageFeeData(response.data);
        } catch (error) {
            setStorageError(error.response?.data?.message || t('packages.storageFeeCalcError'));
        } finally {
            setStorageLoading(false);
        }
    };

    const handlePayStorageFee = async () => {
        setStorageError('');
        setStoragePaying(true);
        try {
            await api.post(`/packages/${storageTarget.id}/pay-storage-fee`);
            const response = await api.get(`/packages/${storageTarget.id}/storage-fee`);
            setStorageFeeData(response.data);
            fetchPackages();
        } catch (error) {
            setStorageError(error.response?.data?.message || t('packages.paymentError'));
        } finally {
            setStoragePaying(false);
        }
    };

    const openDutyModal = async (item) => {
        setDutyTarget(item);
        setDutyData(null);
        setDutyError('');
        setIsDutyModalOpen(true);
        setDutyLoading(true);
        try {
            const response = await api.get(`/packages/${item.id}/customs-duty`);
            setDutyData(response.data);
        } catch (error) {
            setDutyError(error.response?.data?.message || t('packages.dutyCalcError'));
        } finally {
            setDutyLoading(false);
        }
    };

    const handlePayDuty = async () => {
        setDutyError('');
        setDutyPaying(true);
        try {
            await api.post(`/packages/${dutyTarget.id}/pay-customs-duty`);
            const response = await api.get(`/packages/${dutyTarget.id}/customs-duty`);
            setDutyData(response.data);
            fetchPackages();
        } catch (error) {
            setDutyError(error.response?.data?.message || t('packages.paymentError'));
        } finally {
            setDutyPaying(false);
        }
    };

    const selectedWarehouseRate = (whId) => {
        const wh = warehouses.find(w => w.id === whId);
        return wh ? parseFloat(wh.ratePerKg) : 0;
    };

    const estimatedPrice = (weight, whId) => {
        const w = parseFloat(weight) || 0;
        const rate = selectedWarehouseRate(Number(whId));
        return (w * rate).toFixed(2);
    };

    const estimatedInsuranceFee = (declaredValue) => {
        const v = parseFloat(declaredValue) || 0;
        return (v * INSURANCE_RATE).toFixed(2);
    };

    // Yeni Bağlama Yaratmaq (qiymət sistemin özü tərəfindən çəki × anbar tarifinə görə hesablanır)
    const handleCreate = async () => {
        if (!addFormData.trackingNumber.trim()) return alert(t('packages.enterTrackingNumber'));
        const weightError = validateNonNegativeNumber(addFormData.weight, t('packages.weightFieldName'));
        if (weightError) return alert(weightError);
        if (!addFormData.warehouseId) return alert(t('packages.selectWarehouseError'));
        if (addFormData.isInsured) {
            const declaredValueError = validateNonNegativeNumber(addFormData.declaredValue, t('packages.declaredValueFieldName'));
            if (declaredValueError || parseFloat(addFormData.declaredValue) <= 0) return alert(t('packages.insuranceValueError'));
        }
        try {
            await api.post('/packages', {
                trackingNumber: addFormData.trackingNumber,
                weight: addFormData.weight,
                warehouseId: addFormData.warehouseId,
                isInsured: addFormData.isInsured,
                declaredValue: addFormData.declaredValue,
                hsCode: addFormData.hsCode,
                itemDescription: addFormData.itemDescription,
                countryOfOrigin: addFormData.countryOfOrigin
            });
            setIsAddModalOpen(false);
            setAddFormData({ trackingNumber: '', weight: '', warehouseId: '', isInsured: false, declaredValue: '', hsCode: '', itemDescription: '', countryOfOrigin: '' });
            fetchPackages();
        } catch (error) {
            console.error("Yaradılarkən xəta:", error);
            alert(error.response?.data?.message || t('packages.packageCreateError'));
        }
    };

    const handleUpdate = async () => {
        if (!editFormData.trackingNumber.trim()) return alert(t('packages.enterTrackingNumber'));
        const weightError = validateNonNegativeNumber(editFormData.weight, t('packages.weightFieldName'));
        if (weightError) return alert(weightError);
        if (canChangeStatus) {
            const priceError = validateNonNegativeNumber(editFormData.price, t('packages.priceFieldName'));
            if (priceError) return alert(priceError);
        }
        if (editFormData.isInsured) {
            const declaredValueError = validateNonNegativeNumber(editFormData.declaredValue, t('packages.declaredValueFieldName'));
            if (declaredValueError || parseFloat(editFormData.declaredValue) <= 0) return alert(t('packages.insuranceValueError'));
        }
        try {
            await api.put(`/packages/${editFormData.id}`, editFormData);
            setIsEditModalOpen(false);
            fetchPackages();
        } catch (error) {
            console.error("Yenilənərkən xəta:", error);
        }
    };

    const openEditModal = (item) => {
        setEditFormData({
            id: item.id,
            trackingNumber: item.trackingNumber || '',
            weight: item.weight || '',
            price: item.price || '',
            status: item.status || 'Bəyan edildi',
            warehouseId: item.warehouseId || '',
            isInsured: Boolean(item.isInsured),
            declaredValue: item.declaredValue || '',
            hsCode: item.hsCode || '',
            itemDescription: item.itemDescription || '',
            countryOfOrigin: item.countryOfOrigin || ''
        });
        setIsEditModalOpen(true);
    };

    const handleSoftDelete = async (id) => {
        if (window.confirm(t('packages.confirmArchive'))) {
            try {
                await api.delete(`/packages/${id}`);
                fetchPackages();
            } catch (error) {
                console.error("Arxivlənərkən xəta:", error);
            }
        }
    };

    const handleRestore = async (id) => {
        try {
            await api.put(`/packages/${id}/restore`);
            fetchPackages();
        } catch (error) {
            console.error("Bərpa edilərkən xəta:", error);
        }
    };

    const handleHardDelete = async (id) => {
        if (window.confirm(t('packages.confirmHardDelete'))) {
            try {
                await api.delete(`/packages/${id}/hard`);
                fetchPackages();
            } catch (error) {
                console.error("Həmişəlik silinərkən xəta:", error);
            }
        }
    };

    const handleStatusChange = async (id, newStatus, currentItem) => {
        try {
            await api.put(`/packages/${id}`, { ...currentItem, status: newStatus });
            fetchPackages();
        } catch (error) {
            console.error("Status yenilənərkən xəta:", error);
        }
    };

    // Axtarış və status filtri artıq serverdə tətbiq olunur (bax: fetchPackages)
    const filteredPackages = Array.isArray(packages) ? packages : [];

    const handleExportExcel = () => {
        if (filteredPackages.length === 0) return alert(t('packages.exportNoData'));

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
        <h2>${activeTab === 'active' ? t('packages.tabActive') : t('packages.tabArchived')}</h2>
        <table>
          <thead>
            <tr><th>${t('packages.colId')}</th><th>${t('packages.colTrackingNumber')}</th><th>${t('packages.colWeight')}</th><th>${t('packages.colPrice')}</th><th>${t('packages.colStatus')}</th><th>${t('packages.colDate')}</th></tr>
          </thead>
          <tbody>
            ${filteredPackages.map(pkg => `
              <tr>
                <td>${pkg.id}</td>
                <td><b>${pkg.trackingNumber || ''}</b></td>
                <td>${parseFloat(pkg.weight).toFixed(2)} kq</td>
                <td>$${parseFloat(pkg.price).toFixed(2)}</td>
                <td>${statusLabel(pkg.status)}</td>
                <td>${pkg.createdAt ? new Date(pkg.createdAt).toLocaleDateString(locale) : ''}</td>
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
        link.setAttribute('download', `Kargo_Hesabat_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderStatusBadge = (status) => {
        const themeMap = { 'Bəyan edildi': 'info', 'Yoldadır': 'warning', 'Gömrükdə': 'danger', 'Filialda': 'success', 'Təhvil verildi': 'success', 'Konsolidasiya edildi': 'utility' };
        return <Label theme={themeMap[status] || 'normal'}>{statusLabel(status)}</Label>;
    };

    const consolidationTargetTrackingNumber = (consolidatedIntoId) => {
        if (!consolidatedIntoId) return null;
        const target = packages.find((p) => p.id === consolidatedIntoId);
        return target ? target.trackingNumber : `#${consolidatedIntoId}`;
    };

    const courierName = (courierId) => {
        if (!courierId) return null;
        const c = couriers.find((c) => c.id === courierId);
        return c ? `${c.firstName} ${c.lastName}` : `#${courierId}`;
    };

    const columns = [
        ...(canConsolidate && activeTab === 'active' ? [{
            id: 'select',
            name: '',
            meta: { width: '40px' },
            template: (item) => item.consolidatedIntoId ? null : (
                <Checkbox
                    checked={selectedForConsolidation.includes(item.id)}
                    onUpdate={() => toggleConsolidationSelect(item)}
                />
            )
        }] : []),
        { id: 'id', name: t('packages.colId'), meta: { width: '60px' } },
        { id: 'trackingNumber', name: t('packages.colTrackingNumber'), template: (item) => <strong>{item.trackingNumber}</strong> },
        { id: 'weight', name: t('packages.colWeight'), template: (item) => `${parseFloat(item.weight).toFixed(2)} kq` },
        { id: 'price', name: t('packages.colPrice'), template: (item) => `$${parseFloat(item.price).toFixed(2)}` },
        {
            id: 'insurance',
            name: t('packages.colInsurance'),
            template: (item) => item.isInsured
                ? <Label theme="success" icon={<Icon data={ShieldCheck} size={14} />}>${parseFloat(item.declaredValue).toFixed(2)}</Label>
                : <Text color="secondary">—</Text>
        },
        ...(canConsolidate ? [{
            id: 'receiving',
            name: t('packages.colReceivingStatus'),
            template: (item) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Label theme={item.weightConfirmed ? 'success' : 'normal'}>
                        {item.weightConfirmed ? t('packages.receivingConfirmed') : t('packages.receivingUnconfirmed')}
                    </Label>
                    {item.receivingPhotoUrl && (
                        <a href={`${API_ORIGIN}${item.receivingPhotoUrl}`} target="_blank" rel="noopener noreferrer">
                            <img src={`${API_ORIGIN}${item.receivingPhotoUrl}`} alt={t('packages.receivingPhotoAlt')} width={28} height={28} style={{ borderRadius: '4px', objectFit: 'cover', border: '1px solid #30363d' }} />
                        </a>
                    )}
                </div>
            )
        }] : []),
        {
            id: 'status',
            name: t('packages.colStatus'),
            template: (item) => (
                <div>
                    {renderStatusBadge(item.status)}
                    {item.consolidatedIntoId && (
                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                            → {consolidationTargetTrackingNumber(item.consolidatedIntoId)}
                        </Text>
                    )}
                </div>
            )
        },
        ...(canAssignCourier ? [{
            id: 'courier',
            name: t('packages.colCourier'),
            template: (item) => courierName(item.assignedCourierId)
                ? <Label theme="normal">{courierName(item.assignedCourierId)}</Label>
                : <Text color="secondary">{t('packages.courierUnassigned')}</Text>
        }] : []),
        {
            id: 'createdAt',
            name: t('packages.colDate'),
            template: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString(locale) : '—'
        },
        {
            id: 'actions',
            name: t('packages.colActions'),
            template: (item) => (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {activeTab === 'active' ? (
                        isCourierUser ? (
                            <>
                                <Select
                                    value={[item.status || 'Yoldadır']}
                                    onUpdate={(val) => handleCourierStatusUpdate(item.id, val[0])}
                                    options={[
                                        { value: 'Yoldadır', content: t('packages.statusInTransit') },
                                        { value: 'Gömrükdə', content: t('packages.statusCustoms') },
                                        { value: 'Filialda', content: t('packages.statusAtBranch') },
                                        { value: 'Təhvil verildi', content: t('packages.statusDelivered') }
                                    ]}
                                    size="s"
                                />
                                <Button view="flat-secondary" size="s" onClick={() => openHistoryModal(item)} title={t('packages.historyButton')}>
                                    <Icon data={Clock} />
                                </Button>
                                <Button view="flat-secondary" size="s" onClick={() => openBarcodeModal(item)} title={t('packages.barcodeButton')}>
                                    <Icon data={QrCode} />
                                </Button>
                            </>
                        ) : (
                        <>
                            {/* STATUS SELECT - Yalnız icazəsi olanlar üçün */}
                            {canChangeStatus && (
                                <Select
                                    value={[item.status || 'Bəyan edildi']}
                                    onUpdate={(val) => handleStatusChange(item.id, val[0], item)}
                                    options={[
                                        { value: 'Bəyan edildi', content: t('packages.statusDeclared') },
                                        { value: 'Yoldadır', content: t('packages.statusInTransit') },
                                        { value: 'Gömrükdə', content: t('packages.statusCustoms') },
                                        { value: 'Filialda', content: t('packages.statusAtBranch') }
                                    ]}
                                    size="s"
                                />
                            )}
                            <Button view="flat-secondary" size="s" onClick={() => openEditModal(item)} title={t('packages.editButton')}>
                                <Icon data={Pencil} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => openHistoryModal(item)} title={t('packages.historyButton')}>
                                <Icon data={Clock} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => openBarcodeModal(item)} title={t('packages.barcodeButton')}>
                                <Icon data={QrCode} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => generateCommercialInvoice(item)} title={t('packages.invoiceButton')}>
                                <Icon data={FileText} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => openDutyModal(item)} title={t('packages.dutyButton')}>
                                <Icon data={Percent} />
                            </Button>
                            {item.arrivedAtBranchAt && (
                                <Button view="flat-secondary" size="s" onClick={() => openStorageModal(item)} title={t('packages.storageButton')}>
                                    <Icon data={Wallet} />
                                </Button>
                            )}
                            {canConsolidate && (
                                <Button view="flat-secondary" size="s" onClick={() => openReceivingModal(item)} title={t('packages.receivingButton')}>
                                    <Icon data={WeightHanging} />
                                </Button>
                            )}
                            {canAssignCourier && (
                                <Button view="flat-secondary" size="s" onClick={() => openAssignModal(item)} title={t('packages.assignCourierButton')}>
                                    <Icon data={PersonWorker} />
                                </Button>
                            )}
                            <Button view="flat-warning" size="s" onClick={() => handleSoftDelete(item.id)} title={t('packages.archiveButton')}>
                                <Icon data={TrashBin} />
                            </Button>
                        </>
                        )
                    ) : (
                        <>
                            {/* Bərpa və Tam silmə - icazəyə görə ayrı-ayrı */}
                            {canRestore && (
                                <Button view="action" size="s" onClick={() => handleRestore(item.id)}>
                                    <Icon data={ArrowRotateLeft} /> {t('packages.restoreButton')}
                                </Button>
                            )}
                            {canHardDelete && (
                                <Button view="flat-danger" size="s" onClick={() => handleHardDelete(item.id)}>
                                    <Icon data={Xmark} />
                                </Button>
                            )}
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <Text variant="header-2" className="gradient-text">
                        {isCourierUser ? t('packages.titleAssigned') : canViewAll ? t('packages.titleAll') : t('packages.titleMine')}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {isCourierUser ? t('packages.subtitleAssigned') : canViewAll ? t('packages.subtitleAll') : t('packages.subtitleMine')}
                    </Text>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button view="outlined" size="l" onClick={handleExportExcel}>
                        <Icon data={ArrowDownToSquare} />
                        {t('packages.exportButton')}
                    </Button>

                    {activeTab === 'active' && !isCourierUser && (
                        <Button
                            view="action"
                            size="l"
                            onClick={() => setIsAddModalOpen(true)}
                            className="pill-btn"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}
                        >
                            <Icon data={Plus} />
                            {t('packages.declareButton')}
                        </Button>
                    )}
                </div>
            </div>

            {canConsolidate && selectedForConsolidation.length >= 2 && (
                <Card style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6' }}>
                    <Text variant="body-2">{t('packages.selectedCount', { count: selectedForConsolidation.length, weight: totalDeclaredWeight.toFixed(2) })}</Text>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button view="flat" size="s" onClick={() => setSelectedForConsolidation([])}>{t('packages.cancelSelection')}</Button>
                        <Button view="action" size="s" onClick={openConsolidateModal}>
                            <Icon data={Layers} /> {t('packages.consolidateButton')}
                        </Button>
                    </div>
                </Card>
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
                <RadioButton
                    size="l"
                    value={activeTab}
                    onUpdate={handleTabChange}
                    options={[
                        { value: 'active', content: t('packages.tabActive') },
                        { value: 'archived', content: t('packages.tabArchived') }
                    ]}
                />
            </div>

            <Card style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '240px' }}>
                    <TextInput
                        placeholder={t('packages.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        hasClearable
                        size="l"
                        leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                    />
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                    <Select
                        value={selectedStatus}
                        onUpdate={handleStatusFilterChange}
                        options={[
                            { value: 'ALL', content: t('packages.allStatuses') },
                            { value: 'Bəyan edildi', content: t('packages.statusDeclared') },
                            { value: 'Yoldadır', content: t('packages.statusInTransit') },
                            { value: 'Gömrükdə', content: t('packages.statusCustoms') },
                            { value: 'Filialda', content: t('packages.statusAtBranch') }
                        ]}
                        size="l"
                        width="max"
                    />
                </div>

                {(searchQuery || selectedStatus[0] !== 'ALL') && (
                    <Button view="flat" size="l" onClick={() => { handleSearchChange(''); handleStatusFilterChange(['ALL']); }}>
                        {t('packages.resetButton')}
                    </Button>
                )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <Text variant="caption-2" color="secondary">
                    {t('packages.showingCount', { count: filteredPackages.length, total })}
                </Text>
            </div>

            <Card style={{ padding: '8px', overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><Loader size="l" /></div>
                ) : filteredPackages.length > 0 ? (
                    <Table data={filteredPackages} columns={columns} />
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Text variant="subheader-1" color="secondary">
                            {activeTab === 'active' ? t('packages.noPackagesActive') : t('packages.archiveEmpty')}
                        </Text>
                    </div>
                )}
            </Card>

            {total > PAGE_SIZE && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={total}
                        onUpdate={(newPage) => setPage(newPage)}
                    />
                </div>
            )}

            {/* MODALLAR */}
            <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.addModalTitle')}</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.trackingNumberRequiredLabel')}</Text>
                        <TextInput placeholder={t('packages.trackingNumberPlaceholder')} value={addFormData.trackingNumber} onChange={(e) => setAddFormData({ ...addFormData, trackingNumber: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.foreignWarehouseLabel')}</Text>
                        <Select
                            value={addFormData.warehouseId ? [String(addFormData.warehouseId)] : []}
                            onUpdate={(val) => setAddFormData({ ...addFormData, warehouseId: val[0] })}
                            options={warehouses.map((w) => ({ value: String(w.id), content: `${w.flag || ''} ${w.name} ($${parseFloat(w.ratePerKg).toFixed(2)}/kq)` }))}
                            placeholder={t('packages.warehousePlaceholder')}
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.weightLabel')}</Text>
                        <TextInput type="number" min="0" step="0.01" placeholder={t('packages.weightPlaceholder')} value={addFormData.weight} onChange={(e) => setAddFormData({ ...addFormData, weight: e.target.value })} />
                    </div>
                    {addFormData.weight && addFormData.warehouseId && (
                        <div style={{ padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                            <Text variant="caption-2" color="secondary">{t('packages.estimatedPriceLabel')}</Text>
                            <Text variant="subheader-2" style={{ display: 'block', color: '#56d364' }}>
                                ${estimatedPrice(addFormData.weight, addFormData.warehouseId)}
                            </Text>
                        </div>
                    )}
                    <div>
                        <Checkbox
                            checked={addFormData.isInsured}
                            onUpdate={(checked) => setAddFormData({ ...addFormData, isInsured: checked })}
                        >
                            <Icon data={ShieldCheck} size={14} style={{ marginRight: '4px' }} /> {t('packages.insureCheckbox', { percent: (INSURANCE_RATE * 100).toFixed(0) })}
                        </Checkbox>
                    </div>
                    {addFormData.isInsured && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.declaredValueLabel')}</Text>
                            <TextInput type="number" min="0" step="0.01" placeholder={t('packages.declaredValuePlaceholder')} value={addFormData.declaredValue} onChange={(e) => setAddFormData({ ...addFormData, declaredValue: e.target.value })} />
                            {addFormData.declaredValue && (
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                    {t('packages.insuranceFeeLabel', { amount: estimatedInsuranceFee(addFormData.declaredValue) })}
                                </Text>
                            )}
                        </div>
                    )}
                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>{t('packages.customsInfoTitle')}</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.hsCodeLabel')}</Text>
                        <TextInput placeholder={t('packages.hsCodePlaceholder')} value={addFormData.hsCode} onChange={(e) => setAddFormData({ ...addFormData, hsCode: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.itemDescriptionLabel')}</Text>
                        <TextInput placeholder={t('packages.itemDescriptionPlaceholder')} value={addFormData.itemDescription} onChange={(e) => setAddFormData({ ...addFormData, itemDescription: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.countryOfOriginLabel')}</Text>
                        <TextInput placeholder={t('packages.countryOfOriginPlaceholder')} value={addFormData.countryOfOrigin} onChange={(e) => setAddFormData({ ...addFormData, countryOfOrigin: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsAddModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleCreate}>{t('packages.addButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.editModalTitle')}</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.trackingNumberLabel')}</Text>
                        <TextInput value={editFormData.trackingNumber} onChange={(e) => setEditFormData({ ...editFormData, trackingNumber: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.weightLabel')}</Text>
                        <TextInput type="number" min="0" step="0.01" value={editFormData.weight} onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.priceLabel')}</Text>
                        {canChangeStatus ? (
                            <TextInput type="number" min="0" step="0.01" value={editFormData.price} onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} />
                        ) : (
                            <div style={{ padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                                <Text variant="subheader-2" style={{ color: '#56d364' }}>
                                    ${estimatedPrice(editFormData.weight, editFormData.warehouseId)}
                                </Text>
                                <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>{t('packages.autoCalculatedByWeight')}</Text>
                            </div>
                        )}
                    </div>
                    {canChangeStatus && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('claims.statusLabel')}</Text>
                            <Select
                                value={[editFormData.status]}
                                onUpdate={(val) => setEditFormData({ ...editFormData, status: val[0] })}
                                options={[
                                    { value: 'Bəyan edildi', content: t('packages.statusDeclared') },
                                    { value: 'Yoldadır', content: t('packages.statusInTransit') },
                                    { value: 'Gömrükdə', content: t('packages.statusCustoms') },
                                    { value: 'Filialda', content: t('packages.statusAtBranch') }
                                ]}
                                width="max"
                            />
                        </div>
                    )}
                    <div>
                        <Checkbox
                            checked={editFormData.isInsured}
                            onUpdate={(checked) => setEditFormData({ ...editFormData, isInsured: checked })}
                        >
                            <Icon data={ShieldCheck} size={14} style={{ marginRight: '4px' }} /> {t('packages.insureCheckbox', { percent: (INSURANCE_RATE * 100).toFixed(0) })}
                        </Checkbox>
                    </div>
                    {editFormData.isInsured && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.declaredValueLabel')}</Text>
                            <TextInput type="number" min="0" step="0.01" value={editFormData.declaredValue} onChange={(e) => setEditFormData({ ...editFormData, declaredValue: e.target.value })} />
                            {editFormData.declaredValue && (
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                    {t('packages.insuranceFeeLabel', { amount: estimatedInsuranceFee(editFormData.declaredValue) })}
                                </Text>
                            )}
                        </div>
                    )}
                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>{t('packages.customsInfoTitle')}</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.hsCodeLabel')}</Text>
                        <TextInput placeholder={t('packages.hsCodePlaceholder')} value={editFormData.hsCode} onChange={(e) => setEditFormData({ ...editFormData, hsCode: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.itemDescriptionLabel')}</Text>
                        <TextInput placeholder={t('packages.itemDescriptionPlaceholder')} value={editFormData.itemDescription} onChange={(e) => setEditFormData({ ...editFormData, itemDescription: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.countryOfOriginLabel')}</Text>
                        <TextInput placeholder={t('packages.countryOfOriginPlaceholder')} value={editFormData.countryOfOrigin} onChange={(e) => setEditFormData({ ...editFormData, countryOfOrigin: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsEditModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleUpdate}>{t('claims.saveButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.historyModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{t('packages.trackingNumberColon')} <strong>{historyTrackingNumber}</strong></Text>

                    {historyLoading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}><Loader size="m" /></div>
                    ) : historyData.length === 0 ? (
                        <Text color="secondary">{t('packages.historyNotFound')}</Text>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {historyData.map((h, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: idx === historyData.length - 1 ? '#a78bfa' : '#30363d',
                                        flexShrink: 0
                                    }} />
                                    <Text variant="body-2" style={{ fontWeight: idx === historyData.length - 1 ? 600 : 400 }}>
                                        {statusLabel(h.status)}
                                    </Text>
                                    <Text variant="caption-2" color="secondary" style={{ marginLeft: 'auto' }}>
                                        {new Date(h.changedAt).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsHistoryModalOpen(false)}>{t('finance.closeButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.assignModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{t('packages.trackingNumberColon')} <strong>{assignTarget?.trackingNumber}</strong></Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.courierLabel')}</Text>
                        <Select
                            value={assignCourierId ? [assignCourierId] : []}
                            onUpdate={(val) => setAssignCourierId(val[0] || '')}
                            options={[
                                { value: '', content: t('packages.unassignOption') },
                                ...couriers.map((c) => ({ value: String(c.id), content: `${c.firstName} ${c.lastName} (${c.email})` }))
                            ]}
                            placeholder={t('packages.courierPlaceholder')}
                            width="max"
                        />
                        {couriers.length === 0 && (
                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                {t('packages.noCouriersFound')}
                            </Text>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsAssignModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleAssignCourier} loading={assignSaving}>{t('claims.saveButton')}</Button>
                    </div>
                </div>
            </Modal>

            <BarcodeModal
                open={isBarcodeModalOpen}
                onClose={() => setIsBarcodeModalOpen(false)}
                pkg={barcodeTarget}
            />

            <Modal open={isConsolidateModalOpen} onClose={() => setIsConsolidateModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.consolidateModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">
                        {t('packages.consolidateIntro', { count: selectedPackagesForConsolidation.length })}
                    </Text>
                    <Card style={{ padding: '12px', backgroundColor: '#0d1117', maxHeight: '120px', overflowY: 'auto' }}>
                        {selectedPackagesForConsolidation.map((p) => (
                            <Text key={p.id} variant="body-2" style={{ display: 'block' }}>
                                {p.trackingNumber} — {parseFloat(p.weight).toFixed(2)} kq {t('packages.declaredSuffix')}
                            </Text>
                        ))}
                    </Card>

                    {consolidateError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {consolidateError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.newTrackingNumberLabel')}</Text>
                        <TextInput placeholder={t('packages.newTrackingNumberPlaceholder')} value={consolidateTrackingNumber} onChange={(e) => setConsolidateTrackingNumber(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.actualWeightLabel')}</Text>
                        <TextInput type="number" min="0" step="0.01" placeholder={t('packages.actualWeightPlaceholder')} value={consolidateActualWeight} onChange={(e) => setConsolidateActualWeight(e.target.value)} />
                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                            {t('packages.totalDeclaredWeightHint', { weight: totalDeclaredWeight.toFixed(2) })}
                        </Text>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsConsolidateModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleConsolidate} loading={consolidateSaving}>{t('packages.consolidateButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isReceivingModalOpen} onClose={() => setIsReceivingModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.receivingModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{t('packages.trackingNumberColon')} <strong>{receivingTarget?.trackingNumber}</strong></Text>
                    <Text variant="body-2" color="secondary">
                        {t('packages.customerDeclaredWeightLabel')} <strong>{receivingTarget ? parseFloat(receivingTarget.weight).toFixed(2) : '0.00'} kq</strong>
                    </Text>

                    {receivingError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {receivingError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.actualWeightAtWarehouseLabel')}</Text>
                        <TextInput type="number" min="0" step="0.01" value={receivingActualWeight} onChange={(e) => setReceivingActualWeight(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('packages.photoLabel')}</Text>
                        <input type="file" accept="image/*" onChange={(e) => setReceivingPhotoFile(e.target.files[0] || null)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsReceivingModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleConfirmReceiving} loading={receivingSaving}>{t('packages.confirmButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isStorageModalOpen} onClose={() => setIsStorageModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.storageModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{t('packages.trackingNumberColon')} <strong>{storageTarget?.trackingNumber}</strong></Text>

                    {storageError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {storageError}
                        </div>
                    )}

                    {storageLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader size="m" /></div>
                    ) : storageFeeData && (
                        <>
                            <Text variant="body-2" color="secondary">
                                {t('packages.arrivalDateLabel')} <strong>{new Date(storageFeeData.arrivedAtBranchAt).toLocaleDateString(locale)}</strong>
                            </Text>
                            <Text variant="body-2" color="secondary">
                                {t('packages.freeDaysLabel')} <strong>{storageFeeData.freeDays} {t('packages.daysUnit')}</strong> · {t('packages.dailyRateLabel')} <strong>${parseFloat(storageFeeData.dailyRate).toFixed(2)}</strong>
                            </Text>
                            <Text variant="body-2" color="secondary">
                                {t('packages.overdueLabel')} <strong>{storageFeeData.overdueDays} {t('packages.daysUnit')}</strong> · {t('packages.accruedFeeLabel')} <strong>${storageFeeData.totalAccrued.toFixed(2)}</strong>
                            </Text>
                            {storageFeeData.storageFeePaid > 0 && (
                                <Text variant="body-2" color="secondary">
                                    {t('packages.paidLabel')} <strong>${storageFeeData.storageFeePaid.toFixed(2)}</strong>
                                </Text>
                            )}
                            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: storageFeeData.outstanding > 0 ? '#3d1618' : '#13231b', border: `1px solid ${storageFeeData.outstanding > 0 ? '#f85149' : '#2ea043'}` }}>
                                <Text variant="subheader-1" style={{ color: storageFeeData.outstanding > 0 ? '#ff7b72' : '#56d364' }}>
                                    {t('packages.amountDueLabel', { amount: storageFeeData.outstanding.toFixed(2) })}
                                </Text>
                            </div>

                            {storageFeeData.outstanding > 0 && storageTarget?.userId === currentUser.id && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                                    <Button view="action" onClick={handlePayStorageFee} loading={storagePaying}>{t('packages.payFromBalanceButton')}</Button>
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <Button view="flat" onClick={() => setIsStorageModalOpen(false)}>{t('finance.closeButton')}</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isDutyModalOpen} onClose={() => setIsDutyModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('packages.dutyModalTitle')}</Text>
                    <Text variant="body-2" color="secondary">{t('packages.trackingNumberColon')} <strong>{dutyTarget?.trackingNumber}</strong></Text>

                    {dutyError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {dutyError}
                        </div>
                    )}

                    {dutyLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader size="m" /></div>
                    ) : dutyData && (
                        <>
                            <Text variant="body-2" color="secondary">
                                {t('packages.customsValueLabel')} <strong>${dutyData.customsValue.toFixed(2)}</strong>
                                {!dutyData.usedDeclaredValue && t('packages.basedOnCalculatedPrice')}
                            </Text>
                            <Text variant="body-2" color="secondary">
                                {t('packages.deMinimisLabel')} <strong>${dutyData.deMinimisThreshold.toFixed(2)}</strong>
                            </Text>
                            {dutyData.matchedCategory ? (
                                <Text variant="body-2" color="secondary">
                                    {t('packages.categoryLabel')} <strong>{dutyData.matchedCategory}</strong> · {t('packages.dutyRateLabel')} <strong>{dutyData.dutyRatePercent.toFixed(2)}%</strong>
                                </Text>
                            ) : (
                                <Text variant="body-2" color="secondary">{t('packages.belowDeMinimis')}</Text>
                            )}
                            <Text variant="body-2" color="secondary">
                                {t('packages.calculatedDutyLabel')} <strong>${dutyData.totalDuty.toFixed(2)}</strong>
                            </Text>
                            {dutyData.customsDutyPaid > 0 && (
                                <Text variant="body-2" color="secondary">
                                    {t('packages.paidLabel')} <strong>${dutyData.customsDutyPaid.toFixed(2)}</strong>
                                </Text>
                            )}
                            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: dutyData.outstanding > 0 ? '#3d1618' : '#13231b', border: `1px solid ${dutyData.outstanding > 0 ? '#f85149' : '#2ea043'}` }}>
                                <Text variant="subheader-1" style={{ color: dutyData.outstanding > 0 ? '#ff7b72' : '#56d364' }}>
                                    {t('packages.amountDueLabel', { amount: dutyData.outstanding.toFixed(2) })}
                                </Text>
                            </div>

                            {dutyData.outstanding > 0 && dutyTarget?.userId === currentUser.id && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                                    <Button view="action" onClick={handlePayDuty} loading={dutyPaying}>{t('packages.payFromBalanceButton')}</Button>
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <Button view="flat" onClick={() => setIsDutyModalOpen(false)}>{t('finance.closeButton')}</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default Packages;

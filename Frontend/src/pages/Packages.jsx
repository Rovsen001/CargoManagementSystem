import React, { useState, useEffect } from 'react';
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
    Wallet
} from '@gravity-ui/icons';
import api from '../services/api';
import BarcodeModal from '../components/Packages/BarcodeModal';
import { generateCommercialInvoice } from '../utils/commercialInvoice';

const API_ORIGIN = 'http://localhost:5000';

const Packages = () => {
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
        if (value === '' || isNaN(num)) return `${fieldName} üçün rəqəm daxil edin!`;
        if (num < 0) return `${fieldName} mənfi ola bilməz!`;
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
            alert(error.response?.data?.message || "Kuryer təyin edilərkən xəta baş verdi.");
        } finally {
            setAssignSaving(false);
        }
    };

    const handleCourierStatusUpdate = async (id, newStatus) => {
        try {
            await api.put(`/packages/${id}/courier-status`, { status: newStatus });
            fetchPackages();
        } catch (error) {
            alert(error.response?.data?.message || "Status yenilənərkən xəta baş verdi.");
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
            setConsolidateError('Yeni trek nömrəsini daxil edin!');
            return;
        }
        const weightError = validateNonNegativeNumber(consolidateActualWeight, "Real çəki");
        if (weightError || parseFloat(consolidateActualWeight) <= 0) {
            setConsolidateError('Real çəki müsbət rəqəm olmalıdır!');
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
            setConsolidateError(error.response?.data?.message || "Konsolidasiya edilərkən xəta baş verdi.");
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
        const weightError = validateNonNegativeNumber(receivingActualWeight, "Real çəki");
        if (weightError || parseFloat(receivingActualWeight) <= 0) {
            setReceivingError('Real çəki müsbət rəqəm olmalıdır!');
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
            setReceivingError(error.response?.data?.message || "Təsdiqlənərkən xəta baş verdi.");
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
            setStorageError(error.response?.data?.message || "Anbar haqqı hesablanarkən xəta baş verdi.");
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
            setStorageError(error.response?.data?.message || "Ödəniş zamanı xəta baş verdi.");
        } finally {
            setStoragePaying(false);
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
        if (!addFormData.trackingNumber.trim()) return alert("Trek nömrəsini daxil edin!");
        const weightError = validateNonNegativeNumber(addFormData.weight, "Çəki");
        if (weightError) return alert(weightError);
        if (!addFormData.warehouseId) return alert("Anbar seçin!");
        if (addFormData.isInsured) {
            const declaredValueError = validateNonNegativeNumber(addFormData.declaredValue, "Bəyan edilmiş dəyər");
            if (declaredValueError || parseFloat(addFormData.declaredValue) <= 0) return alert("Sığorta üçün bəyan edilmiş dəyər müsbət rəqəm olmalıdır!");
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
            alert(error.response?.data?.message || "Bağlama yaradılarkən xəta baş verdi.");
        }
    };

    const handleUpdate = async () => {
        if (!editFormData.trackingNumber.trim()) return alert("Trek nömrəsini daxil edin!");
        const weightError = validateNonNegativeNumber(editFormData.weight, "Çəki");
        if (weightError) return alert(weightError);
        if (canChangeStatus) {
            const priceError = validateNonNegativeNumber(editFormData.price, "Qiymət");
            if (priceError) return alert(priceError);
        }
        if (editFormData.isInsured) {
            const declaredValueError = validateNonNegativeNumber(editFormData.declaredValue, "Bəyan edilmiş dəyər");
            if (declaredValueError || parseFloat(editFormData.declaredValue) <= 0) return alert("Sığorta üçün bəyan edilmiş dəyər müsbət rəqəm olmalıdır!");
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
        if (window.confirm("Bu bağlama Zibil Qutusuna (Arxivə) göndərilsin?")) {
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
        if (window.confirm("DİQQƏT! Bu bağlama verilənlər bazasından HƏMİŞƏLİK silinəcək. Əminsiniz?")) {
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
        if (filteredPackages.length === 0) return alert("Eksport üçün məlumat yoxdur!");

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
        <h2>${activeTab === 'active' ? 'Aktiv Bağlamalar' : 'Arxivdəki Bağlamalar'}</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>Trek Nömrəsi</th><th>Çəki (kq)</th><th>Qiymət ($)</th><th>Status</th><th>Tarix</th></tr>
          </thead>
          <tbody>
            ${filteredPackages.map(pkg => `
              <tr>
                <td>${pkg.id}</td>
                <td><b>${pkg.trackingNumber || ''}</b></td>
                <td>${parseFloat(pkg.weight).toFixed(2)} kq</td>
                <td>$${parseFloat(pkg.price).toFixed(2)}</td>
                <td>${pkg.status || ''}</td>
                <td>${pkg.createdAt ? new Date(pkg.createdAt).toLocaleDateString('az-AZ') : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

        const blob = new Blob(['\uFEFF' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
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
        return <Label theme={themeMap[status] || 'normal'}>{status || 'Təyin edilməyib'}</Label>;
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
        { id: 'id', name: 'ID', meta: { width: '60px' } },
        { id: 'trackingNumber', name: 'Trek Nömrəsi', template: (item) => <strong>{item.trackingNumber}</strong> },
        { id: 'weight', name: 'Çəki (kq)', template: (item) => `${parseFloat(item.weight).toFixed(2)} kq` },
        { id: 'price', name: 'Qiymət ($)', template: (item) => `$${parseFloat(item.price).toFixed(2)}` },
        {
            id: 'insurance',
            name: 'Sığorta',
            template: (item) => item.isInsured
                ? <Label theme="success" icon={<Icon data={ShieldCheck} size={14} />}>${parseFloat(item.declaredValue).toFixed(2)}</Label>
                : <Text color="secondary">—</Text>
        },
        ...(canConsolidate ? [{
            id: 'receiving',
            name: 'Anbar Təsdiqi',
            template: (item) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Label theme={item.weightConfirmed ? 'success' : 'normal'}>
                        {item.weightConfirmed ? 'Təsdiqlənib' : 'Təsdiqlənməyib'}
                    </Label>
                    {item.receivingPhotoUrl && (
                        <a href={`${API_ORIGIN}${item.receivingPhotoUrl}`} target="_blank" rel="noopener noreferrer">
                            <img src={`${API_ORIGIN}${item.receivingPhotoUrl}`} alt="Qəbul şəkli" width={28} height={28} style={{ borderRadius: '4px', objectFit: 'cover', border: '1px solid #30363d' }} />
                        </a>
                    )}
                </div>
            )
        }] : []),
        {
            id: 'status',
            name: 'Status',
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
            name: 'Kuryer',
            template: (item) => courierName(item.assignedCourierId)
                ? <Label theme="normal">{courierName(item.assignedCourierId)}</Label>
                : <Text color="secondary">Təyin edilməyib</Text>
        }] : []),
        {
            id: 'createdAt',
            name: 'Tarix',
            template: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString('az-AZ') : '—'
        },
        {
            id: 'actions',
            name: 'Əməliyyatlar',
            template: (item) => (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {activeTab === 'active' ? (
                        isCourierUser ? (
                            <>
                                <Select
                                    value={[item.status || 'Yoldadır']}
                                    onUpdate={(val) => handleCourierStatusUpdate(item.id, val[0])}
                                    options={[
                                        { value: 'Yoldadır', content: 'Yoldadır' },
                                        { value: 'Gömrükdə', content: 'Gömrükdə' },
                                        { value: 'Filialda', content: 'Filialda' },
                                        { value: 'Təhvil verildi', content: 'Təhvil verildi' }
                                    ]}
                                    size="s"
                                />
                                <Button view="flat-secondary" size="s" onClick={() => openHistoryModal(item)} title="Tarixçəyə Bax">
                                    <Icon data={Clock} />
                                </Button>
                                <Button view="flat-secondary" size="s" onClick={() => openBarcodeModal(item)} title="Barkod / QR Kod">
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
                                        { value: 'Bəyan edildi', content: 'Bəyan edildi' },
                                        { value: 'Yoldadır', content: 'Yoldadır' },
                                        { value: 'Gömrükdə', content: 'Gömrükdə' },
                                        { value: 'Filialda', content: 'Filialda' }
                                    ]}
                                    size="s"
                                />
                            )}
                            <Button view="flat-secondary" size="s" onClick={() => openEditModal(item)} title="Redaktə Et">
                                <Icon data={Pencil} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => openHistoryModal(item)} title="Tarixçəyə Bax">
                                <Icon data={Clock} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => openBarcodeModal(item)} title="Barkod / QR Kod">
                                <Icon data={QrCode} />
                            </Button>
                            <Button view="flat-secondary" size="s" onClick={() => generateCommercialInvoice(item)} title="Kommersiya Fakturası (PDF)">
                                <Icon data={FileText} />
                            </Button>
                            {item.arrivedAtBranchAt && (
                                <Button view="flat-secondary" size="s" onClick={() => openStorageModal(item)} title="Anbar Saxlama Haqqı">
                                    <Icon data={Wallet} />
                                </Button>
                            )}
                            {canConsolidate && (
                                <Button view="flat-secondary" size="s" onClick={() => openReceivingModal(item)} title="Anbarda Çəkini Təsdiqlə">
                                    <Icon data={WeightHanging} />
                                </Button>
                            )}
                            {canAssignCourier && (
                                <Button view="flat-secondary" size="s" onClick={() => openAssignModal(item)} title="Kuryer Təyin Et">
                                    <Icon data={PersonWorker} />
                                </Button>
                            )}
                            <Button view="flat-warning" size="s" onClick={() => handleSoftDelete(item.id)} title="Zibil Qutusuna At">
                                <Icon data={TrashBin} />
                            </Button>
                        </>
                        )
                    ) : (
                        <>
                            {/* Bərpa və Tam silmə - icazəyə görə ayrı-ayrı */}
                            {canRestore && (
                                <Button view="action" size="s" onClick={() => handleRestore(item.id)}>
                                    <Icon data={ArrowRotateLeft} /> Bərpa Et
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
                        {isCourierUser ? "Mənə Təyin Olunmuş Bağlamalar" : canViewAll ? "Bütün Bağlamalar" : "Mənim Bağlamalarım"}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {isCourierUser ? "Sizə həvalə edilmiş bağlamaların statusunu yeniləyin." : canViewAll ? "Sistemdəki bütün istifadəçi bağlamalarını idarə edin." : "Sifariş etdiyiniz bağlamaları bəyan edin və izləyin."}
                    </Text>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button view="outlined" size="l" onClick={handleExportExcel}>
                        <Icon data={ArrowDownToSquare} />
                        Excel-ə Çıxar (.xls)
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
                            Yeni Bağlama Bəyan Et
                        </Button>
                    )}
                </div>
            </div>

            {canConsolidate && selectedForConsolidation.length >= 2 && (
                <Card style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6' }}>
                    <Text variant="body-2">{selectedForConsolidation.length} bağlama seçildi (ümumi bəyan edilmiş çəki: {totalDeclaredWeight.toFixed(2)} kq)</Text>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Button view="flat" size="s" onClick={() => setSelectedForConsolidation([])}>Seçimi Ləğv Et</Button>
                        <Button view="action" size="s" onClick={openConsolidateModal}>
                            <Icon data={Layers} /> Konsolidasiya Et
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
                        { value: 'active', content: 'Aktiv Bağlamalar' },
                        { value: 'archived', content: 'Zibil Qutusu (Arxiv)' }
                    ]}
                />
            </div>

            <Card style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '240px' }}>
                    <TextInput
                        placeholder="Trek nömrəsi ilə canlı axtarış..."
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
                            { value: 'ALL', content: 'Bütün Statuslar' },
                            { value: 'Bəyan edildi', content: 'Bəyan edildi' },
                            { value: 'Yoldadır', content: 'Yoldadır' },
                            { value: 'Gömrükdə', content: 'Gömrükdə' },
                            { value: 'Filialda', content: 'Filialda' }
                        ]}
                        size="l"
                        width="max"
                    />
                </div>

                {(searchQuery || selectedStatus[0] !== 'ALL') && (
                    <Button view="flat" size="l" onClick={() => { handleSearchChange(''); handleStatusFilterChange(['ALL']); }}>
                        Sıfırla
                    </Button>
                )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <Text variant="caption-2" color="secondary">
                    Göstərilir: <strong>{filteredPackages.length}</strong> / {total} bağlama
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
                            {activeTab === 'active' ? 'Bağlama tapılmadı.' : 'Zibil qutusu boşdur.'}
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
                    <Text variant="header-1">Yeni Bağlama Bəyanı</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Trek Nömrəsi *</Text>
                        <TextInput placeholder="Məs: AZ12345678" value={addFormData.trackingNumber} onChange={(e) => setAddFormData({ ...addFormData, trackingNumber: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Xarici Anbar *</Text>
                        <Select
                            value={addFormData.warehouseId ? [String(addFormData.warehouseId)] : []}
                            onUpdate={(val) => setAddFormData({ ...addFormData, warehouseId: val[0] })}
                            options={warehouses.map((w) => ({ value: String(w.id), content: `${w.flag || ''} ${w.name} ($${parseFloat(w.ratePerKg).toFixed(2)}/kq)` }))}
                            placeholder="Anbar seçin"
                            width="max"
                        />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Çəki (kq)</Text>
                        <TextInput type="number" min="0" step="0.01" placeholder="Məs: 1.5" value={addFormData.weight} onChange={(e) => setAddFormData({ ...addFormData, weight: e.target.value })} />
                    </div>
                    {addFormData.weight && addFormData.warehouseId && (
                        <div style={{ padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                            <Text variant="caption-2" color="secondary">Təxmini Qiymət (avtomatik hesablanır)</Text>
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
                            <Icon data={ShieldCheck} size={14} style={{ marginRight: '4px' }} /> Bağlamanı sığortala ({(INSURANCE_RATE * 100).toFixed(0)}% haqq)
                        </Checkbox>
                    </div>
                    {addFormData.isInsured && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Bəyan Edilmiş Dəyər ($) *</Text>
                            <TextInput type="number" min="0" step="0.01" placeholder="Məs: 100" value={addFormData.declaredValue} onChange={(e) => setAddFormData({ ...addFormData, declaredValue: e.target.value })} />
                            {addFormData.declaredValue && (
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                    Sığorta haqqı: ${estimatedInsuranceFee(addFormData.declaredValue)}
                                </Text>
                            )}
                        </div>
                    )}
                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>Gömrük Məlumatları (könüllü)</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>HS Kodu</Text>
                        <TextInput placeholder="Məs: 6109.10" value={addFormData.hsCode} onChange={(e) => setAddFormData({ ...addFormData, hsCode: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mal Təsviri</Text>
                        <TextInput placeholder="Məs: Pambıq t-shirt" value={addFormData.itemDescription} onChange={(e) => setAddFormData({ ...addFormData, itemDescription: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mənşə Ölkəsi</Text>
                        <TextInput placeholder="Məs: Türkiyə" value={addFormData.countryOfOrigin} onChange={(e) => setAddFormData({ ...addFormData, countryOfOrigin: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsAddModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleCreate}>Əlavə et</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Bağlamanı Redaktə Et</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Trek Nömrəsi</Text>
                        <TextInput value={editFormData.trackingNumber} onChange={(e) => setEditFormData({ ...editFormData, trackingNumber: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Çəki (kq)</Text>
                        <TextInput type="number" min="0" step="0.01" value={editFormData.weight} onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Qiymət ($)</Text>
                        {canChangeStatus ? (
                            <TextInput type="number" min="0" step="0.01" value={editFormData.price} onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} />
                        ) : (
                            <div style={{ padding: '10px 14px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #21262d' }}>
                                <Text variant="subheader-2" style={{ color: '#56d364' }}>
                                    ${estimatedPrice(editFormData.weight, editFormData.warehouseId)}
                                </Text>
                                <Text variant="caption-2" color="secondary" style={{ display: 'block' }}>Çəkiyə görə avtomatik hesablanır</Text>
                            </div>
                        )}
                    </div>
                    {canChangeStatus && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Status</Text>
                            <Select
                                value={[editFormData.status]}
                                onUpdate={(val) => setEditFormData({ ...editFormData, status: val[0] })}
                                options={[
                                    { value: 'Bəyan edildi', content: 'Bəyan edildi' },
                                    { value: 'Yoldadır', content: 'Yoldadır' },
                                    { value: 'Gömrükdə', content: 'Gömrükdə' },
                                    { value: 'Filialda', content: 'Filialda' }
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
                            <Icon data={ShieldCheck} size={14} style={{ marginRight: '4px' }} /> Bağlamanı sığortala ({(INSURANCE_RATE * 100).toFixed(0)}% haqq)
                        </Checkbox>
                    </div>
                    {editFormData.isInsured && (
                        <div>
                            <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Bəyan Edilmiş Dəyər ($) *</Text>
                            <TextInput type="number" min="0" step="0.01" value={editFormData.declaredValue} onChange={(e) => setEditFormData({ ...editFormData, declaredValue: e.target.value })} />
                            {editFormData.declaredValue && (
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                    Sığorta haqqı: ${estimatedInsuranceFee(editFormData.declaredValue)}
                                </Text>
                            )}
                        </div>
                    )}
                    <Text variant="subheader-2" style={{ marginTop: '4px' }}>Gömrük Məlumatları (könüllü)</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>HS Kodu</Text>
                        <TextInput placeholder="Məs: 6109.10" value={editFormData.hsCode} onChange={(e) => setEditFormData({ ...editFormData, hsCode: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mal Təsviri</Text>
                        <TextInput placeholder="Məs: Pambıq t-shirt" value={editFormData.itemDescription} onChange={(e) => setEditFormData({ ...editFormData, itemDescription: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mənşə Ölkəsi</Text>
                        <TextInput placeholder="Məs: Türkiyə" value={editFormData.countryOfOrigin} onChange={(e) => setEditFormData({ ...editFormData, countryOfOrigin: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsEditModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleUpdate}>Yadda saxla</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Status Tarixçəsi</Text>
                    <Text variant="body-2" color="secondary">Trek Nömrəsi: <strong>{historyTrackingNumber}</strong></Text>

                    {historyLoading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}><Loader size="m" /></div>
                    ) : historyData.length === 0 ? (
                        <Text color="secondary">Tarixçə tapılmadı.</Text>
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
                                        {h.status}
                                    </Text>
                                    <Text variant="caption-2" color="secondary" style={{ marginLeft: 'auto' }}>
                                        {new Date(h.changedAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsHistoryModalOpen(false)}>Bağla</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Kuryer Təyin Et</Text>
                    <Text variant="body-2" color="secondary">Trek Nömrəsi: <strong>{assignTarget?.trackingNumber}</strong></Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Kuryer</Text>
                        <Select
                            value={assignCourierId ? [assignCourierId] : []}
                            onUpdate={(val) => setAssignCourierId(val[0] || '')}
                            options={[
                                { value: '', content: 'Təyinatı ləğv et' },
                                ...couriers.map((c) => ({ value: String(c.id), content: `${c.firstName} ${c.lastName} (${c.email})` }))
                            ]}
                            placeholder="Kuryer seçin"
                            width="max"
                        />
                        {couriers.length === 0 && (
                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '6px' }}>
                                Sistemdə kuryer rolunda istifadəçi tapılmadı.
                            </Text>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsAssignModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleAssignCourier} loading={assignSaving}>Yadda saxla</Button>
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
                    <Text variant="header-1">Bağlamaları Konsolidasiya Et</Text>
                    <Text variant="body-2" color="secondary">
                        Seçilmiş {selectedPackagesForConsolidation.length} bağlama tək bir bağlamaya birləşdiriləcək:
                    </Text>
                    <Card style={{ padding: '12px', backgroundColor: '#0d1117', maxHeight: '120px', overflowY: 'auto' }}>
                        {selectedPackagesForConsolidation.map((p) => (
                            <Text key={p.id} variant="body-2" style={{ display: 'block' }}>
                                {p.trackingNumber} — {parseFloat(p.weight).toFixed(2)} kq (bəyan edilmiş)
                            </Text>
                        ))}
                    </Card>

                    {consolidateError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {consolidateError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Yeni Trek Nömrəsi *</Text>
                        <TextInput placeholder="Məs: CONSOL-00123" value={consolidateTrackingNumber} onChange={(e) => setConsolidateTrackingNumber(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Real Ölçülmüş Ümumi Çəki (kq) *</Text>
                        <TextInput type="number" min="0" step="0.01" placeholder="Anbarda ölçülən son çəki" value={consolidateActualWeight} onChange={(e) => setConsolidateActualWeight(e.target.value)} />
                        <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                            Bəyan edilmiş cəmi çəki: {totalDeclaredWeight.toFixed(2)} kq (istinad üçün — real çəki fərqli ola bilər)
                        </Text>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsConsolidateModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleConsolidate} loading={consolidateSaving}>Konsolidasiya Et</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isReceivingModalOpen} onClose={() => setIsReceivingModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Anbarda Çəkini Təsdiqlə</Text>
                    <Text variant="body-2" color="secondary">Trek Nömrəsi: <strong>{receivingTarget?.trackingNumber}</strong></Text>
                    <Text variant="body-2" color="secondary">
                        Müştərinin bəyan etdiyi çəki: <strong>{receivingTarget ? parseFloat(receivingTarget.weight).toFixed(2) : '0.00'} kq</strong>
                    </Text>

                    {receivingError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {receivingError}
                        </div>
                    )}

                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Anbarda Ölçülən Real Çəki (kq) *</Text>
                        <TextInput type="number" min="0" step="0.01" value={receivingActualWeight} onChange={(e) => setReceivingActualWeight(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Bağlamanın Şəkli (könüllü)</Text>
                        <input type="file" accept="image/*" onChange={(e) => setReceivingPhotoFile(e.target.files[0] || null)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsReceivingModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleConfirmReceiving} loading={receivingSaving}>Təsdiqlə</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={isStorageModalOpen} onClose={() => setIsStorageModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Anbar Saxlama Haqqı</Text>
                    <Text variant="body-2" color="secondary">Trek Nömrəsi: <strong>{storageTarget?.trackingNumber}</strong></Text>

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
                                Anbara çatma tarixi: <strong>{new Date(storageFeeData.arrivedAtBranchAt).toLocaleDateString('az-AZ')}</strong>
                            </Text>
                            <Text variant="body-2" color="secondary">
                                Pulsuz saxlama müddəti: <strong>{storageFeeData.freeDays} gün</strong> · Günlük tarif: <strong>${parseFloat(storageFeeData.dailyRate).toFixed(2)}</strong>
                            </Text>
                            <Text variant="body-2" color="secondary">
                                Gecikmə: <strong>{storageFeeData.overdueDays} gün</strong> · Yaranmış haqq: <strong>${storageFeeData.totalAccrued.toFixed(2)}</strong>
                            </Text>
                            {storageFeeData.storageFeePaid > 0 && (
                                <Text variant="body-2" color="secondary">
                                    Ödənilmiş: <strong>${storageFeeData.storageFeePaid.toFixed(2)}</strong>
                                </Text>
                            )}
                            <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: storageFeeData.outstanding > 0 ? '#3d1618' : '#13231b', border: `1px solid ${storageFeeData.outstanding > 0 ? '#f85149' : '#2ea043'}` }}>
                                <Text variant="subheader-1" style={{ color: storageFeeData.outstanding > 0 ? '#ff7b72' : '#56d364' }}>
                                    Ödəniləcək məbləğ: ${storageFeeData.outstanding.toFixed(2)}
                                </Text>
                            </div>

                            {storageFeeData.outstanding > 0 && storageTarget?.userId === currentUser.id && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                                    <Button view="action" onClick={handlePayStorageFee} loading={storagePaying}>Balansdan Ödə</Button>
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <Button view="flat" onClick={() => setIsStorageModalOpen(false)}>Bağla</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default Packages;
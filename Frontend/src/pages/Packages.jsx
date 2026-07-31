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
    Icon
} from '@gravity-ui/uikit';
import {
    Magnifier,
    Plus,
    TrashBin,
    ArrowDownToSquare,
    Pencil,
    ArrowRotateLeft,
    Xmark
} from '@gravity-ui/icons';
import api from '../services/api';

const Packages = () => {
    // Daxil olan istifadəçini localStroage-dən götürürük
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const hasPermission = (key) => Boolean(currentUser.isSuperAdmin || currentUser.permissions?.includes(key));
    const canViewAll = hasPermission('packages.viewAll');
    const canChangeStatus = hasPermission('packages.changeStatus');
    const canRestore = hasPermission('packages.restore');
    const canHardDelete = hasPermission('packages.hardDelete');

    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(['ALL']);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormData, setAddFormData] = useState({ trackingNumber: '', weight: '', price: '' });

    // Çəki/Qiymət kimi sərbəst mətn sahələrindəki ədədin mənfi olmadığını yoxlayır
    const validateNonNegativeNumber = (value, fieldName) => {
        if (!/\d/.test(String(value))) return `${fieldName} üçün rəqəm daxil edin!`;
        if (/-/.test(String(value))) return `${fieldName} mənfi ola bilməz!`;
        return null;
    };

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ id: null, trackingNumber: '', weight: '', price: '', status: '' });

    // Bazadan Məlumatları Çəkmək (Rola uyğun olaraq)
    const fetchPackages = async () => {
        setLoading(true);
        try {
            const isArchived = activeTab === 'archived';
            const response = await api.get(`/packages?archived=${isArchived}&userId=${currentUser.id}&role=${currentUser.role}`);
            if (Array.isArray(response.data)) {
                setPackages(response.data);
            } else {
                setPackages([]);
            }
        } catch (error) {
            console.error("Məlumat çəkilərkən xəta:", error);
            setPackages([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, [activeTab]);

    // Yeni Bağlama Yaratmaq (userId əlavə olunur)
    const handleCreate = async () => {
        if (!addFormData.trackingNumber.trim()) return alert("Trek nömrəsini daxil edin!");
        const weightError = validateNonNegativeNumber(addFormData.weight, "Çəki");
        if (weightError) return alert(weightError);
        const priceError = validateNonNegativeNumber(addFormData.price, "Qiymət");
        if (priceError) return alert(priceError);
        try {
            await api.post('/packages', {
                ...addFormData,
                userId: currentUser.id
            });
            setIsAddModalOpen(false);
            setAddFormData({ trackingNumber: '', weight: '', price: '' });
            fetchPackages();
        } catch (error) {
            console.error("Yaradılarkən xəta:", error);
        }
    };

    const handleUpdate = async () => {
        if (!editFormData.trackingNumber.trim()) return alert("Trek nömrəsini daxil edin!");
        const weightError = validateNonNegativeNumber(editFormData.weight, "Çəki");
        if (weightError) return alert(weightError);
        const priceError = validateNonNegativeNumber(editFormData.price, "Qiymət");
        if (priceError) return alert(priceError);
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
            status: item.status || 'Bəyan edildi'
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

    const safePackages = Array.isArray(packages) ? packages : [];
    const filteredPackages = safePackages.filter((pkg) => {
        const matchesSearch = pkg.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const currentFilter = selectedStatus[0] || 'ALL';
        const matchesStatus = currentFilter === 'ALL' || pkg.status === currentFilter;
        return matchesSearch && matchesStatus;
    });

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
                <td>${pkg.weight || ''}</td>
                <td>${pkg.price || ''}</td>
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
        const themeMap = { 'Bəyan edildi': 'info', 'Yoldadır': 'warning', 'Gömrükdə': 'danger', 'Filialda': 'success' };
        return <Label theme={themeMap[status] || 'normal'}>{status || 'Təyin edilməyib'}</Label>;
    };

    const columns = [
        { id: 'id', name: 'ID', meta: { width: '60px' } },
        { id: 'trackingNumber', name: 'Trek Nömrəsi', template: (item) => <strong>{item.trackingNumber}</strong> },
        { id: 'weight', name: 'Çəki (kq)' },
        { id: 'price', name: 'Qiymət ($)' },
        { id: 'status', name: 'Status', template: (item) => renderStatusBadge(item.status) },
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
                            <Button view="flat-warning" size="s" onClick={() => handleSoftDelete(item.id)} title="Zibil Qutusuna At">
                                <Icon data={TrashBin} />
                            </Button>
                        </>
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
                        {canViewAll ? "Bütün Bağlamalar" : "Mənim Bağlamalarım"}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {canViewAll ? "Sistemdəki bütün istifadəçi bağlamalarını idarə edin." : "Sifariş etdiyiniz bağlamaları bəyan edin və izləyin."}
                    </Text>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button view="outlined" size="l" onClick={handleExportExcel}>
                        <Icon data={ArrowDownToSquare} />
                        Excel-ə Çıxar (.xls)
                    </Button>

                    {activeTab === 'active' && (
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

            <div style={{ display: 'flex', alignItems: 'center' }}>
                <RadioButton
                    size="l"
                    value={activeTab}
                    onUpdate={(val) => setActiveTab(val)}
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        hasClearable
                        size="l"
                        leftContent={<Icon data={Magnifier} style={{ marginLeft: '10px' }} />}
                    />
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                    <Select
                        value={selectedStatus}
                        onUpdate={(val) => setSelectedStatus(val)}
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
                    <Button view="flat" size="l" onClick={() => { setSearchQuery(''); setSelectedStatus(['ALL']); }}>
                        Sıfırla
                    </Button>
                )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <Text variant="caption-2" color="secondary">
                    Göstərilir: <strong>{filteredPackages.length}</strong> / {safePackages.length} bağlama
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

            {/* MODALLAR */}
            <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Yeni Bağlama Bəyanı</Text>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Trek Nömrəsi *</Text>
                        <TextInput placeholder="Məs: AZ12345678" value={addFormData.trackingNumber} onChange={(e) => setAddFormData({ ...addFormData, trackingNumber: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Çəki (kq)</Text>
                        <TextInput placeholder="Məs: 1.5 kq" value={addFormData.weight} onChange={(e) => setAddFormData({ ...addFormData, weight: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Qiymət ($)</Text>
                        <TextInput placeholder="Məs: $12.50" value={addFormData.price} onChange={(e) => setAddFormData({ ...addFormData, price: e.target.value })} />
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
                        <TextInput value={editFormData.weight} onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Qiymət ($)</Text>
                        <TextInput value={editFormData.price} onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} />
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                        <Button view="flat" onClick={() => setIsEditModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleUpdate}>Yadda saxla</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default Packages;
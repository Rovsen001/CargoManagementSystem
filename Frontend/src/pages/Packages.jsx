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
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);

    // Tab State: 'active' (Aktiv Bağlamalar) və ya 'archived' (Zibil Qutusu / Arxiv)
    const [activeTab, setActiveTab] = useState('active');

    // Axtarış və Filtrasiya state-ləri
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(['ALL']);

    // Yeni Bağlama Modalı State-i
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormData, setAddFormData] = useState({ trackingNumber: '', weight: '', price: '' });

    // Redaktə (Update) Modalı State-i
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({ id: null, trackingNumber: '', weight: '', price: '', status: '' });

    // Bazadan Məlumatları Çəkmək (Tab-a uyğun olaraq)
    const fetchPackages = async () => {
        setLoading(true);
        try {
            const isArchived = activeTab === 'archived';
            const response = await api.get(`/packages?archived=${isArchived}`);
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

    // 1. Yeni Bağlama Yaratmaq
    const handleCreate = async () => {
        if (!addFormData.trackingNumber) return alert("Trek nömrəsini daxil edin!");
        try {
            await api.post('/packages', addFormData);
            setIsAddModalOpen(false);
            setAddFormData({ trackingNumber: '', weight: '', price: '' });
            fetchPackages();
        } catch (error) {
            console.error("Yaradılarkən xəta:", error);
        }
    };

    // 2. Redaktə Etmək (Update)
    const handleUpdate = async () => {
        try {
            await api.put(`/packages/${editFormData.id}`, editFormData);
            setIsEditModalOpen(false);
            fetchPackages();
        } catch (error) {
            console.error("Yenilənərkən xəta:", error);
        }
    };

    // Redaktə Modalını Açmaq
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

    // 3. Soft Delete (Arxivə Atmaq)
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

    // 4. Restore (Bərpa Etmək)
    const handleRestore = async (id) => {
        try {
            await api.put(`/packages/${id}/restore`);
            fetchPackages();
        } catch (error) {
            console.error("Bərpa edilərkən xəta:", error);
        }
    };

    // 5. Hard Delete (Bazadan Həmişəlik Silmək - X Düyməsi)
    const handleHardDelete = async (id) => {
        if (window.confirm("⚠️ DİQQƏT! Bu bağlama verilənlər bazasından HƏMİŞƏLİK silinəcək. Əminsiniz?")) {
            try {
                await api.delete(`/packages/${id}/hard`);
                fetchPackages();
            } catch (error) {
                console.error("Həmişəlik silinərkən xəta:", error);
            }
        }
    };

    // Statusu cədvəldən anında dəyişmək
    const handleStatusChange = async (id, newStatus, currentItem) => {
        try {
            await api.put(`/packages/${id}`, { ...currentItem, status: newStatus });
            fetchPackages();
        } catch (error) {
            console.error("Status yenilənərkən xəta:", error);
        }
    };

    // Axtarış və Filtrasiya Məntiqi
    const safePackages = Array.isArray(packages) ? packages : [];
    const filteredPackages = safePackages.filter((pkg) => {
        const matchesSearch = pkg.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const currentFilter = selectedStatus[0] || 'ALL';
        const matchesStatus = currentFilter === 'ALL' || pkg.status === currentFilter;
        return matchesSearch && matchesStatus;
    });

    // Excel (.xls) Export
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
            <tr><th>ID</th><th>Trek Nömrəsi</th><th>Çəki (kq)</th><th>Qiymət ($)</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${filteredPackages.map(pkg => `
              <tr>
                <td>${pkg.id}</td>
                <td><b>${pkg.trackingNumber || ''}</b></td>
                <td>${pkg.weight || ''}</td>
                <td>${pkg.price || ''}</td>
                <td>${pkg.status || ''}</td>
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

    // Cədvəl Sütunları
    const columns = [
        { id: 'id', name: 'ID', meta: { width: '60px' } },
        { id: 'trackingNumber', name: 'Trek Nömrəsi', template: (item) => <strong>{item.trackingNumber}</strong> },
        { id: 'weight', name: 'Çəki (kq)' },
        { id: 'price', name: 'Qiymət ($)' },
        { id: 'status', name: 'Status', template: (item) => renderStatusBadge(item.status) },
        {
            id: 'actions',
            name: 'Əməliyyatlar',
            template: (item) => (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {activeTab === 'active' ? (
                        <>
                            {/* STATUS SELECT */}
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
                            {/* REDAKTƏ (UPDATE) DÜYMƏSİ */}
                            <Button view="flat-secondary" size="s" onClick={() => openEditModal(item)} title="Məlumatları Redaktə Et">
                                <Icon data={Pencil} />
                            </Button>
                            {/* SOFT DELETE (ARXİVƏ AT) DÜYMƏSİ */}
                            <Button view="flat-warning" size="s" onClick={() => handleSoftDelete(item.id)} title="Zibil Qutusuna At">
                                <Icon data={TrashBin} />
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* BƏRPA ET (RESTORE) DÜYMƏSİ */}
                            <Button view="action" size="s" onClick={() => handleRestore(item.id)} title="Aktiv Siyahıya Bərpa Et">
                                <Icon data={ArrowRotateLeft} />
                                Bərpa Et
                            </Button>
                            {/* HARD DELETE (X DÜYMƏSİ - HƏMİŞƏLİK SİL) */}
                            <Button view="flat-danger" size="s" onClick={() => handleHardDelete(item.id)} title="Bazadan Həmişəlik Sil">
                                <Icon data={Xmark} />
                            </Button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* BAŞLIQ VƏ DÜYMƏLƏR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <Text variant="header-2">Bağlamaların İdarə Edilməsi</Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        Aktiv və arxivdəki bağlamalara nəzarət edin, redaktə edin və ya silin.
                    </Text>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button view="outlined" size="l" onClick={handleExportExcel}>
                        <Icon data={ArrowDownToSquare} />
                        Excel-ə Çıxar (.xls)
                    </Button>

                    {activeTab === 'active' && (
                        <Button view="action" size="l" onClick={() => setIsAddModalOpen(true)}>
                            <Icon data={Plus} />
                            Yeni Bağlama
                        </Button>
                    )}
                </div>
            </div>

            {/* TAB KEÇİDİ (AKTİV VS ARXİV/ZİBİL QUTUSU) */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <RadioButton
                    size="l"
                    value={activeTab}
                    onUpdate={(val) => setActiveTab(val)}
                    options={[
                        { value: 'active', content: '📦 Aktiv Bağlamalar' },
                        { value: 'archived', content: '🗑️ Zibil Qutusu (Arxiv)' }
                    ]}
                />
            </div>

            {/* 🔍 AXTARIŞ VƏ FİLTR PANELİ */}
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

            {/* İNDİKATOR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <Text variant="caption-2" color="secondary">
                    Göstərilir: <strong>{filteredPackages.length}</strong> / {safePackages.length} bağlama ({activeTab === 'active' ? 'Aktiv' : 'Arxiv'})
                </Text>
            </div>

            {/* 📋 CƏDVƏL */}
            <Card style={{ padding: '8px', overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><Loader size="l" /></div>
                ) : filteredPackages.length > 0 ? (
                    <Table data={filteredPackages} columns={columns} />
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Text variant="subheader-1" color="secondary">
                            {activeTab === 'active' ? 'Aktiv bağlama tapılmadı.' : 'Zibil qutusu boşdur.'}
                        </Text>
                    </div>
                )}
            </Card>

            {/* ➕ YENİ BAĞLAMA MODALI */}
            <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
                <div style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Yeni Bağlama</Text>
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

            {/* ✏️ REDAKTƏ ETMƏ MODALI (UPDATE) */}
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
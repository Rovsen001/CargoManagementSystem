// Frontend/src/components/Home/WarehouseAddressesModal.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, Label, Loader } from '@gravity-ui/uikit';
import { Check } from '@gravity-ui/icons';
import api from '../../services/api';

const WarehouseAddressesModal = ({ user }) => {
    const { t } = useTranslation();
    const [copiedField, setCopiedField] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);

    const customerCode = user ? `#C-${user.id ? user.id + 10400 : '10492'}` : '#C-10492';
    const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.fullName || t('warehouseAddresses.defaultCustomerName') : t('warehouseAddresses.defaultCustomerName');

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const response = await api.get('/warehouses');
                setWarehouses(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error("Anbarlar çəkilərkən xəta:", error);
                setWarehouses([]);
            } finally {
                setLoading(false);
            }
        };
        fetchWarehouses();
    }, []);

    const copyToClipboard = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const buildFields = (wh) => {
        const fields = [
            { label: t('warehouseAddresses.fullNameLabel'), value: `${fullName} (${customerCode})` },
            { label: t('warehouseAddresses.addressTitleLabel'), value: `CargoMS - ${customerCode}` },
            { label: t('warehouseAddresses.addressLine1Label'), value: wh.addressLine1 }
        ];
        if (wh.addressLine2) fields.push({ label: t('warehouseAddresses.addressLine2Label'), value: `${wh.addressLine2}, ID: ${customerCode}` });
        if (wh.city) fields.push({ label: t('warehouseAddresses.cityLabel'), value: wh.city });
        if (wh.postalCode) fields.push({ label: t('warehouseAddresses.postalCodeLabel'), value: wh.postalCode });
        if (wh.phone) fields.push({ label: t('warehouseAddresses.phoneLabel'), value: wh.phone });
        return fields;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Card view="raised" style={{ padding: '28px 32px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>{t('warehouseAddresses.title')}</Text>
                            <Label theme="info" size="m">{t('warehouseAddresses.yourCustomerCode', { code: customerCode })}</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            {t('warehouseAddresses.description')}
                        </Text>
                    </div>
                </div>
            </Card>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><Loader size="l" /></div>
            ) : warehouses.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                    <Text color="secondary">{t('warehouseAddresses.noWarehouses')}</Text>
                </Card>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: warehouses.length > 1 ? '1fr 1fr' : '1fr', gap: '24px' }}>
                    {warehouses.map((wh) => (
                        <Card key={wh.id} view="outlined" style={{ padding: '24px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>
                                <Text variant="header-2" style={{ color: '#ffffff' }}>{wh.flag} {wh.country} ({wh.name})</Text>
                                <Label theme="success">${parseFloat(wh.ratePerKg).toFixed(2)}{t('warehouseAddresses.perKgSuffix')}</Label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {buildFields(wh).map((f, fIdx) => {
                                    const key = `${wh.id}-${fIdx}`;
                                    const isCopied = copiedField === key;

                                    return (
                                        <div
                                            key={fIdx}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '10px 14px',
                                                backgroundColor: '#0d1117',
                                                borderRadius: '8px',
                                                border: '1px solid #21262d'
                                            }}
                                        >
                                            <div>
                                                <Text variant="caption-2" color="secondary" style={{ display: 'block', fontSize: '11px' }}>
                                                    {f.label}
                                                </Text>
                                                <Text variant="body-2" style={{ color: '#ffffff', fontWeight: 600 }}>
                                                    {f.value}
                                                </Text>
                                            </div>
                                            <Button
                                                size="s"
                                                view={isCopied ? 'action' : 'outlined'}
                                                onClick={() => copyToClipboard(f.value, key)}
                                            >
                                                {isCopied ? <Check size={14} /> : t('warehouseAddresses.copyButton')}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WarehouseAddressesModal;

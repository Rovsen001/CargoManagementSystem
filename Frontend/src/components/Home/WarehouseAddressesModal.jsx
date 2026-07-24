// Frontend/src/components/Home/WarehouseAddressesModal.jsx
import React, { useState } from 'react';
import { Card, Text, Button, Label, Alert } from '@gravity-ui/uikit';
import { Globe, ShieldCheck, Check } from '@gravity-ui/icons';

const WarehouseAddressesModal = ({ user }) => {
    const [copiedField, setCopiedField] = useState('');

    const customerCode = user ? `#C-${user.id ? user.id + 10400 : '10492'}` : '#C-10492';
    const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.fullName || 'Müştəri Adı' : 'Müştəri Adı';

    const copyToClipboard = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const warehouses = [
        {
            country: '🇹🇷 Türkiyə (İstanbul Anbarı)',
            flag: '🇹🇷',
            tag: 'Aktiv Reyslər (Həftədə 5 dəfə)',
            fields: [
                { label: 'Ad, Soyad', value: `${fullName} (${customerCode})` },
                { label: 'Adres Başlığı', value: `CargoMS - ${customerCode}` },
                { label: 'Adres Satırı 1', value: 'Gürsel Mah. Nurcan Sok. No: 14/A' },
                { label: 'Adres Satırı 2 (Müştəri Kodu)', value: `CargoMS Warehouse, ID: ${customerCode}` },
                { label: 'İl / İlçe', value: 'İstanbul / Kağıthane' },
                { label: 'Posta Kodu', value: '34400' },
                { label: 'Telefon', value: '+90 534 892 10 42' },
                { label: 'Vergi No / TC', value: '1920839210' }
            ]
        },
        {
            country: '🇺🇸 ABŞ (Delaware Anbarı - 0% Tax Free)',
            flag: '🇺🇸',
            tag: 'Vergisiz Ştat (0% Sales Tax)',
            fields: [
                { label: 'Full Name', value: `${fullName} / ${customerCode}` },
                { label: 'Address Line 1', value: '100 Continental Dr, Suite 400' },
                { label: 'Address Line 2', value: `CargoMS - ${customerCode}` },
                { label: 'City', value: 'Newark' },
                { label: 'State', value: 'Delaware (DE)' },
                { label: 'Zip Code', value: '19713' },
                { label: 'Phone Number', value: '+1 (302) 492-1042' }
            ]
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Card view="raised" style={{ padding: '28px 32px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>🌐 Xarici Anbar Ünvanlarınız</Text>
                            <Label theme="info" size="m">Müştəri Kodunuz: {customerCode}</Label>
                        </div>
                        <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                            Xaricdən sifariş edərkən aşağıdakı ünvanları kopyalayıb alış-veriş saytlarına (Trendyol, Amazon və s.) daxil edin.
                        </Text>
                    </div>
                </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {warehouses.map((wh, idx) => (
                    <Card key={idx} view="outlined" style={{ padding: '24px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>{wh.country}</Text>
                            <Label theme="success">{wh.tag}</Label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {wh.fields.map((f, fIdx) => {
                                const key = `${idx}-${fIdx}`;
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
                                            {isCopied ? <Check size={14} /> : 'Kopyala'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default WarehouseAddressesModal;

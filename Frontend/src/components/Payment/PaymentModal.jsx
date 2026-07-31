// Frontend/src/components/Payment/PaymentModal.jsx
import React, { useState } from 'react';
import { Modal, Card, Text, Button, TextInput, Label, Alert, Spin } from '@gravity-ui/uikit';
import { ShieldCheck, Lock, Check, Wallet, ArrowRight, ArrowRotateRight } from '@gravity-ui/icons';

const PaymentModal = ({ open, onClose, currentBalance, onPaymentSuccess, userId }) => {
    const [step, setStep] = useState(1); // 1: Select Amount & Card, 2: 3DS OTP, 3: Success Receipt
    const [method, setMethod] = useState('card'); // 'card', 'applepay', 'emanat'
    const [amount, setAmount] = useState('50');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [cardName, setCardName] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [receiptData, setReceiptData] = useState(null);

    const presetAmounts = ['10', '20', '50', '100', '200'];

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];

        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }

        if (parts.length) {
            return parts.join(' ');
        } else {
            return value;
        }
    };

    const formatExpiry = (value) => {
        const clear = value.replace(/[^0-9]/g, '');
        if (clear.length >= 2) {
            return `${clear.substring(0, 2)}/${clear.substring(2, 4)}`;
        }
        return clear;
    };

    const handleProceedToOtp = (e) => {
        e.preventDefault();
        setError('');

        const numVal = parseFloat(amount);
        if (isNaN(numVal) || numVal <= 0) {
            setError('Zəhmət olmasa düzgün məbləğ daxil edin.');
            return;
        }

        if (method === 'card') {
            const cleanCard = cardNumber.replace(/\s/g, '');
            if (cleanCard.length !== 16 || !/^\d+$/.test(cleanCard)) {
                setError('Kart nömrəsi 16 rəqəmdən ibarət olmalıdır.');
                return;
            }
            if (cardExpiry.length < 5) {
                setError('Son istifadə tarixini düzgün daxil edin (MM/YY).');
                return;
            }
            if (cardCvc.length < 3) {
                setError('CVC/CVV kodunu daxil edin.');
                return;
            }
        }

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setStep(2); // Proceed to 3D Secure OTP step
        }, 800);
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');

        if (otpCode.length < 4) {
            setError('Zəhmət olmasa mobil telefonunuza göndərilən SMS təsdiq kodunu daxil edin (məs: 123456).');
            return;
        }

        setLoading(true);

        try {
            // Send payment to backend
            const numVal = parseFloat(amount);
            if (onPaymentSuccess) {
                await onPaymentSuccess(numVal);
            }

            const invId = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
            const dateStr = new Date().toLocaleString('az-AZ', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            setReceiptData({
                invoiceId: invId,
                amount: numVal.toFixed(2),
                date: dateStr,
                paymentMethod: method === 'card' ? 'Visa / Mastercard (**** 4543)' : 'Apple Pay',
                newBalance: (parseFloat(currentBalance || 0) + numVal).toFixed(2),
                tax: '0.00 ₼ (Komissiyasız)',
                status: 'Uğurla tamamlandı'
            });

            setLoading(false);
            setStep(3); // Success Receipt
        } catch (err) {
            setLoading(false);
            setError('Ödəniş icra olunarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.');
        }
    };

    const handleReset = () => {
        setStep(1);
        setAmount('50');
        setCardNumber('');
        setCardExpiry('');
        setCardCvc('');
        setCardName('');
        setOtpCode('');
        setError('');
        setReceiptData(null);
        onClose();
    };

    return (
        <Modal open={open} onClose={handleReset}>
            <div style={{
                padding: '32px',
                width: '500px',
                maxWidth: '90vw',
                backgroundColor: '#161b22',
                color: '#ffffff',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px' }}>
                    <div>
                        <Text variant="header-2" style={{ color: '#ffffff' }}>
                            {step === 1 && 'Balans Artırılması'}
                            {step === 2 && '3D Secure Təsdiq'}
                            {step === 3 && 'Ödəniş Qəbzi'}
                        </Text>
                        <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '2px', fontSize: '13px' }}>
                            {step === 1 && 'Təhlükəsiz SSL 256-bit şifrələnmiş onlayn ödəniş'}
                            {step === 2 && 'Bankınız tərəfindən SMS ilə göndərilən 6-rəqəmli kodu daxil edin'}
                            {step === 3 && 'Əməliyyat uğurla tamamlandı və balansınıza əlavə edildi'}
                        </Text>
                    </div>
                    <Label theme="info" size="m"><ShieldCheck /> SSL Protected</Label>
                </div>

                {error && (
                    <Alert theme="danger" message={error} />
                )}

                {/* STEP 1: AMOUNT & CARD SELECTION */}
                {step === 1 && (
                    <form onSubmit={handleProceedToOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Payment Method Selector */}
                        <div>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '8px', display: 'block' }}>Ödəniş Üsulu</Text>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <Button
                                    size="l"
                                    view={method === 'card' ? 'action' : 'outlined'}
                                    onClick={() => setMethod('card')}
                                    type="button"
                                >
                                    Bank Kartı
                                </Button>
                                <Button
                                    size="l"
                                    view={method === 'applepay' ? 'action' : 'outlined'}
                                    onClick={() => setMethod('applepay')}
                                    type="button"
                                >
                                    Apple Pay
                                </Button>
                                <Button
                                    size="l"
                                    view={method === 'emanat' ? 'action' : 'outlined'}
                                    onClick={() => setMethod('emanat')}
                                    type="button"
                                >
                                    E-Manat
                                </Button>
                            </div>
                        </div>

                        {/* Amount Selection */}
                        <div>
                            <Text variant="caption-2" color="secondary" style={{ marginBottom: '8px', display: 'block' }}>Artırılacaq Məbləğ (AZN)</Text>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                {presetAmounts.map((amt) => (
                                    <Button
                                        key={amt}
                                        size="m"
                                        view={amount === amt ? 'action' : 'outlined'}
                                        onClick={() => setAmount(amt)}
                                        type="button"
                                        style={{ flex: 1 }}
                                    >
                                        +{amt} ₼
                                    </Button>
                                ))}
                            </div>
                            <TextInput
                                size="xl"
                                type="number"
                                min="0"
                                placeholder="Özəl məbləğ daxil edin"
                                value={amount}
                                onUpdate={(val) => setAmount(val)}
                                step="0.01"
                                min="1"
                            />
                        </div>

                        {/* Card Details Form (If card method selected) */}
                        {method === 'card' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#0d1117', padding: '16px', borderRadius: '12px', border: '1px solid #21262d' }}>
                                <div>
                                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Kart Nömrəsi</Text>
                                    <TextInput
                                        size="l"
                                        placeholder="4543 0000 0000 0000"
                                        value={cardNumber}
                                        onUpdate={(val) => setCardNumber(formatCardNumber(val))}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>İstifadə Tarixi</Text>
                                        <TextInput
                                            size="l"
                                            placeholder="MM/YY"
                                            value={cardExpiry}
                                            onUpdate={(val) => setCardExpiry(formatExpiry(val))}
                                        />
                                    </div>
                                    <div>
                                        <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>CVC / CVV</Text>
                                        <TextInput
                                            size="l"
                                            type="password"
                                            placeholder="•••"
                                            value={cardCvc}
                                            onUpdate={(val) => setCardCvc(val.substring(0, 4))}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Text variant="caption-2" color="secondary" style={{ marginBottom: '4px', display: 'block' }}>Kart Sahibinin Adı Soyadı</Text>
                                    <TextInput
                                        size="l"
                                        placeholder="MƏS: RASHAD ALIYEV"
                                        value={cardName}
                                        onUpdate={(val) => setCardName(val.toUpperCase())}
                                    />
                                </div>
                            </div>
                        )}

                        {method === 'emanat' && (
                            <Alert theme="info" title="E-Manat Kodu" message="E-Manat və ya MilliÖN terminallarında 'CargoMS' bölməsinə daxil olaraq Müştəri Kodunuzu (#C-10492) daxil edin." />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <div>
                                <Text color="secondary" variant="caption-2" style={{ display: 'block' }}>Yekun Ödəniləcək:</Text>
                                <Text variant="header-2" style={{ color: '#56d364', fontWeight: 'bold' }}>{parseFloat(amount || 0).toFixed(2)} ₼</Text>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Button view="flat" size="l" onClick={handleReset} type="button">Ləğv Et</Button>
                                <Button view="action" size="l" type="submit" loading={loading}>
                                    Ödənişə Keç <Button.Icon><ArrowRight /></Button.Icon>
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                {/* STEP 2: 3D SECURE OTP CODE */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
                        <div style={{ backgroundColor: '#0d1117', padding: '20px', borderRadius: '12px', border: '1px solid #30363d' }}>
                            <Lock size={32} style={{ color: '#1f6feb', marginBottom: '12px' }} />
                            <Text variant="header-2" style={{ display: 'block', color: '#ffffff' }}>SMS Təsdiq Kodu</Text>
                            <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '6px', fontSize: '13px' }}>
                                +994 50 *** ** 42 nömrənizə göndərilən 6-rəqəmli təhlükəsizlik kodunu daxil edin.
                            </Text>

                            <div style={{ width: '220px', margin: '20px auto 10px auto' }}>
                                <TextInput
                                    size="xl"
                                    placeholder="1 2 3 4 5 6"
                                    value={otpCode}
                                    onUpdate={(val) => setOtpCode(val)}
                                    style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px' }}
                                />
                            </div>
                            <Text variant="caption-2" color="secondary">Kod gəlmədi? <a href="#resend" onClick={(e) => { e.preventDefault(); alert("Yeni SMS kodu göndərildi: 482910"); }} style={{ color: '#58a6ff' }}>Yenidən göndər</a></Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button view="flat" size="l" onClick={() => setStep(1)} type="button">Geri</Button>
                            <Button view="action" size="l" type="submit" loading={loading}>
                                <Button.Icon><Check /></Button.Icon> Ödənişi Təsdiqlə ({parseFloat(amount).toFixed(2)} ₼)
                            </Button>
                        </div>
                    </form>
                )}

                {/* STEP 3: SUCCESS RECEIPT */}
                {step === 3 && receiptData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                            textAlign: 'center',
                            backgroundColor: '#13231b',
                            border: '1px solid #2ea043',
                            padding: '24px',
                            borderRadius: '12px'
                        }}>
                            <div style={{ backgroundColor: '#2ea043', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                                <Check size={28} style={{ color: '#ffffff' }} />
                            </div>
                            <Text variant="header-2" style={{ color: '#56d364', display: 'block' }}>Ödəniş Uğurla Tamamlandı!</Text>
                            <Text variant="body-2" color="secondary" style={{ marginTop: '4px', display: 'block' }}>
                                Balansınız dərhal yeniləndi.
                            </Text>
                        </div>

                        {/* Invoice Receipt Card */}
                        <Card view="outlined" style={{ padding: '20px', backgroundColor: '#0d1117', borderColor: '#30363d', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #21262d', paddingBottom: '8px' }}>
                                <Text color="secondary">Qəbz / Faktura №:</Text>
                                <Text style={{ fontWeight: 'bold', color: '#58a6ff' }}>{receiptData.invoiceId}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #21262d', paddingBottom: '8px' }}>
                                <Text color="secondary">Tarix & Vaxt:</Text>
                                <Text color="primary">{receiptData.date}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #21262d', paddingBottom: '8px' }}>
                                <Text color="secondary">Ödənilən Məbləğ:</Text>
                                <Text style={{ fontWeight: 'bold', color: '#56d364' }}>+{receiptData.amount} ₼</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #21262d', paddingBottom: '8px' }}>
                                <Text color="secondary">Ödəniş Üsulu:</Text>
                                <Text color="primary">{receiptData.paymentMethod}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text color="secondary">Yeni Cari Balansınız:</Text>
                                <Text style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '16px' }}>{receiptData.newBalance} ₼</Text>
                            </div>
                        </Card>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            <Button view="outlined" size="l" width="max" onClick={() => window.print()}>
                                Qəbzi Çap Et
                            </Button>
                            <Button view="action" size="l" width="max" onClick={handleReset}>
                                Bağla
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default PaymentModal;

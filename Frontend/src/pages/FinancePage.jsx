import React, { useState, useEffect } from 'react';
import { Card, Text, Button, Label, Spin, Modal, Alert } from '@gravity-ui/uikit';
import { Wallet, Plus, ShieldCheck, ArrowRight, Check } from '@gravity-ui/icons';
import PaymentModal from '../components/Payment/PaymentModal';
import api from '../services/api';

const FinancePage = () => {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'inkam', 'outcome'
    const [loading, setLoading] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Selected receipt modal state
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user ? user.id : null;

    useEffect(() => {
        if (userId) {
            fetchFinanceData();
        }
    }, [userId]);

    const fetchFinanceData = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/finance/my-balance`);

            setBalance(response.data.balance || 0);
            setTransactions(response.data.transactions || []);
        } catch (error) {
            console.error("Məlumatlar gətirilərkən xəta oldu:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTopUpSuccess = async (amountVal) => {
        try {
            await api.post('/finance/top-up', { amount: amountVal });

            await fetchFinanceData();

            // LocalStorage balance update
            const updatedUser = { ...user, balance: (parseFloat(balance) + parseFloat(amountVal)) };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (error) {
            console.error("Ödəniş xətası:", error);
            throw error;
        }
    };

    const filteredTransactions = transactions.filter((tx) => {
        if (filter === 'all') return true;
        if (filter === 'inkam') return tx.type === 'inkam';
        if (filter === 'outcome') return tx.type !== 'inkam';
        return true;
    });

    if (!userId) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Text color="danger" variant="header-1">Sistemə daxil olmamısınız!</Text>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

            {/* Header Title & Top Up CTA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Text variant="header-2" style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                        Maliyyə və Balans Portalı
                    </Text>
                    <Text variant="body-2" color="secondary">
                        Hesabınızın cari balansını idarə edin, onlayn ödəniş edin və faktura tarixçənizə baxın.
                    </Text>
                </div>

                <Button
                    size="xl"
                    view="action"
                    onClick={() => setIsPaymentModalOpen(true)}
                >
                    <Button.Icon><Plus /></Button.Icon>
                    Balansı Artır (Onlayn Ödəniş)
                </Button>
            </div>

            {/* Financial Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>

                {/* Balance Card */}
                <Card style={{
                    padding: '28px',
                    background: 'linear-gradient(135deg, #161b22 0%, #1c2b1e 100%)',
                    borderColor: '#2ea043',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <Text variant="caption-2" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Cari Balansınız
                            </Text>
                            <Wallet style={{ color: '#56d364' }} size={24} />
                        </div>

                        {loading ? (
                            <Spin size="l" />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                                <Text style={{ fontSize: '42px', fontWeight: 800, color: '#56d364', lineHeight: '1' }}>
                                    {parseFloat(balance).toFixed(2)}
                                </Text>
                                <Text variant="header-2" style={{ color: '#56d364' }}>₼</Text>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
                        <Text variant="caption-2" color="secondary">Hesab Statusu: <span style={{ color: '#56d364', fontWeight: 600 }}>Aktiv (Limit Yoxdur)</span></Text>
                    </div>
                </Card>

                {/* Monthly Spent Card */}
                <Card style={{ padding: '28px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <Text variant="caption-2" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Bu Aykı Xərclər
                        </Text>
                        <ShieldCheck style={{ color: '#58a6ff' }} size={24} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                        <Text style={{ fontSize: '42px', fontWeight: 800, color: '#ffffff', lineHeight: '1' }}>
                            28.40
                        </Text>
                        <Text variant="header-2" color="secondary">₼</Text>
                    </div>

                    <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #30363d' }}>
                        <Text variant="caption-2" color="secondary">4 uğurlu kargo daşınma xidməti</Text>
                    </div>
                </Card>

                {/* Quick Payment Info Card */}
                <Card style={{ padding: '28px', backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px' }}>
                    <Text variant="subheader-2" style={{ color: '#ffffff', marginBottom: '8px', display: 'block' }}>
                        Təhlükəsiz Ödəniş
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                        Visa, Mastercard və Birkart vasitəsilə 3D Secure təhlükəsizlik standartı altında komissiyasız balans artırın.
                    </Text>
                    <Label theme="info" size="m">SSL 256-Bit Encrypted</Label>
                </Card>
            </div>

            {/* Filterable Transaction History Table */}
            <Card style={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Text variant="header-1" style={{ color: '#ffffff' }}>Ödəniş və Əməliyyat Tarixçəsi</Text>
                        <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '2px', fontSize: '13px' }}>
                            Hesabınıza mədaxil olan və kargo daşımaları üçün silinən məbləğlərin siyahısı
                        </Text>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button size="m" view={filter === 'all' ? 'action' : 'outlined'} onClick={() => setFilter('all')}>Hamısı</Button>
                        <Button size="m" view={filter === 'inkam' ? 'action' : 'outlined'} onClick={() => setFilter('inkam')}>+ Mədaxil</Button>
                        <Button size="m" view={filter === 'outcome' ? 'action' : 'outlined'} onClick={() => setFilter('outcome')}>- Məxaric</Button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#0d1117', borderBottom: '1px solid #30363d' }}>
                                <th style={{ padding: '16px 24px' }}><Text color="secondary" variant="caption-2">Tarix & Vaxt</Text></th>
                                <th style={{ padding: '16px 24px' }}><Text color="secondary" variant="caption-2">Təsvir / Təfərrüat</Text></th>
                                <th style={{ padding: '16px 24px' }}><Text color="secondary" variant="caption-2">Status</Text></th>
                                <th style={{ padding: '16px 24px', textAlign: 'right' }}><Text color="secondary" variant="caption-2">Məbləğ</Text></th>
                                <th style={{ padding: '16px 24px', textAlign: 'center' }}><Text color="secondary" variant="caption-2">Qəbz</Text></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                                        <Spin size="l" />
                                    </td>
                                </tr>
                            ) : filteredTransactions.length > 0 ? (
                                filteredTransactions.map((tx) => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid #21262d', transition: 'background-color 0.2s' }}>
                                        <td style={{ padding: '16px 24px' }}>
                                            <Text color="primary" variant="body-2">
                                                {new Date(tx.created_at).toLocaleString('az-AZ', {
                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </Text>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <Text color="primary" variant="body-2" style={{ fontWeight: 500 }}>
                                                {tx.description || 'Balans artırımı'}
                                            </Text>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <Label theme={tx.type === 'inkam' ? 'success' : 'danger'}>
                                                {tx.type === 'inkam' ? 'Mədaxil (Tamamlandı)' : 'Məxaric'}
                                            </Label>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <Text
                                                variant="body-2"
                                                style={{
                                                    fontWeight: 'bold',
                                                    fontSize: '15px',
                                                    color: tx.type === 'inkam' ? '#56d364' : '#f85149'
                                                }}
                                            >
                                                {tx.type === 'inkam' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} ₼
                                            </Text>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                            <Button
                                                size="s"
                                                view="flat-info"
                                                onClick={() => setSelectedReceipt({
                                                    invoiceId: `INV-2026-${tx.id + 8400}`,
                                                    date: new Date(tx.created_at).toLocaleString('az-AZ'),
                                                    amount: parseFloat(tx.amount).toFixed(2),
                                                    type: tx.type,
                                                    description: tx.description || 'Balans artırımı (Onlayn Ödəniş)'
                                                })}
                                            >
                                                Qəbz
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                                        <Text color="secondary" variant="body-2">Heç bir əməliyyat tapılmadı.</Text>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Payment Modal */}
            <PaymentModal
                open={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                currentBalance={balance}
                onPaymentSuccess={handleTopUpSuccess}
                userId={userId}
            />

            {/* Receipt Modal */}
            {selectedReceipt && (
                <Modal open={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)}>
                    <div style={{ padding: '28px', width: '440px', backgroundColor: '#161b22', color: '#ffffff', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '12px' }}>
                            <Text variant="header-2" style={{ color: '#ffffff' }}>Rəqəmsal Əməliyyat Qəbzi</Text>
                            <Label theme="success">Tamamlandı</Label>
                        </div>

                        <Card view="outlined" style={{ padding: '16px', backgroundColor: '#0d1117', borderColor: '#30363d', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text color="secondary">Faktura №:</Text>
                                <Text style={{ fontWeight: 'bold', color: '#58a6ff' }}>{selectedReceipt.invoiceId}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text color="secondary">Tarix:</Text>
                                <Text color="primary">{selectedReceipt.date}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text color="secondary">Əməliyyat:</Text>
                                <Text color="primary">{selectedReceipt.description}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #21262d', paddingTop: '8px', marginTop: '4px' }}>
                                <Text color="secondary">Yekun Məbləğ:</Text>
                                <Text style={{ fontWeight: 'bold', color: selectedReceipt.type === 'inkam' ? '#56d364' : '#f85149', fontSize: '18px' }}>
                                    {selectedReceipt.type === 'inkam' ? '+' : '-'}{selectedReceipt.amount} ₼
                                </Text>
                            </div>
                        </Card>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Button view="outlined" onClick={() => window.print()}>Çap Et</Button>
                            <Button view="action" onClick={() => setSelectedReceipt(null)}>Bağla</Button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};

export default FinancePage;
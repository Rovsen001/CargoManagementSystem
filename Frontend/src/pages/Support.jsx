import React, { useState, useEffect } from 'react';
import { Card, Text, Button, TextInput, TextArea, Label, Loader, Modal, Select, Icon } from '@gravity-ui/uikit';
import { Plus, ArrowLeft, Handset } from '@gravity-ui/icons';
import api from '../services/api';

const STATUS_THEME = { 'Açıq': 'info', 'İşlənir': 'warning', 'Bağlı': 'normal' };

const Support = () => {
    const currentUser = JSON.parse(localStorage.getItem('user')) || {};
    const hasPermission = (key) => Boolean(currentUser.isSuperAdmin || currentUser.permissions?.includes(key));
    const canViewAll = hasPermission('support.viewAll');

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState(['ALL']);

    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [ticketDetail, setTicketDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replySending, setReplySending] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const response = await api.get('/support/tickets');
            setTickets(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("Tiketlər çəkilərkən xəta:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const openTicket = async (id) => {
        setSelectedTicketId(id);
        setDetailLoading(true);
        try {
            const response = await api.get(`/support/tickets/${id}`);
            setTicketDetail(response.data);
        } catch (err) {
            console.error("Tiket detalı çəkilərkən xəta:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleReply = async () => {
        if (!replyText.trim()) return;
        setReplySending(true);
        try {
            await api.post(`/support/tickets/${selectedTicketId}/messages`, { message: replyText });
            setReplyText('');
            await openTicket(selectedTicketId);
            fetchTickets();
        } catch (err) {
            alert(err.response?.data?.message || "Cavab göndərilərkən xəta baş verdi.");
        } finally {
            setReplySending(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await api.put(`/support/tickets/${selectedTicketId}/status`, { status: newStatus });
            await openTicket(selectedTicketId);
            fetchTickets();
        } catch (err) {
            alert(err.response?.data?.message || "Status dəyişdirilərkən xəta baş verdi.");
        }
    };

    const handleCreateTicket = async () => {
        setCreateError('');
        if (!newSubject.trim() || !newMessage.trim()) {
            setCreateError('Mövzu və mesaj mütləqdir.');
            return;
        }
        setCreating(true);
        try {
            await api.post('/support/tickets', { subject: newSubject, message: newMessage });
            setIsCreateModalOpen(false);
            setNewSubject('');
            setNewMessage('');
            fetchTickets();
        } catch (err) {
            setCreateError(err.response?.data?.message || 'Tiket yaradılarkən xəta baş verdi.');
        } finally {
            setCreating(false);
        }
    };

    const filteredTickets = tickets.filter((t) => statusFilter[0] === 'ALL' || t.status === statusFilter[0]);

    if (selectedTicketId) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Button view="flat" onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }} style={{ alignSelf: 'flex-start' }}>
                    <Icon data={ArrowLeft} /> Geri
                </Button>

                {detailLoading || !ticketDetail ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <Text variant="header-2" className="gradient-text">{ticketDetail.ticket.subject}</Text>
                                <Text variant="body-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                                    {ticketDetail.ticket.firstName} {ticketDetail.ticket.lastName} ({ticketDetail.ticket.email})
                                </Text>
                            </div>
                            {canViewAll ? (
                                <Select
                                    value={[ticketDetail.ticket.status]}
                                    onUpdate={(val) => handleStatusChange(val[0])}
                                    options={[
                                        { value: 'Açıq', content: 'Açıq' },
                                        { value: 'İşlənir', content: 'İşlənir' },
                                        { value: 'Bağlı', content: 'Bağlı' }
                                    ]}
                                />
                            ) : (
                                <Label theme={STATUS_THEME[ticketDetail.ticket.status] || 'normal'}>{ticketDetail.ticket.status}</Label>
                            )}
                        </div>

                        <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '480px', overflowY: 'auto' }}>
                            {ticketDetail.messages.map((m) => {
                                const isStaff = m.role && m.role !== 'Customer';
                                return (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: isStaff ? 'flex-start' : 'flex-end' }}>
                                        <div style={{
                                            maxWidth: '70%', padding: '10px 14px', borderRadius: '12px',
                                            backgroundColor: isStaff ? '#21262d' : 'rgba(139, 92, 246, 0.15)',
                                            border: `1px solid ${isStaff ? '#30363d' : '#8b5cf6'}`
                                        }}>
                                            <Text variant="caption-2" color="secondary" style={{ display: 'block', marginBottom: '4px' }}>
                                                {m.firstName} {m.lastName} {isStaff && '(Dəstək)'} · {new Date(m.createdAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <Text variant="body-2" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</Text>
                                        </div>
                                    </div>
                                );
                            })}
                        </Card>

                        <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <TextArea
                                placeholder="Cavabınızı yazın..."
                                value={replyText}
                                onUpdate={(val) => setReplyText(val)}
                                rows={3}
                            />
                            <Button view="action" onClick={handleReply} loading={replySending} style={{ alignSelf: 'flex-end' }}>
                                Göndər
                            </Button>
                        </Card>
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
                        {canViewAll ? 'Bütün Dəstək Tiketləri' : 'Dəstək Tiketlərim'}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {canViewAll ? 'Müştərilərin dəstək müraciətlərini idarə edin.' : 'Suallarınızı və problemlərinizi dəstək komandamıza bildirin.'}
                    </Text>
                </div>
                {!canViewAll && (
                    <Button view="action" size="l" onClick={() => setIsCreateModalOpen(true)} className="pill-btn" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}>
                        <Icon data={Plus} /> Yeni Tiket
                    </Button>
                )}
            </div>

            <div style={{ maxWidth: '260px' }}>
                <Select
                    value={statusFilter}
                    onUpdate={(val) => setStatusFilter(val)}
                    options={[
                        { value: 'ALL', content: 'Bütün Statuslar' },
                        { value: 'Açıq', content: 'Açıq' },
                        { value: 'İşlənir', content: 'İşlənir' },
                        { value: 'Bağlı', content: 'Bağlı' }
                    ]}
                    width="max"
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
            ) : filteredTickets.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                    <Icon data={Handset} size={32} style={{ color: '#8b949e', marginBottom: '8px' }} />
                    <Text variant="subheader-1" color="secondary" style={{ display: 'block' }}>Tiket tapılmadı.</Text>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredTickets.map((t) => (
                        <Card
                            key={t.id}
                            type="action"
                            className="hover-lift"
                            style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
                            onClick={() => openTicket(t.id)}
                        >
                            <div>
                                <Text variant="subheader-2" style={{ color: '#ffffff' }}>{t.subject}</Text>
                                {canViewAll && (
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                        {t.firstName} {t.lastName} ({t.email})
                                    </Text>
                                )}
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                    {t.messageCount} mesaj · {new Date(t.updatedAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[t.status] || 'normal'}>{t.status}</Label>
                        </Card>
                    ))}
                </div>
            )}

            <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">Yeni Dəstək Tiketi</Text>
                    {createError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {createError}
                        </div>
                    )}
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mövzu *</Text>
                        <TextInput placeholder="Məs: Bağlamam gecikir" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>Mesaj *</Text>
                        <TextArea placeholder="Probleminizi ətraflı izah edin..." value={newMessage} onUpdate={(val) => setNewMessage(val)} rows={5} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsCreateModalOpen(false)}>Ləğv et</Button>
                        <Button view="action" onClick={handleCreateTicket} loading={creating}>Göndər</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Support;

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Text, Button, TextInput, TextArea, Label, Loader, Modal, Select, Icon } from '@gravity-ui/uikit';
import { Plus, ArrowLeft, Handset, Sparkles, PaperPlane, TrashBin, ArrowUturnCwRight } from '@gravity-ui/icons';
import api from '../services/api';

const Support = () => {
    const { t, i18n } = useTranslation();
    const STATUS_THEME = { 'Açıq': 'info', 'İşlənir': 'warning', 'Bağlı': 'normal' };
    const STATUS_LABEL = { 'Açıq': t('support.statusOpen'), 'İşlənir': t('support.statusInProgress'), 'Bağlı': t('support.statusClosed') };
    const locale = i18n.language === 'en' ? 'en-US' : 'az-AZ';

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

    const [activeTab, setActiveTab] = useState('tickets');
    const [aiMessages, setAiMessages] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiSending, setAiSending] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiUnavailable, setAiUnavailable] = useState(false);
    const [aiEscalating, setAiEscalating] = useState(false);
    const aiScrollRef = useRef(null);

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
            alert(err.response?.data?.message || t('support.replyError'));
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
            alert(err.response?.data?.message || t('support.statusChangeError'));
        }
    };

    const handleCreateTicket = async () => {
        setCreateError('');
        if (!newSubject.trim() || !newMessage.trim()) {
            setCreateError(t('support.subjectAndMessageRequired'));
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
            setCreateError(err.response?.data?.message || t('support.createError'));
        } finally {
            setCreating(false);
        }
    };

    const fetchAiHistory = async () => {
        setAiLoading(true);
        try {
            const response = await api.get('/support/ai-chat');
            setAiMessages(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("AI söhbət tarixçəsi çəkilərkən xəta:", err);
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ai' && !canViewAll) {
            fetchAiHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        if (aiScrollRef.current) {
            aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
        }
    }, [aiMessages, aiSending]);

    const handleAiSend = async () => {
        const text = aiInput.trim();
        if (!text || aiSending) return;
        setAiError('');
        setAiInput('');
        setAiMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', message: text }]);
        setAiSending(true);
        try {
            const response = await api.post('/support/ai-chat', { message: text, lang: i18n.language });
            setAiMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: 'assistant', message: response.data.reply }]);
        } catch (err) {
            if (err.response?.data?.aiUnavailable) {
                setAiUnavailable(true);
            } else {
                setAiError(err.response?.data?.message || t('support.ai.sendError'));
            }
        } finally {
            setAiSending(false);
        }
    };

    const handleAiClear = async () => {
        if (!window.confirm(t('support.ai.clearConfirm'))) return;
        try {
            await api.delete('/support/ai-chat');
            setAiMessages([]);
        } catch (err) {
            console.error("Söhbət təmizlənərkən xəta:", err);
        }
    };

    const handleAiEscalate = async () => {
        if (aiMessages.length === 0) {
            setAiError(t('support.ai.escalateEmptyError'));
            return;
        }
        setAiEscalating(true);
        setAiError('');
        try {
            const response = await api.post('/support/ai-chat/escalate', {});
            await fetchTickets();
            setActiveTab('tickets');
            await openTicket(response.data.ticketId);
        } catch (err) {
            setAiError(err.response?.data?.message || t('support.ai.escalateError'));
        } finally {
            setAiEscalating(false);
        }
    };

    const filteredTickets = tickets.filter((tk) => statusFilter[0] === 'ALL' || tk.status === statusFilter[0]);

    if (selectedTicketId) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Button view="flat" onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }} style={{ alignSelf: 'flex-start' }}>
                    <Icon data={ArrowLeft} /> {t('auth.back')}
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
                                        { value: 'Açıq', content: t('support.statusOpen') },
                                        { value: 'İşlənir', content: t('support.statusInProgress') },
                                        { value: 'Bağlı', content: t('support.statusClosed') }
                                    ]}
                                />
                            ) : (
                                <Label theme={STATUS_THEME[ticketDetail.ticket.status] || 'normal'}>{STATUS_LABEL[ticketDetail.ticket.status] || ticketDetail.ticket.status}</Label>
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
                                                {m.firstName} {m.lastName} {isStaff && t('support.staffSuffix')} · {new Date(m.createdAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            <Text variant="body-2" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</Text>
                                        </div>
                                    </div>
                                );
                            })}
                        </Card>

                        <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <TextArea
                                placeholder={t('support.replyPlaceholder')}
                                value={replyText}
                                onUpdate={(val) => setReplyText(val)}
                                rows={3}
                            />
                            <Button view="action" onClick={handleReply} loading={replySending} style={{ alignSelf: 'flex-end' }}>
                                {t('support.sendButton')}
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
                        {canViewAll ? t('support.allTicketsTitle') : t('support.myTicketsTitle')}
                    </Text>
                    <Text variant="body-1" color="secondary" style={{ display: 'block', marginTop: '4px' }}>
                        {canViewAll ? t('support.allTicketsDesc') : t('support.myTicketsDesc')}
                    </Text>
                </div>
                {!canViewAll && activeTab === 'tickets' && (
                    <Button view="action" size="l" onClick={() => setIsCreateModalOpen(true)} className="pill-btn" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none' }}>
                        <Icon data={Plus} /> {t('support.newTicketButton')}
                    </Button>
                )}
            </div>

            {!canViewAll && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                        view={activeTab === 'tickets' ? 'action' : 'flat-secondary'}
                        onClick={() => setActiveTab('tickets')}
                    >
                        <Icon data={Handset} /> {t('support.ai.ticketsTabLabel')}
                    </Button>
                    <Button
                        view={activeTab === 'ai' ? 'action' : 'flat-secondary'}
                        onClick={() => setActiveTab('ai')}
                    >
                        <Icon data={Sparkles} /> {t('support.ai.chatTabLabel')}
                    </Button>
                </div>
            )}

            {activeTab === 'ai' && !canViewAll ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {aiError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {aiError}
                        </div>
                    )}

                    <div ref={aiScrollRef} className="g-box g-card g-card_theme_normal g-card_view_raise" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '360px', maxHeight: '480px', overflowY: 'auto', borderRadius: '8px' }}>
                        {aiLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><Loader size="l" /></div>
                        ) : (
                            <>
                                {aiMessages.length === 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#21262d', border: '1px solid #30363d' }}>
                                            <Text variant="body-2">{t('support.ai.welcomeMessage')}</Text>
                                        </div>
                                    </div>
                                )}
                                {aiMessages.map((m) => {
                                    const isAssistant = m.role === 'assistant';
                                    return (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: isAssistant ? 'flex-start' : 'flex-end' }}>
                                            <div style={{
                                                maxWidth: '80%', padding: '10px 14px', borderRadius: '12px',
                                                backgroundColor: isAssistant ? '#21262d' : 'rgba(139, 92, 246, 0.15)',
                                                border: `1px solid ${isAssistant ? '#30363d' : '#8b5cf6'}`
                                            }}>
                                                <Text variant="body-2" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</Text>
                                            </div>
                                        </div>
                                    );
                                })}
                                {aiSending && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: '#21262d', border: '1px solid #30363d' }}>
                                            <Text variant="body-2" color="secondary">{t('support.ai.thinking')}</Text>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <Card style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {aiUnavailable && (
                            <Text color="secondary">{t('support.ai.unavailableMessage')}</Text>
                        )}
                        {!aiUnavailable && (
                            <TextArea
                                placeholder={t('support.ai.placeholder')}
                                value={aiInput}
                                onUpdate={(val) => setAiInput(val)}
                                rows={2}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAiSend();
                                    }
                                }}
                            />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button view="flat-secondary" onClick={handleAiClear} disabled={aiMessages.length === 0}>
                                    <Icon data={TrashBin} /> {t('support.ai.newChatButton')}
                                </Button>
                                <Button view="outlined" onClick={handleAiEscalate} loading={aiEscalating}>
                                    <Icon data={ArrowUturnCwRight} /> {t('support.ai.escalateButton')}
                                </Button>
                            </div>
                            {!aiUnavailable && (
                                <Button view="action" onClick={handleAiSend} loading={aiSending} disabled={!aiInput.trim()}>
                                    <Icon data={PaperPlane} /> {t('support.sendButton')}
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            ) : (
            <>
            <div style={{ maxWidth: '260px' }}>
                <Select
                    value={statusFilter}
                    onUpdate={(val) => setStatusFilter(val)}
                    options={[
                        { value: 'ALL', content: t('support.allStatuses') },
                        { value: 'Açıq', content: t('support.statusOpen') },
                        { value: 'İşlənir', content: t('support.statusInProgress') },
                        { value: 'Bağlı', content: t('support.statusClosed') }
                    ]}
                    width="max"
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader size="l" /></div>
            ) : filteredTickets.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                    <Icon data={Handset} size={32} style={{ color: '#8b949e', marginBottom: '8px' }} />
                    <Text variant="subheader-1" color="secondary" style={{ display: 'block' }}>{t('support.noTicketsFound')}</Text>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredTickets.map((tk) => (
                        <Card
                            key={tk.id}
                            type="action"
                            className="hover-lift"
                            style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
                            onClick={() => openTicket(tk.id)}
                        >
                            <div>
                                <Text variant="subheader-2" style={{ color: '#ffffff' }}>{tk.subject}</Text>
                                {canViewAll && (
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                        {tk.firstName} {tk.lastName} ({tk.email})
                                    </Text>
                                )}
                                <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '2px' }}>
                                    {t('support.messageCountLabel', { count: tk.messageCount })} · {new Date(tk.updatedAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </div>
                            <Label theme={STATUS_THEME[tk.status] || 'normal'}>{STATUS_LABEL[tk.status] || tk.status}</Label>
                        </Card>
                    ))}
                </div>
            )}
            </>
            )}

            <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
                <div style={{ padding: '24px', width: '420px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text variant="header-1">{t('support.newTicketModalTitle')}</Text>
                    {createError && (
                        <div style={{ padding: '10px', backgroundColor: '#3d1618', color: '#ff7b72', border: '1px solid #f85149', borderRadius: '6px', fontSize: '14px' }}>
                            {createError}
                        </div>
                    )}
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('support.subjectLabel')}</Text>
                        <TextInput placeholder={t('support.subjectPlaceholder')} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
                    </div>
                    <div>
                        <Text variant="body-2" style={{ marginBottom: '6px', display: 'block' }}>{t('support.messageLabel')}</Text>
                        <TextArea placeholder={t('support.messagePlaceholder')} value={newMessage} onUpdate={(val) => setNewMessage(val)} rows={5} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <Button view="flat" onClick={() => setIsCreateModalOpen(false)}>{t('support.cancelButton')}</Button>
                        <Button view="action" onClick={handleCreateTicket} loading={creating}>{t('support.sendButton')}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Support;

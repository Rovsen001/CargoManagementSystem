import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text, Icon, Loader } from '@gravity-ui/uikit';
import { Bell, BellDot } from '@gravity-ui/icons';
import api from '../../services/api';

const NotificationBell = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            setUnreadCount(response.data.count || 0);
        } catch (err) {
            console.error('Bildiriş sayı çəkilərkən xəta:', err);
        }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const togglePanel = async () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next) {
            setLoading(true);
            try {
                const response = await api.get('/notifications');
                setNotifications(Array.isArray(response.data) ? response.data : []);
            } catch (err) {
                console.error('Bildirişlər çəkilərkən xəta:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
            fetchUnreadCount();
        } catch (err) {
            console.error('Bildiriş oxunmuş kimi işarələnərkən xəta:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Bildirişlər işarələnərkən xəta:', err);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div
                onClick={togglePanel}
                title="Bildirişlər"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#21262d',
                    border: '1px solid #30363d',
                    cursor: 'pointer',
                    position: 'relative'
                }}
            >
                <Icon data={unreadCount > 0 ? BellDot : Bell} size={18} style={{ color: unreadCount > 0 ? '#f0883e' : '#8b949e' }} />
                {unreadCount > 0 && (
                    <div style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        backgroundColor: '#f85149', color: '#fff', borderRadius: '10px',
                        minWidth: '18px', height: '18px', fontSize: '11px', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </div>
                )}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '48px', right: 0, width: '340px', maxHeight: '420px',
                    backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
                        <Text variant="subheader-2" style={{ color: '#ffffff' }}>Bildirişlər</Text>
                        {unreadCount > 0 && (
                            <Text
                                variant="caption-2"
                                style={{ color: '#58a6ff', cursor: 'pointer' }}
                                onClick={markAllAsRead}
                            >
                                Hamısını oxu
                            </Text>
                        )}
                    </div>

                    <div style={{ overflowY: 'auto', maxHeight: '360px' }}>
                        {loading ? (
                            <div style={{ padding: '24px', textAlign: 'center' }}><Loader size="m" /></div>
                        ) : notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center' }}>
                                <Text color="secondary">Bildiriş yoxdur.</Text>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => !n.isRead && markAsRead(n.id)}
                                    style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #21262d',
                                        backgroundColor: n.isRead ? 'transparent' : 'rgba(139, 92, 246, 0.08)',
                                        cursor: n.isRead ? 'default' : 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {!n.isRead && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8b5cf6', flexShrink: 0 }} />}
                                        <Text variant="body-2" style={{ fontWeight: n.isRead ? 400 : 600, color: '#f0f6fc' }}>{n.title}</Text>
                                    </div>
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px' }}>{n.message}</Text>
                                    <Text variant="caption-2" color="secondary" style={{ display: 'block', marginTop: '4px', fontSize: '11px' }}>
                                        {new Date(n.createdAt).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;

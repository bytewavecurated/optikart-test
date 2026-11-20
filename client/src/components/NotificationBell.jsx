import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck, FiX, FiInbox } from 'react-icons/fi';
import { banners as bannersApi, notifications } from '../services/api';
import { getSocket } from '../services/socket';

/**
 * The shopfront notification bell.
 *
 * The backend has long delivered per-account inboxes (fan-out suite) and the
 * REST half exposes list + mark-read + unreadCount - but a customer only ever
 * saw notification toasts while the tab happened to be open. Alerts that were
 * raised while a phone was locked simply did not exist. This is the small
 * surface that makes the existing pipeline visible: an unread dot, the last
 * items, mark-one/mark-all read, and deep links into the order, return, or
 * prescription the alert is actually about.
 *
 * Live updates ride the socket that auth already opens (`notification` /
 * `order_update` events per room); a 60s poll bounds the worst case if the
 * websocket dropped.
 *
 * It is mounted for customer sessions only (the consoles own their inbox
 * pages already, with a labelled link in the admin layout), and it fails
 * quietly: a bell that cannot fetch shows nothing, never an empty red dot.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offerLink, setOfferLink] = useState('');
  const boxRef = useRef(null);
  const navigate = useNavigate();

  // A live banner that names itself as a sale is the one link we ride into
  // the panel: it is the campaign the shopper is actually in. Best-effort:
  // an absent banner list never blocks the inbox.
  useEffect(() => {
    let live = true;
    bannersApi
      .getActive()
      .then((res) => {
        const list = (res.data?.banners || []).filter((b) => /offer|sale|festive|event|discount/i.test(String(b.title || '')));
        if (live && list[0]?.linkUrl) setOfferLink(String(list[0].linkUrl));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await notifications.list({ limit: 8 });
      const d = res.data || {};
      setItems(d.notifications || []);
      setUnread(d.unreadCount ?? (d.notifications || []).filter((n) => !n.isRead).length);
      setFailed(false);
    } catch {
      setFailed(true); // never loud: absence of data is not an error to show the shopper
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    const socket = getSocket();
    const onNotified = () => refresh();
    if (socket?.on) {
      socket.on('notification', onNotified);
      socket.on('order_update', onNotified);
    }
    return () => {
      clearInterval(t);
      if (socket?.off) {
        socket.off('notification', onNotified);
        socket.off('order_update', onNotified);
      }
    };
  }, [refresh]);

  // outside-click close
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const markRead = async (id) => {
    try {
      await notifications.markRead(id);
      setItems((xs) => xs.map((x) => (x._id === id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      refresh();
    }
  };

  const markAll = async () => {
    try {
      await notifications.markAllRead();
      setItems((xs) => xs.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch {
      refresh();
    }
  };

  const deepLink = (n) => {
    const d = n.data || {};
    if (d.returnId) return `/returns/${d.returnId}`;
    if (d.orderId) return `/order/${d.orderId}`;
    if (d.prescriptionId) return '/profile/prescriptions';
    return null;
  };

  if (failed) return null;

  const time = (ts) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications: ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-white)',
          cursor: 'pointer',
          padding: 6,
          position: 'relative',
          display: 'flex',
        }}
      >
        <FiBell size={20} />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 1,
              right: 1,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              background: 'var(--danger, #e53935)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent notifications"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 10px)',
            width: 'min(360px, calc(100vw - 24px))',
            background: 'var(--bg-white)',
            color: 'var(--text-primary)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg, 0 12px 40px rgba(0,0,0,.18))',
            border: '1px solid var(--border)',
            zIndex: 80,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border-light, #eee)',
              background: 'var(--bg-secondary)',
            }}
          >
            <strong style={{ fontSize: 13.5 }}>Notifications</strong>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}
                >
                  <FiCheck size={13} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <FiX size={15} />
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '26px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                <FiInbox size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>Nothing yet — order updates, returns and price alerts will appear here.</div>
              </div>
            ) : (
              items.map((n) => {
                const link = deepLink(n);
                return (
                  <div
                    key={n._id}
                    role={link ? 'button' : undefined}
                    tabIndex={link ? 0 : undefined}
                    onClick={() => {
                      if (!n.isRead) markRead(n._id);
                      if (link) {
                        setOpen(false);
                        navigate(link);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && link && e.currentTarget.click()}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '11px 14px',
                      borderBottom: '1px solid var(--border-light, #f2f2f2)',
                      cursor: link ? 'pointer' : 'default',
                      background: n.isRead ? 'transparent' : 'var(--primary-tint, rgba(55,125,245,.06))',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        marginTop: 5,
                        flexShrink: 0,
                        background: n.isRead ? 'transparent' : 'var(--primary)',
                        border: n.isRead ? '1px solid var(--border)' : 'none',
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: n.isRead ? 600 : 700 }}>{n.title || n.type}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message || ''}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>{time(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
            style={{ width: '100%', padding: '9px 0', background: 'none', border: 'none', borderTop: '1px solid var(--border-light, #eee)', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
          >
            View account activity
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck, FiChevronRight, FiInbox } from 'react-icons/fi';
import { notifications as notificationsApi, banners } from '../services/api';

/**
 * The notification bell.
 *
 * The fan-out, inboxes and the unread-count endpoint have existed for a long
 * time: `GET /api/notifications` is scoped by WHO is asking (customer,
 * console, partner, brand retailer - recipientScopeFor(principal)) and returns
 * `unreadCount`. What did not exist was a surface. Without one the whole
 * pipeline is only experienced when the account holder happens to visit the
 * inbox page for another reason. This closes the loop: a dot with the number,
 * the four most recent items, and two read paths (per item, mark-all) - plus
 * the one banner that matters most today, deep-linked exactly where the desk
 * aimed it.
 *
 * Mounted for the customer shell; consoles keep their own in-page inbox and
 * do not get a second one here. Socket events are optional sugar: the bell
 * is useful even before a push lands, and survives with no socket at all.
 */
function whereLink(n) {
  const d = n.data || {};
  if (d.orderId) return `/orders/${d.orderId}`;
  if (d.returnId) return `/customer/returns/${d.returnId}`;
  if (d.prescriptionId) return '/account/prescriptions';
  if (n.type === 'wishlist_price_drop' || n.type === 'wishlist_restock') return '/wishlist';
  if (n.type === 'low_stock_alert') return '/seller/inventory';
  if (d.saleEventId) return '/offers';
  return null; // the row still marks read; no invented destination
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const [offer, setOffer] = useState(null);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 6 });
      const d = res?.data || {};
      setItems(Array.isArray(d.notifications) ? d.notifications : []);
      setUnread(Number(d.unreadCount) || 0);
      setFailed(false);
    } catch (err) {
      // no session, dead API: the bell must not turn into an error state.
      setFailed(true);
      setUnread(0);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    let live = true;
    banners
      .getActive()
      .then((res) => {
        const list = res?.data?.banners || [];
        // the live banner carrying a campaign link is the one CTA the bell
        // promotes - the newest, per server sort; only truly useful ones show.
        const best =
          list.find(
            (b) =>
              (b.linkUrl || b.link) && /offer|sale|event|festive|% off|coupon/i.test(`${b.title} ${b.subtitle || ''}`)
          ) || list.find((b) => b.linkUrl || b.link);
        if (live && best) setOffer({ title: best.title || 'Featured offer', href: best.linkUrl || best.link });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // socket live update (optional: the polling interval is the floor)
  useEffect(() => {
    let sock;
    let off = [];
    import('../services/socket')
      .then(({ getSocket }) => {
        sock = getSocket?.();
        if (!sock?.on) return;
        const onIt = () => refresh();
        sock.on('notification:new', onIt);
        off.push(['notification:new', onIt]);
      })
      .catch(() => {});
    return () => {
      try {
        off.forEach(([ev, fn]) => sock?.off?.(ev, fn));
      } catch {}
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);

  const mark = async (n) => {
    if (n.isRead) return;
    try {
      await notificationsApi.markRead(n._id);
      setUnread((u) => Math.max(0, u - 1));
      setItems((xs) => xs.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    } catch {
      refresh();
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnread(0);
      setItems((xs) => xs.map((x) => ({ ...x, isRead: true })));
    } catch {
      refresh();
    }
  };

  const time = (n) => {
    const mins = Math.floor((Date.now() - new Date(n.createdAt).getTime()) / 60000);
    if (!Number.isFinite(mins) || mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / (60 * 24))}d`;
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          color: 'var(--text-white)',
          cursor: 'pointer',
          padding: 8,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <FiBell size={20} />
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 2,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              borderRadius: 999,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg-dark, #111)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(360px, calc(100vw - 24px))',
            background: 'var(--bg-white)',
            color: 'var(--text-primary)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            boxShadow: '0 18px 48px rgba(0,0,0,.18)',
            zIndex: 80,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-light)',
              background: 'var(--bg-secondary, #fafafa)',
            }}
          >
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            {unread > 0 && (
              <button
                onClick={markAll}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                <FiCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {failed ? (
            <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              <FiInbox size={22} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>Sign in to see your alerts.</div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '26px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              <FiInbox size={22} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>No alerts yet - order updates and offers land here.</div>
            </div>
          ) : (
            items.map((n) => {
              const href = whereLink(n);
              return (
                <button
                  key={n._id}
                  onClick={() => {
                    mark(n);
                    if (href) {
                      setOpen(false);
                      navigate(href);
                    }
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: n.isRead ? 'transparent' : 'var(--primary-tint, rgba(63,81,181,.06))',
                    border: 'none',
                    borderBottom: '1px solid var(--border-light, #f1f1f1)',
                    cursor: 'pointer',
                    padding: '11px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: n.isRead ? 600 : 700, fontSize: 13.5 }}>{n.title || 'Update'}</span>
                    <span style={{ color: 'var(--text-light)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{time(n)}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 2, lineHeight: 1.45 }}>
                    {n.message || ''}
                  </div>
                  {href && (
                    <span
                      style={{
                        color: 'var(--primary)',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 5,
                      }}
                    >
                      Open <FiChevronRight size={12} />
                    </span>
                  )}
                </button>
              );
            })
          )}

          {offer && (
            <div
              style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border-light, #eee)',
                background: 'var(--bg-secondary, #fafafa)',
              }}
            >
              <button
                onClick={() => {
                  setOpen(false);
                  navigate(offer.href);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: 'none',
                  background: 'none',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <span>Active now: {offer.title}</span>
                <FiChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiBell, FiPackage, FiTag, FiTruck, FiStar, FiCheck, FiX } from 'react-icons/fi';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: 'order',
    title: 'Order Shipped',
    message: 'Your order #ORD-2026-4521 has been shipped via Blue Dart',
    time: '2 min ago',
    read: false,
    link: '/orders/ORD-2026-4521',
    icon: <FiTruck />,
  },
  {
    id: 2,
    type: 'offer',
    title: 'Flash Sale Alert!',
    message: 'Up to 70% off on Ray-Ban sunglasses. Offer ends tonight!',
    time: '1 hour ago',
    read: false,
    link: '/sale/flash',
    icon: <FiTag />,
  },
  {
    id: 3,
    type: 'order',
    title: 'Order Delivered',
    message: 'Your order #ORD-2026-4498 has been delivered successfully',
    time: 'Yesterday',
    read: true,
    link: '/orders/ORD-2026-4498',
    icon: <FiCheck />,
  },
  {
    id: 4,
    type: 'review',
    title: 'Rate Your Purchase',
    message: 'How was your recent purchase of Aviator Classic? Leave a review!',
    time: '2 days ago',
    read: true,
    link: '/orders/ORD-2026-4450/review',
    icon: <FiStar />,
  },
  {
    id: 5,
    type: 'offer',
    title: 'New Arrival: Oakley 2026',
    message: 'Explore the latest Oakley collection starting at ₹4,999',
    time: '3 days ago',
    read: true,
    link: '/brands/oakley',
    icon: <FiPackage />,
  },
];

const TYPE_COLORS = {
  order: '#2874f0',
  offer: '#ff9f00',
  review: '#388e3c',
};

const styles = {
  wrapper: {
    position: 'relative',
    fontFamily: "'Roboto', sans-serif",
  },
  bellBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    position: 'relative',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '20px',
  },
  badge: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: '#ff9f00',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '50%',
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #2874f0',
  },
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '380px',
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 1100,
    marginTop: '8px',
    overflow: 'hidden',
    animation: 'notifSlideDown 0.2s ease',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #f0f0f0',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#212121',
  },
  markAllRead: {
    fontSize: '12px',
    color: '#2874f0',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  list: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    gap: '12px',
    padding: '14px 16px',
    borderBottom: '1px solid #f5f5f5',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  itemUnread: {
    background: '#f0f6ff',
  },
  iconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '16px',
    color: '#fff',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#212121',
    marginBottom: '2px',
  },
  itemMessage: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  itemTime: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#2874f0',
    flexShrink: 0,
    marginTop: '6px',
  },
  footer: {
    padding: '12px 16px',
    textAlign: 'center',
    borderTop: '1px solid #f0f0f0',
  },
  viewAllLink: {
    color: '#2874f0',
    fontWeight: 600,
    fontSize: '14px',
    textDecoration: 'none',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#888',
    fontSize: '14px',
  },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const wrapperRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    setOpen(false);
  };

  return (
    <div style={styles.wrapper} ref={wrapperRef}>
      <button
        style={styles.bellBtn}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button style={styles.markAllRead} onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div style={styles.list}>
            {notifications.length === 0 ? (
              <div style={styles.empty}>No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  to={notif.link}
                  style={{
                    ...styles.item,
                    ...(!notif.read ? styles.itemUnread : {}),
                  }}
                  onClick={() => handleItemClick(notif)}
                  className="notif-item"
                >
                  <div
                    style={{
                      ...styles.iconWrap,
                      background: TYPE_COLORS[notif.type] || '#888',
                    }}
                  >
                    {notif.icon}
                  </div>
                  <div style={styles.itemContent}>
                    <div style={styles.itemTitle}>{notif.title}</div>
                    <div style={styles.itemMessage}>{notif.message}</div>
                    <div style={styles.itemTime}>{notif.time}</div>
                  </div>
                  {!notif.read && <div style={styles.unreadDot} />}
                </Link>
              ))
            )}
          </div>

          <div style={styles.footer}>
            <Link to="/notifications" style={styles.viewAllLink}>
              View All Notifications
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .notif-item:hover { background: #f8f9fa !important; }
        @media (max-width: 480px) {
          .notif-item { padding: 10px 12px !important; }
        }
      `}</style>
    </div>
  );
}

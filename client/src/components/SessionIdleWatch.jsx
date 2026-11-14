import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock } from 'react-icons/fi';
import api, { auth as authApi } from '../services/api';
import { toast } from '../services/api';

/*
 * Signs a console out when it has genuinely been left alone.
 *
 * The server is the authority here (see server/services/sessionActivity.js): it
 * refuses an idled session on its next request, whatever the browser thinks.
 * This component exists for the two things the server cannot do from its side -
 * warn someone before their work disappears, and actually move them off a screen
 * that is going to keep making no requests forever.
 *
 * The countdown is driven by the window the server reports, not a copy of it, so
 * tightening SESSION_IDLE_MINUTES changes the warning and the rule together. A
 * banner that promises an hour and delivers fifteen minutes is worse than no
 * banner: it teaches people to distrust the one warning that matters.
 *
 * Customers are excluded on purpose. Their sessions expire, and interrupting a
 * browsing session that went quiet is cost without benefit - the risk being
 * managed here is a shared counter terminal, not a personal device.
 */
const LOGIN_BY_ROLE = {
  admin: '/admin/login',
  staff: '/staff/login',
  executive: '/executive/login',
  manufacturer: '/manufacturer/login',
  manufacturerSeller: '/manufacturer-seller/login',
  deliveryPartner: '/delivery-partner/login'
};

// Prompt again this long before the drop, and once more a minute out.
const WARN_AT_SECONDS = [300, 60];

const SessionIdleWatch = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(null);
  const warned = useRef(new Set());
  const signedOut = useRef(false);

  const signOut = useCallback(async (message) => {
    if (signedOut.current) return;
    signedOut.current = true;
    const role = localStorage.getItem('optikart_role');
    try {
      const path = role === 'seller' ? '/seller/logout' : LOGIN_BY_ROLE[role] ? `/auth/logout` : '/auth/logout';
      await api.post(path).catch(() => {});
    } finally {
      // The console-specific logout actions also clear context state; a plain
      // reload does the same job without importing every role's context.
      ['optikart_token', 'optikart_role', 'optikart_user', 'optikart_session_expiry'].forEach((k) => localStorage.removeItem(k));
      toast.info(message || 'Signed out after a period of inactivity.');
      navigate(LOGIN_BY_ROLE[role] || '/login', { replace: true });
      window.setTimeout(() => window.location.reload(), 150);
    }
  }, [navigate]);

  useEffect(() => {
    let stopped = false;
    let timer = null;

    const tick = async () => {
      const role = localStorage.getItem('optikart_role');
      if (!role || !LOGIN_BY_ROLE[role] || !localStorage.getItem('optikart_token')) {
        if (!stopped) setCountdown(null);
        return;
      }
      try {
        // Ask the server how long this session has actually been idle rather
        // than timing keystrokes here: a laptop with its lid shut generates no
        // events, and a session must still end.
        const res = await authApi.sessionPolicy();
        if (stopped) return;
        const policy = res.data?.policy || {};
        if (!policy.controlled || typeof policy.secondsRemaining !== 'number') {
          setCountdown(null);
          return;
        }
        const left = policy.secondsRemaining;
        setCountdown(left);
        for (const mark of WARN_AT_SECONDS) {
          if (left <= mark && !warned.current.has(mark)) {
            warned.current.add(mark);
            toast.warn(`This console signs itself out in ${Math.max(1, Math.round(left / 60))} minute${left > 90 ? 's' : ''} of no activity. Work you have not sent will be lost.`, { duration: 8000 });
          }
        }
        if (left <= 0) await signOut('Signed out: this console was left idle.');
      } catch (error) {
        if (stopped) return;
        // If the server refused the session, it has already said why - the guard
        // returns SESSION_IDLE and the axios interceptor signs the user out. No
        // second message here, or one event shows up as two different popups.
        if (error.response?.data?.code === 'SESSION_IDLE' && !signedOut.current) {
          await signOut(error.response.data.message);
        }
      }
    };

    tick();
    timer = setInterval(tick, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [signOut]);

  if (countdown === null || countdown > WARN_AT_SECONDS[0]) return null;

  const minutes = Math.max(0, Math.floor(countdown / 60));
  const seconds = countdown % 60;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 18,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md, 12px)',
        background: 'var(--bg-white, #fff)',
        border: '1px solid var(--warning, #d97706)',
        boxShadow: 'var(--shadow-md, 0 8px 24px rgba(15, 23, 42, .14))',
        fontSize: 13
      }}
    >
      <FiClock style={{ color: 'var(--warning-dark, #8a6d3b)' }} />
      <span>
        Idle sign-out in <strong>{minutes}:{String(seconds).padStart(2, '0')}</strong>
      </span>
      <a
        href="#main-content"
        onClick={() => { warned.current.clear(); }}
        style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
      >
        Keep working
      </a>
    </div>
  );
};

export default SessionIdleWatch;

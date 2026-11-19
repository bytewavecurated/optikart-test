import React, { useEffect, useState } from 'react';
import { admin as adminApi } from '../../services/api';

// Ops read-out of middleware/requestContext.js. One card; no new server work -
// it is a window onto what the process already tallies on every response.
const SystemMetricsCard = () => {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = () =>
      adminApi
        .getSystemMetrics()
        .then((res) => live && setM(res?.data?.metrics || null))
        .catch(() => live && setError('Cannot read metrics from this server.'));
    load();
    const t = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (error) return <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</p>;
  if (!m)
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );

  const upMin = Math.floor(m.uptimeSeconds / 60);
  const reqPerMin = m.uptimeSeconds > 0 ? (m.requests / Math.max(1, upMin)).toFixed(1) : '0';
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 14 }}>
        <span>
          <strong>{m.requests.toLocaleString()}</strong> requests since boot
        </span>
        <span>
          <strong>{reqPerMin}</strong>/min · up <strong>{upMin}</strong>m
        </span>
        <span
          style={{
            color: m.errorRatio5xx > 0.001 ? 'var(--danger, #b00020)' : undefined,
            fontWeight: m.errorRatio5xx > 0.001 ? 600 : 400,
          }}
        >
          {(m.errorRatio5xx * 100).toFixed(2)}% 5xx
        </span>
        <span>4xx {(m.byStatusClass?.['4xx'] || 0).toLocaleString()}</span>
      </div>
      {m.lastError && (
        <div style={{ marginBottom: 12, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
          <strong>recent error</strong> · <code>{m.lastError.id || m.lastError.reqId || ''}</code>{' '}
          {m.lastError.path || ''} {m.lastError.message || ''} (
          {new Date(m.lastError.at || Date.now()).toLocaleTimeString()})
        </div>
      )}
      {m.slowestCalls?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong>slowest this process</strong>
          {m.slowestCalls.slice(0, 6).map((s) => (
            <div key={s.at + s.route} style={{ display: 'flex', gap: 12, color: 'var(--text-secondary)' }}>
              <span style={{ minWidth: 70 }}>{s.ms}ms</span>
              <span style={{ flex: 1, overflow: 'auto hidden', textOverflow: 'ellipsis' }}>{s.route || s.path}</span>
              <span>{new Date(s.at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
      <p style={{ color: 'var(--text-secondary)', marginTop: 10 }}>{m.note}</p>
    </div>
  );
};

export default SystemMetricsCard;

import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toastError } from '../../services/errors';
import { FiRefreshCw, FiAlertTriangle, FiHardDrive, FiServer, FiFolder, FiCheckCircle } from 'react-icons/fi';

/*
 * Storage: where the app's files actually are.
 *
 * The project rule is that user uploads belong in Cloudinary, and nothing about
 * a deployment proves it. Before this page the only way to find out was to read
 * env vars on the box or discover a broken image months after a container was
 * replaced - because files written to this server's disk are gone with it, and a
 * document keeps pointing at a path that no longer exists with no error anywhere.
 *
 * So the page answers three questions, in this order:
 *
 *  1. Which backend is live right now, and is it the one the operator asked for?
 *     A development fallback is honest only if it says so; here `fellBack` is
 *     surfaced instead of being assumed.
 *  2. How many stored references still live on this machine's disk, and in which
 *     collections? That number, not an adjective, is what the decommissioning
 *     or a storage migration needs.
 *  3. Which rows, so somebody can act. An aggregate cannot be fixed, a row can.
 *
 * The counts come from an inventory that refuses to answer at all if its field
 * map no longer matches the schemas (see server/services/storageInventory.js):
 * an inventory over a renamed field returns nothing and looks like good news.
 */

const styles = {
  page: { padding: '20px 24px', fontFamily: 'var(--font-body)', color: 'var(--text-primary)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '6px' },
  title: { fontSize: '22px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  sub: { color: 'var(--text-light)', fontSize: '13px', marginBottom: '18px', maxWidth: '880px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' },
  card: {
    border: '1px solid var(--bg-subtle)',
    borderRadius: 'var(--radius-xs)',
    padding: '14px 16px',
    minWidth: '210px',
    background: 'var(--bg-white)',
  },
  cardLabel: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-light)' },
  cardValue: { fontSize: '20px', fontWeight: 700, marginTop: '4px' },
  cardNote: { fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' },
  banner: {
    border: '1px solid',
    borderRadius: 'var(--radius-xs)',
    padding: '12px 14px',
    marginBottom: '16px',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    fontSize: '13px',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid var(--bg-subtle)',
    color: 'var(--text-light)',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--bg-subtle)', verticalAlign: 'top' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', wordBreak: 'break-all' },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--bg-white)',
    border: '1px solid var(--bg-subtle)',
    borderRadius: 'var(--radius-xs)',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  sectionTitle: { fontSize: '15px', fontWeight: 700, margin: '22px 0 8px' },
  empty: { color: 'var(--text-light)', fontSize: '13px', padding: '10px 0' },
};

const StorageManagement = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/storage-inventory');
      setData(res.data);
    } catch (e) {
      const body = e?.response?.data;
      if (body?.drift) {
        setError({ title: 'The inventory cannot be trusted yet', detail: body.message, list: body.drift });
      } else {
        toastError(e, 'Could not read storage status');
        setError({ title: 'Storage status could not be read', detail: body?.message || e?.message || 'Unknown error' });
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const storage = data?.storage;
  const inventory = data?.inventory;
  const localRefs = inventory?.totals?.local ?? 0;
  const suspect = inventory?.totals?.suspect ?? 0;
  const relative = inventory?.totals?.relative ?? 0;
  const rowsNeedingMigration = inventory?.totals?.rowsNeedingMigration ?? 0;

  return (
    <div style={styles.page}>
      <div style={styles.head}>
        <h1 style={styles.title}>
          <FiHardDrive /> Storage
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" style={styles.button} onClick={load} disabled={loading}>
            <FiRefreshCw /> {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p style={styles.sub}>
        Which provider holds uploaded files, and how many references still point at this server's own disk. Files stored
        here do not survive a redeploy, so this page exists to make that count visible before it becomes a set of broken
        images.
      </p>

      {error ? (
        <div style={{ ...styles.banner, borderColor: 'var(--danger)', background: 'var(--danger-light)' }}>
          <FiAlertTriangle style={{ marginTop: '2px' }} />
          <div>
            <strong>{error.title}</strong>
            <div style={{ marginTop: '4px' }}>{error.detail}</div>
            {error.list ? (
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {error.list.map((d) => (
                  <li key={d} style={{ ...styles.mono, fontSize: '12px' }}>
                    {d}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {!error && storage ? (
        <>
          <div style={styles.row}>
            <div style={styles.card}>
              <div style={styles.cardLabel}>
                <FiServer style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Backend in use
              </div>
              <div style={styles.cardValue}>{storage.backend === 'cloudinary' ? 'Cloudinary' : 'Local disk'}</div>
              <div style={styles.cardNote}>
                {storage.backend === 'cloudinary'
                  ? `assets under prefix ${storage.prefix}`
                  : 'files written under server/uploads on this container'}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>
                <FiFolder style={{ verticalAlign: '-2px', marginRight: '4px' }} /> Served from
              </div>
              <div style={{ ...styles.cardValue, fontSize: '15px' }}>{storage.servedFrom}</div>
              <div style={styles.cardNote}>
                {storage.backend === 'cloudinary' ? 'outside this machine' : 'same origin as the app'}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>References on disk</div>
              <div style={{ ...styles.cardValue, color: localRefs ? 'var(--danger)' : 'var(--success)' }}>
                {localRefs}
              </div>
              <div style={styles.cardNote}>
                {localRefs ? `${rowsNeedingMigration} row(s) to move` : 'nothing left here'}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>Unreadable references</div>
              <div style={{ ...styles.cardValue, color: suspect + relative ? 'var(--danger)' : 'var(--success)' }}>
                {suspect + relative}
              </div>
              <div style={styles.cardNote}>values that are not a usable URL at all</div>
            </div>
          </div>

          {storage.fellBack ? (
            <div style={{ ...styles.banner, borderColor: 'var(--warning)', background: 'var(--warning-light)' }}>
              <FiAlertTriangle style={{ marginTop: '2px' }} />
              <div>
                <strong>Running on the development fallback.</strong> STORAGE_BACKEND chose local disk because no
                Cloudinary credentials were found. Uploads made like this are not backed up and are lost when this
                instance is replaced; in production the app refuses to start in this state.
                <div style={{ marginTop: '4px', fontSize: '12px' }}>
                  STORAGE_BACKEND is <code>{storage.requested || 'auto'}</code> and Cloudinary credentials{' '}
                  {storage.credentialsFound ? 'were found' : 'were not found'}. The server's own startup log names the
                  same two values, which is the only way to tell "no credentials" from "credentials, wrong backend".
                </div>
              </div>
            </div>
          ) : null}

          {localRefs === 0 && suspect + relative === 0 ? (
            <div style={{ ...styles.banner, borderColor: 'var(--success)', background: 'var(--success-light)' }}>
              <FiCheckCircle style={{ marginTop: '2px' }} />
              <div>
                Every stored reference this app could find points outside this machine. That includes assets uploaded
                before this page existed only if the backfill ran (see the reading notes below).
              </div>
            </div>
          ) : null}

          <h2 style={styles.sectionTitle}>Asset references by collection</h2>
          {inventory?.byField?.length ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Where</th>
                  <th style={styles.th}>Field</th>
                  <th style={{ ...styles.th, ...styles.num }}>Rows</th>
                  <th style={{ ...styles.th, ...styles.num }}>On disk</th>
                  <th style={{ ...styles.th, ...styles.num }}>External</th>
                  <th style={{ ...styles.th, ...styles.num }}>Broken</th>
                  <th style={{ ...styles.th, ...styles.num }}>Blank</th>
                </tr>
              </thead>
              <tbody>
                {inventory.byField.map((f) => (
                  <tr key={`${f.model}.${f.field}`}>
                    <td style={styles.td}>
                      <strong>{f.label}</strong>
                      <div style={{ ...styles.mono, color: 'var(--text-light)' }}>{f.model}</div>
                    </td>
                    <td style={{ ...styles.td, ...styles.mono }}>{f.field}</td>
                    <td style={{ ...styles.td, ...styles.num }}>{f.rows}</td>
                    <td
                      style={{ ...styles.td, ...styles.num, color: f.references.local ? 'var(--danger)' : undefined }}
                    >
                      {f.references.local}
                    </td>
                    <td style={{ ...styles.td, ...styles.num }}>{f.references.remote}</td>
                    <td
                      style={{
                        ...styles.td,
                        ...styles.num,
                        color: f.references.suspect + f.references.relative ? 'var(--danger)' : undefined,
                      }}
                    >
                      {f.references.suspect + f.references.relative}
                    </td>
                    <td style={{ ...styles.td, ...styles.num, color: 'var(--text-light)' }}>{f.references.absent}</td>
                  </tr>
                ))}
                {inventory.byField.some((f) => f.references.dataUrl) ? (
                  <tr>
                    <td colSpan={7} style={{ ...styles.td, color: 'var(--danger)' }}>
                      Some rows embed file bytes directly (data: URLs). These bloat every read of the document and
                      should be moved to the storage service.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <div style={styles.empty}>Nothing to count yet.</div>
          )}

          {inventory?.samples?.length ? (
            <>
              <h2 style={styles.sectionTitle}>Examples that need moving</h2>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Collection</th>
                    <th style={styles.th}>Row</th>
                    <th style={styles.th}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.samples.map((s) => (
                    <tr key={`${s.model}-${s.field}-${s.id}`}>
                      <td style={styles.td}>
                        {s.label}
                        <div style={{ ...styles.mono, color: 'var(--text-light)' }}>{s.model}</div>
                      </td>
                      <td style={{ ...styles.td, ...styles.mono }}>{s.id}</td>
                      <td style={{ ...styles.td, ...styles.mono }}>{s.references.join('  ·  ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <h2 style={styles.sectionTitle}>How to read the buckets</h2>
          <ul style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, paddingLeft: '18px' }}>
            {Object.entries(inventory?.reading || {}).map(([key, text]) => (
              <li key={key}>
                <strong>{key}</strong> — {text}
              </li>
            ))}
          </ul>
          <p style={{ ...styles.sub, marginTop: '14px' }}>
            Counted at {data?.countedAt ? new Date(data.countedAt).toLocaleString('en-IN') : '—'}. Upload counters are
            per process, so they reset on restart and are not a substitute for the inventory above.
          </p>
        </>
      ) : null}

      {!loading && !error && !storage ? <div style={styles.empty}>Loading…</div> : null}
    </div>
  );
};

export default StorageManagement;

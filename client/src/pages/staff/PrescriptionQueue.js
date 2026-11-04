import React, { useState, useEffect, useCallback } from 'react';
import { prescriptionVerification } from '../../services/api';
import { FiCheckCircle, FiXCircle, FiExternalLink, FiFileText, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';
import toast from 'react-hot-toast';

/**
 * The prescription queue.
 *
 * Someone glazes lenses to these numbers, so the check is the safety step in the
 * whole ordering flow - which is why a rejection has to carry a reason the
 * customer can act on, and why approving from here records who did it.
 *
 * What each eye says on the sheet is shown next to the document link, because a
 * verifier otherwise has to open a file, look at the record, and hold both in
 * their head to spot a transposed axis.
 */

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13.5, borderBottom: '1px solid var(--border-light)', verticalAlign: 'top' };

const STATUS_TONE = {
  pending: { color: 'var(--warning)', bg: 'var(--warning-light)' },
  needs_review: { color: 'var(--danger)', bg: 'var(--danger-light)' },
  approved: { color: 'var(--success)', bg: 'var(--success-light)' },
  rejected: { color: 'var(--text-secondary)', bg: 'var(--bg-subtle)' }
};

const signed = (n) => (n === undefined || n === null ? '' : `${n > 0 ? '+' : ''}${n}`);

/** The prescription records sphere / cylinder / axis / addition per eye. */
const eyeText = (eye) => {
  if (!eye) return '—';
  const parts = [];
  if (eye.sphere !== undefined && eye.sphere !== null) parts.push(`S ${signed(eye.sphere)}`);
  if (eye.cylinder !== undefined && eye.cylinder !== null) parts.push(`C ${signed(eye.cylinder)}`);
  if (eye.axis !== undefined && eye.axis !== null) parts.push(`× ${eye.axis}`);
  if (eye.addition !== undefined && eye.addition !== null) parts.push(`ADD ${signed(eye.addition)}`);
  if (eye.prism) parts.push(`${eye.prism}${eye.base || ''}`);
  return parts.length ? parts.join(' · ') : '—';
};

const validationFlags = (v) => {
  const r = v.validationResults || {};
  const flags = Array.isArray(r.flags) ? r.flags : [];
  if (r.isValidFormat === false && flags.length === 0) return ['Values outside a plausible range'];
  return flags;
};

export default function PrescriptionQueue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = showAll ? await prescriptionVerification.all({}) : await prescriptionVerification.pending();
      setRows(listOf(res.data));
    } catch (e) {
      const data = e.response?.data;
      setErr(data?.message || 'Could not load the queue');
      toastError(e, 'Could not load the queue');
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { load(); }, [load]);

  const approve = async (row) => {
    setBusy(row._id);
    try {
      await prescriptionVerification.approve(row._id, note.trim());
      toast.success('Prescription approved');
      setNote('');
      load();
    } catch (e) {
      toastError(e, 'Approval failed');
    } finally {
      setBusy('');
    }
  };

  const reject = async (row) => {
    if (!reason.trim()) {
      toast.error('Add a short reason so the customer knows what to do next');
      return;
    }
    setBusy(row._id);
    try {
      await prescriptionVerification.reject(row._id, reason.trim());
      toast.success('Prescription rejected with the reason attached');
      setReason('');
      setRejecting('');
      load();
    } catch (e) {
      toastError(e, 'Rejection failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {showAll ? 'All prescription checks' : 'Waiting to be checked'}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rows.length} record(s)</span>
        <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 13 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show pending only' : 'Show history'}
        </button>
      </div>

      {err && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', color: 'var(--danger)', fontSize: 13.5 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 50, textAlign: 'center' }}><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 34, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FiCheckCircle size={30} color="var(--success)" />
          <p style={{ margin: '10px 0 0' }}>{showAll ? 'No prescription records yet.' : 'Nothing waiting. Every upload has been checked.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Patient', 'Right eye', 'Left eye', 'Lens / PD', 'Optometrist', 'Uploaded', 'Findings', 'Decision'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.prescription || {};
                const tone = STATUS_TONE[row.status] || STATUS_TONE.pending;
                const flags = validationFlags(row);
                const open = rejecting === row._id;
                return (
                  <tr key={row._id}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{p.patientName || row.user?.name || 'Customer'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{row.user?.email || '—'}</div>
                    </td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{eyeText(p.rightEye)}</td>
                    <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{eyeText(p.leftEye)}</td>
                    <td style={{ ...td, fontSize: 12.5 }}>
                      <div>{p.type || '—'}</div>
                      <div style={{ color: 'var(--text-light)' }}>{p.pd ? `PD ${p.pd}` : ''}{p.nearPd ? ` · near ${p.nearPd}` : ''}</div>
                    </td>
                    <td style={td}>
                      {p.doctorName || '—'}
                      {p.dateOfExamination && (
                        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                          examined {new Date(p.dateOfExamination).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      <div><FiClock size={11} /> {new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      {p.fileUrl && (
                        <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', fontSize: 12.5, display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                          <FiFileText size={12} /> open file <FiExternalLink size={11} />
                        </a>
                      )}
                      {!p.fileUrl && <div style={{ fontSize: 12, color: 'var(--text-light)' }}>typed values only</div>}
                    </td>
                    <td style={{ ...td, maxWidth: 240 }}>
                      {flags.length === 0 ? (
                        <span style={{ fontSize: 12.5, color: 'var(--success)' }}>values look plausible</span>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--danger)' }}>
                          {flags.map((x, i) => <li key={i}>{x}</li>)}
                        </ul>
                      )}
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>
                          {String(row.status).replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td, maxWidth: 230 }}>
                      {row.status === 'approved' && (
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          <FiCheckCircle size={12} color="var(--success)" /> by {row.verifiedByName || 'staff'}
                          {row.adminNotes ? ` — ${row.adminNotes}` : ''}
                        </div>
                      )}
                      {row.status === 'rejected' && (
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          <FiXCircle size={12} color="var(--danger)" /> {row.rejectionReason || 'no reason recorded'}
                        </div>
                      )}
                      {(row.status === 'pending' || row.status === 'needs_review') && (
                        <>
                          {row.verifiedBy ? <div style={{ fontSize: 12.5, color: 'var(--text-light)', marginBottom: 6 }}>checked by {row.verifiedBy}</div> : null}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '5px 10px', fontSize: 12.5 }}
                              disabled={busy === row._id}
                              onClick={() => approve(row)}
                            >
                              <FiCheckCircle size={12} /> Approve
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '5px 10px', fontSize: 12.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                              onClick={() => { setRejecting(open ? '' : row._id); setReason(''); }}
                            >
                              <FiXCircle size={12} /> Reject
                            </button>
                          </div>
                          <input
                            className="input"
                            placeholder="Note for the file (optional)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            style={{ marginTop: 6, padding: '5px 8px', fontSize: 12.5 }}
                          />
                          {open && (
                            <div style={{ marginTop: 8 }}>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                <FiAlertTriangle size={11} /> Reason the customer will see
                              </label>
                              <textarea
                                className="input"
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                                placeholder="e.g. The left-eye axis is missing - please re-upload a clearer photo of the prescription"
                                style={{ width: '100%', fontSize: 12.5, fontFamily: 'inherit' }}
                              />
                              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12.5, color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={busy === row._id} onClick={() => reject(row)}>
                                  {busy === row._id ? 'Saving…' : 'Confirm rejection'}
                                </button>
                                <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => setRejecting('')}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

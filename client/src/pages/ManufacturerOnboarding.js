import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { onboarding as onboardingApi } from '../services/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

// Public, token-addressed page opened from the manufacturer confirmation
// mail. Two doors with genuinely different consequences: VERIFY escalates to
// an emailed OTP (account instated only on that code), UPDATE INFO files a
// proposal the desk must consciously re-create - nothing here edits an
// already-trading record.
const ManufacturerOnboarding = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [view, setView] = useState(null); // {onboarding, company}
  const [mode, setMode] = useState(params.get('mode') === 'update' ? 'update' : 'idle');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState(null);
  const [updates, setUpdates] = useState({});
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState([]);

  const load = async () => {
    try {
      const res = await onboardingApi.get(token);
      const d = res.data || {};
      if (!d.success) {
        setView({ failed: true, message: d.message || 'This link is not valid.' });
        return;
      }
      // The mail's Update button pre-selects the proposal form on first open.
      if (d.onboarding.state === 'pending_verification' && params.get('mode') === 'update') setMode('update');
      setView(d);
    } catch (e) {
      setView({ failed: true, message: e.response?.data?.message || 'Could not load this invitation.' });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [token]);

  if (!view) {
    return (
      <>
        <Header />
        <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div className="spinner" />
        </div>
        <Footer />
      </>
    );
  }
  if (view.failed) {
    return (
      <>
        <Header />
        <div className="container" style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px' }}>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <h2 style={{ marginBottom: 8 }}>Invitation not usable</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{view.message}</p>
            <p style={{ marginTop: 16 }}>
              <Link to="/manufacturer" className="btn btn-outline">
                Go to manufacturer sign-in
              </Link>
            </p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const { onboarding, company } = view;
  const state = onboarding.state;

  // ---- terminal states read plainly, no action theater ----
  const bannerFor = {
    pending_verification: 'Step 1: confirm the recorded details below, or ask for corrections.',
    pending_otp: 'A 6-digit activation code has been sent to the email above. Enter it to finish.',
    update_requested:
      'Your corrections are with the OptiKart desk. Nothing is live yet; a fresh confirmation mail follows when they re-create the invitation.',
    active: 'This manufacturer record is confirmed and active. Sign in from the manufacturer console.',
    declined: 'This invitation was closed by the desk.',
  };

  const fieldLabel = (k) =>
    ({
      name: 'Contact name',
      companyName: 'Company name',
      email: 'Email',
      phone: 'Phone',
      gstNumber: 'GSTIN',
      panNumber: 'PAN',
      website: 'Website',
      'bank.accountNumber': 'Bank account number',
      'bank.ifscCode': 'IFSC',
      'bank.bankName': 'Bank name',
      'bank.branchName': 'Branch',
      'address.street': 'Street',
      'address.city': 'City',
      'address.state': 'State',
      'address.pincode': 'PIN code',
    })[k] || k;

  const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  const UPD_FIELDS = [
    'name',
    'companyName',
    'email',
    'phone',
    'gstNumber',
    'panNumber',
    'website',
    'bank.accountNumber',
    'bank.ifscCode',
    'bank.bankName',
    'bank.branchName',
    'address.street',
    'address.city',
    'address.state',
    'address.pincode',
  ];

  const onVerify = async () => {
    setBusy(true);
    try {
      const res = await onboardingApi.verify(token);
      const d = res.data || {};
      if (d.success) {
        if (d.devCode) setDevCode(d.devCode);
        toast.success(d.message);
        load();
      } else toast.error(d.message || 'Could not start activation.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const onOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await onboardingApi.otp(token, { otp: e.target.elements.otp.value.trim() });
      const d = res.data || {};
      if (d.success) {
        toast.success(d.message);
        // Activation retires the handle - render the terminal state from this
        // response instead of re-GETting the (correctly now-dead) token, which
        // would show 'invitation not usable' to someone who just succeeded.
        if (d.onboarding?.state === 'active') {
          setView({ onboarding: { ...view.onboarding, state: 'active' }, company: view.company });
        } else load();
      } else toast.error(d.message);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    setBusy(true);
    const flat = {};
    for (const [k, v] of Object.entries(updates)) {
      if (String(v ?? '') === '') continue;
      if (k.includes('.')) {
        const [a, b] = k.split('.');
        flat[a] = { ...(flat[a] || {}), [b]: v };
      } else flat[k] = v;
    }
    try {
      const res = await onboardingApi.update(token, { updates: flat, note });
      const d = res.data || {};
      setErrors(d.errors || []);
      if (d.success) {
        toast.success(d.message);
        load();
      } else toast.error(d.message || 'The proposal was not accepted.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not send the proposal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container" style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Manufacturer confirmation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0 }}>
            {bannerFor[state] || 'Review this invitation.'}
          </p>
          {!onboarding.mailDelivered && state === 'pending_verification' && (
            <p style={{ fontSize: 12, color: 'var(--danger, #b00020)' }}>
              Deliverability note from your mail copy: this box could not send via SMTP
              {onboarding.mailNote ? ` (${onboarding.mailNote})` : ''}.
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>On record</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {UPD_FIELDS.map((f) => (
                <tr key={f}>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', width: 200 }}>{fieldLabel(f)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <strong>{(get(company, f) || '—').toString()}</strong>
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>Brands</td>
                <td style={{ padding: '6px 8px' }}>
                  <strong>{(company.brands || []).join(', ') || '—'}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {state === 'pending_verification' && mode !== 'update' && (
            <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={busy} onClick={onVerify}>
                {busy ? '…' : 'Everything is correct - send my code'}
              </button>
              <button className="btn btn-outline" onClick={() => setMode('update')}>
                Something changed - update info
              </button>
            </div>
          )}
        </div>

        {state === 'pending_otp' && (
          <form className="card" style={{ padding: 20, marginBottom: 16 }} onSubmit={onOtp}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Activation code</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              The 6-digit code we mailed to {company.email}.
            </p>
            {devCode && (
              <p style={{ fontSize: 13 }}>
                This server has no mail configured, so your code is shown here instead: <strong>{devCode}</strong>
              </p>
            )}
            <input
              name="otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              style={{ fontSize: 22, letterSpacing: 8, padding: '10px 14px', width: 160, textAlign: 'center' }}
              required
            />
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? '…' : 'Confirm and activate'}
              </button>
            </div>
          </form>
        )}

        {state === 'pending_verification' && mode === 'update' && (
          <form className="card" style={{ padding: 20, marginBottom: 16 }} onSubmit={onUpdate}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Propose corrections</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Only fill what is wrong. These go to the OptiKart desk as a proposal - a fresh confirmation mail arrives
              once they apply them, and nothing is live until you verify that one.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {UPD_FIELDS.map((f) => (
                <label key={f} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {fieldLabel(f)}
                  <input
                    defaultValue={String(get(company, f) ?? '')}
                    onChange={(e) => setUpdates((u) => ({ ...u, [f]: e.target.value }))}
                    style={{ padding: '8px 10px', fontSize: 14 }}
                  />
                </label>
              ))}
            </div>
            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              Note for the desk
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ padding: '8px 10px', fontSize: 14 }}
              />
            </label>
            {errors.length > 0 && (
              <ul style={{ color: 'var(--danger, #b00020)', fontSize: 13 }}>
                {errors.map((er) => (
                  <li key={er.field}>
                    {er.field}: {er.message}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? '…' : 'Send corrections to the desk'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setMode('idle')}>
                Back
              </button>
            </div>
          </form>
        )}

        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Manufacturer sign-in lives at <Link to="/manufacturer">/manufacturer</Link>.
        </p>
      </div>
      <Footer />
    </>
  );
};

export default ManufacturerOnboarding;

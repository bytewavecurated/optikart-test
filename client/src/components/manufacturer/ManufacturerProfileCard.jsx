import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from '../../services/api';
import { FiSave, FiInfo, FiAlertTriangle } from 'react-icons/fi';

/*
 * A manufacturer's own company and brand profile.
 *
 * The GST and PAN on this form end up printed on the invoices a buyer holds, so
 * they are validated to the shapes the tax authorities issue (15-character
 * GSTIN, 10-character PAN) and refused naming the field rather than in general.
 * The brand list matters for a different reason: products group by brand name on
 * the home page and in filters, so "Ray-Ban" and "ray-ban" saved together render
 * as two brands and make the filters disagree with each other. Duplicates are
 * refused rather than silently merged, because merging would rewrite a name the
 * shop never asked to change.
 *
 * The sign-in email is shown, never editable. It is the identity the OTP is sent
 * to; letting a session move it to another inbox means a stolen token becomes a
 * permanent takeover on a screen that looks like housekeeping. Moving one is a
 * support action with a human checking the request is genuine.
 *
 * A save that changes nothing says so. `changed` drives the desk's notice ("a
 * manufacturer updated their GST number"), and firing that on every resubmission
 * of unchanged values teaches the desk to ignore the one alert that means
 * something.
 */
const fields = [
  {
    key: 'companyName',
    label: 'Company name',
    required: true,
    hint: 'Printed on invoices raised against this account.',
  },
  { key: 'name', label: 'Contact person', required: true },
  { key: 'phone', label: 'Contact phone', placeholder: '98765 00000', hint: '10 digits, starting 6-9.' },
  {
    key: 'gstNumber',
    label: 'GSTIN',
    placeholder: '27ABCDE1234F1Z5',
    hint: '15 characters, as issued. Uppercased automatically.',
  },
  { key: 'panNumber', label: 'PAN', placeholder: 'ABCDE1234F', hint: '10 characters. Uppercased automatically.' },
  { key: 'website', label: 'Website', placeholder: 'https://www.example.com', hint: 'Include the https:// part.' },
  {
    key: 'description',
    label: 'About this manufacturer',
    textarea: true,
    hint: 'Shown where a brand is introduced. Up to 1200 characters.',
  },
];

const ManufacturerProfileCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});
  const [address, setAddress] = useState({ street: '', city: '', state: '', pincode: '' });
  const [brandsText, setBrandsText] = useState('');
  const [catalogue, setCatalogue] = useState({ products: 0, retailers: 0, brandsInUse: [] });
  const [errors, setErrors] = useState({});
  const [unreadable, setUnreadable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manufacturer/profile');
      const body = res.data || {};
      setProfile(body.profile || {});
      setAddress({
        street: body.profile?.address?.street || '',
        city: body.profile?.address?.city || '',
        state: body.profile?.address?.state || '',
        pincode: body.profile?.address?.pincode || '',
      });
      setBrandsText((body.profile?.brands || []).join(', '));
      setCatalogue(body.catalogue || { products: 0, retailers: 0, brandsInUse: [] });
      setUnreadable(false);
    } catch (error) {
      setUnreadable(true);
      toast.error(error?.response?.data?.message || 'The profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const res = await api.put('/manufacturer/profile', {
        companyName: profile.companyName,
        name: profile.name,
        phone: profile.phone,
        gstNumber: profile.gstNumber,
        panNumber: profile.panNumber,
        website: profile.website,
        description: profile.description,
        address,
        brands: brandsText
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
      });
      const changed = res.data?.changed || [];
      // The server's own word for "nothing happened", rather than always claiming a save.
      toast.success(changed.length ? `Saved: ${changed.join(', ')}` : res.data?.message || 'Nothing to change.');
      await load();
    } catch (error) {
      const list = error?.response?.data?.errors;
      if (Array.isArray(list)) {
        const map = {};
        list.forEach((e) => {
          map[e.field] = e.message;
        });
        setErrors(map);
        toast.error(list[0]?.message || 'Some fields need attention.');
      } else {
        toast.error(error?.response?.data?.message || 'The profile could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 };
  const hint = { fontSize: 11.5, color: 'var(--text-light)', marginTop: 3, lineHeight: 1.45 };

  const brandMismatch = (catalogue.brandsInUse || []).filter(
    (b) =>
      !brandsText
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .includes(String(b.brand).toLowerCase())
  );

  if (loading)
    return (
      <div className="card" style={{ padding: 18 }}>
        Loading profile…
      </div>
    );

  return (
    <div className="card" style={{ padding: 20, marginBottom: 18, background: 'var(--bg-white)' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Company &amp; brand profile</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 760 }}>
        These details appear on documents raised against your account. {catalogue.products} products and{' '}
        {catalogue.retailers} retailer shops are recorded under this manufacturer.
      </p>

      {unreadable && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 12,
            marginBottom: 14,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(220,38,38,.07)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          <FiAlertTriangle style={{ marginTop: 2 }} />
          <span>
            This profile could not be read, so nothing here is current. Values are not shown rather than shown stale.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={label}>
              {f.label}
              {f.required ? ' *' : ''}
            </label>
            {f.textarea ? (
              <textarea
                className="input"
                rows={3}
                value={profile[f.key] || ''}
                maxLength={1200}
                style={{ width: '100%' }}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                value={profile[f.key] || ''}
                placeholder={f.placeholder || ''}
                style={{ width: '100%' }}
                onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            )}
            {errors[f.key] ? (
              <div style={{ ...hint, color: 'var(--danger)' }}>{errors[f.key]}</div>
            ) : f.hint ? (
              <div style={hint}>{f.hint}</div>
            ) : null}
          </div>
        ))}

        <div>
          <label style={label}>Sign-in email</label>
          <input
            className="input"
            value={profile.email || ''}
            disabled
            style={{ width: '100%', background: 'var(--bg-soft, #f4f4f5)' }}
          />
          <div style={hint}>
            <FiInfo size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Cannot be changed here - it is where the login code is sent. Contact OptiKart support to move the account.
          </div>
        </div>
      </div>

      <div
        style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: 14 }}
      >
        {[
          { key: 'street', ph: 'Street' },
          { key: 'city', ph: 'City' },
          { key: 'state', ph: 'State' },
          { key: 'pincode', ph: 'PIN code' },
        ].map((a) => (
          <div key={a.key}>
            <label style={label}>{a.ph}</label>
            <input
              className="input"
              value={address[a.key]}
              placeholder={a.ph}
              style={{ width: '100%' }}
              onChange={(e) => setAddress((v) => ({ ...v, [a.key]: e.target.value }))}
            />
            {errors[`address.${a.key}`] && (
              <div style={{ ...hint, color: 'var(--danger)' }}>{errors[`address.${a.key}`]}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={label}>Brands manufactured</label>
        <input
          className="input"
          value={brandsText}
          placeholder="Ray-Ban, Meta"
          style={{ width: '100%' }}
          onChange={(e) => setBrandsText(e.target.value)}
        />
        {errors.brands && <div style={{ ...hint, color: 'var(--danger)' }}>{errors.brands}</div>}
        <div style={hint}>
          Comma separated. Names are matched to products case-insensitively, so the same brand cannot be listed twice
          with different capitalisation.
        </div>
        {brandMismatch.length > 0 && (
          <div style={{ ...hint, color: 'var(--warning-dark, #8a6d3b)', marginTop: 6 }}>
            <FiAlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Products still carry brand names that are not on this list:{' '}
            {brandMismatch.map((b) => `${b.brand} (${b.count})`).join(', ')}. Add them, or reassign those products
            before removing anything.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <FiSave style={{ marginRight: 6 }} />
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        <button className="btn btn-outline" onClick={load} disabled={saving}>
          Reload
        </button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
          Saving notifies the OptiKart desk when tax or company details change.
        </span>
      </div>
    </div>
  );
};

export default ManufacturerProfileCard;

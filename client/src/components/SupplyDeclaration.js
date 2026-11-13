import React, { useState } from 'react';
import { FiShield, FiTruck, FiAlertTriangle } from 'react-icons/fi';

/*
 * The three questions a listing of somebody else's brand has to answer before
 * it can sell.
 *
 * This is deliberately an explicit step in the form rather than a checkbox: the
 * platform's problem was that a shop could assert "we stock this Ray-Ban" with
 * nothing behind the claim, and nothing in the data can tell a supplied frame
 * from one bought off a closing shop. So the seller states it, in words the
 * brand can check, and sees what happens next before submitting.
 *
 * `manufacturer_purchase` asks for a reference; `other` asks for a sentence.
 * Both are honest answers - plenty of legitimate stock comes from liquidations
 * and secondary distributors - and neither skips the brand's review. A vague
 * `other` note is refused by the server, because a queue full of claims nobody
 * can check is the same problem wearing a different shirt.
 */
const KINDS = [
  { value: 'manufacturer_purchase', label: 'Bought from the brand', hint: 'Invoice or PO number the brand can look up' },
  { value: 'brand_distribution', label: 'Supplied by the brand as stockist', hint: 'Agreement, distributor code or order number' },
  { value: 'other', label: 'From somewhere else', hint: 'Where, and how a buyer ends up with your price for it' }
];

const SupplyDeclaration = ({
  value,
  onChange,
  productName,
  busy = false,
  onSubmit,
  submitLabel = 'Send to the brand for approval',
  onCancel
}) => {
  const kind = KINDS.find((k) => k.value === value.kind) || KINDS[0];
  const [touched, setTouched] = useState(false);

  const referenceNeeded = value.kind === 'manufacturer_purchase' || value.kind === 'brand_distribution';
  const incomplete = !value.kind
    || (referenceNeeded && !String(value.reference || '').trim())
    || (value.kind === 'other' && String(value.note || '').trim().length < 8);

  const cell = {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 4
  };

  return (
    <div className="card" style={{ background: 'var(--bg-white, #fff)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: 16, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FiShield style={{ color: 'var(--primary)' }} />
        <strong style={{ fontSize: 14.5 }}>Where did this stock come from?</strong>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {productName ? `You are listing ${productName}, which belongs to another company. ` : ''}
        Nothing in the catalogue can tell a frame the brand shipped you from one you bought elsewhere, so this
        is stated, then confirmed by the brand, then verified by OptiKart. Until both have said yes it is not
        visible to customers.
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <div>
          <label style={cell}>Source</label>
          <select
            className="input"
            value={value.kind || ''}
            onChange={(e) => onChange({ ...value, kind: e.target.value })}
          >
            <option value="">Choose one</option>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>

        <div>
          <label style={cell}>{kind.hint}</label>
          {referenceNeeded ? (
            <input
              className="input"
              value={value.reference || ''}
              onChange={(e) => onChange({ ...value, reference: e.target.value })}
              onBlur={() => setTouched(true)}
              placeholder={value.kind === 'brand_distribution' ? 'e.g. DIST-4417' : 'e.g. INV-2026-00451'}
            />
          ) : (
            <textarea
              className="input"
              rows={2}
              value={value.note || ''}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
              onBlur={() => setTouched(true)}
              placeholder="Describe the lot, seller or auction so the brand can recognise it"
            />
          )}
        </div>
      </div>

      {touched && incomplete && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 12.5, color: 'var(--warning-dark, #8a6d3b)', background: 'var(--warning-light, rgba(217,119,6,.10))', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
          <FiAlertTriangle style={{ marginTop: 2 }} />
          <span>
            {value.kind === 'other'
              ? 'A few words are required - long enough for the brand to check. "Got it" is not an answer they can act on.'
              : 'Add the reference the brand can look up. A claim without one cannot be approved.'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 14 }}>
        <button className="btn btn-primary" disabled={busy || incomplete} onClick={() => { setTouched(true); if (!incomplete) onSubmit(); }}>
          <FiTruck style={{ marginRight: 6 }} />{busy ? 'Sending...' : submitLabel}
        </button>
        {onCancel && (
          <button className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
        )}
        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
          The brand is notified; the platform verifies the listing afterwards.
        </span>
      </div>
    </div>
  );
};

export default SupplyDeclaration;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { products as productsApi, cart as cartApi, auth as authApi, oneOf } from '../../services/apiBridge';
import {
  SPHERE_VALUES, CYL_OPTIONS, AXIS_OPTIONS, ADD_OPTIONS,
  POWER_TYPES, formatPower, validatePowerSet, REPLACEMENTS, BOX_SIZES
} from '../../utils/contactLensPowers';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import BackButton from '../../components/BackButton';
import toast from 'react-hot-toast';
import { toastError } from '../../services/errors';
import { FiChevronRight, FiCheck, FiAlertCircle, FiUpload, FiEye } from 'react-icons/fi';

// The configurator is driven by the product's own contactLens spec, so a toric
// SKU asks for CYL/AXIS and a multifocal SKU asks for ADD without the UI needing
// to guess from the URL.
const EYES = [
  { key: 'right', label: 'Right eye', short: 'OD' },
  { key: 'left', label: 'Left eye', short: 'OS' }
];

const emptyPower = () => ({
  right: { sphere: '', cylinder: '', axis: '', addition: '' },
  left: { sphere: '', cylinder: '', axis: '', addition: '' }
});

const Stepper = ({ steps, index }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    {steps.map((s, i) => (
      <React.Fragment key={s}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            background: i < index ? 'var(--success)' : i === index ? 'var(--brand)' : 'var(--bg-subtle)',
            color: i <= index ? '#fff' : 'var(--text-light)'
          }}>
            {i < index ? <FiCheck size={13} /> : i + 1}
          </span>
          <span style={{ fontSize: 13, fontWeight: i === index ? 700 : 500, color: i <= index ? 'var(--text-primary)' : 'var(--text-light)' }}>{s}</span>
        </span>
        {i < steps.length - 1 && <span style={{ width: 18, height: 1, background: 'var(--border)' }} />}
      </React.Fragment>
    ))}
  </div>
);

/** A radio-style tile grid; used for power type, replacement and box size. */
const OptionGrid = ({ options, value, onChange, columns = 'repeat(auto-fit, minmax(150px, 1fr))', subKey = 'note', disabledValue }) => (
  <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 10 }}>
    {options.map((opt) => {
      const v = typeof opt === 'string' || typeof opt === 'number' ? opt : opt.value;
      const label = typeof opt === 'string' || typeof opt === 'number' ? String(opt) : opt.label;
      const note = typeof opt === 'object' && opt !== null ? opt[subKey] : undefined;
      const disabled = disabledValue !== undefined && v === disabledValue;
      const active = String(value) === String(v);
      return (
        <button
          type="button"
          key={String(v)}
          disabled={disabled}
          title={disabled ? 'Not available for this lens' : undefined}
          onClick={() => onChange(v)}
          style={{
            textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
            border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
            background: active ? 'var(--brand-tint)' : 'var(--bg-white)',
            opacity: disabled ? 0.45 : 1, transition: 'border-color .15s, background .15s'
          }}
        >
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: active ? 'var(--brand)' : 'var(--text-primary)' }}>{label}</span>
          {note && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{note}</span>}
        </button>
      );
    })}
  </div>
);

/** Scrollable quarter-step power selector with the option to type an exact value. */
const PowerSelect = ({ label, options, value, onChange, format = formatPower, placeholder = 'Select' }) => (
  <div className="input-group" style={{ marginBottom: 0 }}>
    <label style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</label>
    <select className="input" value={value === '' ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={String(o)} value={String(o)}>{format(o)}</option>
      ))}
    </select>
  </div>
);

/** One eye's prescription inputs, shown only for the parameters the lens needs. */
const EyeCard = ({ eye, power, powerType, onChange, errors }) => {
  const needsCyl = powerType === 'toric';
  const needsAdd = powerType === 'multifocal';
  const e = power[eye.key] || {};
  const set = (k, v) => onChange(eye.key, k, v);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, background: 'var(--bg-white)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800 }}>{eye.label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 700 }}>{eye.short}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: needsCyl ? 'repeat(3, 1fr)' : needsAdd ? 'repeat(2, 1fr)' : '1fr', gap: 12 }}>
        <PowerSelect label="Sphere (SPH)" options={SPHERE_VALUES} value={e.sphere} onChange={(v) => set('sphere', v)} placeholder="e.g. -2.50" errors={errors} />
        {needsCyl && (
          <PowerSelect
            label="Cylinder (CYL)"
            options={CYL_OPTIONS}
            value={e.cylinder}
            onChange={(v) => set('cylinder', v)}
            placeholder="0 if none"
          />
        )}
        {needsCyl && Number(e.cylinder) !== 0 && e.cylinder !== '' && e.cylinder !== undefined && e.cylinder !== null && (
          <PowerSelect label="Axis" options={AXIS_OPTIONS} value={e.axis} onChange={(v) => set('axis', v)} placeholder="10-180" format={(v) => `${v}°`} />
        )}
        {needsAdd && <PowerSelect label="Add (ADD)" options={ADD_OPTIONS} value={e.addition} onChange={(v) => set('addition', v)} placeholder="e.g. +1.50" />}
      </div>
      {['sphere', 'cylinder', 'axis', 'addition'].map((k) => (
        <p key={k} style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger)' }}>{errors[`${eye.key}.${k}`] || ''}</p>
      ))}
    </div>
  );
};
export default function ContactLensConfigure() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [withPower, setWithPower] = useState(true);
  const [power, setPower] = useState(emptyPower());
  const [errors, setErrors] = useState({});
  const [box, setBox] = useState(6);
  const [replacement, setReplacement] = useState('monthly');
  const [colour, setColour] = useState('');
  const [method, setMethod] = useState('manual'); // manual | upload
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await productsApi.getById(productId);
        const p = oneOf(res.data, 'product');
        if (cancelled) return;
        if (!p) { toast.error('That lens could not be found'); navigate('/contact-lenses'); return; }
        setProduct(p);
        const cl = p.contactLens || {};
        if (cl.powerType === 'none' || cl.withPowerAvailable === false) setWithPower(false);
        else if (!cl.allowsZeroPower) setWithPower(true);
        if (cl.lensesPerBox) setBox(cl.lensesPerBox);
        if (cl.replacementPeriod) setReplacement(cl.replacementPeriod);
        if (cl.colorTone) setColour(cl.colorTone);
      } catch (err) {
        toastError(err, 'Could not load this lens');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, navigate]);

  const cl = product?.contactLens || {};
  const powerType = withPower && cl.powerType !== 'none' ? (cl.powerType || 'distance') : 'none';
  const steps = ['Lens & box', withPower ? 'Your power' : 'Colour', 'Review'];

  const boxOptions = useMemo(() => {
    // A single trial lens, or the manufacturer's pack sizes that divide the
    // number of lenses this SKU ships in.
    const perBox = cl.lensesPerBox || 6;
    return BOX_SIZES.filter((b) => b === 1 || b === perBox || b % perBox === 0)
      .map((b) => ({ value: b, label: `${b} lens${b === 1 ? '' : 'es'} per box` }));
  }, [cl.lensesPerBox]);

  const summaryPower = useMemo(() => {
    if (powerType === 'none') return 'No power (plano / cosmetic)';
    return EYES.map((eye) => {
      const e = power[eye.key] || {};
      const bits = [`${eye.short} SPH ${formatPower(e.sphere)}`];
      if (powerType === 'toric') {
        bits.push(`CYL ${Number(e.cylinder) === 0 || e.cylinder === '' ? '0' : formatPower(e.cylinder)}`);
        if (Number(e.cylinder) !== 0 && e.axis) bits.push(`AX ${e.axis}°`);
      }
      if (powerType === 'multifocal' && e.addition) bits.push(`ADD ${formatPower(e.addition)}`);
      return bits.join('  ');
    }).join(' ');
  }, [power, powerType]);

  const goNext = () => {
    if (step === 0) {
      if (withPower && powerType !== 'none') {
        const check = validatePowerSet(power, powerType);
        setErrors(check.errors);
        if (!check.valid) {
          toast.error('Complete both eyes before continuing');
          return;
        }
      }
      if (!box) { toast.error('Choose a box quantity'); return; }
    }
    setStep((v) => Math.min(v + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // Upload the prescription first so the lab pair-checks it with the entry.
      let uploadedUrl = '';
      if (method === 'upload' && prescriptionFile) {
        const fd = new FormData();
        fd.append('prescription', prescriptionFile);
        const up = await authApi.uploadPrescriptionFile(fd);
        uploadedUrl = up?.data?.url || up?.data?.fileUrl || '';
      }
      if (withPower && powerType !== 'none') {
        const check = validatePowerSet(power, powerType);
        if (!check.valid) { setErrors(check.errors); setStep(1); toast.error('Please correct your prescription'); return; }
      }
      await cartApi.addContactLens({
        productId,
        quantity: 1,
        withPower,
        power,
        lensesPerBox: Number(box),
        replacement,
        colour,
        prescriptionImage: uploadedUrl
      });
      toast.success('Added to cart');
      navigate('/cart');
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length) {
        toast.error(serverErrors[0]);
      } else {
        toastError(err, 'Could not add this to your cart');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (<><Header /><div className="container" style={{ padding: 60, textAlign: 'center' }}><div className="spinner spinner-lg" /></div><Footer /></>);
  }
  if (!product) return null;

  const price = product.discountedPrice || product.price;
  const perLens = Number(box) > 0 ? price / Number(box) : price;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header />
      <main className="container" style={{ flex: 1, maxWidth: 980, padding: '18px 20px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <BackButton to="/contact-lenses" />
            <Link to="/contact-lenses" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Contact lenses</Link>
            <span style={{ margin: '0 6px', color: 'var(--text-light)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Configure</span>
          </div>
          <Stepper steps={steps} index={step} />
        </div>

        <div className="card-flat" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
          <img src={product.images?.[0] || '/placeholder.svg'} alt={product.title} style={{ width: 76, height: 76, objectFit: 'contain', background: 'var(--bg-subtle)', borderRadius: 10 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{product.brand}</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, marginTop: 2 }}>{product.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              {POWER_TYPES[powerType]?.label}
              {cl.diameter ? ` · DIA ${cl.diameter} mm` : ''}
              {cl.baseCurve ? ` · BC ${cl.baseCurve}` : ''}
              {cl.waterContent ? ` · ${cl.waterContent}% water` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>₹{price.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>per box of {box}</div>
          </div>
        </div>

        {step === 0 && (
          <div style={{ display: 'grid', gap: 18 }}>
            {(cl.withPowerAvailable !== false) && (POWER_TYPES[cl.powerType || 'distance'] || POWER_TYPES.none).needs.length > 0 && (
              <section>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Do you need power?</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  {cl.allowsZeroPower
                    ? 'This lens is available both with your prescription and as a plain cosmetic pair.'
                    : 'These are corrective lenses, so a prescription is required.'}
                </p>
                <OptionGrid
                  disabledValue={cl.allowsZeroPower ? undefined : 'no'}
                  value={withPower ? 'yes' : 'no'}
                  onChange={(v) => setWithPower(v === 'yes')}
                  options={[
                    { value: 'yes', label: 'With power', note: 'Enter OD/OS values' },
                    { value: 'no', label: 'Zero power', note: 'Cosmetic / plano only' }
                  ]}
                />
              </section>
            )}

            <section>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Replacement schedule</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>How often you open a fresh pair.</p>
              <OptionGrid columns="repeat(auto-fit, minmax(170px, 1fr))" value={replacement} onChange={setReplacement} options={REPLACEMENTS} />
            </section>

            <section>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>Lenses per box</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                This product ships {cl.lensesPerBox || 6} lenses per box. Pick how many you want in each box you buy.
              </p>
              <OptionGrid columns="repeat(auto-fit, minmax(150px, 1fr))" value={box} onChange={setBox} options={boxOptions.length ? boxOptions : [{ value: cl.lensesPerBox || 6, label: `${cl.lensesPerBox || 6} lenses per box` }]} />
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '10px 0 0' }}>
                Works out at about ₹{Math.round(perLens).toLocaleString('en-IN')} per lens.
              </p>
            </section>

            {cl.isCosmetic && (
              <section>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>Colour</h2>
                <OptionGrid value={colour || cl.colorTone || ''} onChange={setColour} options={(cl.comboShades?.length ? cl.comboShades.map((c) => c.name) : (product.colors || []).map((c) => c.name || c))} />
              </section>
            )}
          </div>
        )}

        {step === 1 && (
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px' }}>{POWER_TYPES[powerType]?.label} prescription</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Copy the values exactly from your prescription — powers move in quarter steps and {POWER_TYPES[powerType]?.hint}.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 14px', padding: '10px 12px', background: 'var(--brand-tint)', borderRadius: 10 }}>
              <FiAlertCircle size={16} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                {product.contactLens?.powerType === 'toric'
                  ? 'For toric lenses the axis is only given when a cylinder is present.'
                  : product.contactLens?.powerType === 'multifocal'
                    ? 'Multi-focal lenses need the ADD value from the lower part of your prescription.'
                    : 'Sphere is the top number in each eye column of your prescription.'}
              </span>
            </div>
            <div className="cl-eyes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {EYES.map((eye) => (
                <EyeCard key={eye.key} eye={eye} power={power} powerType={powerType} errors={errors} onChange={(k, field, v) => setPower((p) => ({ ...p, [k]: { ...p[k], [field]: v } }))} />
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--text-secondary)' }}>How will you give us the numbers?</span>
              <div style={{ marginTop: 10 }}>
                <OptionGrid
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: 'manual', label: 'Type my power', note: 'Fastest if you have your prescription to hand' },
                    { value: 'upload', label: 'Upload a copy', note: 'We check it before the lenses are made' }
                  ]}
                />
              </div>
              {method === 'upload' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 12, cursor: 'pointer', fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  <FiUpload size={18} />
                  {prescriptionFile ? prescriptionFile.name : 'Choose a photo or PDF of your prescription'}
                  <input type="file" accept="image/*,.pdf" hidden onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)} />
                </label>
              )}
              {method === 'upload' && prescriptionFile && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '10px 0 0' }}>
                  We read the uploaded copy and reconcile it with the values above. Any mismatch is flagged before your order is sent to the laboratory.
                </p>
              )}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card-flat" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px' }}>Review</h2>
            {[
              ['Lens', `${product.brand} ${product.title}`],
              ['Power', withPower ? POWER_TYPES[powerType].label : 'Zero power'],
              ...(withPower ? [['Prescription', summaryPower]] : []),
              ['Replacement', REPLACEMENTS.find((r) => r.value === replacement)?.label || replacement],
              ['Box', String(box)],
              ...(colour ? [['Colour', colour]] : []),
              ...(prescriptionFile ? [['Prescription upload', prescriptionFile.name]] : [])
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13.5 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: 'right', whiteSpace: withPower && k === 'Prescription' ? 'pre-line' : 'normal' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 17, fontWeight: 800 }}>
              <span>Total</span><span>₹{price.toLocaleString('en-IN')}</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '10px 0 0' }}>
              Contact lenses are hygiene-sealed. Once the box is opened it cannot be returned; an unopened box can be returned within {product.returnWindowDays ?? 7} days.
            </p>
          </section>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 22 }}>
          <button className="btn btn-outline" onClick={() => (step === 0 ? navigate('/contact-lenses') : setStep((v) => v - 1))}>Back</button>
          {step < steps.length - 1 ? (
            <button className="btn btn-primary btn-lg" onClick={goNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {step === 0 && withPower ? 'Enter my power' : step === 1 ? 'Review order' : 'Continue'} <FiChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" disabled={submitting} onClick={submit} style={{ minWidth: 200 }}>
              {submitting ? 'Adding…' : `Add to cart - ₹${price.toLocaleString('en-IN')}`}
            </button>
          )}
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 700px) { .cl-eyes { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { ICON_NAMES } from '../../services/homeContent';
import { toastError } from '../../services/errors.js';
import { FiSave, FiTrash2, FiPlus, FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';

/**
 * Storefront content.
 *
 * Everything on this screen is what previously needed a code change and a deploy:
 * the home page rail headings, which rails show, the category and facet tiles, the
 * promo tiles and the gender tiles. Nothing here is duplicated from the catalogue -
 * only what the operator changed is stored, and the storefront merges it over the
 * defaults that live beside the components.
 */

const HEADING_FIELDS = [
  ['categories', 'Category rail heading'],
  ['categoriesSub', 'Category rail sub-heading'],
  ['faceShape', 'Face shape heading'],
  ['faceShapeSub', 'Face shape sub-heading'],
  ['frameType', 'Frame type heading'],
  ['frameTypeSub', 'Frame type sub-heading'],
  ['material', 'Material heading'],
  ['materialSub', 'Material sub-heading']
];

const BLOCKS = [
  ['categoryRail', 'Shop by Category tiles'],
  ['faceShapeRail', 'Shop by Face Shape'],
  ['frameTypeRail', 'Shop by Frame Type'],
  ['materialRail', 'Shop by Material'],
  ['promoTiles', 'Promo tiles'],
  ['gender', 'Shop by Gender']
];

const label = (text) => (
  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{text}</label>
);

const TileList = ({ title, rows, onChange, fields, addLabel }) => {
  const set = (i, key, value) => onChange(rows.map((r, ix) => (ix === i ? { ...r, [key]: value } : r)));
  const move = (i, dir) => {
    const next = [...rows];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };
  return (
    <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button type="button" className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12.5 }}
          onClick={() => onChange([...rows, { name: '', slug: '', link: '', icon: '', subtitle: '', tint: '', fg: '', image: '' }])}>
          <FiPlus size={13} /> {addLabel}
        </button>
      </div>
      {rows.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
          Nothing set - the home page uses its built-in list for this block.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div>{label('Name')}<input className="input" value={row.name || ''} onChange={(e) => set(i, 'name', e.target.value)} /></div>
            {fields.includes('slug') && <div>{label('Category slug')}<input className="input" value={row.slug || ''} onChange={(e) => set(i, 'slug', e.target.value)} placeholder="sunglasses" /></div>}
            {fields.includes('link') && <div>{label('Link')}<input className="input" value={row.link || ''} onChange={(e) => set(i, 'link', e.target.value)} placeholder="/coupons" /></div>}
            {fields.includes('subtitle') && <div>{label('Small print')}<input className="input" value={row.subtitle || ''} onChange={(e) => set(i, 'subtitle', e.target.value)} /></div>}
            {fields.includes('icon') && (
              <div>{label('Icon')}
                <select className="input" value={row.icon || ''} onChange={(e) => set(i, 'icon', e.target.value)}>
                  <option value="">None</option>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            {fields.includes('image') && <div>{label('Image')}<input className="input" value={row.image || ''} onChange={(e) => set(i, 'image', e.target.value)} placeholder="/assets/…" /></div>}
            {fields.includes('color') && <div>{label('Accent (hex)')}<input className="input" value={row.fg || ''} onChange={(e) => set(i, 'fg', e.target.value)} placeholder="var(--brand)" /></div>}
            {fields.includes('tint') && <div>{label('Background (hex)')}<input className="input" value={row.tint || ''} onChange={(e) => set(i, 'tint', e.target.value)} placeholder="var(--brand-tint)" /></div>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => move(i, -1)} aria-label="Move up"><FiChevronUp size={13} /></button>
            <button type="button" className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => move(i, 1)} aria-label="Move down"><FiChevronDown size={13} /></button>
            <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)' }}
              onClick={() => onChange(rows.filter((_, ix) => ix !== i))}>
              <FiX size={13} /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function SiteContentManagement() {
  const [home, setHome] = useState({ headings: {}, visible: {}, categoryRail: [], promoTiles: [], genderTiles: [], faceShapes: [], frameTypes: [], frameMaterials: [] });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState([]);
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/site-content/home');
        const doc = res.data.home || {};
        setOverridden(Boolean(
          (doc.categoryRail || []).length || (doc.promoTiles || []).length || (doc.genderTiles || []).length
          || Object.values(doc.headings || {}).some(Boolean)
        ));
        setHome({
          headings: doc.headings || {},
          visible: { categoryRail: doc.visible?.categoryRail !== false, faceShapeRail: doc.visible?.faceShapeRail !== false, frameTypeRail: doc.visible?.frameTypeRail !== false, materialRail: doc.visible?.materialRail !== false, promoTiles: doc.visible?.promoTiles !== false, gender: doc.visible?.gender !== false },
          categoryRail: doc.categoryRail || [],
          promoTiles: doc.promoTiles || [],
          genderTiles: doc.genderTiles || [],
          faceShapes: doc.faceShapes || [],
          frameTypes: doc.frameTypes || [],
          frameMaterials: doc.frameMaterials || []
        });
      } catch (err) {
        toastError(err, 'Could not read the storefront content');
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setProblems([]);
    try {
      const list = (v) => String(v || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      await api.put('/site-content/home', {
        headings: home.headings,
        visible: home.visible,
        categoryRail: home.categoryRail,
        promoTiles: home.promoTiles,
        genderTiles: home.genderTiles,
        faceShapes: list(home.faceShapes.join ? home.faceShapes.join(',') : home.faceShapes),
        frameTypes: list(home.frameTypes.join ? home.frameTypes.join(',') : home.frameTypes),
        frameMaterials: list(home.frameMaterials.join ? home.frameMaterials.join(',') : home.frameMaterials)
      });
      window.location.reload();
    } catch (err) {
      const errs = err.response?.data?.errors;
      setProblems(Array.isArray(errs) ? errs : []);
      toastError(err, 'Could not save the storefront content');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Clear all storefront overrides and go back to the built-in home page?')) return;
    try {
      await api.delete('/site-content/home');
      window.location.reload();
    } catch (err) {
      toastError(err, 'Could not reset the storefront content');
    }
  };

  const wordsField = (key, title, hint) => (
    <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
      {label(title)}
      <textarea
        className="input"
        rows={2}
        value={(home[key] || []).join(', ')}
        onChange={(e) => setHome({ ...home, [key]: e.target.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) })}
        placeholder={hint}
        style={{ width: '100%', fontFamily: 'inherit' }}
      />
      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>One value per line or comma separated. Leave empty to use the built-in list.</p>
    </div>
  );

  if (!loaded) return <div className="container" style={{ padding: 40 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Change the home page rails, headings and tiles without a deploy. Stored overrides only: whatever you leave alone keeps the built-in list.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: overridden ? 'var(--warning)' : 'var(--text-light)' }}>
            {overridden ? 'Overrides are in effect on the home page.' : 'No overrides yet - the home page uses its defaults.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={reset}><FiTrash2 size={14} /> Reset</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><FiSave size={14} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="card-flat" style={{ padding: 14, marginBottom: 14, borderLeft: '3px solid var(--danger)' }}>
          <strong style={{ fontSize: 13.5 }}>Not saved - fix these first:</strong>
          <ul className="list-clean" style={{ margin: '8px 0 0', fontSize: 13 }}>
            {problems.map((p, i) => <li key={i} style={{ padding: '2px 0' }}>• {p}</li>)}
          </ul>
        </div>
      )}

      <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
        {label('Show or hide blocks')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 6 }}>
          {BLOCKS.map(([key, title]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={home.visible[key] !== false} onChange={(e) => setHome({ ...home, visible: { ...home.visible, [key]: e.target.checked } })} />
              {title}
            </label>
          ))}
        </div>
      </div>

      <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Headings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {HEADING_FIELDS.map(([key, title]) => (
            <div key={key}>
              {label(title)}
              <input className="input" value={home.headings[key] || ''} onChange={(e) => setHome({ ...home, headings: { ...home.headings, [key]: e.target.value } })} placeholder="Leave blank for the default" />
            </div>
          ))}
        </div>
      </div>

      <TileList title="Category tiles" rows={home.categoryRail} fields={['slug', 'icon']} addLabel="Add tile"
        onChange={(rows) => setHome({ ...home, categoryRail: rows })} />
      <TileList title="Promo tiles" rows={home.promoTiles} fields={['link', 'icon', 'subtitle', 'tint', 'color']} addLabel="Add promo"
        onChange={(rows) => setHome({ ...home, promoTiles: rows })} />
      <TileList title="Gender tiles" rows={home.genderTiles} fields={['slug', 'image', 'subtitle', 'color']} addLabel="Add group"
        onChange={(rows) => setHome({ ...home, genderTiles: rows })} />

      {wordsField('faceShapes', 'Face shapes', 'Rectangle, Cat Eye, Oval')}
      {wordsField('frameTypes', 'Frame types', 'Full Rim, Half Rim, Rimless')}
      {wordsField('frameMaterials', 'Materials', 'Acetate, Metal, Titanium')}

      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        Links can point at an internal path such as <code>/coupons</code> or an external <code>https://</code> address; images must be a local <code>/assets/…</code> path or an <code>https://</code> URL. The full list of accepted icon names is in the dropdowns. <Link to="/" style={{ color: 'var(--brand)' }}>Open the home page</Link> to check the result.
      </p>
    </div>
  );
}

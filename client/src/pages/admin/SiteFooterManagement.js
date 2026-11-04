import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { toastError } from '../../services/errors.js';
import { FiSave, FiTrash2, FiPlus, FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';

/**
 * Footer links, the category strip labels and the support line.
 *
 * Kept separate from the home-page screen on purpose: the two are different
 * documents on the server, and one page that tried to save both could fail one
 * half and leave the footer and the home page disagreeing about the same section.
 */

const label = (text) => (
  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-secondary)' }}>{text}</label>
);

const EMPTY_ROW = { name: '', link: '' };

function ListEditor({ title, hint, rows, onChange, addLabel }) {
  const patch = (i, key, value) => onChange(rows.map((r, ix) => (ix === i ? { ...r, [key]: value } : r)));
  const move = (i, dir) => {
    const next = [...rows];
    const to = i + dir;
    if (to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  return (
    <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button type="button" className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={() => onChange([...rows, { ...EMPTY_ROW }])}>
          <FiPlus size={13} /> {addLabel}
        </button>
      </div>
      {hint && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text-secondary)' }}>{hint}</p>}
      {rows.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Nothing set - the built-in list is used.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 220 }} value={row.name || ''} placeholder="Label" onChange={(e) => patch(i, 'name', e.target.value)} />
          <input className="input" style={{ flex: '1 1 240px' }} value={row.link || ''} placeholder="/category/sunglasses" onChange={(e) => patch(i, 'link', e.target.value)} />
          <button type="button" className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => move(i, -1)} aria-label="Move up"><FiChevronUp size={13} /></button>
          <button type="button" className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => move(i, 1)} aria-label="Move down"><FiChevronDown size={13} /></button>
          <button type="button" className="btn btn-outline" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => onChange(rows.filter((_, ix) => ix !== i))} aria-label="Remove entry"><FiX size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export default function SiteFooterManagement() {
  const [footer, setFooter] = useState({ nav: [], footerGroups: [], footerNote: '', support: { email: '', phone: '' } });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState([]);
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/site-content/footer')
      .then((res) => {
        if (!alive) return;
        const doc = res.data.footer || {};
        setOverridden(Boolean((doc.nav || []).length || (doc.footerGroups || []).length || doc.footerNote
          || doc.support?.email || doc.support?.phone));
        setFooter({
          nav: doc.nav || [],
          footerGroups: (doc.footerGroups || []).map((g) => ({ title: g.title, links: g.links || [] })),
          footerNote: doc.footerNote || '',
          support: { email: doc.support?.email || '', phone: doc.support?.phone || '' }
        });
      })
      .catch((e) => toastError(e, 'Could not read the footer content'))
      .finally(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setProblems([]);
    try {
      await api.put('/site-content/footer', {
        nav: footer.nav.filter((n) => (n.name || '').trim() && (n.link || '').trim()),
        footerGroups: footer.footerGroups.map((g) => ({
          title: g.title,
          links: (g.links || []).filter((l) => (l.name || '').trim() && (l.link || '').trim())
        })),
        footerNote: footer.footerNote,
        support: footer.support
      });
      window.location.reload();
    } catch (e) {
      setProblems(Array.isArray(e.response?.data?.errors) ? e.response.data.errors : []);
      toastError(e, 'The footer content was not saved');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Clear the footer and navigation overrides and go back to the built-in lists?')) return;
    try {
      await api.delete('/site-content/footer');
      window.location.reload();
    } catch (e) {
      toastError(e, 'Could not reset the footer content');
    }
  };

  if (!loaded) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 720 }}>
          The labels in the category strip, the footer columns, and the support line shoppers read when an order goes wrong. Only what you change here is stored; the rest keeps the built-in text.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={reset}><FiTrash2 size={14} /> Reset</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><FiSave size={14} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: overridden ? 'var(--warning)' : 'var(--text-light)' }}>
        {overridden ? 'Overrides are live on the site.' : 'No overrides yet - the footer and category strip use the built-in lists.'}
      </p>

      {problems.length > 0 && (
        <div className="card-flat" style={{ padding: 14, marginBottom: 14, borderLeft: '3px solid var(--danger)' }}>
          <strong style={{ fontSize: 13.5 }}>Not saved - fix these first:</strong>
          <ul className="list-clean" style={{ margin: '8px 0 0', fontSize: 13 }}>
            {problems.map((p, i) => <li key={i} style={{ padding: '2px 0' }}>• {p}</li>)}
          </ul>
        </div>
      )}

      <ListEditor
        title="Category strip (second navbar)"
        hint="Leave this empty to use the catalogue's own categories. Entries need a label and a path such as /category/sunglasses."
        rows={footer.nav}
        addLabel="Add link"
        onChange={(rows) => setFooter({ ...footer, nav: rows })}
      />

      <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Footer columns</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Adding a column replaces the built-in About / Help / Policy set entirely, because a half-overridden footer reads as broken. The social row is always kept.
        </p>
        {footer.footerGroups.map((group, gi) => (
          <div key={gi} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input className="input" style={{ maxWidth: 240 }} value={group.title} placeholder="Column heading (e.g. HELP)"
                onChange={(e) => setFooter({ ...footer, footerGroups: footer.footerGroups.map((x, i) => (i === gi ? { ...x, title: e.target.value } : x)) })} />
              <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12.5 }}
                onClick={() => setFooter({ ...footer, footerGroups: footer.footerGroups.map((x, i) => (i === gi ? { ...x, links: [...(x.links || []), { ...EMPTY_ROW }] } : x)) })}>
                <FiPlus size={12} /> link
              </button>
              <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)', marginLeft: 'auto' }}
                onClick={() => setFooter({ ...footer, footerGroups: footer.footerGroups.filter((_, i) => i !== gi) })}>
                <FiX size={12} /> remove column
              </button>
            </div>
            {(group.links || []).map((link, li) => (
              <div key={li} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <input className="input" style={{ maxWidth: 220 }} value={link.name || ''} placeholder="Label"
                  onChange={(e) => setFooter({ ...footer, footerGroups: footer.footerGroups.map((x, i) => (i === gi ? { ...x, links: x.links.map((l, j) => (j === li ? { ...l, name: e.target.value } : l)) } : x)) })} />
                <input className="input" style={{ flex: '1 1 240px' }} value={link.link || ''} placeholder="/help/faq"
                  onChange={(e) => setFooter({ ...footer, footerGroups: footer.footerGroups.map((x, i) => (i === gi ? { ...x, links: x.links.map((l, j) => (j === li ? { ...l, link: e.target.value, slug: e.target.value } : l)) } : x)) })} />
                <button type="button" className="btn btn-outline" style={{ padding: '4px 8px' }} aria-label="Remove link"
                  onClick={() => setFooter({ ...footer, footerGroups: footer.footerGroups.map((x, i) => (i === gi ? { ...x, links: x.links.filter((_, j) => j !== li) } : x)) })}>
                  <FiX size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => setFooter({ ...footer, footerGroups: [...footer.footerGroups, { title: '', links: [{ ...EMPTY_ROW }] }] })}>
          <FiPlus size={13} /> Add column
        </button>
      </div>

      <div className="card-flat" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            {label('Support email')}
            <input className="input" type="email" value={footer.support.email} placeholder="help@yourshop.example"
              onChange={(e) => setFooter({ ...footer, support: { ...footer.support, email: e.target.value } })} />
          </div>
          <div>
            {label('Support phone')}
            <input className="input" value={footer.support.phone} placeholder="+91 00000 00000"
              onChange={(e) => setFooter({ ...footer, support: { ...footer.support, phone: e.target.value } })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {label('Line shown above the copyright')}
            <textarea className="input" rows={2} value={footer.footerNote} placeholder="Returns window, grievance officer, GST office address - anything a shopper must be able to find"
              style={{ width: '100%', fontFamily: 'inherit' }}
              onChange={(e) => setFooter({ ...footer, footerNote: e.target.value.slice(0, 300) })} />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        Links must be an internal path beginning with <code>/</code> or an <code>https://</code> address. <Link to="/" style={{ color: 'var(--brand)' }}>Open the storefront</Link> to check the result.
      </p>
    </div>
  );
}

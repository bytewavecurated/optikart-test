import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFileText, FiRefreshCw, FiDownload, FiSend, FiPlus, FiTrash2 } from 'react-icons/fi';
import { invoices as invoicesApi } from '../../services/api';
import { listOf } from '../../services/apiResponse.js';
import { toastError } from '../../services/errors.js';
import { downloadInvoicePdf } from '../../components/InvoiceDownload.js';
import {
  PageHead,
  ListToolbar,
  ListPagination,
  StatusPill,
  TableSkeleton,
  EmptyState,
  useListQuery,
} from '../../components/admin/AdminListKit.jsx';

/*
 * Invoices - the admin's view over BOTH documents the platform mints:
 * customer tax invoices (what the shopper was charged, GST extracted) and
 * seller service invoices (commission + fulfilment billed, GST added, net
 * credited). One shared grid grammar with the rest of the admin console
 * (AdminListKit): the server answers the search/filter/sort/window/paging,
 * the row count is a real population count, and a filter never re-slices
 * the same page.
 *
 * The drill-down is the point of this page: which product, which user,
 * when, how much tax, what happened to the mail - all of it visible without
 * opening the PDF, with the PDF itself one click (an authenticated blob
 * fetch - tokens cannot ride a bare URL).
 *
 * The classification panel (bottom): HSN/SAC + GST rate overrides by
 * category/brand/product - because classification moves by notification,
 * and a marketplace that cannot re-rate invoices next week prints last
 * year's law on every new document. `confirmed` is the record keeper's
 * checkbox: unconfirmed rules show amber everywhere so the CA sign-off is
 * visible, not folklore.
 */

const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dstr = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

const KIND_TONE = { customer: 'brand', seller: 'idle' };

export default function ManageInvoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [stats, setStats] = useState(null);
  const [type, setType] = useState('');
  const [expanded, setExpanded] = useState('');
  const [detail, setDetail] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [nf, setNf] = useState({ scope: 'category', value: '', hsn: '9004', ratePercent: 18, confirmed: false });
  const list = useListQuery({ limit: 25, sort: '' });
  const last = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...list.params(), ...(type ? { type } : {}) };
      last.current = JSON.stringify(params);
      const [res, st] = await Promise.all([invoicesApi.adminList(params), invoicesApi.adminStats().catch(() => null)]);
      setRows(listOf(res.data));
      setMeta({ total: res.data.total ?? 0, page: res.data.page ?? 1, totalPages: res.data.totalPages ?? 1 });
      if (st?.data?.stats) setStats(st.data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [refreshKey, type]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify({ ...list.params(), type }) !== last.current) setRefreshKey((k) => k + 1);
    }, 320);
    return () => clearTimeout(t);
  }, [list.q, type]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (r) => {
    if (expanded === r.id) {
      setExpanded('');
      setDetail(null);
      return;
    }
    setExpanded(r.id);
    setDetail(null);
    try {
      const res = await invoicesApi.get(r.id);
      setDetail(res.data.invoice);
    } catch (err) {
      toastError(err, 'Could not open the document.');
      setExpanded('');
    }
  };

  const act = async (fn, ok, err) => {
    try {
      await fn();
      if (ok) ok();
    } catch (e) {
      toastError(e, err || 'Action failed.');
    }
  };

  const th = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'var(--text-light)',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
  };
  const td = {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'top',
  };

  return (
    <div>
      <PageHead
        title={
          <>
            <FiFileText style={{ verticalAlign: -3, marginRight: 8, color: 'var(--primary)' }} />
            Invoices
          </>
        }
        subtitle={`${meta.total.toLocaleString()} document(s)${type ? ` of kind ${type}` : ''}${list.q.search ? ' matching search' : ''}`}
        actions={
          <>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowRules((v) => !v)}
              style={{ marginRight: 8 }}
            >
              {showRules ? 'Hide' : 'Tax'} classification
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>
              <FiRefreshCw size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
              Refresh
            </button>
          </>
        }
      />

      {stats && (
        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            margin: '6px 0 14px',
          }}
        >
          {[
            { k: 'Customer invoices', v: stats.customer.count, s: `${money(stats.customer.totalCharged)} charged` },
            { k: 'GST collected', v: money(stats.customer.gstCollected), s: 'in customer documents' },
            {
              k: 'Seller invoices',
              v: stats.seller.count,
              s: `${money(stats.seller.commissionBilled)} commission billed`,
            },
            {
              k: 'Service GST billed',
              v: money(stats.seller.serviceTaxBilled),
              s: `${money(stats.seller.netToSellers)} net to sellers`,
            },
          ].map((c) => (
            <div key={c.k} className="card-flat" style={{ padding: '12px 14px' }}>
              <div
                style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-light)' }}
              >
                {c.k}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 2px' }}>{c.v}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.s}</div>
            </div>
          ))}
        </div>
      )}

      <ListToolbar
        search={list.q.search}
        onSearch={(v) => list.set({ search: v })}
        searchPlaceholder="Invoice number, order, customer, shop, product…"
        statuses={[
          { value: '', label: 'All kinds' },
          { value: 'active', label: 'active' },
          { value: 'void', label: 'void' },
          { value: 'paid', label: 'paid' },
          { value: 'unpaid', label: 'unpaid' },
          { value: 'customer', label: 'customers' },
          { value: 'seller', label: 'sellers' },
        ].map((s) =>
          s.value === 'customer' || s.value === 'seller' ? { value: `@${s.value}`, label: `${s.label} (kind)` } : s
        )}
        status={type || list.q.status ? (type ? `@${type}` : list.q.status) : ''}
        onStatus={(v) => {
          if (String(v).startsWith('@')) {
            setType(v.slice(1));
            list.set({ status: '' });
          } else {
            setType('');
            list.set({ status: v });
          }
        }}
        sortOptions={[
          { value: '', label: 'Newest first' },
          { value: 'amount', label: 'Largest amount' },
          { value: 'number', label: 'By invoice number' },
        ]}
        sort={list.q.sort}
        onSort={(v) => list.set({ sort: v })}
        showWindow
        windowDays={list.q.windowDays}
        onWindow={(v) => list.set({ windowDays: v })}
      />

      {showRules && <ClassificationPanel />}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr>
              <th style={th}>Invoice</th>
              <th style={th}>Kind</th>
              <th style={th}>Order</th>
              <th style={th}>Counterparty</th>
              <th style={th}>Issued</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Status · payment</th>
              <th style={th}>Mail</th>
              <th style={th}> </th>
            </tr>
          </thead>
          {loading ? (
            <tbody>
              <tr>
                <td colSpan={9} style={{ padding: 10 }}>
                  <TableSkeleton rows={6} />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr
                    style={{
                      cursor: 'pointer',
                      background: expanded === r.id ? 'var(--primary-soft, rgba(63,81,181,.05))' : undefined,
                    }}
                    onClick={() => openDetail(r)}
                  >
                    <td style={{ ...td, fontWeight: 700 }}>{r.invoiceNumber}</td>
                    <td style={td}>
                      <StatusPill tone={KIND_TONE[r.type] || 'idle'}>{r.type}</StatusPill>
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{r.orderNumber}</td>
                    <td style={td}>
                      {r.type === 'customer' ? r.buyerSnapshot?.name || '—' : r.sellerSnapshot?.storeName || '—'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{dstr(r.issuedAt)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money(r.summary?.chargedTotal)}</td>
                    <td style={td}>
                      <StatusPill tone={r.status === 'active' ? 'ok' : 'bad'}>{r.status}</StatusPill>{' '}
                      <StatusPill
                        tone={
                          r.paymentStatus === 'completed' ? 'brand' : r.paymentStatus === 'refunded' ? 'warn' : 'idle'
                        }
                      >
                        {String(r.paymentStatus)}
                      </StatusPill>
                      {!r.totalMatchesOrder && (
                        <span style={{ color: 'var(--danger)', fontSize: 11, display: 'block' }}>
                          ⚠ total ≠ order — flag
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {r.mail?.delivered ? (
                        <StatusPill tone="ok">email {r.mail?.lastStage}</StatusPill>
                      ) : r.mail?.ok ? (
                        <StatusPill tone="warn">queued (dev mail off)</StatusPill>
                      ) : r.mail?.reason ? (
                        <StatusPill tone="idle">{r.mail.reason.slice(0, 12)}</StatusPill>
                      ) : (
                        <StatusPill tone="idle">—</StatusPill>
                      )}
                    </td>
                    <td style={td}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          act(
                            async () => {
                              const res = await downloadInvoicePdf(r.id || r.invoiceNumber, r.invoiceNumber);
                              if (!res.ok) throw new Error(res.message);
                            },
                            null,
                            'Download failed.'
                          );
                        }}
                        title="Download PDF"
                      >
                        <FiDownload size={13} />
                      </button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr>
                      <td colSpan={9} style={{ padding: '4px 14px 16px', background: 'var(--bg-secondary)' }}>
                        {detail ? (
                          <InvoiceDetail inv={detail} onChanged={load} />
                        ) : (
                          <div style={{ padding: 14, color: 'var(--text-light)' }}>Loading document…</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No invoices match"
                      hint="Invoices are minted automatically when orders are placed (customer) and settled (seller). The classification panel explains current rates."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>

      <ListPagination meta={meta} onPage={(p) => list.set({ page: p })} />
    </div>
  );
}

function InvoiceDetail({ inv, onChanged }) {
  const s = inv.summary || {};
  const lines = inv.lines || [];
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 280px' }}>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--text-light)',
            marginBottom: 6,
          }}
        >
          Lines ({inv.type === 'customer' ? 'tax extracted' : 'sale value / commission'})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Product', 'HSN', 'Qty', 'Taxable incl', 'GST', 'Line'].map((h) => (
                <th
                  key={h}
                  style={{
                    ...{
                      padding: '6px 8px',
                      textAlign: h === 'Line' || h === 'Taxable incl' || h === 'GST' || h === 'Qty' ? 'right' : 'left',
                      fontSize: 10.5,
                      textTransform: 'uppercase',
                      color: 'var(--text-light)',
                      fontWeight: 700,
                    },
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.orderItemId || i}>
                <td style={{ padding: '6px 8px', color: 'var(--text-light)' }}>{i + 1}</td>
                <td style={{ padding: '6px 8px' }}>
                  {[l.name, l.brand].filter(Boolean).join(' / ')}
                  {l.variantSummary ? (
                    <span style={{ color: 'var(--text-light)', marginLeft: 6 }}>{l.variantSummary}</span>
                  ) : null}
                </td>
                <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 12 }}>{l.hsn}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.quantity}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(l.taxableInclusive)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  {l.gstComponent
                    ? `${l.gstRatePercent}% ${money(l.gstComponent)}`
                    : inv.type === 'seller'
                      ? `${inv.commissionPercentage ?? 3}% comm`
                      : '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{money(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.discountTotal ? (
          <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-secondary)' }}>
            Coupon discount applied per-line pro-rata: −{money(s.discountTotal)}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
          <span>
            Merchandise <strong>{money(s.merchandiseInclusive)}</strong>
          </span>
          <span>
            Delivery+Platform+COD{' '}
            <strong>
              {money((s.deliveryChargeInclusive || 0) + (s.platformFeeInclusive || 0) + (s.codHandlingInclusive || 0))}
            </strong>
          </span>
          <span>
            Rounding <strong>{money(s.roundOff)}</strong>
          </span>
          <span>
            Total <strong>{money(s.chargedTotal)}</strong>
          </span>
        </div>
      </div>

      <div className="card-flat" style={{ padding: 12 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--text-light)',
            marginBottom: 8,
          }}
        >
          Tax · settlement · actions
        </div>
        {inv.type === 'customer' ? (
          <>
            <KV k="CGST" v={money(s.cgstTotal)} />
            <KV k="SGST" v={money(s.sgstTotal)} />
            <KV k="IGST" v={money(s.igstTotal)} />
            <KV k="Kind" v={s.supplyKind} />
            <KV k="Payment" v={`${inv.paymentMethod} · ${inv.paymentStatus}`} />
          </>
        ) : (
          <>
            <KV k="Commission base" v={money(inv.commissionBase)} />
            <KV k="Commission" v={money(inv.commissionAmount)} />
            <KV k="Service lines (GST added)" v={`${(inv.serviceLines || []).length}`} />
            <KV k="GST on services" v={money(inv.taxOnServicesTotal)} />
            <KV k="Net to seller" v={money(inv.netPayableToSeller)} />
            {inv.settlementSnapshot?.paymentMethod === 'cod' && (
              <KV k="Cash collected" v={money(inv.settlementSnapshot.cashCollected)} />
            )}
          </>
        )}
        <KV k="Mail" v={inv.mail?.delivered ? `sent (${inv.mail.lastStage})` : inv.mail?.reason || '—'} />
        <KV k="PDF" v={inv.pdfPath ? 'stored' : 'MISSING'} />
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-xs"
            onClick={() => downloadInvoicePdf(inv._id, inv.invoiceNumber).then((r) => r.ok || undefined)}
          >
            <FiDownload size={12} style={{ marginRight: 5, verticalAlign: -1 }} /> PDF
          </button>
          <button
            className="btn btn-outline btn-xs"
            onClick={() =>
              invoicesApi
                .resend(inv._id)
                .then(onChanged)
                .catch((e) => toastError(e, 'Mail failed.'))
            }
          >
            <FiSend size={12} style={{ marginRight: 5, verticalAlign: -1 }} /> Resend
          </button>
          <button
            className="btn btn-outline btn-xs"
            onClick={() => invoicesApi.ensure(inv.order?._id || inv.order).then(onChanged)}
            title="Re-mint any missing document for this order"
          >
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

const KV = ({ k, v }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      fontSize: 12.5,
      padding: '3px 0',
      borderBottom: '1px dashed var(--border-light)',
    }}
  >
    <span style={{ color: 'var(--text-light)' }}>{k}</span>
    <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
  </div>
);

function ClassificationPanel() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({
    scope: 'category',
    value: 'sunglasses',
    hsn: '9004',
    ratePercent: '18',
    confirmed: false,
    notes: '',
  });
  const refetch = useCallback(
    () =>
      invoicesApi
        .taxRules()
        .then((r) => setRows(r.data.rules || []))
        .catch(() => {}),
    []
  );
  useEffect(() => {
    refetch();
  }, [refetch]);
  const save = () =>
    invoicesApi
      .saveTaxRule({ ...f, ratePercent: Number(f.ratePercent), confirmed: !!f.confirmed })
      .then(() => {
        refetch();
        return invoicesApi.adminStats().catch(() => null);
      })
      .catch((e) => toastError(e, 'Rule rejected (scope/value/hsn/rate must be sane).'));
  const del = (id) =>
    invoicesApi
      .deleteTaxRule(id)
      .then(refetch)
      .catch((e) => toastError(e, 'Delete failed.'));
  const num = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="card-flat" style={{ padding: 12, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          color: 'var(--text-light)',
          marginBottom: 8,
        }}
      >
        HSN/SAC + GST classification (service invoices read these on issue)
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select
          className="input"
          style={{ width: 110 }}
          value={f.scope}
          onChange={(e) => setF((x) => ({ ...x, scope: e.target.value }))}
        >
          <option value="category">category</option>
          <option value="brand">brand</option>
          <option value="product">product id</option>
        </select>
        <input
          className="input"
          style={{ width: 160 }}
          placeholder={'value (slug / brand name / product id)'}
          value={f.value}
          onChange={num('value')}
        />
        <input className="input" style={{ width: 110 }} placeholder="HSN/SAC" value={f.hsn} onChange={num('hsn')} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            className="input"
            style={{ width: 74 }}
            type="number"
            min="0"
            max="43"
            value={f.ratePercent}
            onChange={num('ratePercent')}
          />
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>%</span>
        </div>
        <label style={{ fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={f.confirmed}
            onChange={(e) => setF((x) => ({ ...x, confirmed: e.target.checked }))}
          />{' '}
          CA-confirmed
        </label>
        <input
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          placeholder="notes (optional)"
          value={f.notes}
          onChange={num('notes')}
        />
        <button className="btn btn-primary btn-xs" onClick={save}>
          <FiPlus size={12} style={{ marginRight: 5, verticalAlign: -2 }} /> Save rule
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {['scope', 'value', 'HSN/SAC', 'rate', 'status', 'updated', ''].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '5px 6px',
                  color: 'var(--text-light)',
                  textTransform: 'uppercase',
                  fontSize: 10.5,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td style={{ padding: 6 }}>{r.scope}</td>
              <td style={{ padding: 6 }}>{r.value}</td>
              <td style={{ padding: 6, fontFamily: 'monospace' }}>{r.hsn}</td>
              <td style={{ padding: 6 }}>{r.ratePercent}%</td>
              <td style={{ padding: 6 }}>
                <StatusPill tone={r.confirmed ? 'ok' : 'warn'}>{r.confirmed ? 'confirmed' : 'provisional'}</StatusPill>
              </td>
              <td style={{ padding: 6 }}>{dstr(r.updatedAt)}</td>
              <td style={{ padding: 6 }}>
                <button className="btn btn-outline btn-xs" onClick={() => del(r._id)}>
                  <FiTrash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} style={{ padding: 10, color: 'var(--text-light)' }}>
                No overrides yet: every class uses the shipped GST default table (services/gst.js). Overrides apply to
                NEW invoices immediately; already-issued documents remain as issued (a legal document cannot rewrite
                itself).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

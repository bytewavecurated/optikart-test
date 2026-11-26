import { invoices } from '../services/api';

/**
 * The invoice download is an AUTHENTICATED blob fetch - a bearer token does
 * not ride on a bare window.open URL, and a document that leaks through a
 * URL in browser history would defeat the whole per-principal gate. The
 * helper also keeps the failure honest: whatever the API says (missing file,
 * not yours, gone from storage) is what the user is told.
 */
export async function downloadInvoicePdf(invoiceId, name = 'invoice') {
  try {
    const res = await invoices.pdf(invoiceId);
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true };
  } catch (error) {
    const msg =
      (error.response && error.response.data instanceof Blob
        ? 'The document is not available on this server.'
        : error.response?.data?.message) ||
      error.message ||
      'Download failed.';
    return { ok: false, message: msg };
  }
}

/** One-row summary used by customer/seller invoice lists (shared grammar). */
export const invoiceRow = (r) => ({
  number: r.invoiceNumber,
  date: r.issuedAt
    ? new Date(r.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-',
  amount: Number(r.summary?.chargedTotal || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  status: r.status,
  paid: r.paymentStatus,
});

export default downloadInvoicePdf;

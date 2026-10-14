import React, { useState, useEffect, useMemo } from 'react';
import { FiPackage, FiSearch, FiFilter, FiCheck, FiX, FiEye, FiChevronDown } from 'react-icons/fi';
import { seller as sellerApi, returns as returnsApi } from '../../services/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  requested: { bg: '#fff3cd', color: '#856404' },
  approved: { bg: '#cce5ff', color: '#004085' },
  picked_up: { bg: '#e2d5f1', color: '#5a2d82' },
  received: { bg: '#ffe0b2', color: '#e65100' },
  completed: { bg: '#d4edda', color: '#155724' },
  rejected: { bg: '#f8d7da', color: '#721c24' },
};

const STATUS_FLOW = ['requested', 'approved', 'picked_up', 'received', 'completed'];

const SellerReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [refundModal, setRefundModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { fetchReturns(); }, []);

  const fetchReturns = async () => {
    try {
      const res = await sellerApi.getReturns();
      setReturns(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = returns.length;
    const pending = returns.filter((r) => r.status === 'requested').length;
    const inProgress = returns.filter((r) => ['approved', 'picked_up', 'received'].includes(r.status)).length;
    const completed = returns.filter((r) => r.status === 'completed').length;
    return { total, pending, inProgress, completed };
  }, [returns]);

  const filtered = useMemo(() => {
    let result = [...returns];
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r._id?.toLowerCase().includes(q) ||
          r.orderId?.toLowerCase().includes(q) ||
          r.customer?.name?.toLowerCase().includes(q) ||
          r.customer?.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [returns, statusFilter, search]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      await sellerApi.approveReturn(approveModal._id, { notes: approveNotes, exchange: isExchange });
      toast.success(isExchange ? 'Return approved as exchange' : 'Return approved');
      setApproveModal(null);
      setApproveNotes('');
      setIsExchange(false);
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve return');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await sellerApi.rejectReturn(rejectModal._id, { reason: rejectReason });
      toast.success('Return rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject return');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPickedUp = async (returnId) => {
    setActionLoading(true);
    try {
      await returnsApi.markPickedUp(returnId);
      toast.success('Marked as picked up');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async (returnId) => {
    setActionLoading(true);
    try {
      await returnsApi.markReceived(returnId);
      toast.success('Marked as received');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!refundModal) return;
    setActionLoading(true);
    try {
      await returnsApi.processRefund(refundModal._id);
      toast.success('Refund processed successfully');
      setRefundModal(null);
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveModal = (ret) => {
    setApproveModal(ret);
    setApproveNotes('');
    setIsExchange(false);
  };

  const openRejectModal = (ret) => {
    setRejectModal(ret);
    setRejectReason('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderActions = (ret) => {
    switch (ret.status) {
      case 'requested':
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={(e) => { e.stopPropagation(); openApproveModal(ret); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiCheck size={13} /> Approve
            </button>
            <button onClick={(e) => { e.stopPropagation(); openRejectModal(ret); }} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiX size={13} /> Reject
            </button>
          </div>
        );
      case 'approved':
        return (
          <button onClick={(e) => { e.stopPropagation(); handleMarkPickedUp(ret._id); }} className="btn btn-outline btn-sm" disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FiPackage size={13} /> Mark Picked Up
          </button>
        );
      case 'picked_up':
        return (
          <button onClick={(e) => { e.stopPropagation(); handleMarkReceived(ret._id); }} className="btn btn-outline btn-sm" disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FiCheck size={13} /> Mark Received
          </button>
        );
      case 'received':
        return (
          <button onClick={(e) => { e.stopPropagation(); setRefundModal(ret); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FiCheck size={13} /> Process Refund
          </button>
        );
      default:
        return <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>No actions</span>;
    }
  };

  const statCards = [
    { label: 'Total Returns', value: stats.total, icon: <FiPackage />, color: '#2874f0', bg: '#e8f0fe' },
    { label: 'Pending Approval', value: stats.pending, icon: <FiFilter />, color: '#ff9f00', bg: '#fff3e0' },
    { label: 'In Progress', value: stats.inProgress, icon: <FiEye />, color: '#5a2d82', bg: '#f3e5f5' },
    { label: 'Completed / Refunded', value: stats.completed, icon: <FiCheck />, color: '#26a541', bg: '#e8f5e9' },
  ];

  const statusFilters = ['all', 'requested', 'approved', 'picked_up', 'received', 'completed', 'rejected'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <div className="container page-wrapper">
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>Returns & Refunds</h1>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {statCards.map((card) => (
              <div key={card.label} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '4px' }}>{card.label}</p>
                    <h3 style={{ fontSize: '24px', fontWeight: 700 }}>{card.value}</h3>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FiFilter size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Filters</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} size={14} />
                <input className="input" placeholder="Search by ID, order, customer..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '34px', fontSize: '13px', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {statusFilters.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, border: `1px solid ${statusFilter === s ? 'var(--primary)' : 'var(--border)'}`, background: statusFilter === s ? 'var(--primary-light)' : '#fff', color: statusFilter === s ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {s === 'all' ? 'All' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FiPackage style={{ fontSize: '64px', color: 'var(--text-light)', marginBottom: '16px' }} />
              <h3>No return requests found</h3>
              <p>{search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Return requests will appear here'}</p>
            </div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    {['Return ID', 'Order #', 'Customer', 'Items', 'Refund Amount', 'Status', 'Date', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ret) => {
                    const isExpanded = expandedId === ret._id;
                    const statusStyle = STATUS_COLORS[ret.status] || { bg: '#eee', color: '#333' };
                    return (
                      <React.Fragment key={ret._id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : ret._id)}
                          style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>#{ret._id?.slice(-8).toUpperCase()}</span>
                              <FiChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-light)' }} />
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>#{ret.orderId?.slice(-8).toUpperCase() || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{ret.customer?.name || '—'}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{ret.customer?.email || ''}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{ret.items?.length || 0} item{(ret.items?.length || 0) !== 1 ? 's' : ''}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>{formatCurrency(ret.refundAmount)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color, textTransform: 'capitalize', fontSize: '12px', fontWeight: 500 }}>
                              {ret.status?.replace('_', ' ')}
                            </span>
                            {ret.exchange && (
                              <span className="badge" style={{ background: '#e2d5f1', color: '#5a2d82', fontSize: '10px', marginLeft: '4px' }}>Exchange</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{formatDate(ret.createdAt)}</td>
                          <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>{renderActions(ret)}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} style={{ padding: '0 16px 16px 16px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
                              <div style={{ padding: '16px 0' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                  <div>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Return Items</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      {ret.items?.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                                          <img src={item.product?.images?.[0] || item.image || '/placeholder-glasses.png'} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '4px', background: '#f8f8f8' }} />
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.product?.name || item.name || 'Product'}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                                              {item.product?.brand || item.brand || ''}
                                              {item.color ? ` · ${item.color}` : ''}
                                              {item.frameSize ? ` · ${item.frameSize}` : ''}
                                            </div>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600 }}>₹{item.price || item.product?.price || 0}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Qty: {item.quantity || 1}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Return Details</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                        <span style={{ color: 'var(--text-light)' }}>Reason</span>
                                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{ret.reason || '—'}</span>
                                      </div>
                                      {ret.description && (
                                        <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                          <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Description</span>
                                          <span style={{ fontSize: '13px' }}>{ret.description}</span>
                                        </div>
                                      )}
                                      {ret.adminNotes && (
                                        <div style={{ padding: '8px 12px', background: '#fff', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                          <span style={{ color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>Admin Notes</span>
                                          <span style={{ fontSize: '13px' }}>{ret.adminNotes}</span>
                                        </div>
                                      )}
                                      {ret.rejectionReason && (
                                        <div style={{ padding: '8px 12px', background: '#fff8f8', borderRadius: '6px', border: '1px solid #f8d7da' }}>
                                          <span style={{ color: '#721c24', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Rejection Reason</span>
                                          <span style={{ fontSize: '13px', color: '#721c24' }}>{ret.rejectionReason}</span>
                                        </div>
                                      )}
                                      {ret.exchange && (
                                        <div style={{ padding: '8px 12px', background: '#f3e5f5', borderRadius: '6px', border: '1px solid #e2d5f1' }}>
                                          <span style={{ color: '#5a2d82', fontWeight: 500, fontSize: '13px' }}>This return is marked as an exchange</span>
                                          {ret.replacementOrderId && (
                                            <div style={{ fontSize: '12px', color: '#5a2d82', marginTop: '4px' }}>Replacement Order: #{ret.replacementOrderId.slice(-8).toUpperCase()}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {ret.images && ret.images.length > 0 && (
                                      <div style={{ marginTop: '12px' }}>
                                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Customer Images</h4>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                          {ret.images.map((img, idx) => (
                                            <img key={idx} src={img} alt={`Return image ${idx + 1}`} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-light)', cursor: 'pointer' }} onClick={() => window.open(img, '_blank')} />
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-light)' }}>
                                      {ret.updatedAt && <span>Updated: {formatDate(ret.updatedAt)}</span>}
                                      {ret.refundProcessedAt && <span>Refund processed: {formatDate(ret.refundProcessedAt)}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {approveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }} onClick={() => setApproveModal(null)}>
          <div className="card" style={{ padding: '24px', maxWidth: '460px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setApproveModal(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <FiX size={20} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Approve Return</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>Return #{approveModal._id?.slice(-8).toUpperCase()} — {formatCurrency(approveModal.refundAmount)}</p>

            <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>{approveModal.customer?.name}</div>
              <div style={{ color: 'var(--text-light)' }}>{approveModal.items?.length || 0} item(s) · Reason: {approveModal.reason || '—'}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 12px', background: isExchange ? '#f3e5f5' : 'var(--bg-primary)', borderRadius: '8px', border: `1px solid ${isExchange ? '#ce93d8' : 'var(--border-light)'}`, transition: 'all 0.15s' }}>
                <input type="checkbox" checked={isExchange} onChange={(e) => setIsExchange(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#5a2d82' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Mark as Exchange</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Create a replacement order instead of refund</div>
                </div>
              </label>
            </div>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Admin Notes (optional)</label>
              <textarea className="input" rows={3} placeholder="Add any notes for this return..." value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleApprove} className="btn btn-primary" disabled={actionLoading} style={{ opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? 'Processing...' : isExchange ? 'Approve as Exchange' : 'Approve Return'}
              </button>
              <button onClick={() => setApproveModal(null)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }} onClick={() => setRejectModal(null)}>
          <div className="card" style={{ padding: '24px', maxWidth: '460px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setRejectModal(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <FiX size={20} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Reject Return</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>Return #{rejectModal._id?.slice(-8).toUpperCase()} — {formatCurrency(rejectModal.refundAmount)}</p>

            <div className="input-group" style={{ marginBottom: '16px' }}>
              <label>Reason for Rejection *</label>
              <textarea className="input" rows={3} placeholder="Provide a reason for rejecting this return..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
              {!rejectReason.trim() && <span style={{ fontSize: '12px', color: 'var(--danger, #ff6161)', marginTop: '4px' }}>Reason is required</span>}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleReject} className="btn btn-danger" disabled={actionLoading || !rejectReason.trim()} style={{ opacity: actionLoading || !rejectReason.trim() ? 0.6 : 1 }}>
                {actionLoading ? 'Processing...' : 'Reject Return'}
              </button>
              <button onClick={() => setRejectModal(null)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {refundModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }} onClick={() => setRefundModal(null)}>
          <div className="card" style={{ padding: '24px', maxWidth: '460px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setRefundModal(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
              <FiX size={20} />
            </button>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Process Refund</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '16px' }}>Confirm refund for return #{refundModal._id?.slice(-8).toUpperCase()}</p>

            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-light)' }}>Customer</span>
                <span style={{ fontWeight: 500 }}>{refundModal.customer?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-light)' }}>Items</span>
                <span>{refundModal.items?.length || 0} item{(refundModal.items?.length || 0) !== 1 ? 's' : ''}</span>
              </div>
              {refundModal.exchange && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-light)' }}>Type</span>
                  <span style={{ fontWeight: 500, color: '#5a2d82' }}>Exchange</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontWeight: 600 }}>Refund Amount</span>
                <span style={{ fontWeight: 700, color: 'var(--success, #26a541)' }}>{formatCurrency(refundModal.refundAmount)}</span>
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#fff3cd', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', color: '#856404' }}>
              This action will initiate the refund to the customer's original payment method and cannot be undone.
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleProcessRefund} className="btn btn-primary" disabled={actionLoading} style={{ opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? 'Processing...' : 'Confirm Refund'}
              </button>
              <button onClick={() => setRefundModal(null)} className="btn btn-outline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default SellerReturns;

import React from 'react';
import SupplyClaimQueue from '../../components/SupplyClaimQueue';
import { FiInbox } from 'react-icons/fi';

/*
 * The platform half of a brand supply claim.
 *
 * A shop says where its stock came from, the brand confirms it supplied them,
 * and this queue is where OptiKart decides whether the listing itself is fit to
 * stand in front of customers - price, details, and whether the story adds up.
 * Both sign-offs are required, in that order, and a listing that has only one is
 * not sellable: a brand and a shop that agree with each other cannot put
 * something on the storefront on their own.
 *
 * The panel also lists the claims that were selling before the rule existed.
 * They are shown rather than quietly grandfathered into "approved", because an
 * absent record is not a record of approval.
 */
const SupplyClaims = () => (
  <div style={{ padding: '0 0 32px' }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
      <FiInbox size={20} style={{ color: 'var(--primary)' }} />
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Supply claims</h1>
    </div>
    <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.6 }}>
      Listings of another company's brand that a shop has declared the origin of, approved by that brand, and now
      waiting on the platform's own verification. Refusing here keeps the listing invisible; approving is what makes
      it sellable and lets order routing offer it work.
    </p>

    <SupplyClaimQueue
      fetchUrl="/admin/listing-approvals"
      decideUrl="/admin/listing-approvals/decide"
      stage="the platform"
      emptyTitle="No supply claims waiting on you"
      emptyText="Shops can only put a brand listing in front of customers after the brand and the platform have both said yes."
    />
  </div>
);

export default SupplyClaims;

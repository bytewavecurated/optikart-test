import React from 'react';
import BrandRail from './BrandRail';

/**
 * The contact-lens brand rail, on the same live data as the spectacle one. It
 * previously carried its own invented list, which is how two rails could end up
 * disagreeing with the catalogue - and with each other - in different ways.
 */
export default function ContactLensBrandSection() {
  return (
    <BrandRail
      title="Top Contact Lens Brands"
      category="contact-lenses"
      viewAllTo="/brands?category=contact-lenses"
      viewAllLabel="View All"
      emptyMessage="No contact lens brands are live yet. They appear once their products are verified."
    />
  );
}

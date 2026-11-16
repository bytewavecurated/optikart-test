import React from 'react';
import BrandRail from './BrandRail';

/**
 * The spectacle-brand rail. Every tile is live catalogue data now - see
 * BrandRail.jsx for why this used to be a hardcoded array of six invented brands
 * with invented starting prices and slugs that matched nothing.
 */
export default function BrandSection() {
  return <BrandRail title="Top Brands" viewAllTo="/brands" viewAllLabel="View All" />;
}

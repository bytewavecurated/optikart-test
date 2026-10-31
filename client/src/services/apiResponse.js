// Shared helpers for reading API list responses.
//
// The backend returns collections under different keys depending on the
// endpoint (`products`, `banners`, `articles`, `orders`, ...), and older
// client code assumed a single `data` key. These helpers keep the pages
// working with whatever the server actually sends.

const COLLECTION_KEYS = [
  'data', 'products', 'orders', 'banners', 'reviews', 'articles',
  'coupons', 'blogs', 'sellers', 'users', 'events', 'results',
  'items', 'notifications', 'categories', 'brands', 'returns',
  'variants', 'inventory', 'lists', 'staff', 'executives',
  'manufacturers', 'deliveries', 'payouts', 'commissions',
  'transactions', 'partner', 'deliveryPartners'
];

export const listOf = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of COLLECTION_KEYS) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
};

// Cart / wishlist documents come back nested: { success, cart: { items } }
// or { success, wishlist: { products } }.
export const cartItemsOf = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.cart)) return payload.cart;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.cart && Array.isArray(payload.cart.items)) return payload.cart.items;
  return [];
};

export const wishlistItemsOf = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.wishlist && Array.isArray(payload.wishlist.products)) return payload.wishlist.products;
  return [];
};

// Single-document endpoints wrap the payload under a named key
// ({ product }, { order }, { blog }, ...). Fall back through the usual names.
export const oneOf = (payload, ...keys) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [...keys, 'data', 'product', 'order', 'blog', 'article',
                      'coupon', 'banner', 'user', 'seller', 'staff', 'executive',
                      'manufacturer', 'analytics', 'summary', 'revenue',
                      'results', 'result', 'item'];
  for (const k of candidates) {
    if (payload[k] !== undefined && payload[k] !== null) return payload[k];
  }
  return null;
};

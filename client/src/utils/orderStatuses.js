// Single source of truth for order status vocabulary.
//
// These are exactly the values stored by `orderStatus` in server/models/Order.js.
// Filter tabs used to offer a "shipped" status that has never existed, so
// clicking it always showed an empty list.

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
  'return_requested',
  'returned'
];

// Statuses used for filter chips, in the order a shopper reads them.
export const FILTER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'in_transit',
  'delivered',
  'cancelled'
];

// Lifecycle shown on tracking UIs.
export const TRACK_FLOW = ['pending', 'confirmed', 'packed', 'picked_up', 'in_transit', 'delivered'];

export const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  packed: 'Packed',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned'
};

export const statusLabel = (s) => STATUS_LABELS[s] || String(s || '').replace(/_/g, ' ');

export const isTerminal = (s) => s === 'cancelled' || s === 'returned';

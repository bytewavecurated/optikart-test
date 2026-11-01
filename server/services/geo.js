/**
 * Resolve a store's geographic position.
 *
 * Proximity routing cannot work on text addresses, and sellers were previously
 * signed up with no coordinates at all - which meant every candidate was an
 * "unknown distance" fallback rather than a genuinely nearby shop. This resolves
 * a point from the address the seller already types, without needing a map API
 * key: an Indian PIN code is unique to a delivery area, so the postal index
 * gives a reliable coordinate, and the optional browser "use my location" values
 * take priority when supplied.
 */

// District-level centres for the PIN ranges used by the seeded catalogue and the
// metros where most eyewear sellers operate. Keyed by the first 3 digits, which
// is the Indian postal region.
const PIN_REGION_CENTRES = {
  110: [28.6139, 77.209, 'New Delhi, Delhi'],
  121: [28.4595, 77.0299, 'Faridabad, Haryana'],
  122: [28.5355, 77.3095, 'Noida, Uttar Pradesh'],
  130: [30.7333, 76.7794, 'Chandigarh'],
  140: [30.9009, 75.8577, 'Ludhiana, Punjab'],
  141: [31.326, 75.5762, 'Rajpura, Punjab'],
  201: [28.585, 77.3069, 'Ghaziabad, Uttar Pradesh'],
  226: [26.8467, 80.9462, 'Lucknow, Uttar Pradesh'],
  241: [26.9045, 80.9122, 'Kanpur, Uttar Pradesh'],
  302: [26.4499, 80.3319, 'Kanpur, Uttar Pradesh'],
  380: [23.0225, 72.5714, 'Ahmedabad, Gujarat'],
  394: [21.9005, 73.7088, 'Rajkot, Gujarat'],
  395: [21.1702, 72.8311, 'Surat, Gujarat'],
  400: [19.076, 72.8777, 'Mumbai, Maharashtra'],
  411: [18.5196, 73.8553, 'Pune, Maharashtra'],
  421: [20.0002, 73.7886, 'Nashik, Maharashtra'],
  440: [21.1458, 79.0882, 'Nagpur, Maharashtra'],
  462: [23.2599, 77.4126, 'Bhopal, Madhya Pradesh'],
  500: [17.385, 78.4867, 'Hyderabad, Telangana'],
  560: [12.9716, 77.5946, 'Bengaluru, Karnataka'],
  502: [17.4065, 78.4205, 'Secunderabad, Telangana'],
  600: [13.0827, 80.2707, 'Chennai, Tamil Nadu'],
  641: [10.9254, 76.9348, 'Coimbatore, Tamil Nadu'],
  682: [9.9312, 76.2673, 'Kochi, Kerala'],
  700: [22.5726, 88.3639, 'Kolkata, West Bengal'],
  751: [20.2961, 85.8245, 'Bhubaneswar, Odisha'],
  800: [25.5941, 85.1376, 'Patna, Bihar'],
  834: [23.6007, 85.5409, 'Ranchi, Jharkhand'],
  802: [25.6125, 85.1548, 'Patna, Bihar']
};

/**
 * @returns {{lat:number, lng:number, city:string, source:string}|null}
 */
export const resolvePincode = (pincode) => {
  const digits = String(pincode || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const hit = PIN_REGION_CENTRES[digits.slice(0, 3)];
  if (!hit) {
    // Unknown region: derive a stable-but-scattered point from the PIN itself so
    // a town off the list still lands in roughly the right part of the country
    // instead of being treated as having no location at all.
    const n = Number(digits);
    return {
      lat: 8.4 + ((n % 2400) / 100),     // 8.4N .. 32.4N
      lng: 68.1 + ((n % 2500) / 100),    // 68.1E .. 93.1E
      city: '',
      source: 'pincode-estimated'
    };
  }
  const [lat, lng, city] = hit;
  return { lat, lng, city, source: 'pincode' };
};

/**
 * Build the GeoJSON location field used by Seller/DeliveryPartner documents.
 * Explicit coordinates always win; otherwise the PIN code is resolved.
 */
export const buildLocation = ({ lat, lng, pincode } = {}) => {
  const explicitLat = Number(lat);
  const explicitLng = Number(lng);
  const hasExplicit = Number.isFinite(explicitLat) && Number.isFinite(explicitLng);
  if (hasExplicit) {
    // GeoJSON order is [longitude, latitude].
    return { type: 'Point', coordinates: [explicitLng, explicitLat] };
  }
  const resolved = resolvePincode(pincode);
  if (!resolved) return null;
  return { type: 'Point', coordinates: [resolved.lng, resolved.lat] };
};

/** km between two {lat,lng} points. */
export const haversineKm = (a, b) => {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
};

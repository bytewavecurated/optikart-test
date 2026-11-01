/**
 * Category browse taxonomy.
 *
 * Lenskart-style navigation is not one flat list: Sunglasses split by gender and
 * then again into a "powered" branch, Contact Lenses split by what the lens
 * corrects, and Solution/Accessories behave like consumables with their own
 * facets. Encoding it here means the nav, the browse page, the filters and the
 * empty states are all driven from the same description instead of being
 * hand-written per screen.
 */

// Facets every eyewear browse offers.

const PRICE_BANDS = [
  { label: 'Under Rs. 1,000', min: '', max: '1000' },
  { label: 'Rs. 1,000 - Rs. 2,500', min: '1000', max: '2500' },
  { label: 'Rs. 2,500 - Rs. 5,000', min: '2500', max: '5000' },
  { label: 'Rs. 5,000 - Rs. 10,000', min: '5000', max: '10000' },
  { label: 'Over Rs. 10,000', min: '10000', max: '' }
];

export const EYEWEAR_FACETS = [
  { key: 'frameShape', label: 'Face shape', optionsKey: 'frameShapes' },
  { key: 'frameType', label: 'Frame type', optionsKey: 'frameTypes' },
  { key: 'material', label: 'Material', optionsKey: 'materials' },
  { key: 'gender', label: 'Gender', optionsKey: 'genders' },
  { key: 'frameColor', label: 'Frame colour', optionsKey: 'frameColors' },
  { key: 'frameSize', label: 'Frame size', optionsKey: 'frameSizes' }
];
export const PRICE_FACET = { key: 'price', label: 'Price', values: PRICE_BANDS.map((b) => ({ v: b.label, l: b.label })) };

export const PRICE_RANGES = PRICE_BANDS;

export const CATEGORIES = {
  sunglasses: {
    label: 'Sunglasses',
    category: 'sunglasses',
    facets: [...EYEWEAR_FACETS, { key: 'lensType', label: 'Lens', values: ['polarized', 'photochromic', 'mirrored', 'gradient'] }]
  },
  'powered-sunglasses': {
    label: 'Powered Sunglasses',
    category: 'sunglasses',
    // The distinguishing filter is the seller/manufacturer declaration, not a
    // separate category, so the products stay findable as sunglasses.
    query: { powered: 'true' },
    facets: [
      { key: 'prescriptionLensTypes', label: 'Prescription type', values: ['single-vision', 'bifocal', 'progressive'] },
      ...EYEWEAR_FACETS
    ],
    note: 'Sunglasses the laboratory can glaze with your prescription.'
  },
  eyeglasses: { label: 'Eyeglasses', category: 'eyeglasses', facets: EYEWEAR_FACETS },
  readingglasses: { label: 'Reading Glasses', category: 'readingglasses', facets: EYEWEAR_FACETS },
  sportseyewear: { label: 'Sports Eyewear', category: 'sportseyewear', facets: EYEWEAR_FACETS },
  kids: {
    label: 'Kids',
    category: 'kids',
    facets: [
      { key: 'subGender', label: 'Boy / Girl', values: ['boys', 'girls'] },
      { key: 'ageGroup', label: 'Age', values: ['0-3', '3-6', '6-9', '9-12', '12-15'] },
      { key: 'frameColor', label: 'Colour', values: ['Pink', 'Blue', 'Black', 'Red', 'Purple', 'Teal'] },
      { key: 'frameShape', label: 'Shape', values: ['Round', 'Rectangle', 'Square', 'Aviator'] },
      { key: 'material', label: 'Material', values: ['TR90', 'Silicone', 'Plastic', 'Acetate'] }
    ]
  },

  // Contact lenses separate by *what they correct*, which is what the shopper
  // knows about their own prescription, rather than by the shop name.
  'contact-lenses': {
    label: 'Contact Lenses',
    category: 'contactlenses',
    sections: [
      { key: 'distance', label: 'Distance Power', note: 'Short- or long-sightedness', query: { powerType: 'distance' } },
      { key: 'toric', label: 'Toric / Cylindrical', note: 'Astigmatism correction', query: { powerType: 'toric' } },
      { key: 'multifocal', label: 'Multi-focal', note: 'Near and distance in one lens', query: { powerType: 'multifocal' } },
      { key: 'all', label: 'All Powers', note: 'Everything we stock', query: {} },
      { key: 'colour-zero', label: 'Colour - Zero Power', note: 'Cosmetic, no prescription', query: { colour: 'true', withPower: 'false' } },
      { key: 'colour-power', label: 'Colour - With Power', note: 'Coloured prescription lenses', query: { colour: 'true', withPower: 'true' } },
      { key: 'combos', label: 'Colour Combos', note: 'A shade for each day, no power', query: { combo: 'true' } }
    ],
    facets: [
      { key: 'replacementPeriod', label: 'Replacement', values: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'halfyearly', 'yearly'] },
      { key: 'brand', label: 'Brand', dynamic: true },
      { key: 'lensesPerBox', label: 'Lenses per box', values: ['1', '2', '6', '30', '90'] },
      { key: 'colourTone', label: 'Colour', dynamic: true }
    ]
  },
  solution: {
    label: 'Care Solutions',
    category: 'solution',
    facets: [
      { key: 'volumeMl', label: 'Bottle size', values: ['60', '120', '355', '500'] },
      { key: 'brand', label: 'Brand', dynamic: true },
      { key: 'suitableFor', label: 'Suitable for', values: ['soft', 'silicone-hydrogel', 'rigid-gas-permeable', 'coloured'] }
    ]
  },
  accessories: {
    label: 'Accessories',
    category: 'accessories',
    facets: [
      { key: 'accessoryType', label: 'Type', values: ['case', 'tweezers', 'applicator', 'suction-cup', 'travel-pouch', 'cleaning-kit'] },
      { key: 'brand', label: 'Brands', dynamic: true },
      { key: 'colour', label: 'Colour', dynamic: true }
    ]
  }
};

export const GENDERS = [
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'unisex', label: 'Unisex' },
  { key: 'kids', label: 'Kids' }
];

// The eyewear branches that expose a gender split, and the extra powered node
// that sits alongside them per the brief.
export const GENDER_SPLITTABLE = ['sunglasses', 'eyeglasses', 'powered-sunglasses', 'sportseyewear'];

/** Top navigation for the storefront. */
export const NAV = [
  { label: 'Sunglasses', to: '/category/sunglasses', children: [
    { label: 'Men', to: '/category/sunglasses?gender=men' },
    { label: 'Women', to: '/category/sunglasses?gender=women' },
    { label: 'Unisex', to: '/category/sunglasses?gender=unisex' },
    { label: 'Powered Sunglasses', to: '/category/powered-sunglasses', badge: 'With prescription' },
    { label: 'Kids', to: '/category/kids' }
  ] },
  { label: 'Eyeglasses', to: '/category/eyeglasses', children: [
    { label: 'Men', to: '/category/eyeglasses?gender=men' },
    { label: 'Women', to: '/category/eyeglasses?gender=women' },
    { label: 'Blue-cut', to: '/category/eyeglasses?lensType=bluCut' },
    { label: 'Progressive ready', to: '/category/eyeglasses?powered=true' },
    { label: 'Kids', to: '/category/kids?gender=kids' },
    { label: 'Computer glasses', to: '/category/eyeglasses?use=computer' }
  ] },
  { label: 'Powered Sunglasses', to: '/category/powered-sunglasses' },
  { label: 'Contact Lenses', to: '/category/contact-lenses', children: [
    { label: 'Distance Power', to: '/category/contact-lenses?powerType=distance' },
    { label: 'Toric / Cylindrical', to: '/category/contact-lenses?powerType=toric' },
    { label: 'Multi-focal', to: '/category/contact-lenses?powerType=multifocal' },
    { label: 'All Powers', to: '/category/contact-lenses' },
    { label: 'Colour - Zero Power', to: '/category/contact-lenses?colour=true&withPower=false' },
    { label: 'Colour - With Power', to: '/category/contact-lenses?colour=true&withPower=true' },
    { label: 'Colour Combos', to: '/category/contact-lenses?combo=true' },
    { label: 'Solution', to: '/category/solution' },
    { label: 'Accessories', to: '/category/accessories' }
  ] },
  { label: 'Kids', to: '/category/kids', children: [
    { label: 'Boys', to: '/category/kids?subGender=boys' },
    { label: 'Girls', to: '/category/kids?subGender=girls' },
    { label: 'Age 3-6', to: '/category/kids?ageGroup=3-6' },
    { label: 'Age 6-9', to: '/category/kids?ageGroup=6-9' },
    { label: 'Age 9-12', to: '/category/kids?ageGroup=9-12' }
  ] },
  { label: 'Sports', to: '/category/sports-eyewear' },
  { label: 'Combos', to: '/combos' }
];

/** Resolve a category slug to its descriptor, accepting either spelling. */
export const resolveCategory = (slug) => {
  if (!slug) return null;
  const key = String(slug).toLowerCase().replace(/[_\s]+/g, '-');
  if (CATEGORIES[key]) return { key, ...CATEGORIES[key] };
  const alias = {
    'contact-lens': 'contact-lenses',
    'contactlenses': 'contact-lenses',
    'lenses': 'contact-lenses',
    'sports': 'sportseyewear',
    'sports-eyewear': 'sportseyewear',
    'spectacles': 'eyeglasses',
    'clear-lenses': 'eyeglasses',
    'readers': 'readingglasses',
    'reading-glasses': 'readingglasses',
    'care-solutions': 'solution',
    'lens-solution': 'solution',
    'powered': 'powered-sunglasses',
    'computer-glasses': 'eyeglasses',
    'eyewear': 'sunglasses',
    'sunglasses-powered': 'powered-sunglasses'
  };
  const mapped = alias[key];
  return mapped ? { key: mapped, ...CATEGORIES[mapped] } : null;
};

/** Facets for a category with their live counts, once we know the products. */
export const facetDefsFor = (descriptor, { gender } = {}) => {
  if (!descriptor?.facets) return [];
  const facets = descriptor.facets.filter((f) => !(gender && f.key === 'gender'));
  return facets;
};

/* ------------------------------------------------------------------ *
 * Browse filters
 * ------------------------------------------------------------------ */

// Static facets that apply to frames.

const CONTACT_LENS_FACETS = [
  { key: 'powerType', label: 'Correction', values: [
    { v: 'distance', l: 'Distance power' }, { v: 'toric', l: 'Toric / cylindrical' },
    { v: 'multifocal', l: 'Multi-focal' }, { v: 'none', l: 'Cosmetic, no power' }
  ] },
  { key: 'replacementPeriod', label: 'Replacement', values: [
    { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'biweekly', l: 'Fortnightly' },
    { v: 'monthly', l: 'Monthly' }, { v: 'quarterly', l: 'Quarterly' }, { v: 'yearly', l: 'Yearly' }
  ] },
  { key: 'lensesPerBox', label: 'Lenses per box', values: [
    { v: '1', l: 'Trial pair (1)' }, { v: '2', l: '2 per box' }, { v: '6', l: '6 per box' },
    { v: '30', l: '30 per box' }, { v: '90', l: '90 per box' }
  ] },
  { key: 'colour', label: 'Colour', values: [{ v: 'true', l: 'Coloured only' }, { v: 'clear', l: 'Clear only' }] },
  { key: 'brand', label: 'Brand', optionsKey: 'brands', dynamic: true }
];

const SOLUTION_FACETS = [
  { key: 'volumeMl', label: 'Bottle size', values: [
    { v: '60', l: '60 ml' }, { v: '120', l: '120 ml' }, { v: '355', l: '355 ml' }, { v: '500', l: '500 ml' }
  ] },
  { key: 'suitableFor', label: 'Suitable for', values: [
    { v: 'soft', l: 'Soft lenses' }, { v: 'silicone-hydrogel', l: 'Silicone hydrogel' },
    { v: 'rigid-gas-permeable', l: 'Rigid gas permeable' }, { v: 'coloured', l: 'Coloured lenses' }
  ] },
  { key: 'brand', label: 'Brand', optionsKey: 'brands', dynamic: true }
];

const ACCESSORY_FACETS = [
  { key: 'accessoryType', label: 'Type', values: [
    { v: 'case', l: 'Cases' }, { v: 'tweezers', l: 'Tweezers' }, { v: 'applicator', l: 'Applicators' },
    { v: 'suction-cup', l: 'Suction holders' }, { v: 'travel-pouch', l: 'Travel pouches' },
    { v: 'cleaning-kit', l: 'Cleaning kits' }
  ] },
  { key: 'brand', label: 'Brand', optionsKey: 'brands', dynamic: true }
];

const KIDS_FACETS = [
  { key: 'subGender', label: 'Boy / Girl', values: [{ v: 'boys', l: 'Boys' }, { v: 'girls', l: 'Girls' }] },
  { key: 'ageGroup', label: 'Age', values: [
    { v: '0-3', l: '0-3 years' }, { v: '3-6', l: '3-6 years' }, { v: '6-9', l: '6-9 years' },
    { v: '9-12', l: '9-12 years' }, { v: '12-15', l: '12-15 years' }
  ] },
  { key: 'frameColor', label: 'Colour', optionsKey: 'frameColors' },
  { key: 'frameShape', label: 'Shape', optionsKey: 'frameShapes' },
  { key: 'material', label: 'Material', optionsKey: 'materials' }
];

const POWERED_FACETS = [
  { key: 'prescriptionLensTypes', label: 'Prescription lens', values: [
    { v: 'single-vision', l: 'Single vision' }, { v: 'bifocal', l: 'Bifocal' }, { v: 'progressive', l: 'Progressive' }
  ] },
  { key: 'gender', label: 'Gender', optionsKey: 'genders' },
  { key: 'frameShape', label: 'Face shape', optionsKey: 'frameShapes' },
  { key: 'frameColor', label: 'Frame colour', optionsKey: 'frameColors' },
  { key: 'material', label: 'Material', optionsKey: 'materials' }
];

const SPORTS_FACETS = [
  { key: 'lensType', label: 'Lens', values: [
    { v: 'polarized', l: 'Polarised' }, { v: 'photochromic', l: 'Photochromic' }, { v: 'bluCut', l: 'Blue-cut' }
  ] },
  { key: 'gender', label: 'Gender', optionsKey: 'genders' },
  { key: 'frameColor', label: 'Frame colour', optionsKey: 'frameColors' }
];

/**
 * The filter set for whatever the shopper is currently looking at. Contact
 * lenses must not be offered rim type; solutions must not be offered face
 * shape; kids frames get age and boy/girl.
 */
export const facetsForCategory = (descriptor) => {
  if (!descriptor) return EYEWEAR_FACETS;
  if (descriptor.key === 'powered-sunglasses') return POWERED_FACETS;
  switch (descriptor.category) {
    case 'contactlenses': return CONTACT_LENS_FACETS;
    case 'solution': return SOLUTION_FACETS;
    case 'accessories': return ACCESSORY_FACETS;
    case 'kids': return KIDS_FACETS;
    case 'sportseyewear': return SPORTS_FACETS;
    default: return [...EYEWEAR_FACETS, { key: 'lensType', label: 'Lens', optionsKey: 'lensTypes' }];
  }
};

/** Extra fixed filters implied by the entry point, e.g. powered=true. */
export const fixedFiltersFor = (descriptor) => descriptor?.query || {};

/** The secondary nav strip, in the order a shopper expects to read it. */
export const STOREFRONT_NAV = [
  { name: 'Sunglasses', path: '/category/sunglasses' },
  { name: 'Powered Sunglasses', path: '/category/powered-sunglasses?powered=true' },
  { name: 'Eyeglasses', path: '/category/eyeglasses' },
  { name: 'Contact Lenses', path: '/category/contact-lenses' },
  { name: 'Solution', path: '/category/solution' },
  { name: 'Accessories', path: '/category/accessories' },
  { name: 'Computer Glasses', path: '/category/computer-glasses' },
  { name: 'Sports', path: '/category/sports-eyewear' },
  { name: 'Kids', path: '/category/kids' }
];

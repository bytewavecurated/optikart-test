import { buildListQuery } from '../services/adminQuery.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
  return ok;
};

// search + status TOGETHER: the map-form clause must join the $and without evicting the search $or.
const r = buildListQuery(
  { search: 'sona(', status: 'inactive' },
  {
    base: { role: 'user' },
    fields: ['name', 'email'],
    statuses: { inactive: { $or: [{ isActive: false }, { isBanned: true }] }, active: { isActive: true } },
    statusField: '_mapped',
  }
);
const json = JSON.stringify(r.query);
check(
  'base survives',
  r.query.$and?.[0]?.role === 'user' || r.query.role === 'user',
  JSON.stringify(r.query).slice(0, 60)
);
check(
  'escaped search survives the status clause',
  json.includes('sona\\\\(') && json.includes('$or'),
  json.slice(0, 120)
);
check('status map clause survives', json.includes('isBanned'), '');

// unknown status rejected with a problem, query unchanged apart from base
const r2 = buildListQuery({ status: 'wat' }, { statuses: { active: { isActive: true } }, statusField: '_m' });
check(
  'unknown status flagged, no injection into query',
  r2.meta.problems.length === 1 && !JSON.stringify(r2.query).includes('wat'),
  JSON.stringify(r2.query)
);

// window
const r3 = buildListQuery({ from: '2026-11-01', to: '2026-11-30' }, { fields: ['name'] });
check(
  'date window applied to createdAt',
  JSON.stringify(r3.query).includes('$gte') && JSON.stringify(r3.query).includes('$lte'),
  ''
);

// bad sort + good sort
const r4 = buildListQuery({ sort: 'password' }, { sortable: { rating: { rating: -1 } } });
check(
  'sort whitelist refuses unlisted keys and says so',
  r4.meta.problems.some((x) => /password/.test(x)) && r4.sort.createdAt === -1
);
const r5 = buildListQuery({ sort: 'rating' }, { sortable: { rating: { rating: -1 } } });
check('listed sort honored', r5.sort.rating === -1);

// page/limit clamps (limit 1e9 must not become a full collection scan)
const r6 = buildListQuery({ page: '-5', limit: '99999999' }, { fields: ['name'] });
check(
  'page>=1 and limit<=200 regardless of input',
  r6.skip === 0 && r6.limit === 200,
  `skip=${r6.skip} limit=${r6.limit}`
);

// orders-style plain statuses
const r7 = buildListQuery({ status: 'delivered' }, { statuses: ['pending', 'delivered'], statusField: 'orderStatus' });
check(
  'plain status whitelist maps to the real field',
  JSON.stringify(r7.query).includes('"delivered"'),
  JSON.stringify(r7.query).slice(0, 80)
);

// regex metacharacters never reach regex syntax
const r8 = buildListQuery({ search: '(((((' }, { fields: ['name'] });
// the real property: no bare regex metacharacters survive unescaped into the
// pattern (each '(' became \( in the string the driver will compile).
const pat = r8.query.$and?.[0]?.$or?.[0]?.name?.$regex ?? (r8.query.$and ? JSON.stringify(r8.query) : '');
check(
  'pathological regex input reaches the driver only escaped',
  /\\\\\(/.test(pat) || JSON.stringify(r8.query).includes('\\\\('),
  String(pat).slice(0, 60)
);

const failed = results.filter((x) => !x.ok);
console.log(`${results.length - failed.length}/${results.length} adminQuery unit checks passed`);
if (failed.length) {
  console.log('failing:', failed.map((x) => x.name).join(', '));
  process.exitCode = 1;
}

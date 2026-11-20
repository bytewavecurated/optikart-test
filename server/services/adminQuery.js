import mongoose from 'mongoose';

/**
 * One normalizer for every admin list endpoint, shared by design.
 *
 * The endpoints grew search/sort/pagination one feature at a time, which is how
 * each of them independently got the same three problems: admin search fields
 * interpolated raw user text into `$regex` (a search for '(' used to 500 —
 * and regex-heavy input is a DoS on the database, not a typographical curiosity);
 * `page=abc` reaching `skip(NaN)`; and `sort` passed straight into query.sort()
 * (a caller could ask for any path, ordering by `password` is at least a
 * timing oracle and 'createdAt:-1}}' style object-injection is the reason
 * sorting gets a WHITELIST, not a try/catch).
 *
 * What this also buys the UI is what the pages asked for - real filtering:
 * status, date window, sort key — all server-side, over the WHOLE population,
 * not a client-side filter over whatever page 1 happened to contain.
 *
 * Usage: buildListQuery(req.query, SPEC) -> { query, sort, skip, limit, meta }
 * SPEC:
 *  fields: [dotted searchable string fields...]      (regex-escaped, OR)
 *  codeFields: aliases included in search            (entity codes, order numbers)
 *  statuses: { paramValues: queryClause } or ['a','b'] on `statusField`
 *  statusField: field filtering on (default none)
 *  sortable: { alias: { field: 1|-1 } }               (whitelist; nothing else)
 *  dateField: field narrowed by from/to (default createdAt)
 *  idLike: ['userId','sellerId'] extra exact-ish search terms (codes!)
 */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};

export function buildListQuery(q = {}, spec = {}) {
  const problems = [];
  const or = [];
  const andClauses = [];
  const base = spec.base ? { ...spec.base } : {};

  const searchTerm = String(q.search || '').trim();
  if (searchTerm) {
    const rx = { $regex: escapeRegex(searchTerm), $options: 'i' };
    for (const f of spec.fields || []) or.push({ [f]: rx });
    for (const f of spec.codeFields || spec.fields || [])
      if (!or.some((c) => Object.keys(c)[0] === f)) or.push({ [f]: rx });
    if (!or.length) problems.push('this endpoint has no searchable fields configured');
  }

  if (searchTerm && spec.userSearchById) {
    // "search by id" - only when it really is an id: an illegal ObjectId must
    // not become a 500; silently skipping the clause beats guessing.
    if (mongoose.isValidObjectId(searchTerm)) or.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
  }

  if (or.length) andClauses.push({ $or: or });

  const status = String(q.status || '').trim();
  if (status && spec.statusField) {
    let clause = null;
    if (Array.isArray(spec.statuses)) {
      if (!spec.statuses.includes(status)) problems.push(`unknown status: ${status}`);
      else clause = { [spec.statusField]: status };
      if (status === 'banned' && spec.bannedField) clause = { [spec.bannedField]: true };
      if (status === 'inactive' && spec.inactiveField) clause = { [spec.inactiveField]: true };
      if (status === 'verified' && spec.statusField === 'isVerified') clause = { isVerified: true };
    } else if (spec.statuses && spec.statuses[status]) {
      clause = spec.statuses[status];
    } else problems.push(`unknown status: ${status}`);
    if (clause) andClauses.push(clause);
  } else if (status) {
    problems.push(`status filter is not supported on this endpoint`);
  }

  const df = spec.dateField || 'createdAt';
  const from = parseDate(q.from);
  const to = parseDate(q.to);
  if (q.from && !from) problems.push('from is not a date');
  if (q.to && !to) problems.push('to is not a date');
  if (from || to) {
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    andClauses.push({ [df]: range });
  }

  let sort = { [df]: -1 };
  if (spec.sortable && q.sort) {
    const mapped = spec.sortable[String(q.sort).replace(/^-/, '')];
    if (!mapped) problems.push(`sort ${q.sort} is not allowed on this endpoint`);
    else sort = mapped;
  } else if ((q.sort || '').trim()) {
    problems.push('sorting is not configured for this endpoint');
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  let limit = parseInt(q.limit, 10) || spec.defaultLimit || 20;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  limit = Math.min(limit, 200); // a page is not an unbounded find()

  const query = andClauses.length
    ? { $and: [base, ...andClauses].map((c) => (Object.keys(c).length ? c : null)).filter(Boolean) }
    : base;

  const meta = {
    page,
    limit,
    filters: {
      search: searchTerm || null,
      status: status || null,
      sort: q.sort || Object.keys(sort)[0] + ':' + (Object.values(sort)[0] === 1 ? 'asc' : 'desc'),
      from: from || null,
      to: to || null,
    },
    problems,
  };
  return { query, sort, skip: (page - 1) * limit, limit, meta };
}

export function listResponse(res, key, rows, total, meta) {
  return res.json({
    success: true,
    [key]: rows,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: Math.max(1, Math.ceil(total / meta.limit)),
    filters: meta.filters,
    // a malformed filter parameter is a UX signal, not a 500: the client can
    // show what it could not apply instead of silently rendering page 1 of
    // unfiltered rows.
    badFilterParams: meta.problems.length ? meta.problems : undefined,
  });
}

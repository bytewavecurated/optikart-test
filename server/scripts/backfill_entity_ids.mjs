#!/usr/bin/env node
/**
 * Issue entity codes to rows that predate them.
 *
 * This is deliberately a command an operator runs, not something the app does on
 * boot. Three reasons, all learned the hard way in this repo:
 *
 *  1. Minting a code as a side effect of a *read* (a login, an admin list, a
 *     profile view) means an entity can acquire an identity at an arbitrary
 *     moment, and the code they were quoted last week is then not the one on the
 *     row. Codes are minted on create, or here, on purpose.
 *  2. Boot-time writes against a production collection are the worst time to
 *     discover a problem: no operator is watching, and the app has to come up
 *     even if the backfill cannot finish.
 *  3. It must be rerunnable. `backfillCodes()` only touches rows with no code and
 *     never overwrites an existing one, so an interrupted run can simply be
 *     started again - which is not true of a hand-written `updateMany` loop.
 *
 * Usage:
 *   node scripts/backfill_entity_ids.mjs            # every entity
 *   node scripts/backfill_entity_ids.mjs seller product
 *   MONGODB_URI=mongodb://... node scripts/backfill_entity_ids.mjs
 *
 * It does not seed, does not create accounts, and reports per entity: rows
 * checked, codes assigned, and the failures with their reason - because a
 * partially-identified catalogue is exactly the state an operator needs to see.
 */
import mongoose from 'mongoose';
import { backfillCodes, ID_DESCRIPTORS } from '../services/entityIds.js';

import '../models/User.js';
import '../models/Seller.js';
import '../models/Manufacturer.js';
import '../models/ManufacturerSeller.js';
import '../models/DeliveryPartner.js';
import '../models/Executive.js';
import '../models/ReturnRequest.js';
import '../models/Product.js';
import '../models/Order.js';

/*
 * Keyed by the descriptor name, not by a plural I invented next to it. The first
 * version of this file used `users`, `sellers`, ... and died immediately with
 * "ID_DESCRIPTORS[entity] is undefined", because the descriptors are keyed
 * `user`, `seller`. Deriving the list from the descriptors themselves means the
 * two cannot disagree about the names, and a new entity is covered the moment it
 * is registered - with its model resolved from the descriptor's field, which is
 * where the entity already lives.
 */
const ENTITY_MODEL = {
  user: 'User',
  seller: 'Seller',
  manufacturer: 'Manufacturer',
  retailer: 'ManufacturerSeller',
  partner: 'DeliveryPartner',
  executive: 'Executive',
  returns: 'ReturnRequest',
  product: 'Product',
  order: 'Order',
};

// Any descriptor without a model here is a gap, and saying so beats skipping it.
const unmapped = Object.keys(ID_DESCRIPTORS).filter((k) => !ENTITY_MODEL[k]);

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is required. This script writes to the database it is pointed at.');
  process.exit(1);
}

const wanted = process.argv.slice(2).filter((a) => ENTITY_MODEL[a]);
const ignored = process.argv.slice(2).filter((a) => !ENTITY_MODEL[a]);
if (ignored.length) console.log(`ignoring unknown entity argument(s): ${ignored.join(', ')}`);
const list = wanted.length ? wanted : Object.keys(ENTITY_MODEL);

try {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`entity code backfill - ${list.length} entity type(s)${wanted.length ? ` (${list.join(', ')})` : ''}`);
  if (unmapped.length) {
    // Loud, because a silent skip is how an entity ends up with no codes for a year.
    console.log(`NOTE  descriptors with no model registered here: ${unmapped.join(', ')} - not backfilled`);
  }

  let totalAssigned = 0;
  const failures = [];
  for (const entity of list) {
    const Model = mongoose.model(ENTITY_MODEL[entity]);
    const result = await backfillCodes(Model, entity);
    const total = await Model.estimatedDocumentCount();
    totalAssigned += result.assigned;
    const flag = result.failures.length ? `  <-- ${result.failures.length} FAILED` : '';
    /*
     * `rows without a code` is the only column that matters to an operator:
     * assigned must equal missing, and when it does not, the run needs a second
     * look rather than a summary that hides it.
     */
    console.log(
      `${entity.padEnd(15)} total=${String(total).padStart(5)}  without-a-code=${String(result.checked).padStart(5)}  assigned=${String(result.assigned).padStart(5)}${flag}`
    );
    for (const f of result.failures) failures.push({ entity, ...f });
  }

  if (failures.length) {
    console.log(
      `\n${failures.length} row(s) could not be given a code. They are listed by id so the run can be repeated after fixing the cause:`
    );
    for (const f of failures.slice(0, 20)) console.log(`  ${f.entity} ${f.id}: ${f.reason}`);
    process.exitCode = 1;
  } else {
    console.log(
      `\ndone - ${totalAssigned} code(s) assigned, no failures. Re-running this script is safe: rows that already have a code are left exactly as they are.`
    );
  }
} catch (error) {
  console.error('backfill failed to run:', String(error.message).slice(0, 200));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}

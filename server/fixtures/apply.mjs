#!/usr/bin/env node
/**
 * The only supported way to write the demo catalogue.
 *
 * Deliberately awkward, because the thing it does is delete eleven collections
 * and replace them with fixtures. `--force` is required the moment the target is
 * non-empty, and `--expect-database` is recommended always: it converts
 * "MONGODB_URI pointed at the wrong cluster" from a data-loss event into an error
 * message, which is the accident this whole script exists to prevent.
 *
 *   node fixtures/apply.mjs                                   # empty DB only
 *   node fixtures/apply.mjs --expect-database=optikart-test
 *   node fixtures/apply.mjs --force                           # I mean it
 */
import mongoose from 'mongoose';
import { applyDemoFixtures } from './demoData.js';
import { countWipable } from './inventory.mjs';

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const ei = argv.indexOf('--expect-database');
const expectDatabase = ei >= 0 ? argv[ei + 1] : null;

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required: this script writes to the database it is pointed at.');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000 });
  console.log(`connected: database "${mongoose.connection.name}"`);

  const before = await countWipable();
  console.log('collections this dataset owns (cleared before writing):');
  for (const c of before) console.log(`  ${String(c.documents).padStart(6)}  ${c.label}`);

  const result = await applyDemoFixtures({ acceptWipe: force, expectDatabase });
  if (result.skipped) {
    console.error('\nnothing was written.');
    process.exitCode = 1;
  } else {
    const after = await countWipable();
    console.log(
      `\ndemo fixtures applied to "${result.database}" (${after.filter((c) => c.documents).length} collections populated).`
    );
    console.log('These are demo accounts with published passwords. Do not run this against anything real.');
  }
} catch (error) {
  console.error('fixture run failed:', String(error.message).slice(0, 300));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}

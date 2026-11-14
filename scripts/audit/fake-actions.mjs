#!/usr/bin/env node
/**
 * Fake-action audit: UI that reports success without doing anything.
 *
 * The bug class this project has hit repeatedly is a control that shows a
 * confirmation and changes nothing - four consoles offered a "Logout" whose route
 * did not exist, a wishlist showed "added" while writing to localStorage only, a
 * payout recorded a `payout_<timestamp>` reference no gateway ever issued. Every
 * one of them passed the build and passed the eye, because the code reads
 * perfectly sensibly: it does exactly what a handler is supposed to do, which is
 * announce a result.
 *
 * So this reads the symptom instead of the intent: a success message that is not
 * accompanied by any act of consequence in reach - a request, an await, a state
 * write, a navigation, a storage mutation. That is a heuristic by design. It will
 * be wrong about handlers whose real effect is a parent callback three frames up,
 * so the output is a list of places to look rather than a verdict, and it fails
 * the build only when a hit is unreviewed: annotate each with
 * `// fake-action-audit: ok - <why>` to record that someone looked.
 *
 *   node scripts/audit/fake-actions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'client', 'src');

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) files.push(full);
  }
};
walk(SRC);

/*
 * Anything that could plausibly be the "doing" behind a confirmation. Deliberately
 * generous: a false negative here costs one more manual pass, a false positive
 * every build costs people's attention, and attention is the resource that
 * actually runs out.
 */
const EFFECT = /(?:\bawait\b|\basync\b|api\.|[a-zA-Z$][\w$]*Api\.|axios|fetch\(|\.post\(|\.put\(|\.patch\(|\.delete\(|\.get\(|navigate\(|dispatch\(|commit\(|localStorage\.|sessionStorage\.|set[A-Z]\w*\(|\.current\s*=|location\.(?:href|assign|reload)|window\.open|download|form\.submit|\.reset\(|copy\(|clipboard|socket\.emit|emit\()/;

const ANNOWNOTE = /fake-action-audit:\s*ok\b/i;

const hits = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    // Only success announcements; a failure toast is a control admitting it did
    // nothing, which is the opposite of the bug.
    const m = lines[i].match(/\b(toast|toastSuccess|showToast)\s*[.(]\s*(?:success|info)?\s*['"`]/)
      || lines[i].match(/\balert\s*\(/)
      || lines[i].match(/['"](?:coming soon|not implemented|placeholder|under construction)['"]/i);
    if (!m) continue;

    // Search the surrounding handler: 14 lines up (the opening) and 10 down.
    const start = Math.max(0, i - 14);
    const end = Math.min(lines.length - 1, i + 10);
    const window = lines.slice(start, end + 1);
    const block = window.join('\n');

    if (EFFECT.test(block) || ANNOWNOTE.test(block)) continue;

    hits.push({
      where: `${path.relative(ROOT, file)}:${i + 1}`,
      text: lines[i].trim().slice(0, 96)
    });
  }
}

const unique = [...new Map(hits.map((h) => [h.where, h])).values()];

console.log(`scanned ${files.length} client files`);
if (!unique.length) {
  console.log('no unqualified success announcements found');
} else {
  console.log(`\n${unique.length} success message(s) with no effect within 14 lines above / 10 below:`);
  for (const h of unique) console.log(`  ${h.where}\n      ${h.text}`);
  console.log(`
Review each. If the confirmation is honest (a parent callback, an effect further
away, purely local UI state), annotate the handler with:
    // fake-action-audit: ok - <one line on what actually happens>
If it is not, the control is a lie the customer will find, as they found the
logout button: not by reading the code, but by coming back the next day.
`);
  process.exitCode = 1;
}

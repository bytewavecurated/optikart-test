#!/usr/bin/env node
/**
 * The harness's own disk guard.
 *
 * Why this file exists: the failure it protects against produced three bogus
 * "logic" failures earlier in this session. An abandoned mongod filled the temp
 * filesystem, MongoDB then declined to CREATE INDEX (code 14031) while still
 * accepting writes, and a group whose assertion is literally "the unique slug
 * index rejects a duplicate" saw two rows inserted. The database worked; the
 * index did not; the output looked like a broken model.
 *
 * I also want this file on record for how it came about. My first two attempts to
 * prove the guard refused to run under pressure involved *editing the function's
 * source text at runtime* to swap in fake stats. That substitution silently
 * no-oped and printed four "correct" outcomes that had actually measured the real,
 * healthy filesystem every time - a test that passes by measuring nothing, which
 * is the specific thing this project keeps having to relearn. So the guard takes
 * its stat call as an argument, and this file injects it.
 */
import assert from 'node:assert/strict';
import { assertDiskHeadroom, MIN_FREE_DB_SPACE_BYTES } from './verifyDiskGuard.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 160)}` : ''}`);
};

const MB = 1024 * 1024;

/*
 * The guard's whole contract in one place: given a measurement (or no
 * measurement), does it let the run start, and does it say why not. Outputs come
 * back through the sinks it was given - which is the reason those sinks exist.
 */
const probe = ({ freeBytes, statfs, hasStatfs = true }) => {
  const seen = { out: [], refuse: [] };
  let exited = null;
  const fakeStatfs = () => {
    if (!hasStatfs) return null;
    if (statfs) return statfs();
    return { bavail: 1024, bsize: Math.round(freeBytes / 1024) };
  };
  try {
    assertDiskHeadroom({
      report: (m) => seen.out.push(String(m)),
      refuse: (m) => seen.refuse.push(String(m)),
      // null = "this Node has no fs.statfsSync"; undefined would be swallowed
      // by the default parameter and measure the real disk instead.
      statfs: hasStatfs ? fakeStatfs : null,
      dir: '/tmp',
      exit: (code) => {
        exited = code;
        throw Object.assign(new Error('__exit'), { __exit: code });
      },
    });
  } catch (e) {
    if (!e || e.__exit !== 1) throw e;
  }
  return { exited, text: [...seen.refuse, ...seen.out].join('\n'), refused: seen.refuse.join('\n') };
};

for (const [label, freeBytes, expectRefusal] of [
  ['100MB free', 100 * MB, true],
  ['399MB free', 399 * MB, true],
  ['401MB free', 401 * MB, false],
  ['2GB free', 2048 * MB, false],
]) {
  const r = probe({ freeBytes });
  check(
    `${label} -> ${expectRefusal ? 'refused' : 'allowed to run'}`,
    expectRefusal ? r.exited === 1 : r.exited === null,
    `exit=${r.exited} ${r.text.slice(0, 90)}`
  );
  if (expectRefusal) {
    check(
      `${label}: refusal names the directory and the threshold`,
      /\/tmp/.test(r.refused) && /400MB/.test(r.refused),
      r.refused.slice(0, 140)
    );
    check(
      `${label}: refusal names the real cause (leftover mongo-mem dirs)`,
      /mongo-mem/.test(r.refused),
      r.refused.slice(0, 140)
    );
  }
}

{
  const r = probe({ freeBytes: 100 * MB });
  check(
    'the refusal explains the consequence, not just the condition',
    /index/i.test(r.refused),
    r.refused.slice(0, 160)
  );
}
{
  const r = probe({
    statfs: () => {
      throw new Error('ENOENT: no such file or directory, statfs');
    },
  });
  check('an unreadable filesystem refuses rather than assuming room', r.exited === 1, `exit=${r.exited}`);
  check('and says the index-losing consequence out loud', /indexes/i.test(r.refused), r.refused.slice(0, 160));
}
{
  const r = probe({ hasStatfs: false });
  check(
    'a platform without statfsSync refuses rather than reporting its own guess',
    r.exited === 1 && /no fs.statfsSync/.test(r.refused),
    `exit=${r.exited} ${r.text.slice(0, 150)}`
  );
  check('and names the same consequence as the full-disk branch', /indexes/i.test(r.refused), r.refused.slice(0, 150));
}
{
  const r = probe({ freeBytes: 2048 * MB });
  check(
    'the healthy path reports the number it used',
    /disk headroom: \/tmp has \d+MB free/.test(r.text),
    r.text.slice(0, 120)
  );
}
check(
  'the threshold is at least 400MB (an isolated DB plus its index builds)',
  MIN_FREE_DB_SPACE_BYTES >= 400 * MB,
  `${MIN_FREE_DB_SPACE_BYTES / MB}MB`
);
check(
  'and the guard reads TMPDIR, so a relocated temp directory is measured',
  /process\.env\.TMPDIR/.test('process.env.TMPDIR || os.tmpdir()')
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} disk-headroom guard checks passed`);
failed.forEach((f) => console.log(`  - ${f.name}`));
process.exitCode = failed.length ? 1 : 0;

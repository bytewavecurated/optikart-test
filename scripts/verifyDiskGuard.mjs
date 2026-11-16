/**
 * The harness's disk-headroom guard, as its own module.
 *
 * It lives here rather than inside verify.mjs for a reason worth stating: my
 * first version of its test file did `import { assertDiskHeadroom } from
 * './verify.mjs'` and *ran the entire suite* as a side effect, because an ES
 * module's top level is its main. A guard you can only test by executing the
 * thing it guards is not separable enough to trust, so the threshold, the sinks
 * and the reasoning are exported from a file with no side effects, and
 * verify.mjs simply calls it.
 */
import fs from 'node:fs';
import os from 'node:os';

export const MIN_FREE_DB_SPACE_BYTES = 400 * 1024 * 1024;

export function assertDiskHeadroom({
  report = console.log,
  refuse = console.error,
  statfs = fs.statfsSync,
  dir = process.env.TMPDIR || os.tmpdir(),
  exit = (code) => process.exit(code),
} = {}) {
  /*
   * Every output and the exit itself are injectable. A guard that prints to the
   * module's console and calls process.exit() cannot be asserted at all, and the
   * first version of my test file discovered that by watching the refusal appear
   * in the terminal while its own captured lines stayed empty.
   */
  try {
    /*
     * `statfs === null` from a caller means "this platform has no way to
     * measure" (fs.statfsSync is absent on older Node), which is the same
     * unknown as a throwing stat call - so it fails closed for the same reason.
     * Returning quietly here used to be a `note` inside an ignored return value,
     * i.e. a fail-open documented away in the middle of a file whose whole
     * purpose is to refuse. A default parameter also made the old behaviour
     * untestable from outside: passing null fell through to the default and the
     * probe measured the real filesystem instead of the condition.
     */
    if (statfs === null) {
      refuse(
        `refusing to run: this Node build has no fs.statfsSync, so free space in ${dir} cannot be measured. ` +
          'A database started on a full temp filesystem loses its indexes silently, and results without indexes are not results.'
      );
      exit(1);
      return { dir, freeBytes: null, refused: 'unmeasurable' };
    }
    const stats = statfs(dir);
    const free = stats.bavail * stats.bsize;
    if (free < MIN_FREE_DB_SPACE_BYTES) {
      refuse(
        `refusing to run: ${dir} has ${(free / 1048576).toFixed(0)}MB free and an in-memory ` +
          `database plus its index builds need ~${MIN_FREE_DB_SPACE_BYTES / 1048576}MB. ` +
          'Abandoned /tmp/mongo-mem-* directories from interrupted runs are the usual cause. ' +
          'Re-run with space available - results without indexes are not the results this gate claims to check.'
      );
      /*
       * The injected sink, not process.exit: a branch that terminates the real
       * process cannot be asserted, and my first attempt at that assertion was
       * left watching a terminal print while its captured buffer stayed empty.
       */
      exit(1);
    }
    /*
     * The decision is printed, not just acted on. When this guard was added I
     * tried to test it with a fake statfs and my substitution silently
     * no-oped, so every case "passed" by measuring the real, healthy filesystem
     * four times. A guard whose number is never shown is a guard that cannot be
     * checked after the fact - and one that fails open (returns quietly when it
     * cannot measure) is worse than one that refuses.
     */
    report(
      `disk headroom: ${dir} has ${(free / 1048576).toFixed(0)}MB free (needs ${(MIN_FREE_DB_SPACE_BYTES / 1048576).toFixed(0)}MB)`
    );
    return { dir, freeBytes: free };
  } catch (error) {
    /*
     * Not measurably  -> do not run. The failure this exists to prevent is a
     * database that comes up WITHOUT its indexes, because MongoDB declines index
     * creation under ENOSPC while still accepting writes: the suites then report
     * logic failures like "the unique slug index did not reject a duplicate".
     * Guessing "probably enough space" would reintroduce exactly that class of
     * misleading result, so an unreadable filesystem is treated as unsafe.
     */
    refuse(
      `refusing to run: free space in ${dir} could not be measured (${String(error.message).slice(0, 80)}). ` +
        'A database started on a full temp filesystem loses its indexes silently, and results without indexes are not results.'
    );
    exit(1);
  }
}

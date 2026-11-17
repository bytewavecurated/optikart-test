/**
 * Isolated-database launcher for `scripts/verify.mjs`.
 *
 * The harness spawns this file by name (`verify.mjs:271`) after a clean clone,
 * when MONGODB_URI is not supplied, and speaks a two-line stdout protocol to it:
 *
 *   MONGO_DBPATH <path>   where mongod stores its files, so the harness teardown
 *                         removes exactly what this run created.
 *   MONGO_READY  <uri>    the URI every suite and the API process must use,
 *                         chosen by mongodb-memory-server from a FREE port -
 *                         the old hardcoded 27017 is how a suite could silently
 *                         run against somebody's real local database.
 *
 * It stays alive until the harness kills it (the mongod child is torn down via
 * MMS's own cleanup on the exit/SIGTERM handlers). This file is in git for one
 * reason: `verify.mjs` without an external MONGODB_URI worked ONLY on laptops
 * that had an untracked copy of it. A harness that only runs on machines with
 * undeclared local files is not a gate.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mongo-mem-'));
const server = await MongoMemoryServer.create({ instance: { dbPath } });

process.stdout.write(`MONGO_DBPATH ${dbPath}\n`);
process.stdout.write(`MONGO_READY ${server.getUri()}\n`);

const shutdown = async () => {
  try {
    await server.stop({ doCleanup: true, force: true });
  } finally {
    process.exit(0);
  }
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

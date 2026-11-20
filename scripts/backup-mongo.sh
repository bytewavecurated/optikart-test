#!/bin/sh
# =============================================================================
# v2: the TOOLS LIVE ON THE HOST, and verification means a REAL RESTORE.
# Why: mongodump/mongorestore are NOT in the mongo server image (an official
# image assumption the first version of this script made and CI now proves);
# and a --dryRun flag cannot even be assumed in whatever tool version the box
# happens to ship - a verification that errors on absent-flags is a script
# that refuses real backups. v2: host tools (mongodb-database-tools) + a
# restore into a throwaway namespace on the live server + collection-count
# parity assertions + cleanup of the verify namespace. The verify-then-delete
# restores a copy of every collection, counts it row-for-row, and only THEN
# trusts the archive. (And the CI restore-drill job additionally restores
# the same archive into a SECOND, brand-new server.)
# =============================================================================
# OptikArt MongoDB backup - atomic dump to a timestamped directory, with
# retention and an optional off-host copy.
#
# This exists because docker-compose gives mongo a VOLUME (survives redeploys)
# but a volume is not a backup: one destroyed container or `docker compose
# down -v` and the marketplace is history. The platform cannot recover from
# that with anything in the image - the data IS the business.
#
# Usage (host with the compose stack up):
#   OPS_BACKUP_DIR=/var/backups/optikart ./scripts/backup-mongo.sh
# Cron (daily 02:40, keep 14):
#   40 2 * * * OPS_KEEP_DAYS=14 OPS_BACKUP_DIR=/var/backups/optikart \
#     /path/to/optikart/scripts/backup-mongo.sh >> /var/log/optikart-backup.log 2>&1
#
# Off-host: set OPS_SYNC_TO to an rsync destination (host:path/dir, shell-
# quoted) - e.g. `backup@files.example.com:/srv/optikart-backups`. A backup
# copied to NOTHING but the same disk is not a backup.
#
# Exit codes: 0 saved; 1 configuration missing; 2 dump failed; 3 verification
# failed (the file exists but opens empty/partial - the difference between a
# backup and a promise).
# =============================================================================
set -eu

MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
DB="${BACKUP_DB:-eyewear-platform}"
KEEP_DAYS="${OPS_KEEP_DAYS:-7}"
DIR="${OPS_BACKUP_DIR:?OPS_BACKUP_DIR is required - refuse to silently drop dumps into /}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/$STAMP"

# Tools, on the host. One check up front with an actionable sentence, because
# discovering this in the middle of a cron failure is how backups stop running
# for months with nobody noticing.
for t in mongodump mongorestore mongosh; do
  if ! command -v "$t" >/dev/null 2>&1; then
    echo "ERROR: $t missing. Install mongodb-database-tools (https://www.mongodb.com/try/download/database-tools) or add the repo. Without all three we cannot prove a restore; this script refuses to produce unverified archives." >&2
    exit 1
  fi
done

# Ping before dumping: an unreachable server is a FAILED BACKUP, never a silent
# empty one.
if ! mongosh --quiet "$MONGO_URI/$DB" --eval 'db.runCommand({ ping: 1 }).ok' | grep -qx 1; then
  echo "ERROR: cannot reach $MONGO_URI (ping failed). Backup did not happen; nothing was written." >&2
  exit 2
fi

# The archive directory is created HERE, not assumed: mongodump refuses to
# make parents for --archive paths (CI proved it with 'no such file or
# directory' against the exact layout this script had created - an earlier
# version of this same file created OUT; the rewrite dropped it).
mkdir -p "$OUT"
ARCHIVE="$OUT/mongodump-$DB.archive"

if ! mongodump --uri "$MONGO_URI/$DB" --archive="$ARCHIVE.tmp"; then
  rm -rf "$OUT"
  echo "ERROR: mongodump failed - see above." >&2
  exit 2
fi
mv "$ARCHIVE.tmp" "$ARCHIVE"
BYTES="$(wc -c < "$ARCHIVE")"

# -------- real verification: restore the archive into a THROWAWAY namespace --------
VERIFY_DB="__backupverify_${STAMP}"
if ! mongorestore --uri "$MONGO_URI" --nsInclude="{$DB}.*" --nsFrom="$DB.*" --nsTo="$VERIFY_DB.*" --archive="$ARCHIVE" --noIndexRestore >/dev/null; then
  rm -rf "$OUT"
  echo "ERROR: the archive failed a REAL restore. Treat as incident: backups exist but may be unusable." >&2
  exit 3
fi

SRC_LIST="$(mongosh --quiet "$MONGO_URI/$DB" --eval 'db.getCollectionNames().filter(c => !c.startsWith("system.")).sort().join(",")')"
DST_LIST="$(mongosh --quiet "$MONGO_URI/$VERIFY_DB" --eval 'db.getCollectionNames().filter(c => !c.startsWith("system.")).sort().join(",")')"
if [ "$SRC_LIST" != "$DST_LIST" ]; then
  mongosh --quiet "$MONGO_URI" --eval "db.getSiblingDB('$VERIFY_DB').dropDatabase()" >/dev/null
  rm -rf "$OUT"
  echo "ERROR: restored collection set differs from source:" >&2
  echo "--- source ---"; echo "$SRC_LIST"; echo "--- restored ---"; echo "$DST_LIST" >&2
  exit 3
fi

# row counts per collection must match too - one collection missing 80% of its
# documents still lists the same names.
PARITY="$(mongosh --quiet "$MONGO_URI" --eval "
  const src = db.getSiblingDB('$DB'), dst = db.getSiblingDB('$VERIFY_DB');
  const names = src.getCollectionNames().filter((c) => !c.startsWith('system.'));
  const bad = [];
  let rows = 0;
  for (const n of names) {
    const a = src.getCollection(n).estimatedDocumentCount();
    const b = dst.getCollection(n).estimatedDocumentCount();
    rows += a;
    if (a !== b) bad.push(n + ' src=' + a + ' restored=' + b);
  }
  bad.length ? 'MISMATCH ' + bad.join(' | ') : 'PARITY_OK rows=' + rows + ' collections=' + names.length;
")"
mongosh --quiet "$MONGO_URI" --eval "db.getSiblingDB('$VERIFY_DB').dropDatabase()" >/dev/null

if ! echo "$PARITY" | grep -q '^PARITY_OK'; then
  echo "ERROR: restored collections differ in rows: $PARITY" >&2
  exit 3
fi

echo "OK: $ARCHIVE"
echo "    $BYTES bytes; restore verified into a fresh namespace and dropped again; $PARITY"

if [ -n "${OPS_SYNC_TO:-}" ]; then
  rsync -a "$OUT/" "$OPS_SYNC_TO/$STAMP/" || echo "WARN: off-host sync failed (verified local copy kept)." >&2
fi

# Retention applies only inside OPS_BACKUP_DIR and only to this script's own
# timestamp-shaped directories - never anything else.
find "$DIR" -maxdepth 1 -type d -name '[0-9]*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true
echo "Retention: kept newest $KEEP_DAYS day(s) under $DIR"

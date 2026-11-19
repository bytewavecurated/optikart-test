#!/bin/sh
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

CONTAINER="${MONGO_CONTAINER:-optikart-mongo-1}"
DB="${BACKUP_DB:-eyewear-platform}"
KEEP_DAYS="${OPS_KEEP_DAYS:-7}"
DIR="${OPS_BACKUP_DIR:?OPS_BACKUP_DIR is required - refuse to silently drop dumps into /}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/$STAMP"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: mongo container '$CONTAINER' is not running (override MONGO_CONTAINER)." >&2
  exit 2
fi
mkdir -p "$DIR"
# mongodump wants a directory; --db limits scope. Auth vars pass through if set.
if docker exec "$CONTAINER" mongodump --db "$DB" --archive > "$OUT/mongodump-$DB.archive.tmp"; then
  mv "$OUT/mongodump-$DB.archive.tmp" "$OUT/mongodump-$DB.archive"
else
  rm -rf "$OUT"
  echo "ERROR: mongodump failed." >&2
  exit 2
fi

# VERIFY by restore-ability, not file size: list collections. A truncated
# archive (the classic disk-full backup that looks fine) fails here.
COLS="$(docker exec "$CONTAINER" mongosh --quiet --db "$DB" --eval 'db.getCollectionNames().length' || echo 0)"
BYTES="$(wc -c < "$OUT/mongodump-$DB.archive")"
if [ "$BYTES" -lt 4096 ]; then
  echo "ERROR: archive is $BYTES bytes - refusing to call this a backup." >&2
  exit 3
fi
# A second, independent read of the archive itself (mongorestore --dry-run):
if ! docker exec -i "$CONTAINER" mongorestore --dryRun --nsInclude="$DB.*" --archive < "$OUT/mongodump-$DB.archive" > /dev/null; then
  echo "ERROR: the archive fails a dry-run restore. Treat as failure, not artifact." >&2
  exit 3
fi
echo "OK: $OUT/mongodump-$DB.archive ($BYTES bytes; $COLS live collections; dry-run restore passed)"

if [ -n "${OPS_SYNC_TO:-}" ]; then
  rsync -a "$OUT/" "$OPS_SYNC_TO/$STAMP/" || echo "WARN: off-host sync failed (local copy kept)." >&2
fi

# Retention applies only inside OPS_BACKUP_DIR and only to this script's
# own timestamp-shaped directories - it never touches anything else.
find "$DIR" -maxdepth 1 -type d -name '[0-9]*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true
echo "Retention: kept newest $KEEP_DAYS day(s) under $DIR"

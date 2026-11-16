/**
 * Which storage backend will be used, decided without touching the filesystem
 * or the network so it can be asserted anywhere.
 *
 * The project rule is that user uploads live in Cloudinary and nothing is kept
 * on the app server's disk. That is a production guarantee, not a preference,
 * and a production instance that silently falls back to local disk would (a)
 * lose every image on the next redeploy and (b) serve attacker-influenced bytes
 * from the same origin as the app. So the fallback exists for development and
 * CI - where there are no credentials - and is refused in production.
 *
 * `STORAGE_BACKEND` values:
 *   unset | "auto"      Cloudinary when credentials are present, otherwise local
 *   "cloudinary"        required; missing credentials are a boot error
 *   "local"             explicit, for a machine without egress; never in production
 *
 * @param {{ nodeEnv?: string, requested?: string, credentialsPresent?: boolean, acknowledged?: boolean }} input
 * @returns {{ backend: 'cloudinary' | 'local' | null, fellBack: boolean, refused: string | null, acknowledged?: boolean }}
 *
 * Invariant: `refused` is either null or a human-readable string. It is never
 * `true`, and a decision with a non-null `backend` is never refused.
 */
export function storageDecision({
  nodeEnv = process.env.NODE_ENV || 'development',
  requested = process.env.STORAGE_BACKEND || 'auto',
  credentialsPresent = false,
  acknowledged = process.env.ALLOW_LOCAL_STORED_UPLOADS === 'true',
} = {}) {
  const mode = String(requested || 'auto')
    .trim()
    .toLowerCase();
  const production = nodeEnv === 'production';

  if (mode !== 'auto' && mode !== 'cloudinary' && mode !== 'local') {
    return {
      backend: null,
      fellBack: false,
      refused: `STORAGE_BACKEND must be "cloudinary", "local" or "auto" (got ${JSON.stringify(requested)}).`,
    };
  }

  if (mode === 'cloudinary') {
    if (!credentialsPresent) {
      return {
        backend: null,
        fellBack: false,
        refused:
          'STORAGE_BACKEND=cloudinary but no Cloudinary credentials are configured. ' +
          'Set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET. ' +
          'An explicitly requested provider must not be silently swapped for another one.',
      };
    }
    return { backend: 'cloudinary', fellBack: false, refused: null };
  }

  if (mode === 'local') {
    if (production && !acknowledged) {
      return {
        backend: null,
        fellBack: false,
        refused:
          "STORAGE_BACKEND=local is refused in production: uploads written to this container's disk are lost " +
          'on redeploy and are served from the application origin. Set ALLOW_LOCAL_STORED_UPLOADS=true only if ' +
          'you genuinely mean it (for example an air-gapped installation with its own volume).',
      };
    }
    /*
     * A decision must never be both "usable" and "refused". The first version of
     * this line returned `refused: production && acknowledged`, so the documented
     * air-gapped path (STORAGE_BACKEND=local + ALLOW_LOCAL_STORED_UPLOADS=true)
     * handed back backend:'local' together with a truthy refusal, and the storage
     * service threw `Error: true` on the first upload - i.e. the one configuration
     * written specifically for installations with no egress was the one that could
     * not run at all. Pinned by a shape invariant in scripts/brand_logo_unit.mjs.
     */
    return { backend: 'local', fellBack: false, acknowledged: Boolean(production && acknowledged), refused: null };
  }

  // auto
  if (credentialsPresent) return { backend: 'cloudinary', fellBack: false, refused: null };
  if (production) {
    return {
      backend: null,
      fellBack: false,
      refused:
        'Production boot refused: no Cloudinary credentials, and uploads must not be written to local disk in ' +
        'production. Provide CLOUDINARY_URL (or the three CLOUDINARY_* variables), or set ' +
        'STORAGE_BACKEND=local together with ALLOW_LOCAL_STORED_UPLOADS=true to acknowledge the consequences.',
    };
  }
  return { backend: 'local', fellBack: true, refused: null };
}

/** True when enough configuration exists for the Cloudinary SDK to talk to an account. */
export function hasCloudinaryCredentials(env = process.env) {
  if (env.CLOUDINARY_URL && env.CLOUDINARY_URL.trim()) return true;
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** The folder whitelist. Anything else is refused rather than sanitised into place. */
export const UPLOAD_FOLDERS = [
  'products',
  'brands',
  'prescriptions',
  'banners',
  'returns',
  'avatars',
  'stores',
  'blogs',
];

/** Extensions we will ever accept as the final stored name. */
export const UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'svg'];

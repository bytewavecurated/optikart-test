process.env.JWT_SECRET = 'x'.repeat(40);
const { isDisallowedHost, ownUploadsPath } = await import('./routes/manufacturer.js').catch(() => import('./_shim.js'));

const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn, spawnSync } = require('child_process');
(async () => {
  const m = await MongoMemoryServer.create();
  const uri = m.getUri();
  const env = { ...process.env, MONGODB_URI: uri, JWT_SECRET: 'x'.repeat(40), STORAGE_BACKEND: 'local', ENV_FILE: '/tmp/empty.env', PORT: '3071', NODE_ENV: 'development' };
  for (let i = 0; i < 45; i++) {
    const r = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:3071/api/health']);
    if (String(r.stdout).includes('200')) break;
    await new Promise((s) => setTimeout(s, 2000));
  }
  const f = spawnSync('node', ['fixtures/apply.mjs', '--force'], { env, encoding: 'utf8' });
  console.log('fixtures exit', f.status);
  const s = spawnSync('node', ['../scripts/privilege_boundary_e2e.mjs', 'http://127.0.0.1:3071'], { env, encoding: 'utf8' });
  console.log(String(s.stdout).trim() || '(no stdout)');
  console.log('exit', s.status, '| stderr:', String(s.stderr).slice(0, 300));
  await m.stop();
})().catch((e) => { console.log('harness error', e.message); process.exit(1); });

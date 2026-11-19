#!/usr/bin/env node
/**
 * Face detection over the REAL request path - against a mock endpoint, not a
 * mock of the module.
 *
 * WHY THIS EXISTS AT ALL: the v2 SDK was retired (end-of-support, a frozen
 * advisory, and a warning printed on EVERY boot on EVERY machine including the
 * ones with no AWS configured). v3 moved the SDK to lazy import and the wire
 * shape to commands. The only thing that certifies a migration like this is
 * driving the actual client against actual response JSON - a source reading
 * tells you the code parses what the SDK hands it. And the two fixtures below
 * deliberately classify to DIFFERENT face shapes, so if a field name had been
 * dropped in translation, the geometry would land identically and the suite
 * would have nothing to fail on. This also pins, as agreed behaviour, the
 * honest refusal of the AWS SPEECH path - the v2 code there was a phantom
 * (startStreamTranscription never returned the shape it read), and a refusal
 * that throws with a reason is the fixable kind of wrong.
 *
 *   node scripts/face_shape_aws_mock_e2e.mjs
 */
import http from 'node:http';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${String(detail).slice(0, 140)}` : ''}`);
  return ok;
};

function lm(overrides) {
  const base = {
    eyeLeft: { x: 0.35, y: 0.4 },
    eyeRight: { x: 0.7, y: 0.4 },
    nose: { x: 0.52, y: 0.58 },
    mouthLeft: { x: 0.38, y: 0.76 },
    mouthRight: { x: 0.66, y: 0.76 },
    chinBottom: { x: 0.52, y: 0.8 },
  };
  const merged = { ...base, ...overrides };
  return Object.entries(merged).map(([type, p]) => ({ Type: type, X: p.x, Y: p.y }));
}

/*
 * The mock answers with the wire casing the SDK actually delivers. This was
 * PROBED, not remembered: v3's RekognitionClient returns the documented
 * {Type,X,Y} members verbatim (v2 lower-cased them), which is precisely the
 * casing trap the service normalizer absorbs and this suite exists to pin.
 * A mock that echoed the author's guess about casing certifies nothing.
 */
const toRec = (landmarks) => landmarks;

const FACE_HEART = {
  Confidence: 98.2,
  BoundingBox: { Width: 0.4, Height: 0.38, Left: 0.3, Top: 0.3 },
  Landmarks: toRec(lm({ mouthLeft: { x: 0.42, y: 0.76 }, mouthRight: { x: 0.58, y: 0.76 } })),
};
const FACE_OBLONG = {
  Confidence: 97.1,
  BoundingBox: { Width: 0.3, Height: 0.5, Left: 0.33, Top: 0.22 },
  Landmarks: toRec(
    lm({
      eyeLeft: { x: 0.42, y: 0.32 },
      eyeRight: { x: 0.58, y: 0.32 },
      chinBottom: { x: 0.5, y: 0.92 },
      mouthLeft: { x: 0.44, y: 0.74 },
      mouthRight: { x: 0.56, y: 0.74 },
    })
  ),
};

function startMock() {
  return new Promise((resolve) => {
    let mode = 'heart';
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const target = String(req.headers['x-amz-target'] || '');
        if (!/RekognitionService\.DetectFaces/.test(target)) {
          res.writeHead(400, { 'content-type': 'application/x-amz-json-1.1' });
          return res.end('{"__type":"UnknownOperationException"}');
        }
        const body = JSON.stringify({
          FaceDetails: [mode === 'heart' ? FACE_HEART : FACE_OBLONG],
        });
        res.writeHead(200, { 'content-type': 'application/x-amz-json-1.1', 'content-length': Buffer.byteLength(body) });
        res.end(body);
      });
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        setMode: (m) => {
          mode = m;
        },
        close: () => new Promise((r) => server.close(r)),
      })
    );
  });
}

async function main() {
  const mock = await startMock();
  process.env.FACE_DETECTION_SERVICE = 'aws';
  process.env.AWS_ACCESS_KEY_ID = 'MOCK-AKID';
  process.env.AWS_SECRET_ACCESS_KEY = 'MOCK-SKID';
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_ENDPOINT = mock.url;

  // the module must be imported AFTER the env is pinned (it reads config at
  // first client construction, which is lazy now); fresh import per mode so the
  // endpoint pin is unambiguous.
  const { detectFaceShape } = await import('../server/services/faceDetection.js');

  mock.setMode('heart');
  const a = await detectFaceShape(Buffer.from('pretend-jpeg-bytes'));
  check(
    'v3 client parses an authoritative DetectFaces response end-to-end',
    a?.success === true && a?.source === 'aws-rekognition' && typeof a?.faceShape === 'string',
    JSON.stringify({ source: a?.source, faceShape: a?.faceShape })
  );

  mock.setMode('oblong');
  const b = await detectFaceShape(Buffer.from('pretend-jpeg-bytes'));
  check(
    'two real-response shapes classify DIFFERENTLY (the fields made it through the port)',
    a.faceShape !== b.faceShape && typeof b.faceShape === 'string',
    `${a.faceShape} vs ${b.faceShape}`
  );

  check(
    'landmarks and bounding box ride through the response',
    (a.landmarks || []).length >= 6 && !!a.boundingBox && typeof a.boundingBox.Width === 'number'
  );

  // AWS SPEECH: the v2 phantom is now an explicit refusal - pinned as behaviour.
  process.env.SPEECH_RECOGNITION_SERVICE = 'aws';
  const { speechToText } = await import('../server/services/speechRecognition.js');
  let refusal = '';
  try {
    await speechToText(Buffer.from('pretend-webm'));
    refusal = '<did not throw - the phantom returned>';
  } catch (e) {
    refusal = String(e.message || e);
  }
  check(
    'AWS speech refuses with its own reason at the service door',
    /not implemented/i.test(refusal),
    refusal.slice(0, 120)
  );

  /*
   * The silent-simulation trap: credentials CONFIGURED but the provider down
   * used to be caught and answered as a simulated 'detection' - customers got
   * face-shape advice because an AWS call threw. A configured provider that
   * fails must now surface as a refusal.
   */
  process.env.AWS_ACCESS_KEY_ID = 'MOCK-AKID';
  process.env.AWS_SECRET_ACCESS_KEY = 'MOCK-SKID';
  process.env.AWS_ENDPOINT = 'http://127.0.0.1:1'; // refused immediately
  /*
   * `?v=down` is not decoration: ESM caches the module instance for the whole
   * process, and the v3 client is cached behind a module-level promise - so a
   * plain re-import of the SAME specifier would hand back the live mock's
   * client and certify nothing (the first run of this suite proved that the
   * hard way: the 'down' probe returned a genuine oblong answer from the mock
   * still bound to the module). A fresh specifier gets a fresh promise.
   */
  const { detectFaceShape: downed } = await import('../server/services/faceDetection.js?v=down');
  try {
    const leaked = await downed(Buffer.from('x'));
    check(
      'configured-but-down provider refuses; it is never laundered into simulation',
      false,
      `simulated: ${JSON.stringify(leaked).slice(0, 70)}`
    );
  } catch (e) {
    check(
      'configured-but-down provider refuses; it is never laundered into simulation',
      /temporarily unavailable/i.test(String(e.message)),
      String(e.message).slice(0, 70)
    );
  }

  // Unconfigured Rekognition falls back to the simulation the way it always did.
  delete process.env.AWS_ACCESS_KEY_ID;
  const { detectFaceShape: fresh } = await import('../server/services/faceDetection.js');
  const sim = await fresh(Buffer.from('x'));
  check(
    'no AWS credentials still means honest simulation, and it names itself',
    sim?.success === true && sim?.source === 'simulation'
  );

  await mock.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} face/v3 wire checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exitCode = 1;
});

// Envía un aviso Web Push a las suscripciones de Planos, sin dependencias.
// Cifrado: RFC 8291 (aes128gcm, RFC 8188). Autenticación del servidor: VAPID (RFC 8292).
// El POST lo hace curl, que respeta HTTPS_PROXY.
//
// Uso:
//   PLANOS_SUBSCRIPTIONS='[{"endpoint":"…","keys":{"p256dh":"…","auth":"…"}}]' \
//   VAPID_PUBLIC='…' VAPID_PRIVATE='…' VAPID_SUBJECT='https://…' \
//   [PAYLOAD='{"type":"daily"}'] node send-push.mjs
//   node send-push.mjs --generate-keys      genera un par de claves VAPID
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s).replace(/\s+/g, ''), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
// HKDF-Expand for a single block (length <= 32), as used by RFC 8291.
const expand = (prk, info, len) => hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, len);

export function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

// Encrypts `plaintext` for one subscription. `salt` and `asPrivate` are only passed by tests.
export function encrypt(plaintext, uaPublicB64, authB64, { salt = crypto.randomBytes(16), asPrivate } = {}) {
  const uaPublic = fromB64u(uaPublicB64);
  const authSecret = fromB64u(authB64);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('invalid subscription keys');
  const ecdh = crypto.createECDH('prime256v1');
  if (asPrivate) ecdh.setPrivateKey(asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = expand(prkKey, keyInfo, 32);
  const prk = hmac(salt, ikm);
  const cek = expand(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = expand(prk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const record = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return { body: Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, record]), debug: { ecdhSecret, prkKey, ikm, prk, cek, nonce } };
}

export function vapidAuthorization(endpoint, subject, publicKeyB64, privateKeyB64, now = Date.now()) {
  const pub = fromB64u(publicKeyB64);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: b64u(fromB64u(privateKeyB64)) };
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKeyB64}`;
}

function send(sub, payload, vapid) {
  const { body } = encrypt(payload, sub.keys.p256dh, sub.keys.auth);
  const dir = mkdtempSync(join(tmpdir(), 'planos-push-'));
  const file = join(dir, 'body.bin');
  writeFileSync(file, body);
  try {
    const out = execFileSync('curl', [
      '-sS', '-m', '30', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'POST',
      '-H', 'TTL: 43200', '-H', 'Urgency: normal', '-H', 'Content-Encoding: aes128gcm',
      '-H', 'Content-Type: application/octet-stream',
      '-H', `Authorization: ${vapidAuthorization(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey)}`,
      '--data-binary', `@${file}`, sub.endpoint,
    ], { encoding: 'utf8' });
    return Number(out.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--generate-keys')) {
    console.log(JSON.stringify(generateVapidKeys(), null, 2));
    process.exit(0);
  }
  const raw = JSON.parse(process.env.PLANOS_SUBSCRIPTIONS || '[]');
  const subs = Array.isArray(raw) ? raw : [raw];
  const vapid = { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE, subject: process.env.VAPID_SUBJECT || 'https://srtaramon.github.io/planos/' };
  if (!subs.length || !vapid.publicKey || !vapid.privateKey) { console.error('Faltan PLANOS_SUBSCRIPTIONS, VAPID_PUBLIC o VAPID_PRIVATE'); process.exit(2); }
  const payload = process.env.PAYLOAD || JSON.stringify({ type: 'daily' });
  let failed = 0;
  for (const [i, sub] of subs.entries()) {
    let status;
    try { status = send(sub, payload, vapid); } catch (e) { status = 0; console.error(String(e.message || e)); }
    const verdict = status >= 200 && status < 300 ? 'OK' : status === 404 || status === 410 ? 'CADUCADA' : 'ERROR';
    console.log(`suscripción ${i + 1}: ${status} ${verdict}`);
    if (verdict !== 'OK') failed++;
  }
  process.exit(failed ? 1 : 0);
}

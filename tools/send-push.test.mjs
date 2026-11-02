// Comprueba el cifrado contra el ejemplo del RFC 8291 (sección 5 y apéndice A) y la firma VAPID.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encrypt, vapidAuthorization, generateVapidKeys } from './send-push.mjs';

const b64u = (b) => Buffer.from(b).toString('base64url');
const v = (s) => s.replace(/\s+/g, '');

const { body, debug } = encrypt('When I grow up, I want to be a watermelon',
  v('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'),
  'BTBZMqHH6r4Tts7J_aSIgg',
  { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'), asPrivate: Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url') });

assert.equal(b64u(debug.ecdhSecret), 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs');
assert.equal(b64u(debug.prkKey), 'Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k');
assert.equal(b64u(debug.ikm), 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg');
assert.equal(b64u(debug.prk), '09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc');
assert.equal(b64u(debug.cek), 'oIhVW04MRdy2XN9CiKLxTg');
assert.equal(b64u(debug.nonce), '4h_95klXJ5E_qnoN');
assert.equal(b64u(body), v(`DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
   mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
   pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`));
// 86-byte header + 41-byte plaintext + 1 delimiter + 16-byte tag. (The RFC's sample request says
// Content-Length: 145, but its own base64url body decodes to 144 octets.)
assert.equal(body.length, 144);

// VAPID: the JWT verifies with the public key, and claims are right.
const keys = generateVapidKeys();
const auth = vapidAuthorization('https://web.push.apple.com/QGuQyavXutnMH8', 'https://srtaramon.github.io/planos/', keys.publicKey, keys.privateKey, 1_800_000_000_000);
const m = auth.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
assert.ok(m, 'header shape');
assert.equal(m[4], keys.publicKey);
const claims = JSON.parse(Buffer.from(m[2], 'base64url'));
assert.deepEqual(claims, { aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://srtaramon.github.io/planos/' });
const pub = Buffer.from(keys.publicKey, 'base64url');
const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
assert.ok(crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: pubKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')), 'signature verifies');
assert.equal(Buffer.from(keys.privateKey, 'base64url').length, 32);
assert.equal(pub.length, 65);

console.log('send-push: RFC 8291 example reproduced byte for byte; VAPID JWT verifies');

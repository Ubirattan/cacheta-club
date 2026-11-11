import assert from 'node:assert/strict';
import { createECDH, createHmac, createDecipheriv, randomBytes, createPublicKey, verify } from 'node:crypto';
import { vapid, encrypt, notifyAdmins, saveSubs, getSubs } from '../lib/push.js';
import { memRepo } from './memrepo.mjs';
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
// "celular" de teste: chaves do navegador
const ua = createECDH('prime256v1'); ua.generateKeys(); const auth = randomBytes(16);
const sub = { endpoint: 'https://push.exemplo.com/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
function decrypt(buf) { // como o navegador abre (RFC 8291)
  const salt = buf.subarray(0, 16), idlen = buf[20], asPub = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const shared = ua.computeSecret(asPub), prkKey = hmac(auth, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])])).subarray(0, 32);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(-16));
  const pt = Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]);
  assert.equal(pt[pt.length - 1], 2); return pt.subarray(0, -1).toString();
}
assert.equal(decrypt(encrypt(sub, '{"title":"oi"}')), '{"title":"oi"}');
// chave VAPID estável e assinatura válida
process.env.SUPABASE_SERVICE_ROLE_KEY = 'segredo-teste';
assert.equal(vapid().publicKey, vapid('segredo-teste').publicKey); assert.equal(Buffer.from(vapid().publicKey, 'base64url').length, 65);
const R = memRepo(); const sent = [];
const fake = async (url, opt) => { sent.push({ url, opt }); return { status: url.includes('morto') ? 410 : 201 }; };
await saveSubs(R, [sub, { ...sub, endpoint: 'https://push.exemplo.com/morto' }]);
assert.equal(await notifyAdmins(R, 'Venda', 'Bira comprou Dragão', fake), 1);
const h = sent[0].opt.headers.Authorization, [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/);
const [hd, bd, sg] = jwt.split('.');
const pub = Buffer.from(k, 'base64url');
const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
assert.ok(verify('sha256', Buffer.from(hd + '.' + bd), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sg, 'base64url')));
assert.equal(JSON.parse(Buffer.from(bd, 'base64url')).aud, 'https://push.exemplo.com');
assert.deepEqual(JSON.parse(decrypt(sent.find(x => x.url.endsWith('abc')).opt.body)), { title: 'Venda', body: 'Bira comprou Dragão', url: '/admin' });
assert.equal((await getSubs(R)).length, 1, 'aparelho que não existe mais é removido');
console.log('OK — notificação no celular: criptografia, assinatura VAPID e limpeza de aparelhos antigos');

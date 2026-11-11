// Notificação no celular do administrador (Web Push), sem biblioteca externa.
// A chave VAPID sai da SUPABASE_SERVICE_ROLE_KEY (segredo que já existe no servidor): nada para configurar.
import { createHmac, createECDH, createCipheriv, randomBytes, createPrivateKey, sign } from 'node:crypto';

const b64u = b => Buffer.from(b).toString('base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const SUBS_KEY = 'admin_push';

let vapidCache = null;
export function vapid(secret = process.env.ADMIN_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only') {
  if (vapidCache && vapidCache.secret === secret) return vapidCache;
  const d = hmac('cacheta-club-vapid', secret);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(d);
  const pub = ecdh.getPublicKey(); // 65 bytes, sem compressão
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  vapidCache = { secret, publicKey: b64u(pub), key };
  return vapidCache;
}

function vapidHeader(endpoint, v = vapid()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:admin@cacheta-club.netlify.app' }));
  const sig = sign('sha256', Buffer.from(head + '.' + body), { key: v.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`;
}

// criptografia do conteúdo (RFC 8291, aes128gcm)
export function encrypt(sub, payload) {
  const uaPub = Buffer.from(sub.keys.p256dh, 'base64url'), auth = Buffer.from(sub.keys.auth, 'base64url');
  const as = createECDH('prime256v1'); as.generateKeys();
  const asPub = as.getPublicKey(), shared = as.computeSecret(uaPub);
  const prkKey = hmac(auth, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
  const salt = randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

export async function sendPush(sub, data, doFetch = fetch) {
  const body = encrypt(sub, JSON.stringify(data));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await doFetch(sub.endpoint, { method: 'POST', signal: ctl.signal, body,
      headers: { Authorization: vapidHeader(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' } });
    return r.status;
  } finally { clearTimeout(t); }
}

export async function getSubs(repo) {
  try { const [r] = await repo.sel('app_settings', { key: SUBS_KEY }); return Array.isArray(r?.value) ? r.value : []; } catch { return []; }
}
export async function saveSubs(repo, subs) {
  const ex = await repo.sel('app_settings', { key: SUBS_KEY });
  if (ex.length) await repo.upd('app_settings', { key: SUBS_KEY }, { value: subs }); else await repo.ins('app_settings', { key: SUBS_KEY, value: subs });
}

// avisa todos os aparelhos do admin; nunca derruba a compra se falhar
export async function notifyAdmins(repo, title, body, doFetch = fetch) {
  try {
    const subs = await getSubs(repo); if (!subs.length) return 0;
    const dead = [];
    let ok = 0;
    await Promise.all(subs.map(async s => {
      try { const st = await sendPush(s, { title, body, url: '/admin' }, doFetch); if (st === 404 || st === 410) dead.push(s.endpoint); else if (st < 300) ok++; } catch {}
    }));
    if (dead.length) await saveSubs(repo, subs.filter(s => !dead.includes(s.endpoint)));
    return ok;
  } catch (e) { console.error('push:', e.message); return 0; }
}

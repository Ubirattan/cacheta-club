// =====================================================================
// Pagamento por Pix via GeraPix (gerapix.digital) — compra de FICHAS VIRTUAIS.
// Usado quando a variável GERAPIX_SECRET existe no Netlify (senão, Mercado Pago).
// Docs: https://gerapix.digital/docs
//  - cria cobrança: POST https://api.gerapix.digital/v1/pix/qrcodes/  (Bearer token secreto)
//  - o GeraPix avisa o site em callback_url com Authorization: Bearer <token secreto>
// Só RECEBIMENTO. Não há saque de fichas.
// =====================================================================
import { timingSafeEqual } from 'node:crypto';
import { GameError } from './service.js';
import { packFor, RECARGA_MIN, RECARGA_MAX } from './shop-items.js';

const fail = (m, s) => { throw new GameError(m, s); };
const API = 'https://api.gerapix.digital/v1/pix/qrcodes/';
export const gerapixOn = () => !!process.env.GERAPIX_SECRET;
const site = () => (process.env.SITE_URL || 'https://cacheta-club.netlify.app').replace(/\/$/, '');

export function cpfValido(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let s = 0; for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

export async function createGerapixCharge(repo, user, { pack: packId, valor, nome, cpf }, fetchImpl = fetch) {
  const pack = packFor(packId, valor); if (!pack) fail(`Valor inválido: escolha de R$ ${RECARGA_MIN} a R$ ${RECARGA_MAX}`);
  const profile = await repo.getProfile(user.id); if (!profile || profile.blocked) fail('Conta bloqueada', 403);
  const doc = String(cpf || '').replace(/\D/g, '');
  const name = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!cpfValido(doc)) fail('CPF inválido');
  if (name.split(' ').length < 2) fail('Digite nome e sobrenome');
  if (!site()) fail('Pagamento ainda não configurado (falta SITE_URL)', 503);
  const [pur] = await repo.ins('purchases', { user_id: user.id, item: pack.id, coins: pack.coins, price_coins: 0, price_brl: pack.brl, status: 'pending' });
  const body = {
    valor: pack.brl.toFixed(2), nome: name, email: String(user.email || `${user.id}@cachetaclub.app`).slice(0, 100),
    doc_tipo: 'cpf', doc_numero: doc, callback_url: `${site()}/api/pay/gerapix`, external_reference: String(pur.id),
  };
  const res = await fetchImpl(API, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GERAPIX_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_transacao || !data.qr_code) {
    await repo.upd('purchases', { id: pur.id }, { status: 'failed' });
    fail(data.message || data.erro || data.error || 'O GeraPix não gerou o Pix. Tente de novo.', 502);
  }
  await repo.upd('purchases', { id: pur.id }, { mp_preference: String(data.id_transacao) });
  return { pix: { copiaCola: data.qr_code, imagem: data.qr_code_base64 || null, valor: pack.brl, coins: pack.coins }, purchaseId: pur.id };
}

function sameToken(header) {
  const want = Buffer.from(`Bearer ${process.env.GERAPIX_SECRET || ''}`);
  const got = Buffer.from(String(header || ''));
  return !!process.env.GERAPIX_SECRET && want.length === got.length && timingSafeEqual(want, got);
}

// aviso do GeraPix: só credita se o token bater, se a transação for a mesma da compra e se estiver pendente
export async function gerapixWebhook(repo, authHeader, body) {
  if (!sameToken(authHeader)) return { ok: false, reason: 'token inválido' };
  const status = String(body && body.status || '').toLowerCase();
  if (status !== 'aprovado') return { ok: true, ignored: status || 'sem status' };
  const purId = Number(body.external_reference);
  const [pur] = purId ? await repo.sel('purchases', { id: purId }) : [];
  if (!pur) return { ok: false, reason: 'compra não encontrada' };
  if (String(pur.mp_preference) !== String(body.id_transacao)) return { ok: false, reason: 'transação não confere' };
  const moved = await repo.upd('purchases', { id: pur.id, status: 'pending' }, { status: 'done', mp_payment_id: 'gp-' + String(body.id_transacao), paid_at: new Date().toISOString() });
  if (!moved.length) return { ok: true, already: true };
  await repo.adjustProfile(pur.user_id, pur.coins, 0, 0);
  return { ok: true, credited: pur.coins };
}

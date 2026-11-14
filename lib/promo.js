// PROMOÇÃO DO MÊS (ranking da cacheta): o primeiro a chegar em 1.000 pontos no mês ganha 30 fichas.
// Pontos iguais aos do ranking (10 por vitória + 1 por partida), só nas mesas online de cacheta
// com entrada de 5 fichas ou mais (fora de torneio). Um ganhador por mês; pago sozinho, com aviso pro admin.
import { jogoDoModo } from './modes.js';
import { notifyAdmins } from './push.js';

export const PROMO = { jogo: 'cacheta', meta: 1000, premio: 30, entradaMin: 5 };
export const mesBR = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t)).slice(0, 7);
export const inicioMes = t => new Date(mesBR(t) + '-01T00:00:00-03:00');
const chave = t => 'promo_cacheta_' + mesBR(t);

// a partida conta pra promoção?
export const valePromo = h => !!h && !h.tournament_id && jogoDoModo(h.mode || 'cacheta') === PROMO.jogo
  && (Number(h.pot) || 0) / Math.max(1, (h.players || []).length) >= PROMO.entradaMin;

export async function pontosPromo(repo, uid, agora = Date.now()) {
  const mp = await repo.sel('match_players', { user_id: uid }, { desde: ['created_at', inicioMes(agora).toISOString()], limit: 5000 });
  if (!mp.length) return 0;
  const hs = new Map((await repo.selIn('match_history', 'id', [...new Set(mp.map(r => r.match_id))])).map(h => [String(h.id), h]));
  return mp.reduce((s, r) => s + (valePromo(hs.get(String(r.match_id))) ? (r.won ? 11 : 1) : 0), 0);
}

export async function ganhadorDoMes(repo, agora = Date.now()) {
  try { const [r] = await repo.sel('app_settings', { key: chave(agora) }); return r ? r.value : null; } catch { return null; }
}

// chamada no fim de cada partida de cacheta online: confere se alguém bateu a meta e paga (uma vez só no mês)
export async function checarPromo(repo, uids, agora = Date.now(), notificar = notifyAdmins) {
  try {
    if (await ganhadorDoMes(repo, agora)) return null;
    for (const uid of uids) {
      const pts = await pontosPromo(repo, uid, agora);
      if (pts < PROMO.meta) continue;
      const p = await repo.getProfile(uid);
      if (!p || p.blocked) continue;
      // a chave do mês é única no banco: se duas partidas acabarem juntas, só uma consegue gravar
      try { await repo.ins('app_settings', { key: chave(agora), value: { uid, nick: p.nickname, avatar: p.avatar, pontos: pts, em: agora } }); }
      catch { return null; }
      await repo.adjustProfile(uid, PROMO.premio, 0, 0);
      await notificar(repo, '🏆 Promoção da cacheta', `${p.nickname} chegou em ${pts} pontos e ganhou ${PROMO.premio} fichas`);
      return { uid, pontos: pts };
    }
  } catch (e) { console.error('promo:', e?.message); }
  return null;
}

// o que a tela do ranking mostra
export async function statusPromo(repo, user, agora = Date.now()) {
  const g = await ganhadorDoMes(repo, agora);
  return { ...PROMO, mes: mesBR(agora), ganhador: g ? { nick: g.nick, avatar: g.avatar, pontos: g.pontos } : null,
    meusPontos: user && !user.visitante ? await pontosPromo(repo, user.id, agora) : null };
}

// Promoção do mês: 1.000 pontos na cacheta online (entrada >= 5, fora de torneio) = 30 fichas, um ganhador por mês.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { checarPromo, pontosPromo, statusPromo, valePromo, PROMO } from '../lib/promo.js';
const repo = memRepo(); addUsers(repo, 3, 100);
const avisos = []; const n = async (_r, t, b) => { avisos.push(b); return 1; };
let mid = 0;
async function partida(vencedor, outros, entrada = 5, extra = {}) {
  const ps = [vencedor, ...outros];
  const [h] = await repo.ins('match_history', { mode: 'cacheta', pot: entrada * ps.length, players: ps.map(uid => ({ uid })), tournament_id: null, ...extra });
  await repo.ins('match_players', ps.map(uid => ({ match_id: h.id, user_id: uid, won: uid === vencedor, coins_delta: 0 })));
}
assert.equal(valePromo({ mode: 'cacheta', pot: 8, players: [{}, {}] }), false, 'entrada 4 não vale');
assert.equal(valePromo({ mode: 'gude-triangulo', pot: 20, players: [{}, {}] }), false, 'só cacheta');
assert.equal(valePromo({ mode: 'cacheta', pot: 20, players: [{}, {}], tournament_id: 't1' }), false, 'torneio não vale');
for (let i = 0; i < 90; i++) await partida('u0', ['u1']);          // u0: 90 × 11 = 990
await partida('u0', ['u1'], 2);                                    // entrada 2: não conta
assert.equal(await pontosPromo(repo, 'u0'), 990);
assert.equal(await checarPromo(repo, ['u0', 'u1'], Date.now(), n), null, 'ainda não chegou');
await partida('u1', ['u0']);                                       // u0 +1 = 991
for (let i = 0; i < 1; i++) await partida('u0', ['u1']);           // 1002
const g = await checarPromo(repo, ['u0', 'u1'], Date.now(), n);
assert.equal(g.uid, 'u0');
assert.equal((await repo.getProfile('u0')).coins, 100 + PROMO.premio);
assert.equal(await checarPromo(repo, ['u0'], Date.now(), n), null, 'só um ganhador no mês');
assert.equal((await repo.getProfile('u0')).coins, 130);
assert.equal(avisos.length, 1);
const s = await statusPromo(repo, { id: 'u1' });
assert.equal(s.ganhador.nick, 'J0'); assert.equal(s.meusPontos, 102);
console.log('OK — promoção do mês da cacheta (1.000 pontos = 30 fichas)');

// Foguetinho: sorteio com margem de 5%, rodadas ao vivo, aposta, saque no tempo certo, automático e explosão.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { sorteiaCrash, multEm, duracaoMs, APOSTAS_MS, PAUSA_MS } from '../lib/foguete.js';
import { foguete, rodadaAtual } from '../lib/foguete-service.js';

// margem: apostar sempre sacando em 2x devolve ~95%
{
  let s = 0; const N = 400000;
  for (let i = 0; i < N; i++) s += sorteiaCrash(Math.random()) >= 2 ? 2 : 0;
  const rtp = s / N; assert.ok(rtp > 0.93 && rtp < 0.97, 'retorno ~95%: ' + rtp);
  assert.equal(sorteiaCrash(0), 1); assert.equal(sorteiaCrash(0.999999), 100);
  assert.equal(multEm(0), 1); assert.ok(Math.abs(multEm(duracaoMs(2.5)) - 2.5) < 0.02);
}
const R = memRepo(); R.T.foguete_rodadas = []; R.T.foguete_apostas = [];
const [u0, u1] = addUsers(R, 2, 1000);
const coins = i => R.T.profiles[i].coins;
let t = 1_000_000_000_000;
// primeira rodada com explosão em 3x
const r1 = await rodadaAtual(R, t, () => 3);
const st = await foguete(R, u0, { op: 'estado' }, t);
assert.equal(st.rodada.fase, 'apostas'); assert.equal(st.rodada.crash, undefined, 'não mostra onde explode antes');
await foguete(R, u0, { op: 'apostar', slot: 1, valor: 100 }, t + 10);
await foguete(R, u0, { op: 'apostar', slot: 2, valor: 50, auto: 2 }, t + 20);
await foguete(R, u1, { op: 'apostar', slot: 1, valor: 10, auto: 5 }, t + 30);
await assert.rejects(foguete(R, u0, { op: 'apostar', slot: 1, valor: 5 }, t + 40), /já apostou/);
await assert.rejects(foguete(R, u0, { op: 'apostar', slot: 1, valor: 9999 }, t + 40), /Aposte de/);
assert.equal(coins(0), 850); assert.equal(coins(1), 990);
await assert.rejects(foguete(R, u0, { op: 'sacar', slot: 1 }, t + 50), /ainda não decolou/);
const start = t + APOSTAS_MS;
// saca em ~1.5x
const s1 = await foguete(R, u0, { op: 'sacar', slot: 1 }, start + duracaoMs(1.5));
assert.ok(Math.abs(s1.mult - 1.5) < 0.02); assert.equal(coins(0), 850 + s1.ganho);
await assert.rejects(foguete(R, u0, { op: 'sacar', slot: 1 }, start + duracaoMs(1.6)), /Nada pra sacar/);
await assert.rejects(foguete(R, u0, { op: 'apostar', slot: 1, valor: 5 }, start + 100), /decolou/);
// depois de explodir: automático de 2x pago, 5x perdeu, não dá mais pra sacar
const fim = start + duracaoMs(3);
const e = await foguete(R, u1, { op: 'estado' }, fim + 10);
assert.equal(e.rodada.fase, 'explodiu'); assert.equal(e.rodada.crash, 3);
assert.equal(coins(0), 850 + s1.ganho + 100, 'automático em 2x pagou 100');
assert.equal(coins(1), 990, 'automático em 5x perdeu');
assert.equal(e.minhas[0].status, 'perdeu');
// próxima rodada começa sozinha depois da pausa
const e2 = await foguete(R, u1, { op: 'estado' }, fim + PAUSA_MS + 5);
assert.equal(e2.rodada.num, 2); assert.equal(e2.rodada.fase, 'apostas'); assert.deepEqual(e2.historico, [3]);
// cancelar devolve
await foguete(R, u1, { op: 'apostar', slot: 1, valor: 40 }, fim + PAUSA_MS + 10);
await foguete(R, u1, { op: 'cancelar', slot: 1 }, fim + PAUSA_MS + 20);
assert.equal(coins(1), 990);
await foguete(R, u1, { op: 'apostar', slot: 1, valor: 20 }, fim + PAUSA_MS + 30);
assert.equal(coins(1), 970, 'pode apostar de novo depois de cancelar');
// sem fichas
R.T.profiles[1].coins = 3;
await assert.rejects(foguete(R, u1, { op: 'apostar', slot: 2, valor: 5 }, fim + PAUSA_MS + 40), /insuficientes/);
console.log('OK — foguetinho: margem 5%, rodadas ao vivo, saque no tempo do servidor, automático, explosão e cancelamento');

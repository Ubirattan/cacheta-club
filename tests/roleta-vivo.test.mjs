// Roleta ao vivo: rodada compartilhada, apostas somam, fecha no giro, paga certo e esconde o número antes.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { roletaVivo, rodadaAtual } from '../lib/roleta-vivo-service.js';
import { APOSTAS_MS, GIRO_MS, PAUSA_MS } from '../lib/roleta-vivo.js';
const repo = memRepo(); addUsers(repo, 2, 1000);
const t0 = 1e12;
await rodadaAtual(repo, t0, () => 17);
let s = await roletaVivo(repo, { id: 'u0' }, { op: 'estado' }, t0 + 1000);
assert.equal(s.rodada.fase, 'apostas'); assert.equal(s.rodada.resultado, undefined, 'número escondido');
await roletaVivo(repo, { id: 'u0' }, { op: 'apostar', apostas: { n17: 10, vermelho: 20 } }, t0 + 2000);
const r2 = await roletaVivo(repo, { id: 'u0' }, { op: 'apostar', apostas: { n17: 5 } }, t0 + 3000);
assert.deepEqual(r2.minha, { apostas: { n17: 15, vermelho: 20 }, valor: 35 });
await roletaVivo(repo, { id: 'u1' }, { op: 'apostar', apostas: { preto: 50 } }, t0 + 3000);
await assert.rejects(() => roletaVivo(repo, { id: 'u1' }, { op: 'apostar', apostas: { preto: 460 } }, t0 + 3000), /No máximo 500/);
assert.equal((await repo.getProfile('u0')).coins, 965);
await assert.rejects(() => roletaVivo(repo, { id: 'u0' }, { op: 'apostar', apostas: { n1: 1 } }, t0 + APOSTAS_MS + 10), /girando/);
s = await roletaVivo(repo, { id: 'u0' }, { op: 'estado' }, t0 + APOSTAS_MS + 10);
assert.equal(s.rodada.fase, 'girando'); assert.equal(s.rodada.resultado, 17); assert.equal(s.jogadores, 2);
s = await roletaVivo(repo, { id: 'u0' }, { op: 'estado' }, t0 + APOSTAS_MS + GIRO_MS + 10);
// 17 é preto: n17 15 × 36 = 540; vermelho perde
assert.equal((await repo.getProfile('u0')).coins, 965 + 540);
assert.equal((await repo.getProfile('u1')).coins, 950 + 100);
assert.equal(s.minha.status, 'ganhou'); assert.equal(s.minha.ganho, 540);
s = await roletaVivo(repo, { id: 'u0' }, { op: 'estado' }, t0 + APOSTAS_MS + GIRO_MS + PAUSA_MS + 10);
assert.equal(s.rodada.fase, 'apostas'); assert.equal(s.minha, null); assert.deepEqual(s.historico, [17]);
assert.equal(repo.T.jogadas.length, 2, 'entra no relatório');
console.log('OK — roleta ao vivo: rodada de todos, apostas somam, paga e esconde o número');

// Cacheta e truco contra o computador: cada partida custa 1 ficha, cobrada no servidor
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { cobrarTreino } from '../lib/treino-service.js';

const repo = memRepo(); const [a, b] = addUsers(repo, 2, 2);
const r1 = await cobrarTreino(repo, a, { jogo: 'cacheta' });
assert.equal(r1.coins, 1, 'cacheta gastou 1');
const r2 = await cobrarTreino(repo, a, { jogo: 'truco' });
assert.equal(r2.coins, 0, 'truco gastou 1');
await assert.rejects(cobrarTreino(repo, a, { jogo: 'truco' }), e => e.status === 402, 'sem fichas não joga');
assert.equal(repo.T.profiles.find(p => p.id === a.id).coins, 0, 'saldo não fica negativo');
await assert.rejects(cobrarTreino(repo, b, { jogo: 'poker' }), /inválido/, 'jogo desconhecido');
repo.T.profiles.find(p => p.id === b.id).blocked = true;
await assert.rejects(cobrarTreino(repo, b, { jogo: 'cacheta' }), e => e.status === 403, 'conta bloqueada');
assert.equal(repo.T.profiles.find(p => p.id === b.id).coins, 2, 'bloqueada não é cobrada');
console.log('treino ok: 1 ficha por partida contra o computador');

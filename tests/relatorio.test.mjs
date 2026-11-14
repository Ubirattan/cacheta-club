// Relatório de jogos do painel: junta as linhas por jogo, mesas online pelo modo, ordena e soma a casa.
import assert from 'node:assert/strict';
import { montarRelatorio, registrarJogada } from '../lib/relatorio.js';
import { memRepo } from './memrepo.mjs';
const r = montarRelatorio([
  { jogo: 'foguete', partidas: 40, jogadores: 5, apostado: 400, pago: 380 },
  { jogo: 'onca', partidas: 10, jogadores: 2, apostado: 50, pago: 30 },
  { jogo: 'online:cacheta', partidas: 3, jogadores: 6, apostado: 30, pago: 27 },
]);
assert.deepEqual(r.jogos.map(j => j.id), ['foguete', 'onca', 'on-cacheta']);
assert.equal(r.jogos[0].casa, 20); assert.equal(r.total.casa, 43); assert.equal(r.total.partidas, 53);
const repo = memRepo(); await registrarJogada(repo, 'roleta', 'u1', 10, 36);
assert.equal(repo.T.jogadas.length, 1);
await registrarJogada({ ins: () => { throw new Error('sem tabela'); } }, 'x', 'u', 1);   // não quebra
console.log('OK — relatório de jogos');

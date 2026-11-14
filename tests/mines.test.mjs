// Mines: margem de 10%, bombas escondidas, abrir, perder, sacar, saque sozinho e prêmio máximo.
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { multDe, ganhoDe, sortearMinas, publico, MAX_GANHO } from '../lib/mines.js';
import { mines } from '../lib/mines-service.js';

// contas: 3 bombas, 1ª casa = 25/22 × 0,9 = 1,02x; nunca menos que a aposta na 1ª casa
assert.equal(multDe(3, 1), 1.02); assert.equal(multDe(3, 0), 1);
for (let b = 3; b <= 24; b++) assert.ok(multDe(b, 1) >= 1.01, 'bombas ' + b);
assert.equal(multDe(24, 1), 22.5);
// retorno médio ~90% pra qualquer jeito de jogar (sacar depois de k casas)
for (const [b, k] of [[3, 1], [3, 5], [5, 3], [10, 4], [24, 1]]) {
  let s = 0; const N = 60000;
  for (let i = 0; i < N; i++) { const m = sortearMinas(b, n => Math.floor(Math.random() * n)); let ok = true; for (let c = 0; c < k; c++) if (m.includes(c)) { ok = false; break; } if (ok) s += multDe(b, k); }
  const rtp = s / N; assert.ok(rtp > 0.85 && rtp < 0.95, `retorno ${b} bombas, ${k} casas: ${rtp}`);
}
assert.equal(sortearMinas(5, () => 0).length, 5);
assert.equal(publico({ id: 1, valor: 10, bombas: 3, abertas: [], status: 'jogando', minas: [1, 2, 3] }).minas, undefined, 'não mostra as bombas');

const R = memRepo(); R.T.mines_partidas = [];
const [u0, u1] = addUsers(R, 2, 1000);
const coins = i => R.T.profiles[i].coins;
const fixo = () => 0;     // bombas nas casas 0, 1, 2… (embaralhamento previsível)
const r1 = await mines(R, u0, { op: 'iniciar', valor: 100, bombas: 3 }, fixo);
assert.equal(coins(0), 900); assert.equal(r1.partida.minas, undefined);
const minas = R.T.mines_partidas[0].minas; assert.equal(minas.length, 3);
await assert.rejects(mines(R, u0, { op: 'iniciar', valor: 10, bombas: 3 }), /Termine/);
await assert.rejects(mines(R, u0, { op: 'sacar' }), /pelo menos uma/);
const livre = [...Array(25).keys()].filter(c => !minas.includes(c));
let r = await mines(R, u0, { op: 'abrir', casa: livre[0] });
assert.equal(r.partida.mult, 1.02); assert.equal(r.partida.premio, 102); assert.equal(r.partida.status, 'jogando');
r = await mines(R, u0, { op: 'abrir', casa: livre[0] }); assert.equal(r.partida.abertas.length, 1, 'abrir a mesma casa não conta 2x');
r = await mines(R, u0, { op: 'abrir', casa: livre[1] });
const m2 = multDe(3, 2);
r = await mines(R, u0, { op: 'sacar' });
assert.equal(r.partida.status, 'sacou'); assert.equal(r.partida.ganho, ganhoDe(100, m2)); assert.ok(r.partida.minas, 'mostra as bombas no fim');
assert.equal(coins(0), 900 + ganhoDe(100, m2));
await assert.rejects(mines(R, u0, { op: 'sacar' }), /Nenhuma partida/);
// perder
const antes = coins(0);
await mines(R, u0, { op: 'iniciar', valor: 50, bombas: 5 }, fixo);
const mm = R.T.mines_partidas.at(-1).minas;
r = await mines(R, u0, { op: 'abrir', casa: mm[0] });
assert.equal(r.partida.status, 'perdeu'); assert.equal(r.partida.bomba, mm[0]); assert.equal(coins(0), antes - 50);
// prêmio máximo: saca sozinho quando chega em 4 mil
await mines(R, u1, { op: 'iniciar', valor: 500, bombas: 24 }, fixo);
const m24 = R.T.mines_partidas.at(-1).minas, so = [...Array(25).keys()].find(c => !m24.includes(c));
r = await mines(R, u1, { op: 'abrir', casa: so });
assert.equal(r.partida.status, 'sacou'); assert.equal(r.partida.ganho, MAX_GANHO); assert.equal(coins(1), 500 + MAX_GANHO);
// abrir todas as casas livres saca sozinho
await mines(R, u1, { op: 'iniciar', valor: 1, bombas: 20 }, fixo);
const m20 = R.T.mines_partidas.at(-1).minas;
for (const c of [...Array(25).keys()].filter(c => !m20.includes(c))) r = await mines(R, u1, { op: 'abrir', casa: c });
assert.equal(r.partida.status, 'sacou'); assert.equal(r.partida.ganho, ganhoDe(1, multDe(20, 5)));
// validações
await assert.rejects(mines(R, u0, { op: 'iniciar', valor: 10, bombas: 2 }), /de 3 a 24/);
await assert.rejects(mines(R, u0, { op: 'iniciar', valor: 0, bombas: 3 }), /Aposte de/);
await assert.rejects(mines(R, u0, { op: 'iniciar', valor: 999999, bombas: 3 }), /Aposte de/);
console.log('OK — Mines: margem 10%, abrir, perder, sacar, saque sozinho e prêmio máximo');

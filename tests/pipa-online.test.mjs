// Pipa online: semente igual = mesma partida nos dois celulares; resultado só paga se os dois concordarem
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as SV from '../lib/service.js';
import { pipaTick } from '../lib/pipa-service.js';
import { newPipa, stepPipa } from '../lib/pipa.js';

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
async function sala(entry = 20) {
  const R = memRepo(); const [a, b] = addUsers(R, 2, 50);
  await assert.rejects(SV.createRoom(R, a, { mode: 'pipa-1x1', entry: 1, turnSeconds: 30 }), /mínima é 2/);
  const room = await SV.createRoom(R, a, { mode: 'pipa-1x1', entry, turnSeconds: 30 });
  await SV.joinRoom(R, b, { id: room.id });
  await SV.setReady(R, a, room.id, true); await SV.setReady(R, b, room.id, true);
  return { R, a, b, room, S: (await R.getGame(room.id)).state };
}
// os dois celulares: mesma semente e mesmos toques
{
  const { S } = await sala();
  const mk = () => newPipa({ pipas: 2, seed: S.seed, humanos: [0, 1] });
  const A = mk(), B = mk(); let r = 7;
  const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 60 * 300 && !A.over; t++) {
    const c = [0, 1].map(() => ({ x: rand() < .3 ? -1 : rand() < .5 ? 1 : 0, y: rand() < .3 ? -1 : 0, solta: rand() < .1, puxa: rand() < .25 }));
    stepPipa(A, { ctls: c }); stepPipa(B, { ctls: JSON.parse(JSON.stringify(c)) });
  }
  const h = G => JSON.stringify([G.score, G.round, G.t, G.k.map(k => [k.x, k.y, k.cut])]);
  assert.equal(h(A), h(B), 'os dois celulares chegaram no mesmo resultado');
}
// os dois concordam: paga o ganhador (pote 40, casa 10% → 36)
{
  const { R, a, b, room, S } = await sala();
  const ia = S.players.findIndex(p => p.uid === a.id);
  await SV.act(R, a, room.id, { type: 'resultado', winner: ia, hash: 'x1' });
  assert.ok(!(await R.getGame(room.id)).state.over, 'espera o outro');
  await SV.act(R, b, room.id, { type: 'resultado', winner: ia, hash: 'x1' });
  assert.equal(coins(R, a), 30 + 36); assert.equal(coins(R, b), 30);
}
// não bateu: devolve a entrada dos dois
{
  const { R, a, b, room, S } = await sala();
  const ia = S.players.findIndex(p => p.uid === a.id);
  await SV.act(R, a, room.id, { type: 'resultado', winner: ia, hash: 'x1' });
  await SV.act(R, b, room.id, { type: 'resultado', winner: 1 - ia, hash: 'x2' });
  assert.equal(coins(R, a), 50); assert.equal(coins(R, b), 50);
}
// o outro sumiu: depois de 45 s vale o resultado que chegou
{
  const { R, a, room, S } = await sala();
  const ia = S.players.findIndex(p => p.uid === a.id);
  await SV.act(R, a, room.id, { type: 'resultado', winner: ia, hash: 'x1' });
  R.games.get(room.id).state.firstReportAt = Date.now() - 46000;
  await SV.tick(R, null, room.id);
  assert.equal(coins(R, a), 66);
}
// saiu no meio: perde
{
  const { R, a, b, room } = await sala();
  await SV.leaveRoom(R, a, room.id);
  assert.equal(coins(R, b), 66); assert.equal(coins(R, a), 30);
}
void pipaTick;
console.log('pipa online ok');

// lockstep: dois celulares com atraso e mensagens perdidas chegam no mesmo resultado
{
  const { createLockstep } = await import('../lib/pipa-lockstep.js');
  let clock = 0; const fila = [];
  let r = 3; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const rede = de => m => { if (rand() < .15) return; fila.push({ at: clock + 3 + rand() * 25 | 0, para: 1 - de, m: JSON.parse(JSON.stringify(m)) }); };
  const C = [0, 1].map(me => createLockstep({ seed: 999, me, names: ['A', 'B'], enviar: rede(me), agora: () => clock * 16 }));
  let travas = 0;
  for (; clock < 60 * 60 * 6 && !(C[0].G.over && C[1].G.over); clock++) {
    for (let k = fila.length - 1; k >= 0; k--) if (fila[k].at <= clock) { C[fila[k].para].recebe(fila[k].m); fila.splice(k, 1); }
    for (const c of C) { const ctl = { x: rand() < .3 ? -1 : rand() < .5 ? 1 : 0, y: rand() < .2 ? -.8 : 0, solta: rand() < .08, puxa: rand() < .3 }; if (!c.quadroUm(ctl)) travas++; }
  }
  assert.ok(C[0].G.over && C[1].G.over, 'as duas partidas terminaram');
  assert.equal(C[0].resumo(), C[1].resumo(), 'mesmo resultado nos dois celulares');
  assert.equal(C[0].G.over.winner, C[1].G.over.winner);
  console.log('lockstep ok', C[0].resumo().slice(0, 40), 'quadros esperando:', travas);
}

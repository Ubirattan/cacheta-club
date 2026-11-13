// Sinuca online 1 contra 1: sala, tacadas conferidas no servidor, replay igual no navegador, prêmio
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import * as SV from '../lib/service.js';
import { jogadaComputador, aplicaTacada, stepSinuca, grupoDe } from '../lib/sinuca.js';

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
const clone = x => JSON.parse(JSON.stringify(x));

for (const modo of ['bola8', 'lisa', 'bolinho']) {
  const R = memRepo(); const [a, b] = addUsers(R, 2, 50);
  await assert.rejects(SV.createRoom(R, a, { mode: 'sinuca-' + modo, entry: 1, turnSeconds: 30 }), /mínima é 2/);
  const room = await SV.createRoom(R, a, { mode: 'sinuca-' + modo, entry: 20, turnSeconds: 30 });
  await SV.joinRoom(R, b, { id: room.id });
  await SV.setReady(R, a, room.id, true); await SV.setReady(R, b, room.id, true);
  assert.equal(coins(R, a), 30); assert.equal(coins(R, b), 30);
  const quem = S => [a, b].find(u => u.id === S.players[S.turn].uid);
  let S = (await R.getGame(room.id)).state;
  if (modo === 'lisa') {
    assert.equal(S.phase, 'monta');
    for (const [u, p] of [[a, 0], [b, 1]]) {
      const pi = S.players.findIndex(x => x.uid === u.id);
      const pos = S.balls.filter(x => grupoDe(x.n) === S.grupos[pi]).map(x => [x.x, x.y]);
      if (p === 0) await assert.rejects(SV.act(R, u, room.id, { type: 'monta', pos: pos.map(([x, y]) => [pi === 0 ? 900 : 100, y]) }), /fora do seu lado/);
      await SV.act(R, u, room.id, { type: 'monta', pos });
      S = (await R.getGame(room.id)).state;
    }
    assert.equal(S.phase, 'aim', 'os dois arrumaram: começou');
  }
  let n = 0;
  while (!S.over && n++ < 400) {
    const antes = clone(S);
    const j = jogadaComputador(clone(S));
    const other = [a, b].find(u => u.id !== S.players[S.turn].uid);
    await assert.rejects(SV.act(R, other, room.id, { type: 'shot', ang: j.ang, forca: j.forca }), /sua vez/);
    await SV.act(R, quem(S), room.id, { type: 'shot', ang: j.ang, forca: j.forca, sel: j.sel, place: antes.naMao ? [antes.balls[antes.sel].x, antes.balls[antes.sel].y] : null });
    S = (await R.getGame(room.id)).state;
    // o navegador refaz a tacada com a mesa de antes + a velocidade: tem que dar igual ao servidor
    const L = S.last; const V = clone(antes); V.balls = clone(L.pre.balls).map(x => ({ ...x, vx: 0, vy: 0 })); V.sel = L.sel; V.naMao = false;
    assert.ok(aplicaTacada(V, L.vx, L.vy)); let k = 0; while (V.phase === 'rolling' && k++ < 30000) stepSinuca(V);
    V.balls.forEach((x, i) => { assert.equal(x.in, S.balls[i].in); if (!x.in) { assert.equal(x.x, S.balls[i].x); assert.equal(x.y, S.balls[i].y); } });
  }
  assert.ok(S.over, modo + ': terminou');
  const w = S.players[S.over.winner].uid === a.id ? a : b, l = w === a ? b : a;
  assert.equal(coins(R, w), 30 + 36, 'pote 40, casa 10% = 4, ganhador leva 36');
  assert.equal(coins(R, l), 30);
  console.log(`sinuca online ${modo}: ${n} tacadas, ganhador recebeu 36`);
}
console.log('sinuca online ok');

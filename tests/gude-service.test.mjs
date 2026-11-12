// Gude no servidor: contra o computador valendo ficha e a sala online 1 contra 1
import assert from 'node:assert/strict';
import { memRepo, addUsers } from './memrepo.mjs';
import { gudeBot, BOT_COST, BOT_PRIZE } from '../lib/gude-service.js';
import * as SV from '../lib/service.js';
import { botShot, velOf, launch, step } from '../lib/gude.js';

const coins = (R, u) => R.T.profiles.find(p => p.id === u.id).coins;
const myShot = S => { const { ang, power } = botShot({ ...S, turn: 0 }, 'dificil'); return velOf(ang, power); };

/* ---------- contra o computador ---------- */
{
  const R = memRepo(); const [u] = addUsers(R, 1, 0);
  await assert.rejects(gudeBot(R, u, { op: 'start', mode: 'triangulo' }), /sem fichas/, 'sem fichas não joga');
  R.T.profiles[0].coins = 100;
  let won = 0, lost = 0, tie = 0;
  for (let g = 0; g < 40; g++) {
    const mode = ['triangulo', 'bulica', 'matamata'][g % 3];
    const before = coins(R, u);
    let r = await gudeBot(R, u, { op: 'start', mode, level: 'facil', first: g % 2 });
    assert.equal(coins(R, u), before - BOT_COST + r.prize, 'cobrou 1 ficha');
    let { id, version, state } = r, guard = 0;
    while (!state.over) {
      assert.equal(state.turn, 0, 'volta pra mim depois do computador');
      const v = myShot(state);
      // o navegador refaz as tecadas a partir da cópia e chega na mesma mesa
      r = await gudeBot(R, u, { op: 'shot', id, version, ...v });
      let L = null;
      for (const s of r.shots) { L = JSON.parse(JSON.stringify(s.pre)); launch(L, s.vx, s.vy); while (L.moving) step(L); }
      assert.deepEqual(L.players.map(p => [p.sh.x, p.sh.y, p.score]), r.state.players.map(p => [p.sh.x, p.sh.y, p.score]), 'replay bate com o servidor');
      await assert.rejects(gudeBot(R, u, { op: 'shot', id, version, ...v }), /mudou|acabou/, 'não repete a mesma jogada');
      ({ version, state } = r);
      assert.ok(++guard < 300);
    }
    const w = state.over.winner, delta = coins(R, u) - before;
    if (w === 0) { won++; assert.equal(delta, BOT_PRIZE - BOT_COST); }
    else if (w < 0) { tie++; assert.equal(delta, -BOT_COST, 'empate contra o computador não devolve'); }
    else { lost++; assert.equal(delta, -BOT_COST); }
  }
  console.log('contra o computador (fácil): ganhou', won, 'perdeu', lost, 'empatou', tie);
  // começar outra partida abandona a anterior
  const a = await gudeBot(R, u, { op: 'start', mode: 'matamata' });
  await gudeBot(R, u, { op: 'start', mode: 'matamata' });
  if (!a.state.over) await assert.rejects(gudeBot(R, u, { op: 'shot', id: a.id, version: a.version, vx: 5, vy: 0 }), /acabou/);
}

/* ---------- online 1 contra 1 ---------- */
{
  const R = memRepo(); const [a, b, c] = addUsers(R, 3, 50);
  const room = await SV.createRoom(R, a, { mode: 'gude-bulica', maxPlayers: 9, entry: 10, turnSeconds: 30 });
  assert.equal(R.T.rooms[0].max_players, 2, 'gude é sempre 1x1');
  await SV.joinRoom(R, b, { id: room.id });
  await assert.rejects(SV.joinRoom(R, c, { id: room.id }), /cheia/);
  await SV.setReady(R, a, room.id, true);
  const st = await SV.setReady(R, b, room.id, true);
  assert.ok(st.started);
  assert.equal(coins(R, a), 40); assert.equal(coins(R, b), 40);
  let g = (await R.getGame(room.id)).state;
  assert.equal(g.game, 'gude'); assert.equal(g.mode, 'bulica');
  const who = i => [a, b].find(u => u.id === g.players[i].uid);
  await assert.rejects(SV.act(R, who(1 - g.turn), room.id, { type: 'shot', vx: 3, vy: 0 }), /vez/);
  let guard = 0;
  while (!(g.result && g.result.matchOver)) {
    const { ang, power } = botShot(g, 'dificil'), v = velOf(ang, power);
    const r = await SV.act(R, who(g.turn), room.id, { type: 'shot', ...v });
    assert.ok(r.state.last.pre && r.state.last.n === r.state.shots, 'manda a cópia pra animar');
    g = (await R.getGame(room.id)).state;
    assert.ok(++guard < 400);
  }
  const champ = g.result.champion;
  assert.equal(coins(R, who(champ)), 55, 'campeão leva a entrada + metade da do outro');
  assert.equal(coins(R, who(1 - champ)), 40, 'quem perde fica sem a entrada');
  assert.equal(R.T.rooms[0].status, 'waiting');
  assert.equal(R.T.match_history[0].mode, 'gude-bulica');

  // tempo esgotado passa a vez; quem sai perde
  await SV.setReady(R, a, room.id, true); await SV.setReady(R, b, room.id, true);
  g = (await R.getGame(room.id)).state;
  const t0 = g.turn;
  const G = R.games.get(room.id); G.state.deadline = Date.now() - 5000;
  assert.ok((await SV.tick(R, a, room.id)).changed);
  g = (await R.getGame(room.id)).state; assert.equal(g.turn, 1 - t0);
  await SV.leaveRoom(R, a, room.id);
  g = (await R.getGame(room.id)).state;
  assert.equal(g.result.champion, g.players.findIndex(p => p.uid === b.id), 'quem ficou ganha');
}

/* ---------- empate online devolve a entrada ---------- */
{
  const R = memRepo(); const [a, b] = addUsers(R, 2, 20);
  const room = await SV.createRoom(R, a, { mode: 'gude-triangulo', entry: 5, turnSeconds: 30 });
  await SV.joinRoom(R, b, { id: room.id });
  await SV.setReady(R, a, room.id, true); await SV.setReady(R, b, room.id, true);
  const G = R.games.get(room.id); // força o fim: 5 x 5
  G.state.balls.forEach((x, i) => { if (i) x.out = true; }); G.state.players[0].score = 5; G.state.players[1].score = 4;
  G.state.balls[0].x = 455; G.state.balls[0].y = 225; // a última, na ponta do triângulo
  const sh = G.state.players[G.state.turn].sh; sh.x = 380; sh.y = 225;
  if (G.state.turn === 0) { G.state.players[0].score = 4; G.state.players[1].score = 5; }
  const who = [a, b].find(u => u.id === G.state.players[G.state.turn].uid);
  await SV.act(R, who, room.id, { type: 'shot', vx: 9, vy: 0 });
  const g = (await R.getGame(room.id)).state;
  assert.ok(g.result && g.result.tie, 'empatou');
  assert.equal(coins(R, a), 20); assert.equal(coins(R, b), 20);
}
/* ---------- entrada mínima de 2 e a parte da casa ---------- */
{
  const R = memRepo(); const [a, b] = addUsers(R, 2, 10);
  await assert.rejects(SV.createRoom(R, a, { mode: 'gude-triangulo', entry: 1, turnSeconds: 30 }), /mínima é 2/);
  const room = await SV.createRoom(R, a, { mode: 'gude-matamata', entry: 2, turnSeconds: 30 });
  await SV.joinRoom(R, b, { id: room.id });
  await SV.setReady(R, a, room.id, true); await SV.setReady(R, b, room.id, true);
  assert.equal(coins(R, a), 8); assert.equal(coins(R, b), 8);
  await SV.leaveRoom(R, a, room.id);   // a sai: b ganha
  assert.equal(coins(R, b), 11, 'ganhador leva 3 (2 dele + 1 do outro)');
  assert.equal(coins(R, a), 8, 'quem perdeu fica sem os 2');
  assert.equal(R.T.match_players.find(x => x.user_id === b.id).coins_delta, 1);
}
console.log('gude servidor ok');

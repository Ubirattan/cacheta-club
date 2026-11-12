// Testes da bolinha de gude: os 3 modos, o computador e a repetição da jogada (online)
import assert from 'node:assert/strict';
import { newGame, step, shoot, launch, velOf, simulate, snapshot, botShot, inTri, left, holeAt, CX, CY, LINE, HOLES, MODOS, MAXV } from '../lib/gude.js';

assert.ok(inTri(CX, CY), 'centro está dentro');
assert.ok(!inTri(LINE, CY), 'linha está fora');
{
  const S = newGame();
  assert.equal(left(S), 10);
  assert.ok(S.balls.every(b => inTri(b.x, b.y)), 'todas começam dentro do triângulo');
  assert.ok(shoot(S, 0, 0) && !shoot(S, 0, 50), 'não teca com bolinha andando');
}
{ // velocidade acima do máximo é cortada
  const S = newGame({ mode: 'matamata' });
  const v = launch(S, 500, 0);
  assert.ok(Math.abs(v.vx - MAXV) < 1e-9);
}
{ // búlica: tecada certinha cai no buraco 1 e joga de novo
  const S = newGame({ mode: 'bulica' });
  const sh = S.players[0].sh, [hx, hy] = HOLES[0], d = Math.hypot(hx - sh.x, hy - sh.y);
  launch(S, (hx - sh.x) / d * d * .028, (hy - sh.y) / d * d * .028);
  simulate(S);
  assert.equal(holeAt(S.players[0].sh), 0, 'caiu na búlica');
  assert.equal(S.players[0].step, 1); assert.equal(S.turn, 0, 'acertou: joga de novo');
}
{ // mata-mata: acertou o outro, ponto, e as bolinhas voltam pro lugar
  const S = newGame({ mode: 'matamata' });
  S.players[1].sh.x = 300;
  launch(S, 8, 0); simulate(S);
  assert.equal(S.players[0].score, 1); assert.equal(S.turn, 1, 'quem levou começa');
  assert.equal(S.players[1].sh.x, 750);
}
// a mesma tecada refeita a partir da cópia chega exatamente no mesmo lugar (é assim que o online anima)
for (const mode of Object.keys(MODOS)) {
  const S = newGame({ mode });
  for (let k = 0; k < 12 && !S.over; k++) {
    const pre = snapshot(S), { ang, power } = botShot(S, 'medio'), v = velOf(ang, power);
    launch(S, v.vx, v.vy); simulate(S);
    const R = JSON.parse(JSON.stringify(pre)); launch(R, v.vx, v.vy);
    while (R.moving) step(R);
    assert.deepEqual(snapshot(R), snapshot(S), 'replay idêntico');
  }
}
// partidas inteiras computador x computador em todos os modos: sempre acabam
for (const mode of Object.keys(MODOS)) {
  const lv = ['facil', 'medio', 'dificil'];
  let wins = [0, 0, 0];
  for (let g = 0; g < 120; g++) {
    const S = newGame({ mode, players: [{ name: 'A' }, { name: 'B' }] });
    let frames = 0;
    while (!S.over) {
      if (!S.moving) { const s = botShot(S, lv[g % 3]); shoot(S, s.ang, s.power); }
      step(S); S.events.length = 0;
      assert.ok(++frames < 600000, 'partida travou: ' + mode);
    }
    if (mode === 'triangulo') assert.equal(S.players[0].score + S.players[1].score, 10);
    wins[S.over.winner + 1]++;
    if (g === 0) console.log(mode, 'tecadas na partida:', S.shots);
  }
  console.log(mode, 'empates/A/B:', wins.join('/'));
}
console.log('gude ok');

// Testes da bolinha de gude
import assert from 'node:assert/strict';
import { newGame, step, shoot, botShot, inTri, left, CX, CY, LINE } from '../lib/gude.js';

assert.ok(inTri(CX, CY), 'centro está dentro');
assert.ok(!inTri(LINE, CY), 'linha está fora');
{
  const S = newGame();
  assert.equal(left(S), 10);
  assert.ok(S.balls.every(b => inTri(b.x, b.y)), 'todas começam dentro do triângulo');
  assert.ok(shoot(S, 0, 0) && !shoot(S, 0, 50), 'não teca com bolinha andando');
}
// partidas inteiras computador x computador: sempre acabam e o placar fecha
for (let g = 0; g < 200; g++) {
  const S = newGame(['A', 'B']);
  let frames = 0;
  while (!S.over) {
    if (!S.moving) { const s = botShot(S, g % 2 ? 'facil' : 'medio'); shoot(S, s.ang, s.power); }
    step(S); S.events.length = 0;
    assert.ok(++frames < 400000, 'partida travou');
  }
  assert.equal(S.players[0].score + S.players[1].score, 10);
}
console.log('gude ok');

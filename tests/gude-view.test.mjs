// Mesa da gude no navegador (com uma tela de mentira): arrastar, fila de tecadas e mesa igual à do servidor
const ctx = new Proxy({}, { get: (t,k) => k==='createRadialGradient'||k==='createLinearGradient' ? () => ({ addColorStop(){} }) : (k in t ? t[k] : () => {}), set: (t,k,v) => { t[k]=v; return true; } });
const mkCanvas = () => ({ width:0,height:0,style:{}, getContext:()=>ctx, getBoundingClientRect:()=>({left:0,top:0,width:920,height:450}), addEventListener(t,f){ this['on'+t]=f; }, removeEventListener(){}, setPointerCapture(){} });
globalThis.document = { createElement: () => mkCanvas() };
globalThis.window = { devicePixelRatio: 1 };
globalThis.ResizeObserver = class { observe(){} disconnect(){} };
let frames = []; globalThis.requestAnimationFrame = f => { frames.push(f); return 1; }; globalThis.cancelAnimationFrame = () => {};
globalThis.localStorage = { getItem: () => '0', setItem(){} };

let T = 0; globalThis.performance = { now: () => T };
const { createView } = await import('../lib/gude-view.js');
const G = await import('../lib/gude.js');
const run = (n) => { for (let i=0;i<n;i++){ T += 16.7; const f = frames.shift(); f && f(T); } };
import assert from 'node:assert/strict';

// servidor simulado: partida contra o computador
const S0 = G.newGame({ mode: 'bulica', first: 0 });
const srv = JSON.parse(JSON.stringify(S0));
const cv = mkCanvas(); let shot = null, settles = 0, last = null;
const v = createView({ canvas: cv, box: cv, state: S0, me: 0, onShoot: x => shot = x, onSettle: () => settles++, onChange: s => last = s });
run(2);
assert.ok(v.myTurn());
// arrasta pra trás e solta
const sh = v.state.players[0].sh;
cv.onpointerdown({ clientX: sh.x, clientY: sh.y, pointerId: 1 });
cv.onpointermove({ clientX: sh.x - 60, clientY: sh.y + 15 });
cv.onpointerup({});
assert.ok(shot, 'mandou a tecada');
assert.ok(!v.myTurn(), 'não teca de novo com a bolinha andando');
// servidor refaz a mesma tecada + jogadas do computador
const shots = [];
const play = (vx,vy) => { const pre = G.snapshot(srv); const u = G.launch(srv, vx, vy); G.simulate(srv); shots.push({ pre, vx:u.vx, vy:u.vy }); };
play(shot.vx, shot.vy);
let k=0; while (!srv.over && srv.turn === 1 && k++ < 30) { const b = G.botShot(srv,'medio'), w = G.velOf(b.ang,b.power); play(w.vx,w.vy); }
v.push(shots.slice(1)); v.setFinal(srv);
run(20000);
assert.ok(!v.busy(), 'terminou de animar');
assert.deepEqual(G.snapshot(v.state), G.snapshot(srv), 'tela igual ao servidor');
assert.equal(settles, shots.length, 'um recado por tecada');
console.log('view ok: tecadas', shots.length, 'recados', settles);

// erro dentro de um quadro (ex.: no recado) não pode congelar a mesa: o loop continua
{
  frames = [];
  const S1 = G.newGame({ mode: 'bulica', first: 0 });
  const cv2 = mkCanvas(); let boom = true, shot2 = null;
  const v2 = createView({ canvas: cv2, box: cv2, state: S1, me: 0, onShoot: x => shot2 = x,
    onSettle: () => { if (boom) { boom = false; throw new Error('erro de teste'); } } });
  const ce = console.error; console.error = () => {};
  run(2);
  const s2 = v2.state.players[0].sh;
  cv2.onpointerdown({ clientX: s2.x, clientY: s2.y, pointerId: 1 });
  cv2.onpointermove({ clientX: s2.x - 50, clientY: s2.y - 10 });
  cv2.onpointerup({});
  assert.ok(shot2, 'tecou');
  run(3000);
  console.error = ce;
  assert.ok(frames.length > 0, 'loop continua rodando depois do erro');
  assert.ok(!v2.state.moving, 'bolinha parou');
  v2.destroy();
  console.log('view ok: erro num quadro não trava');
}

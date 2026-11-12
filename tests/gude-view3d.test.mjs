// Mesa 3D da gude com um Three.js de mentira: mira, botão de força, fila de tecadas e mesa igual à do servidor
import assert from 'node:assert/strict';

// Three.js falso: qualquer coisa vira um objeto que aceita tudo
const fake = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return () => 0;
    if (k === 'then') return undefined;
    if (!(k in t)) t[k] = fake();
    return t[k];
  },
  set: (t, k, v) => { t[k] = v; return true; },
  apply: () => fake(),
  construct: () => fake(),
});
const THREE = fake();

// DOM falso
const ctx = new Proxy({}, { get: (t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const el = () => {
  const L = {};
  const e = {
    width: 0, height: 0, style: {}, className: '', innerHTML: '', offsetWidth: 1,
    classList: { add() {}, remove() {}, toggle() {} },
    getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 420 }),
    addEventListener(t, f) { L[t] = f; }, removeEventListener() {}, setPointerCapture() {},
    appendChild() {}, remove() {}, fire(t, ev = {}) { L[t] && L[t]({ preventDefault() {}, pointerId: 1, ...ev }); },
    querySelector(sel) { return (e._q[sel] = e._q[sel] || el()); }, _q: {},
  };
  return e;
};
const created = [];
globalThis.document = { createElement: () => { const e = el(); created.push(e); return e; }, head: { appendChild() {} } };
globalThis.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
let frames = []; globalThis.requestAnimationFrame = f => { frames.push(f); return 1; }; globalThis.cancelAnimationFrame = () => {};
globalThis.localStorage = { getItem: () => '0', setItem() {} };
let T = 0; globalThis.performance = { now: () => T };
globalThis.setTimeout = () => 0; globalThis.clearTimeout = () => {};

const { createView3D } = await import('../lib/gude-view3d.js');
const G = await import('../lib/gude.js');
const run = n => { for (let i = 0; i < n; i++) { T += 16.7; const f = frames.shift(); f && f(T); } };

for (const mode of ['triangulo', 'bulica', 'matamata']) {
  frames = [];
  const { events: _e, ...S0 } = G.newGame({ mode, first: 0 });
  const srv = { ...JSON.parse(JSON.stringify(S0)), events: [] };
  const box = el(); let shot = null, settles = 0;
  const v = createView3D({ box, state: S0, me: 0, onShoot: x => shot = x, onSettle: () => settles++ }, THREE);
  run(3);
  assert.ok(v.myTurn(), mode + ': minha vez');
  // segura o botão de força ~0,8 s e solta
  const pw = lastUi().querySelector('.gd3-pw');
  pw.fire('pointerdown'); run(48); pw.fire('pointerup');
  assert.ok(shot, mode + ': mandou a tecada');
  assert.ok(!v.myTurn(), mode + ': não teca de novo com a bolinha andando');
  const shots = [];
  const play = (vx, vy) => { const pre = G.snapshot(srv); const u = G.launch(srv, vx, vy); G.simulate(srv); shots.push({ pre, vx: u.vx, vy: u.vy }); };
  play(shot.vx, shot.vy);
  let k = 0; while (!srv.over && srv.turn === 1 && k++ < 30) { const b = G.botShot(srv, 'medio'), w = G.velOf(b.ang, b.power); play(w.vx, w.vy); }
  v.push(shots.slice(1)); v.setFinal(srv);
  run(30000);
  assert.ok(!v.busy(), mode + ': terminou de animar');
  assert.deepEqual(G.snapshot(v.state), G.snapshot(srv), mode + ': tela igual ao servidor');
  assert.equal(settles, shots.length, mode + ': um recado por tecada');
  v.destroy();
  console.log(`3D ${mode} ok: tecadas ${shots.length}`);
}

function lastUi() { return created.filter(e => e.className === 'gd3-ui').pop(); }

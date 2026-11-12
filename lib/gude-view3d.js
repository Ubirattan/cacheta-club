'use client';
// Mesa da gude em 3D (Three.js), no estilo "câmera atrás da bolinha".
// A física, as regras e o servidor são os mesmos do lib/gude.js: esta tela só desenha.
// Cada tecada (minha, do computador ou do adversário online) é refeita quadro a quadro
// a partir da mesa de antes (pre), com a mesma velocidade (vx, vy) do servidor.
//
// Controles: arraste o dedo na tela pra mirar; segure o botão de força (a força sobe e desce)
// e solte na hora certa. O 👁 mostra o campo de cima.
//
// O Three.js vem do CDN só quando a gude abre (o resto do site continua leve).
// Se não carregar, ou o celular não tiver WebGL, o components/Gude.js usa a tela 2D antiga.
import { CX, CY, MAXP, VK, FRICTION, HOLES, RUA, world, step, launch, velOf, target, holeAt } from './gude.js';
import { sfx } from './sfx.js';
import { foto, paintGround, paintRua, clack } from './gude-view.js';

const K = 0.01;            // 1 pixel do mundo da gude = 1 cm = 0,01 unidade do 3D
const STEP = 1000 / 60;    // a física roda a 60 quadros por segundo, em qualquer tela
const AIM_MS = 750;        // tempo mostrando a mira do adversário antes da tecada dele
const clone = x => JSON.parse(JSON.stringify(x));
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

/* ---------------- carregar o Three.js ---------------- */
let threeP = null;
export function loadThree() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem janela'));
  if (window.THREE && window.THREE.WebGLRenderer) return Promise.resolve(window.THREE);
  if (!threeP) threeP = new Promise((ok, fail) => {
    const srcs = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
    const tryNext = i => {
      if (i >= srcs.length) { threeP = null; fail(new Error('O 3D não carregou')); return; }
      const s = document.createElement('script'); s.src = srcs[i]; s.async = true;
      const t = setTimeout(() => { s.onload = s.onerror = null; s.remove(); tryNext(i + 1); }, 12000);
      s.onload = () => { clearTimeout(t); window.THREE && window.THREE.WebGLRenderer ? ok(window.THREE) : tryNext(i + 1); };
      s.onerror = () => { clearTimeout(t); s.remove(); tryNext(i + 1); };
      document.head.appendChild(s);
    };
    tryNext(0);
  });
  return threeP;
}
let glOk = null;   // testa uma vez só (cada teste abre um contexto WebGL)
export function webglOk() {
  if (glOk != null) return glOk;
  try {
    const c = document.createElement('canvas'), gl = window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'));
    glOk = !!gl;
    try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
  } catch { glOk = false; }
  return glOk;
}

/* ---------------- texturas desenhadas na hora ---------------- */
function tex(THREE, renderer, w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  try { t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); } catch {}
  return t;
}
const rr = (a, b) => a + Math.random() * (b - a);
function speckle(g, w, h, n, cols, a, b) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = rr(a, b); g.fillRect(Math.random() * w, Math.random() * h, s, s); } }
function drawBrick(g, w, h) {
  g.fillStyle = '#cbb9a0'; g.fillRect(0, 0, w, h);
  const rows = 8, bw = w / 4, bh = h / rows;
  for (let r = 0; r < rows; r++) { const off = (r % 2) * bw / 2; for (let k = -1; k < 5; k++) { const v = rr(-18, 18); g.fillStyle = `rgb(${172 + v | 0},${88 + v * .6 | 0},${58 + v * .4 | 0})`; g.fillRect(k * bw + off + 2, r * bh + 2, bw - 4, bh - 4); } }
  speckle(g, w, h, 2500, ['rgba(0,0,0,.12)', 'rgba(255,220,190,.12)'], .5, 1.6);
}
function drawFacade(col) {
  return (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.08)'], .6, 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 10, w, 10);
    const n = Math.max(1, Math.round(w / 90));
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * w / n;
      if (i === 0 && w > 120) { g.fillStyle = '#5b4632'; g.fillRect(x - 16, h - 78, 32, 68); continue; }   // porta
      g.fillStyle = '#e8e4d8'; g.fillRect(x - 22, h * .3 - 4, 44, 40);
      g.fillStyle = '#334155'; g.fillRect(x - 18, h * .3, 36, 32);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 18, h * .3, 12, 32);
    }
  };
}
function marbleTex(THREE, renderer, b) {
  return tex(THREE, renderer, 256, 128, (g, w, h) => {
    const [c0, c1, c2] = b.k || ['#2563eb', '#93c5fd', '#0b2a6b'];
    const leite = b.type === 'leiteira', preto = b.type === 'olhopreto';
    g.fillStyle = leite ? '#f4f6f9' : preto ? '#141821' : c1; g.fillRect(0, 0, w, h);
    const band = (col, wid, y0, amp, ph) => {
      g.strokeStyle = col; g.lineWidth = wid; g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = y0 + Math.sin(x / w * Math.PI * 4 + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    };
    if (leite) { band('rgba(148,163,184,.6)', 10, 40, 18, 0); band('rgba(203,213,225,.9)', 14, 86, 22, 2); }
    else if (preto) { band(c1, 14, 50, 22, .5); band('rgba(255,200,80,.6)', 6, 82, 16, 2.4); }
    else { band(c0, 22, 46, 20, .3); band('rgba(255,255,255,.85)', 7, 70, 24, 1.9); band(c2, 12, 96, 14, 3.4); }
  });
}

/* ---------------- a mesa em 3D ---------------- */
// opts: { box, state, me, canPlay(), onShoot({vx,vy}), onSettle(ev,S), onChange(S) }  (igual à tela 2D)
export function createView3D(opts, THREE) {
  const box = opts.box;
  let S = clone(opts.state); S.events = [];
  const mode = S.mode, rua = mode === 'matamata', WD = world(mode);
  const me = () => opts.me;

  /* --- peças da tela (canvas 3D + botões) --- */
  const cv = document.createElement('canvas'); cv.className = 'gd3-cv';
  const ui = document.createElement('div'); ui.className = 'gd3-ui';
  ui.innerHTML = '<div class="gd3-msg"></div><div class="gd3-hint">Arraste na tela pra mirar · segure o botão e solte pra tecar</div>'
    + '<button class="gd3-eye" title="Ver de cima">👁</button><div class="gd3-pw"><div class="in">SEGURE<br>E SOLTE</div></div>';
  const msgEl = ui.querySelector('.gd3-msg'), hintEl = ui.querySelector('.gd3-hint'), eyeEl = ui.querySelector('.gd3-eye'), pwEl = ui.querySelector('.gd3-pw');

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });   // sem WebGL isto dá erro e o Gude.js usa o 2D
  box.appendChild(cv); box.appendChild(ui);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.02, 200);
  const V3 = THREE.Vector3;

  // céu e reflexo nas bolinhas
  scene.background = tex(THREE, renderer, 16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d7fd1'); gr.addColorStop(.55, '#9cc9f0'); gr.addColorStop(1, '#e8f2fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0xcfe3f5, rua ? 14 : 12, rua ? 40 : 34);
  try {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    const et = tex(THREE, renderer, 16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6aa6e6'); gr.addColorStop(.48, '#d7ecfb'); gr.addColorStop(.52, '#6b6560'); gr.addColorStop(1, '#4a4440'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: et, side: THREE.BackSide })));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); sunBall.position.set(4, 7, 3); es.add(sunBall);
    scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose();
  } catch {}

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x7a6a55, 0.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.15); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
  sun.shadow.bias = -0.0006; scene.add(sun); scene.add(sun.target);

  const Wd = WD.w * K, Hd = WD.h * K;   // tamanho do campo em unidades 3D (x → X, y → Z)
  const std = o => new THREE.MeshStandardMaterial(o);
  function box3(w, h, d, mat, x, y, z, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
  }

  /* --- chão: o mesmo desenho do 2D (risco do triângulo, buracos, rua), agora deitado no 3D --- */
  let alive = true;
  const groundTex = new THREE.CanvasTexture(rua ? paintRua(foto('rua-chao.jpg', () => redo())) : paintGround(mode, foto('rua-chao.jpg', () => redo())));
  groundTex.encoding = THREE.sRGBEncoding;
  try { groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); } catch {}
  function redo() { if (!alive) return; groundTex.image = rua ? paintRua(foto('rua-chao.jpg')) : paintGround(mode, foto('rua-chao.jpg')); groundTex.needsUpdate = true; }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Hd), std({ map: groundTex, roughness: .92 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(Wd / 2, 0, Hd / 2); ground.receiveShadow = true; scene.add(ground);
  // em volta: asfalto da rua
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), std({ map: tex(THREE, renderer, 256, 256, (g, w, h) => { g.fillStyle = '#4a4c50'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.08)'], .6, 2); }, [40, 40]), roughness: 1 }));
  outside.rotation.x = -Math.PI / 2; outside.position.set(Wd / 2, -0.004, Hd / 2); outside.receiveShadow = true; scene.add(outside);

  // muro de tijolo nas bordas (é onde a bolinha rebate)
  const wallH = rua ? .55 : .8, wt = .16;
  const brick = len => std({ map: tex(THREE, renderer, 256, 128, drawBrick, [len / 1.1, wallH / .8 * 1.6]), roughness: .95 });
  box3(Wd + 2 * wt, wallH, wt, brick(Wd), Wd / 2, wallH / 2, -wt / 2);
  box3(Wd + 2 * wt, wallH, wt, brick(Wd), Wd / 2, wallH / 2, Hd + wt / 2);
  box3(wt, wallH, Hd, brick(Hd), -wt / 2, wallH / 2, Hd / 2);
  box3(wt, wallH, Hd, brick(Hd), Wd + wt / 2, wallH / 2, Hd / 2);

  // casas em volta do campo
  const cores = ['#e9d8a6', '#94d2bd', '#f4a261', '#e5e5e5', '#a8dadc', '#f6bd60', '#cdb4db', '#b5c99a'];
  const roof = std({ color: 0x8a4b2e, roughness: .9 });
  function houses(x0, x1, z, face) {   // face: +1 olha pra +Z, -1 pra -Z
    let x = x0;
    while (x < x1) {
      const w = rr(2.4, 3.6), h = rr(2.2, 3.4), d = 3, col = cores[(Math.random() * cores.length) | 0];
      const ft = tex(THREE, renderer, Math.round(w * 90), Math.round(h * 90), drawFacade(col));
      const side = std({ color: col, roughness: 1 }), front = std({ map: ft, roughness: 1 });
      const mats = [side, side, side, side, face > 0 ? front : side, face > 0 ? side : front];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      m.position.set(x + w / 2, h / 2, z - face * d / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + .2, .12, d + .5), roof); r.position.set(x + w / 2, h + .06, z - face * d / 2 + face * .15); scene.add(r);
      x += w + rr(.05, .6);
    }
  }
  function sideHouses(z0, z1, x, face) {   // fileira ao longo de Z (face +1 olha pra +X)
    let z = z0;
    while (z < z1) {
      const w = rr(2.4, 3.6), h = rr(2.2, 3.4), d = 3, col = cores[(Math.random() * cores.length) | 0];
      const ft = tex(THREE, renderer, Math.round(w * 90), Math.round(h * 90), drawFacade(col));
      const side = std({ color: col, roughness: 1 }), front = std({ map: ft, roughness: 1 });
      const mats = [face > 0 ? front : side, face > 0 ? side : front, side, side, side, side];
      const m = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), mats);
      m.position.set(x - face * d / 2, h / 2, z + w / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      z += w + rr(.05, .6);
    }
  }
  const gap = rua ? 1.2 : 1.6;
  houses(-gap - 4, Wd + gap + 4, -gap, 1);
  houses(-gap - 4, Wd + gap + 4, Hd + gap, -1);
  sideHouses(-gap, Hd + gap, -gap, 1);
  sideHouses(-gap, Hd + gap, Wd + gap, -1);

  /* --- rua do mata-mata: árvores, postes e carros de verdade em cima do desenho --- */
  const trunkM = std({ color: 0x5a3d24, roughness: 1 }), leafA = std({ color: 0x3f7d26, roughness: 1 }), leafB = std({ color: 0x2e6a1f, roughness: 1 });
  if (rua) {
    for (const t of RUA.trees) {
      const small = t.y === 500, x = t.x * K, z = t.y * K, th = small ? 1.1 : 1.6;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(t.r * K * .8, t.r * K, th, 8), trunkM); tr.position.set(x, th / 2, z); tr.castShadow = true; scene.add(tr);
      const cr = small ? .5 : .75;
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + t.x, s = new THREE.Mesh(new THREE.SphereGeometry(cr * rr(.75, 1), 10, 8), k % 2 ? leafA : leafB);
        s.position.set(x + Math.cos(a) * cr * .5, th + cr * rr(.4, .9), z + Math.sin(a) * cr * .5); s.castShadow = true; scene.add(s);
      }
    }
    const poleM = std({ color: 0x5b6068, roughness: .6, metalness: .3 }), lampM = std({ color: 0xfff7d6, emissive: 0x554422, roughness: .3 });
    for (const p of RUA.poles) {
      const x = p.x * K, z = p.y * K, ph = 3.2;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r * K * .7, p.r * K, ph, 8), poleM); m.position.set(x, ph / 2, z); m.castShadow = true; scene.add(m);
      const dir = z < Hd / 2 ? 1 : -1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, .7), poleM); arm.position.set(x, ph - .05, z + dir * .35); scene.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.18, .07, .28), lampM); lamp.position.set(x, ph - .1, z + dir * .7); scene.add(lamp);
    }
    const carCols = [0xb91c1c, 0x1d4ed8, 0xe5e7eb, 0x15803d], glass = std({ color: 0x1e293b, roughness: .1, metalness: .4 }), tyre = std({ color: 0x111111, roughness: .9 });
    RUA.cars.forEach((c, i) => {
      const w = c.w * K, d = c.h * K, x = c.x * K + w / 2, z = c.y * K + d / 2, body = std({ color: carCols[i % 4], roughness: .35, metalness: .4 });
      box3(w, .32, d, body, x, .3, z);
      box3(w * .52, .26, d * .86, glass, x - w * .04, .59, z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .1, 14), tyre); wh.rotation.x = Math.PI / 2;
        wh.position.set(x + sx * w * .32, .15, z + sz * (d / 2 - .03)); scene.add(wh);
      }
    });
  } else {
    // algumas árvores atrás do muro
    for (let i = 0; i < 10; i++) {
      const x = i % 2 ? rr(-gap - 2, Wd + gap + 2) : (i % 4 ? -gap + .3 : Wd + gap - .3), z = i % 2 ? (i % 4 === 1 ? -gap + .4 : Hd + gap - .4) : rr(0, Hd);
      const th = rr(2.2, 3.4);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, th, 6), trunkM); tr.position.set(x, th / 2, z); scene.add(tr);
      const c = new THREE.Mesh(new THREE.SphereGeometry(rr(.8, 1.2), 10, 8), i % 3 ? leafA : leafB); c.position.set(x, th + .3, z); c.castShadow = true; scene.add(c);
    }
  }

  /* --- bolinhas --- */
  const bodiesOf = st => [['p0', st.players[0].sh], ['p1', st.players[1].sh], ...st.balls.map((b, i) => ['b' + i, b])];
  const meshes = {};
  const sphereCache = {};
  for (const [id, b] of bodiesOf(S)) {
    const r = b.r * K, geo = sphereCache[r] || (sphereCache[r] = new THREE.SphereGeometry(r, 32, 20));
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: marbleTex(THREE, renderer, b), roughness: .07, metalness: 0, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.1 }));
    m.castShadow = true; m.position.set(b.x * K, r, b.y * K); m.rotation.set(rr(0, 6), rr(0, 6), rr(0, 6)); m.visible = !b.out;
    scene.add(m);
    meshes[id] = { m, r, last: null, pop: -1 };
  }
  // anel que pisca embaixo da bolinha da vez
  const ring = new THREE.Mesh(new THREE.RingGeometry(.2, .245, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  // buraco da vez (búlica) pisca
  const holeRing = new THREE.Mesh(new THREE.RingGeometry(.2, .24, 40), new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: .8, depthWrite: false }));
  holeRing.rotation.x = -Math.PI / 2; holeRing.visible = false; scene.add(holeRing);
  // linha da mira (até onde a bolinha para se não bater em nada)
  const aimG = new THREE.Group(); scene.add(aimG);
  const lineGeo = new THREE.PlaneGeometry(.035, 1); lineGeo.rotateX(-Math.PI / 2); lineGeo.translate(0, 0, -.5);
  const lineTex = tex(THREE, renderer, 4, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,.95)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const aimLine = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, depthWrite: false }));
  aimLine.position.y = .006; aimG.add(aimLine);
  const aimEnd = new THREE.Mesh(new THREE.RingGeometry(.13, .16, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, depthWrite: false }));
  aimEnd.rotation.x = -Math.PI / 2; aimEnd.position.y = .007; aimG.add(aimEnd);

  /* --- estado da tela --- */
  let queue = [], final = null, aiming = null, raf = 0, acc = 0, lastT = 0, lastClack = 0, movingFrames = 0;
  let ang = 0, charging = false, chargeT0 = 0, power = 0, overview = false, lookOff = 0, wasMine = false, myShots = 0;
  let shotAng = 0, msgTimer = 0;
  const idle = () => !S.moving && !aiming && !queue.length;
  const myTurn = () => me() >= 0 && idle() && !final && !S.over && S.turn === me() && (!opts.canPlay || opts.canPlay());

  // pra onde a mira aponta no começo da vez
  function autoAim(pi) {
    const sh = S.players[pi].sh;
    let tx = CX, ty = CY;
    if (mode === 'bulica') { const tg = target(S, pi); if (tg === 'matador') { const o = S.players[1 - pi].sh; tx = o.x; ty = o.y; } else [tx, ty] = HOLES[tg]; }
    else if (mode === 'matamata') { const o = S.players[1 - pi].sh; tx = o.x; ty = o.y; }
    if (Math.hypot(tx - sh.x, ty - sh.y) < 1) { tx = CX; ty = CY; }
    return Math.atan2(ty - sh.y, tx - sh.x);
  }

  function bigMsg(html) {
    msgEl.innerHTML = html; msgEl.classList.remove('show'); void msgEl.offsetWidth; msgEl.classList.add('show');
    clearTimeout(msgTimer); msgTimer = setTimeout(() => msgEl.classList.remove('show'), 1800);
  }
  function settleMsg(e) {
    const n = e.got ? e.got.length : 0;
    if (mode === 'triangulo') {
      if (n) {
        const tag = n >= 5 ? 'FENOMENAL!' : n >= 4 ? 'SHOW DE BOLA!' : n >= 2 ? 'MUITO BOM!' : '';
        bigMsg(`${n} TECADA${n > 1 ? 'S' : ''}.${tag ? '<br>' + tag : ''}`);
      } else if (e.stuck) bigMsg('QUEIMOU!<small>ficou no triângulo</small>');
      return;
    }
    if (e.matador) return bigMsg('MATADOR! 💀');
    if (e.hole != null) return bigMsg(`BURACO ${e.hole + 1}!<small>joga de novo</small>`);
    if (e.kill) return bigMsg(mode === 'matamata' ? 'ACERTOU! +1' : 'MATOU!');
    if (e.bueiro && e.bueiro.length) return bigMsg('BUEIRO!');
  }

  function events() {
    for (const e of S.events) {
      if (e.type === 'shoot') clack(.8, false);
      if (e.type === 'hit') { const now = performance.now(); if (now - lastClack > 35) { lastClack = now; clack(e.force / 8, true); if (e.force > 3 || e.sh) buzz(12); } }
      if (e.type === 'bump') { clack(Math.min(1, e.force / 7), e.kind === 'poste' || e.kind === 'carro'); if (e.force > 2.5) buzz(10); }
      if (e.type === 'curb') clack(Math.min(.6, e.force / 10), false);
      if (e.type === 'bueiro') { sfx('err'); buzz(30); }
      if (e.type === 'hole') clack(.5, false);
      if (e.type === 'settle') {
        if ((e.got && e.got.length) || e.hole != null || e.kill) sfx('coin');
        if (e.kill) buzz(40);
        settleMsg(e);
        opts.onSettle && opts.onSettle(e, S);
        opts.onChange && opts.onChange(S);
      }
    }
    S.events.length = 0;
  }

  /* --- um quadro de lógica (60/s) --- */
  function logic(now) {
    if (S.moving) {
      if (movingFrames >= 8000) { for (const [, b] of bodiesOf(S)) { b.vx = 0; b.vy = 0; } } else movingFrames++;
      step(S); events();
      if (!S.moving) movingFrames = 0;
    } else if (aiming) {
      if (now - aiming.t0 > AIM_MS) { const a = aiming; aiming = null; shotAng = Math.atan2(a.vy, a.vx); launch(S, a.vx, a.vy); events(); }
    } else if (queue.length) {
      const sh = queue.shift();
      S = clone(sh.pre); S.events = [];
      aiming = { vx: sh.vx, vy: sh.vy, t0: now };
      opts.onChange && opts.onChange(S);
    } else if (final) { S = final; final = null; opts.onChange && opts.onChange(S); }
  }
  function recover() {
    aiming = null; charging = false; movingFrames = 0;
    if (S.moving) for (const [, b] of bodiesOf(S)) { b.vx = 0; b.vy = 0; }
    if (queue.length || final) return;
    S.moving = false;
  }

  /* --- câmera --- */
  const camPos = new V3(), camLook = new V3(), wantPos = new V3(), wantLook = new V3();
  let camReady = false;
  function wanted() {
    const pi = S.turn, sh = S.players[pi].sh, p = new V3(sh.x * K, 0, sh.y * K);
    let a;
    if (S.moving) a = shotAng;
    else if (aiming) a = Math.atan2(aiming.vy, aiming.vx);
    else if (pi === me() && !S.over) a = ang;
    else a = autoAim(pi) + lookOff;
    const d = new V3(Math.cos(a), 0, Math.sin(a));
    if (overview) {
      if (rua) { const f = S.moving ? fastest() : p; wantPos.set(f.x, 7.5, f.z + 3.4); wantLook.set(f.x, 0, f.z); }
      else { wantPos.set(Wd / 2, 6.2, Hd / 2 + 3.6); wantLook.set(Wd / 2, 0, Hd / 2 + .2); }
      return;
    }
    if (S.moving) { wantPos.copy(p).addScaledVector(d, -1.55).add(new V3(0, .85, 0)); wantLook.copy(p).addScaledVector(d, .9); }
    else { wantPos.copy(p).addScaledVector(d, -1.15).add(new V3(0, .52, 0)); wantLook.copy(p).addScaledVector(d, 1.9); }
    const m = .08;
    wantPos.x = Math.max(m, Math.min(Wd - m, wantPos.x)); wantPos.z = Math.max(m, Math.min(Hd - m, wantPos.z));
  }
  function fastest() {
    let best = S.players[S.turn].sh, bv = -1;
    for (const p of S.players) { const v = Math.abs(p.sh.vx) + Math.abs(p.sh.vy); if (v > bv) { bv = v; best = p.sh; } }
    return new V3(best.x * K, 0, best.y * K);
  }

  /* --- desenho de cada quadro --- */
  const qTmp = new THREE.Quaternion(), axTmp = new V3();
  function render(now, dt) {
    // bolinhas
    for (const [id, b] of bodiesOf(S)) {
      const o = meshes[id]; if (!o) continue;
      const x = b.x * K, z = b.y * K;
      if (b.out) {
        if (o.m.visible && o.pop < 0) o.pop = 0;
        if (o.pop >= 0) { o.pop += dt / 650; o.m.position.y = o.r + o.pop * .9; o.m.scale.setScalar(Math.max(.001, 1 - o.pop)); if (o.pop >= 1) { o.m.visible = false; o.pop = -1; } }
        o.last = null; continue;
      }
      if (!o.m.visible || o.pop >= 0) { o.m.visible = true; o.pop = -1; o.m.scale.setScalar(1); }
      if (o.last) {
        const dx = x - o.last[0], dz = z - o.last[1], dist = Math.hypot(dx, dz);
        if (dist > 1e-5 && dist < .5) { axTmp.set(dz / dist, 0, -dx / dist); qTmp.setFromAxisAngle(axTmp, dist / o.r); o.m.quaternion.premultiply(qTmp); }
      }
      o.last = [x, z];
      const sunk = mode === 'bulica' && !b.vx && !b.vy && holeAt(b) >= 0;
      o.m.position.set(x, sunk ? o.r * .35 : o.r, z);
    }
    // anel da vez, mira e buraco da vez
    const sh = S.players[S.turn].sh, showRing = !S.over && !S.moving;
    ring.visible = showRing; ring.position.set(sh.x * K, .006, sh.y * K);
    const pulse = (now / 900) % 1; ring.scale.setScalar(1 + pulse * .6); ring.material.opacity = (1 - pulse) * .85;
    ring.material.color.set(S.turn === me() ? 0xffd23f : 0xff8a78);
    let aimA = null, aimP = 0;
    if (myTurn()) { aimA = ang; aimP = power * MAXP; }
    else if (aiming) { aimA = Math.atan2(aiming.vy, aiming.vx); aimP = Math.min(1, (now - aiming.t0) / 600) * Math.hypot(aiming.vx, aiming.vy) / VK; }
    aimG.visible = aimA != null;
    if (aimA != null) {
      aimG.position.set(sh.x * K, 0, sh.y * K); aimG.rotation.y = Math.atan2(-Math.cos(aimA), -Math.sin(aimA));
      const dist = Math.min(1100, aimP * VK / (1 - FRICTION)) * K, L = Math.max(.9, dist);
      aimLine.scale.set(1, 1, L); aimLine.position.z = -sh.r * K * 1.3;
      aimEnd.visible = dist > .2; aimEnd.position.z = -dist;
      const col = aimP > MAXP * .7 ? 0xef4444 : aimP > MAXP * .38 ? 0xf59e0b : 0x4ade80;
      aimEnd.material.color.set(aimP > 1 ? col : 0xffffff);
    }
    holeRing.visible = false;
    if (mode === 'bulica' && me() >= 0 && !S.over) {
      const tg = target(S, me());
      if (tg != null && tg !== 'matador') { const [hx, hy] = HOLES[tg], k = (now / 700) % 1; holeRing.visible = true; holeRing.position.set(hx * K, .008, hy * K); holeRing.scale.setScalar(1 + k * .9); holeRing.material.opacity = (1 - k) * .9; }
    }
    // botão de força
    const deg = power * 360;
    pwEl.style.background = `conic-gradient(${power > .85 ? '#ff2d2d' : '#ff7a00'} ${deg}deg, rgba(40,40,40,.55) ${deg}deg)`;
    const mine = myTurn();
    pwEl.classList.toggle('off', !mine);
    hintEl.style.opacity = mine && !charging && myShots === 0 ? '1' : '0';
    // câmera
    wanted();
    if (!camReady) { camPos.copy(wantPos); camLook.copy(wantLook); camReady = true; }
    const k = 1 - Math.exp(-dt / 1000 * (S.moving ? 4 : 6));
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    camera.position.copy(camPos); camera.lookAt(camLook);
    sun.target.position.set(camLook.x, 0, camLook.z); sun.position.set(camLook.x + 3.5, 8, camLook.z + 3);
    renderer.render(scene, camera);
  }

  function tick(now) {
    const dt = lastT ? Math.min(100, now - lastT) : STEP; lastT = now;
    acc += dt; let n = 0;
    while (acc >= STEP - .01 && n < 5) { acc -= STEP; n++; logic(now); }
    if (n >= 5) acc = 0;
    // virou minha vez: mira já apontando pro alvo
    const mine = myTurn();
    if (mine && !wasMine) { ang = autoAim(me()); lookOff = 0; }
    wasMine = mine;
    if (charging) { if (!mine) charging = false; else { const t = (now - chargeT0) / 1000; power = (1 - Math.cos(t * Math.PI * 2 / 1.8)) / 2; } }
    else power = 0;
    render(now, dt);
  }
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    try { tick(now); } catch (e) { console.error('gude3d', e); recover(); }
  }

  /* --- tamanho da tela --- */
  function fit() {
    const r = box.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < 1.2 ? 62 : 50; camera.updateProjectionMatrix();
  }
  fit();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null; ro && ro.observe(box);

  /* --- controles --- */
  let drag = null;
  const down = e => { drag = { id: e.pointerId, x: e.clientX }; try { cv.setPointerCapture(e.pointerId); } catch {} };
  const move = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x; drag.x = e.clientX;
    const f = .0045 * (overview ? 1.6 : 1);
    if (myTurn()) ang += dx * f; else if (idle()) lookOff += dx * f;
  };
  const up = e => { if (drag && drag.id === e.pointerId) drag = null; };
  const pwDown = e => { e.preventDefault(); if (!myTurn()) return; charging = true; chargeT0 = performance.now(); try { pwEl.setPointerCapture(e.pointerId); } catch {} };
  const pwUp = () => {
    if (!charging) return; charging = false;
    const p = power * MAXP; power = 0;
    if (p < 4 || !myTurn()) return;
    const v = velOf(ang, p);
    const used = launch(S, v.vx, v.vy);
    if (used) { shotAng = Math.atan2(used.vy, used.vx); myShots++; opts.onShoot && opts.onShoot({ vx: used.vx, vy: used.vy }); }
    opts.onChange && opts.onChange(S);
  };
  const pwCancel = () => { charging = false; power = 0; };
  const eye = () => { overview = !overview; eyeEl.classList.toggle('on', overview); };
  const key = e => {
    if (e.repeat) return;
    if (e.code === 'Space' && e.type === 'keydown' && myTurn()) { charging = true; chargeT0 = performance.now(); }
    if (e.code === 'Space' && e.type === 'keyup') pwUp();
  };
  const arrows = e => { if (!myTurn()) return; if (e.key === 'ArrowLeft') ang -= .02; if (e.key === 'ArrowRight') ang += .02; };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  pwEl.addEventListener('pointerdown', pwDown); pwEl.addEventListener('pointerup', pwUp); pwEl.addEventListener('pointercancel', pwCancel);
  eyeEl.addEventListener('click', eye);
  window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('keydown', arrows);

  ang = autoAim(Math.max(0, me()));
  raf = requestAnimationFrame(loop);

  return {
    get state() { return S; },
    busy: () => !idle() || !!final,
    myTurn,
    push(shots) { queue.push(...shots); },
    setFinal(st) { final = clone(st); final.events = []; },
    reset(st) { queue = []; aiming = null; charging = false; S = clone(st); S.events = []; final = null; for (const k in meshes) meshes[k].last = null; opts.onChange && opts.onChange(S); },
    destroy() {
      alive = false; cancelAnimationFrame(raf); ro && ro.disconnect(); clearTimeout(msgTimer);
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      pwEl.removeEventListener('pointerdown', pwDown); pwEl.removeEventListener('pointerup', pwUp); pwEl.removeEventListener('pointercancel', pwCancel);
      eyeEl.removeEventListener('click', eye);
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('keydown', arrows);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
      try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch {}
      cv.remove(); ui.remove();
    },
  };
}

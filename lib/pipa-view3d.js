'use client';
// Céu da pipa em 3D (Three.js). A câmera fica parada e enquadra o céu do jogo inteiro na tela:
// a pipa alcança todos os cantos. A física é a do lib/pipa.js (plano de 960 x 540); aqui só desenha.
// Cada jogador é um bonequinho pequeno numa laje: você no meio, os outros nos lados e um lá no fundo.
import { W, GROUND, linePts } from './pipa.js';
import { drawPipa, modelo } from './pipa-arte.js';
import { cenario as achaCenario, pintaCeu, pintaHorizonte, linha as achaLinha, PELES } from './pipa-cenarios.js';

const K = 0.01;                       // 1 pixel do mundo da pipa = 0,01 unidade do 3D
const KITE = 0.8;                    // tamanho da pipa no 3D
const TAIL_N = 16, TAIL_GAP = 8;      // rabiola: pedaços e distância entre eles (pixels do mundo)
const v3 = (THREE, x, y, z = 0) => new THREE.Vector3((x - W / 2) * K, (GROUND - y) * K, z);

function canvasTex(THREE, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}
// horizonte do cenário (casas, praia, morro, campinho), desenhado em lib/pipa-cenarios.js
function horizonteTex(THREE, id) { return canvasTex(THREE, 2048, 256, (g, w, h) => pintaHorizonte(g, w, h, id)); }
function lajeTex(THREE, img, night) {
  return canvasTex(THREE, 512, 128, (g, w, h) => {
    if (img) { g.drawImage(img, 0, 0, img.width, img.height * .5, 0, 0, w, h); g.fillStyle = 'rgba(120,110,100,.35)'; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = '#8a8178'; g.fillRect(0, 0, w, h); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 6);                 // borda da laje
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 6, 2, h); }
    if (night) { g.fillStyle = 'rgba(5,10,30,.6)'; g.fillRect(0, 0, w, h); }
  });
}
function skyTex(THREE, cen) { return canvasTex(THREE, 4, 512, (g, w, h) => pintaCeu(g, w, h, cen)); }
function glowTex(THREE, inner, outer) {
  return canvasTex(THREE, 256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, inner); r.addColorStop(.25, inner); r.addColorStop(.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}
function moonTex(THREE) {
  return canvasTex(THREE, 256, 256, (g, w) => {
    const gl = g.createRadialGradient(128, 128, 40, 128, 128, 128); gl.addColorStop(0, 'rgba(220,230,255,.35)'); gl.addColorStop(1, 'rgba(220,230,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, w);
    g.fillStyle = '#f1f0e4'; g.beginPath(); g.arc(128, 128, 54, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,160,150,.35)'; [[110, 112, 12], [146, 140, 9], [122, 152, 7], [150, 106, 6]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  });
}
function cloudTex(THREE) {
  return canvasTex(THREE, 256, 128, (g) => {
    g.fillStyle = '#fff';
    [[70, 80, 40], [115, 62, 48], [165, 76, 42], [200, 88, 30], [40, 92, 26], [130, 92, 40]].forEach(([x, y, r]) => {
      const gr = g.createRadialGradient(x, y, r * .3, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    });
  });
}

/*
 opts: { THREE, box, models: [id por jogador], cenario, linha, pele (0-3) }
 devolve { draw(G, now), pop(texto, x, y), shake(v), resize(), dispose() }
*/
export function createPipa3D({ THREE, box, models, cenario: cenId, linha: linhaId, pele = 1 }) {
  const cen = achaCenario(cenId), night = !!cen.noite, corLinha = achaLinha(linhaId).cor, corPele = PELES[pele] || PELES[1];
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const cv = renderer.domElement;
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none' });
  box.appendChild(cv);
  const scene = new THREE.Scene();
  scene.background = skyTex(THREE, cen);
  scene.fog = new THREE.Fog(night ? 0x0a1430 : 0xbcdcf5, 40, 120);
  const FOV = 50, TG = Math.tan(FOV / 2 * Math.PI / 180);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 300);
  const disp = [];
  const keep = x => (disp.push(x), x);
  // enquadramento: o que aparece da tela, em pixels do mundo da pipa (a física usa isso como parede)
  const vis = { x0: 12, x1: W - 12, y0: 14 };
  let D = 5, CY = 2.2, aspect = 2;

  /* ---- sol / lua / estrelas ---- */
  const astro = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(night ? moonTex(THREE) : glowTex(THREE, 'rgba(255,253,240,1)', 'rgba(255,252,235,.28)')), transparent: true, depthWrite: false, fog: false })));
  scene.add(astro);
  let stars = null;
  if (night) {
    const N = 600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 140; pos[i * 3 + 1] = -5 + Math.random() * 70; pos[i * 3 + 2] = -70; }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(g, keep(new THREE.PointsMaterial({ color: 0xffffff, size: .25, sizeAttenuation: true, fog: false, transparent: true, opacity: .85 })));
    scene.add(stars);
  }

  /* ---- nuvens ---- */
  const cloudMap = keep(cloudTex(THREE));
  const clouds = Array.from({ length: night ? 5 : 10 }, () => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: cloudMap, transparent: true, depthWrite: false, opacity: night ? .18 : .85, color: night ? 0x8a94b8 : (cen.nuvem || 0xffffff) })));
    s.userData = { v: .003 + Math.random() * .005, z: -25 - Math.random() * 25, fy: .35 + Math.random() * .6, fx: Math.random() * 2 - 1, k: 4 + Math.random() * 6 };
    scene.add(s); return s;
  });

  /* ---- horizonte (bairro, praia...) lá longe e a laje na frente, embaixo da tela ---- */
  const ZR = -45;
  const rua = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: keep(horizonteTex(THREE, cen.id)), transparent: true, depthWrite: false, fog: false })));
  scene.add(rua);
  const lt = keep(lajeTex(THREE, null, night)); lt.wrapS = THREE.RepeatWrapping; lt.repeat.set(6, 1);
  const laje = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: lt })));
  scene.add(laje);

  /* ---- bonequinhos (cada jogador numa laje, segurando a linha) ---- */
  const PELE_BOT = ['#d9a066', '#a8693f', '#f1c7a3', '#6b3f22'];
  function boneco(cor, pele, bone, vira) {
    const t = canvasTex(THREE, 64, 128, (g) => {
      if (vira) { g.translate(64, 0); g.scale(-1, 1); }
      const pl = night ? '#2b3047' : pele, ca = night ? '#20263a' : cor;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(32, 124, 16, 4, 0, 0, 7); g.fill();
      g.fillStyle = night ? '#141826' : '#1f2a44'; g.fillRect(22, 90, 9, 34); g.fillRect(33, 90, 9, 34);      // bermuda e pernas
      g.fillStyle = pl; g.fillRect(23, 106, 7, 16); g.fillRect(34, 106, 7, 16);
      g.fillStyle = ca; g.beginPath(); g.moveTo(18, 52); g.lineTo(46, 52); g.lineTo(44, 94); g.lineTo(20, 94); g.closePath(); g.fill();   // camiseta
      g.strokeStyle = pl; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(42, 56); g.lineTo(54, 30); g.stroke();                  // braço levantado (segura a linha)
      g.beginPath(); g.moveTo(22, 58); g.lineTo(14, 80); g.stroke();                  // outro braço (lata)
      g.fillStyle = '#9aa3ad'; g.fillRect(8, 78, 12, 14); g.fillStyle = corLinhaDe(cor); g.fillRect(8, 81, 12, 3); g.fillRect(8, 86, 12, 3);
      g.fillStyle = pl; g.beginPath(); g.arc(32, 40, 11, 0, 7); g.fill();            // cabeça
      g.fillStyle = night ? '#2a3150' : bone; g.beginPath(); g.arc(32, 36, 11.5, Math.PI, 0); g.fill(); g.fillRect(32, 33, 15, 4);   // boné
    });
    return new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(t), transparent: true, depthWrite: false })));
  }
  const corLinhaDe = () => '#e5e7eb';
  const bonecos = [];   // { sp, h, w, vira, dep }
  function poeBonecos(G) {
    for (let i = 0; i < G.n; i++) {
      if (bonecos[i]) continue;
      const [hx] = G.hands[i], vira = hx > W / 2 && i !== 0, M = modelo(models[i]);
      const sp = boneco(M.c[0], i === 0 ? corPele : PELE_BOT[i % 4], i === 0 ? '#facc15' : '#f8fafc', vira);
      const h = i === 0 ? .78 : .66; sp.scale.set(h / 2, h, 1); scene.add(sp);
      bonecos[i] = { sp, h, vira, dep: (G.handDep && G.handDep[i]) || 0 };
    }
  }
  // posição do bonequinho: a mão levantada fica bem onde a linha começa
  const tmpB = new THREE.Vector3();
  function colocaBoneco(i, G) {
    const b = bonecos[i]; if (!b) return;
    const [hx, hy] = G.hands[i], w = b.h / 2;
    tmpB.copy(v3(THREE, hx, hy));
    tmpB.x -= (b.vira ? -1 : 1) * (54 - 32) / 64 * w; tmpB.y -= (64 - 30) / 128 * b.h;
    deep(tmpB, b.dep); b.sp.position.copy(tmpB);
  }

  /* ---- passarinhos (de dia) ---- */
  const aves = night ? [] : Array.from({ length: 5 }, () => {
    const g = keep(new THREE.BufferGeometry()), pos = new Float32Array(9); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, keep(new THREE.LineBasicMaterial({ color: 0x2a2a33, transparent: true, opacity: .7 })));
    l.frustumCulled = false; scene.add(l);
    return { l, pos, g, x: -20 + Math.random() * 40, fy: .45 + Math.random() * .45, z: -20 - Math.random() * 12, v: .02 + Math.random() * .03, f: Math.random() * 6 };
  });
  let tremor = 0;
  function shake(v = .12) { tremor = Math.max(tremor, v); }

  /* ---- pipas, linhas e rabiolas ---- */
  const tint = night ? 0xc9d2f0 : 0xffffff;
  const kites = models.map((id, i) => {
    const M = modelo(id);
    const map = keep(canvasTex(THREE, 256, 256, (g) => drawPipa(g, id, 240, 8, 8)));
    const grp = new THREE.Group(), mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(KITE, KITE)), keep(new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .4, side: THREE.DoubleSide, color: tint })));
    grp.add(mesh); scene.add(grp);
    const lineGeo = keep(new THREE.BufferGeometry()), linePos = new Float32Array(23 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const line = new THREE.Line(lineGeo, keep(new THREE.LineBasicMaterial({ color: i ? (night ? 0xaab4d0 : 0x2b3445) : corLinha, transparent: true, opacity: .95 })));
    line.frustumCulled = false; scene.add(line);
    const tailGeo = keep(new THREE.BufferGeometry()), tailPos = new Float32Array(TAIL_N * 3);
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
    const tailLine = new THREE.Line(tailGeo, keep(new THREE.LineBasicMaterial({ color: M.rab[0] })));
    tailLine.frustumCulled = false; scene.add(tailLine);
    const ribbonGeo = keep(new THREE.PlaneGeometry(.12, .035));
    const ribbons = Array.from({ length: TAIL_N / 2 }, (_, j) => { const r = new THREE.Mesh(ribbonGeo, keep(new THREE.MeshBasicMaterial({ color: M.rab[j % 2], side: THREE.DoubleSide }))); scene.add(r); return r; });
    return { grp, mesh, line, linePos, lineGeo, tailLine, tailPos, tailGeo, ribbons, tail: [] };
  });

  /* ---- faíscas onde as linhas se cruzam ---- */
  const SP = 90, spPos = new Float32Array(SP * 3), sparks = Array.from({ length: SP }, () => ({ life: 0 }));
  const spGeo = keep(new THREE.BufferGeometry()); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const spPts = new THREE.Points(spGeo, keep(new THREE.PointsMaterial({ color: 0xffe08a, size: .07, transparent: true, depthWrite: false })));
  spPts.frustumCulled = false; scene.add(spPts);
  const ring = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(glowTex(THREE, 'rgba(255,245,200,.9)', 'rgba(255,200,80,.35)')), transparent: true, depthWrite: false })));
  ring.scale.setScalar(.5); ring.visible = false; scene.add(ring);

  /* ---- textos que sobem (CORTOU!, APAROU!) ---- */
  const pops = [];
  function pop(text, x, y) {
    const el = document.createElement('div'); el.textContent = text;
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', font: '700 40px Oswald, Rubik, sans-serif', color: '#fde68a', textShadow: '0 0 6px #000, 0 2px 0 #3a1b04', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', zIndex: 3 });
    box.appendChild(el); pops.push({ el, p: v3(THREE, x, Math.max(vis.y0 + 40, y - 20)), t: 0 });
  }

  // câmera parada, olhando reto: o chão do jogo (laje) fica na borda de baixo e o céu do jogo ocupa a tela inteira
  function enquadra() {
    const hw = W / 2 * K, hgt = GROUND * K;
    D = Math.min(hw / (TG * aspect), hgt / (2 * TG));
    const hh = D * TG; CY = hh - .03;
    camera.position.set(0, CY, D); camera.lookAt(0, CY, 0); camera.updateMatrixWorld();
    const meiaL = hh * aspect / K;
    vis.x0 = Math.max(12, W / 2 - meiaL + 12); vis.x1 = Math.min(W - 12, W / 2 + meiaL - 12); vis.y0 = Math.max(14, GROUND - (CY + hh) / K + 14);
    // horizonte: faixa de baixo (uns 30% da tela), bem longe
    const dr = D - ZR, hr = dr * TG;
    rua.scale.set(2 * hr * aspect * 1.05, 2 * hr * .34, 1); rua.position.set(0, CY - hr + hr * .34 - hr * .02, ZR);
    // laje na frente: faixa fininha embaixo
    const dl = D + .6, hl = dl * TG;
    laje.scale.set(2 * hl * aspect * 1.05, hl * .17, 1); laje.position.set(0, CY - hl + hl * .085, -.6);
    // sol / lua e estrelas em relação à tela
    const da = D + 60, ha = da * TG;
    if (cen.astro === 'solbaixo') { astro.position.set(ha * aspect * .45, CY - ha * .25, -60); astro.scale.setScalar(ha * .5); astro.material.color.set(0xffc27a); }
    else if (night) { astro.position.set(-ha * aspect * .55, CY + ha * .6, -60); astro.scale.setScalar(ha * .16); }
    else { astro.position.set(ha * aspect * .55, CY + ha * .62, -60); astro.scale.setScalar(ha * .3); }
    for (const c of clouds) { const u = c.userData, dc = D - u.z, hc = dc * TG; c.position.set(u.fx * hc * aspect, CY - hc + 2 * hc * u.fy, u.z); c.scale.set(u.k * 2, u.k, 1); c.userData.lim = hc * aspect + u.k; }
    for (const a of aves) { const hc = (D - a.z) * TG; a.y = CY - hc + 2 * hc * a.fy; a.lim = hc * aspect + 1; }
  }
  function resize() {
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); aspect = r.width / r.height; camera.aspect = aspect; camera.updateProjectionMatrix();
    enquadra();
  }
  resize();

  const tmp = new THREE.Vector3();
  // profundidade: empurra o ponto pra longe ao longo do olhar da câmera (mesmo lugar na tela, só menor e mais longe)
  const PROF = 3.2;
  const deep = (v, d) => (d > 0 ? v.sub(camera.position).multiplyScalar(1 + d * PROF).add(camera.position) : v);

  function tailStep(G, k, T, end) {
    if (!T.length) for (let j = 0; j < TAIL_N; j++) T.push({ x: end[0], y: end[1] + j * TAIL_GAP });
    T[0].x = end[0]; T[0].y = end[1];
    for (let j = 1; j < T.length; j++) {
      const p = T[j], q = T[j - 1];
      p.x += G.wind * 1.1 + Math.sin((G.t + j * 9) / (8 - Math.min(4, Math.abs(G.wind) * 3))) * (.6 + Math.abs(G.wind) * .9); p.y += 1.4;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
      p.x = q.x + dx / d * TAIL_GAP; p.y = q.y + dy / d * TAIL_GAP;
    }
  }

  function draw(G, now) {
    G.vis = vis;
    if (G.phase === 'ready' && G.phaseT >= 89) kites.forEach(k => { k.tail.length = 0; });
    camera.position.set(0, CY, D);
    if (tremor > .002) { camera.position.x += (Math.random() - .5) * tremor; camera.position.y += (Math.random() - .5) * tremor; tremor *= .9; }
    camera.updateMatrixWorld();
    poeBonecos(G);
    for (let i = 0; i < G.n; i++) colocaBoneco(i, G);
    for (const c of clouds) { c.position.x += c.userData.v + G.wind * .002; if (c.position.x > c.userData.lim) c.position.x = -c.userData.lim; }
    for (const a of aves) {
      a.x += a.v + G.wind * .004; if (a.x > a.lim) a.x = -a.lim;
      const bat = Math.sin(now / 120 + a.f) * .18;
      a.pos.set([a.x - .35, a.y + bat, a.z, a.x, a.y, a.z, a.x + .35, a.y + bat, a.z]); a.g.attributes.position.needsUpdate = true;
    }

    for (let i = 0; i < G.n; i++) {
      const k = G.k[i], o = kites[i]; if (!o) continue;
      const hd = (G.handDep && G.handDep[i]) || 0;
      const off = k.y > GROUND + 80;
      o.grp.visible = !off; o.tailLine.visible = !off; o.ribbons.forEach(r => (r.visible = !off));
      // linha: da mão do bonequinho até a pipa (a profundidade vai da dele até a da pipa)
      const L = linePts(G, i, 22);
      if (L.length) {
        L.forEach(([x, y], j) => { const t = j / 22; tmp.copy(v3(THREE, x, y)); deep(tmp, hd * (1 - t) + k.dep * t); o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3); });
        o.line.visible = true; o.lineGeo.attributes.position.needsUpdate = true; o.lineGeo.setDrawRange(0, L.length);
      } else {   // cortada: pedaço de linha caindo da mão
        const [hx, hy] = G.hands[i], d = hx < W / 2 ? 1 : -1;
        [[0, 0], [14 * d, 10], [22 * d, 28]].forEach(([dx, dy], j) => { tmp.copy(v3(THREE, hx + dx, hy + dy)); deep(tmp, hd); o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3); });
        o.lineGeo.attributes.position.needsUpdate = true; o.lineGeo.setDrawRange(0, 3);
      }
      if (off) continue;
      const p = deep(v3(THREE, k.x, k.y), k.dep);
      o.grp.position.copy(p);
      o.grp.rotation.z = Math.atan2(-Math.sin(k.a), Math.cos(k.a)) - Math.PI / 2;
      // treme no vento: mais longe e com a linha frouxa, treme mais
      const [hx0, hy0] = G.hands[i], frouxa = Math.min(1, Math.max(0, (k.L - Math.hypot(k.x - hx0, k.y - hy0)) / 120));
      const tr = (k.cut ? .9 : k.pull ? .18 : .4) + k.dep * .35 + frouxa * .3 + Math.abs(G.wind) * .15;
      o.mesh.rotation.y = Math.sin(now / 260 + i * 2) * tr + Math.sin(now / 47 + i) * tr * .15;
      o.mesh.rotation.x = -.25 + Math.sin(now / 410 + i) * (.12 + tr * .1);
      o.grp.rotation.z += Math.sin(now / 83 + i * 3) * tr * .08;
      const tail = [k.x - Math.cos(k.a) * 26, k.y - Math.sin(k.a) * 26];
      if (k.presa && k.presa.ax != null) {        // aparada: a rabiola vai da pipa até a linha de quem aparou
        if (!o.tail.length) for (let j = 0; j < TAIL_N; j++) o.tail.push({ x: 0, y: 0 });
        o.tail.forEach((q, j) => { const t = j / (TAIL_N - 1); q.x = tail[0] + (k.presa.ax - tail[0]) * t; q.y = tail[1] + (k.presa.ay - tail[1]) * t + Math.sin(t * Math.PI) * 5; });
      } else tailStep(G, k, o.tail, tail);
      o.tail.forEach((q, j) => { tmp.copy(v3(THREE, q.x, q.y, -.01)); deep(tmp, k.dep); o.tailPos.set([tmp.x, tmp.y, tmp.z], j * 3); });
      o.tailGeo.attributes.position.needsUpdate = true;
      o.ribbons.forEach((r, j) => { const q = o.tail[j * 2 + 1]; r.position.copy(deep(v3(THREE, q.x, q.y, -.005), k.dep)); r.rotation.z = Math.sin((G.t + j * 7) / (6 - Math.min(3, Math.abs(G.wind) * 2))) * (.6 + Math.abs(G.wind) * .5); });
    }

    // faíscas nos cruzamentos
    const cs = G.crosses || [];
    const ponto = c => deep(v3(THREE, c.p[0], c.p[1]), (G.k[c.a].dep + G.k[c.b].dep) * .3);
    for (const c of cs) for (let n = 0; n < 2; n++) {
      const s = sparks.find(q => q.life <= 0); if (!s) break;
      const a = Math.random() * 6.3, v = .01 + Math.random() * .025, cp = ponto(c);
      Object.assign(s, { life: 1, x: cp.x, y: cp.y, z: cp.z, vx: Math.cos(a) * v, vy: Math.sin(a) * v + .01 });
    }
    sparks.forEach((s, j) => {
      if (s.life > 0) { s.x += s.vx; s.y += s.vy; s.vy -= .0012; s.life -= .045; spPos.set([s.x, s.y, s.z], j * 3); }
      else spPos.set([0, -99, 0], j * 3);
    });
    spGeo.attributes.position.needsUpdate = true;
    ring.visible = cs.length > 0;
    if (cs.length) { ring.position.copy(ponto(cs[0])); ring.scale.setScalar(.35 + Math.sin(now / 70) * .08); }

    renderer.render(scene, camera);

    const r = box.getBoundingClientRect();
    for (let j = pops.length - 1; j >= 0; j--) {
      const q = pops[j]; q.t += 1 / 60; q.p.y += .006;
      tmp.copy(q.p).project(camera);
      q.el.style.left = ((tmp.x + 1) / 2 * r.width) + 'px'; q.el.style.top = ((1 - tmp.y) / 2 * r.height) + 'px';
      q.el.style.opacity = String(Math.max(0, 1 - Math.max(0, q.t - 1.4) / .8));
      if (q.t > 2.2) { q.el.remove(); pops.splice(j, 1); }
    }
  }

  function dispose() {
    pops.forEach(q => q.el.remove());
    disp.forEach(x => { try { x.dispose(); } catch {} });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch {}
    cv.remove();
  }
  return { draw, pop, shake, resize, dispose, canvas: cv, setFoto() {} };
}

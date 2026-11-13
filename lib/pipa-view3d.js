'use client';
// Céu da pipa em 3D (Three.js), com a câmera em cima da laje olhando pro céu.
// A física é a mesma do lib/pipa.js (um plano de 960 x 540): esta tela só desenha.
// No fundo fica a foto da rua do Jd. Guaracy; dá pra jogar de dia ou de noite.
import { W, H, GROUND, linePts } from './pipa.js';
import { drawPipa, modelo } from './pipa-arte.js';
import { cenario as achaCenario, pintaCeu, pintaHorizonte, linha as achaLinha, PELES } from './pipa-cenarios.js';

const K = 0.01;                       // 1 pixel do mundo da pipa = 0,01 unidade do 3D
const KITE = 0.8;                    // tamanho da pipa no 3D
const TAIL_N = 16, TAIL_GAP = 8;      // rabiola: pedaços e distância entre eles (pixels do mundo)
const ZH = i => (i === 0 ? 1.7 : -0.6 - (i % 3) * 0.5);   // profundidade da mão de cada um (você mais perto)
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
 opts: { THREE, box, models: [id por jogador], cenario, linha, pele (0-3), foto: { chao } }
 devolve { draw(G, now), pop(texto, x, y), resize(), dispose() }
*/
export function createPipa3D({ THREE, box, models, cenario: cenId, linha: linhaId, pele = 1, foto = {} }) {
  const cen = achaCenario(cenId), night = !!cen.noite, corLinha = achaLinha(linhaId).cor, corPele = PELES[pele] || PELES[1];
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const cv = renderer.domElement;
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none', borderRadius: '14px' });
  box.appendChild(cv);
  const scene = new THREE.Scene();
  scene.background = skyTex(THREE, cen);
  scene.fog = new THREE.Fog(night ? 0x0a1430 : 0xbcdcf5, 30, 90);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 200);
  const look = new THREE.Vector3(0, 1.7, 0);
  const disp = [];   // tudo que precisa ser liberado no fim
  const keep = x => (disp.push(x), x);

  /* ---- sol / lua / estrelas ---- */
  const astro = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(night ? moonTex(THREE) : glowTex(THREE, 'rgba(255,253,240,1)', 'rgba(255,252,235,.28)')), transparent: true, depthWrite: false, fog: false })));
  if (cen.astro === 'solbaixo') { astro.position.set(18, 8, -50); astro.scale.setScalar(20); astro.material.color.set(0xffc27a); }
  else { astro.position.set(night ? -14 : 20, night ? 22 : 26, -50); astro.scale.setScalar(night ? 9 : 12); } scene.add(astro);
  if (night) {
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, e = .08 + Math.random() * 1.3, r = 70; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = -Math.abs(Math.sin(a) * Math.cos(e) * r) - 10; }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, keep(new THREE.PointsMaterial({ color: 0xffffff, size: .22, sizeAttenuation: true, fog: false, transparent: true, opacity: .85 }))));
  }

  /* ---- nuvens ---- */
  const cloudMap = keep(cloudTex(THREE));
  const clouds = Array.from({ length: night ? 5 : 9 }, () => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: cloudMap, transparent: true, depthWrite: false, opacity: night ? .18 : .85, color: night ? 0x8a94b8 : (cen.nuvem || 0xffffff) })));
    const z = -18 - Math.random() * 25; s.position.set(-25 + Math.random() * 50, 5 + Math.random() * 12, z); const k = 4 + Math.random() * 6; s.scale.set(k * 2, k, 1);
    s.userData.v = .002 + Math.random() * .004; scene.add(s); return s;
  });

  /* ---- a rua (foto) lá no fundo e a laje na frente ---- */
  let rua = null, laje = null;
  function cenario() {
    if (rua) { scene.remove(rua); } if (laje) { scene.remove(laje); }
    rua = new THREE.Mesh(keep(new THREE.PlaneGeometry(64, 8)), keep(new THREE.MeshBasicMaterial({ map: keep(horizonteTex(THREE, cen.id)), transparent: true, depthWrite: false, fog: false })));
    rua.position.set(0, -0.6, -16); scene.add(rua);
    const lt = keep(lajeTex(THREE, foto.chao, night)); lt.wrapS = THREE.RepeatWrapping; lt.repeat.set(4, 1);
    laje = new THREE.Mesh(keep(new THREE.PlaneGeometry(30, 1.6)), keep(new THREE.MeshBasicMaterial({ map: lt })));
    laje.position.set(0, -1.6, 2.6); scene.add(laje);
  }
  cenario();
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

  /* ---- suas mãos (em primeira pessoa): uma segura a linha, a outra a lata ---- */
  const mao = document.createElement('canvas');
  Object.assign(mao.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, borderRadius: '14px' });
  box.appendChild(mao);
  const mg = mao.getContext('2d');
  const manga = modelo(models[0]).c[0];
  let puxa = 0, maoDpr = 1;   // puxa: 0 = parada, 1 = mexendo (suavizado)
  const maoTela = (w, h) => [w * .58, h * (.86 + puxa * .03) + Math.sin(performance.now() / 45) * puxa * 1.2];
  const lataTela = (w, h) => [w * .44, h * .93];
  const hand3D = new THREE.Vector3(), ndc = new THREE.Vector3();

  /* ---- textos que sobem (CORTOU!, CAIU!) ---- */
  const pops = [];
  function pop(text, x, y) {
    const el = document.createElement('div'); el.textContent = text;
    Object.assign(el.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', font: '700 40px Oswald, Rubik, sans-serif', color: '#fde68a', textShadow: '0 0 6px #000, 0 2px 0 #3a1b04', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', zIndex: 3 });
    box.appendChild(el); pops.push({ el, p: v3(THREE, x, y - 20), t: 0 });
  }

  function resize() {
    const r = box.getBoundingClientRect(); if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height;
    camera.fov = camera.aspect < 1.2 ? 72 : 56; camera.updateProjectionMatrix();
    maoDpr = Math.min(2, window.devicePixelRatio || 1); mao.width = r.width * maoDpr; mao.height = r.height * maoDpr;
  }
  resize();

  const tmp = new THREE.Vector3();
  // um ponto da linha i no 3D: a profundidade vai da mão (ZH) até a pipa (0)
  const lineZ = (i, t) => ZH(i) * (1 - t);
  // a mão fica abaixo da tela (quem empina está na laje, embaixo de você): a linha vai baixando até lá
  const HAND_DROP = -2.6;
  const lineY = t => HAND_DROP * (1 - t) * (1 - t);

  function tailStep(G, k, T, end) {
    if (!T.length) for (let j = 0; j < TAIL_N; j++) T.push({ x: end[0], y: end[1] + j * TAIL_GAP });
    T[0].x = end[0]; T[0].y = end[1];
    for (let j = 1; j < T.length; j++) {
      const p = T[j], q = T[j - 1];
      p.x += G.wind * .7 + Math.sin((G.t + j * 9) / 8) * .6; p.y += 1.4;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1;
      p.x = q.x + dx / d * TAIL_GAP; p.y = q.y + dy / d * TAIL_GAP;
    }
  }

  function draw(G, now) {
    if (G.phase === 'ready' && G.phaseT >= 89) kites.forEach(k => { k.tail.length = 0; });
    // câmera: atrás da sua mão, olhando pro céu e seguindo a sua pipa de leve
    const me = G.k[0], hand = G.hands[0];
    const camX = (hand[0] - W / 2) * K * .45;
    camera.position.set(camX + (me.cut ? 0 : ((me.x - W / 2) * K - camX) * .12), -.45, 4.8);
    const tx = me.cut ? 0 : (me.x - W / 2) * K * .45, ty = me.cut ? 1.6 : Math.max(1.2, Math.min(2.5, (GROUND - me.y) * K * .6 + .5));
    look.x += (tx - look.x) * .05; look.y += (ty - look.y) * .05;
    camera.lookAt(look); camera.updateMatrixWorld();
    // ponto da sua mão no 3D: bem na frente da câmera, onde a mão aparece na tela
    puxa += ((me.pull && !me.cut ? 1 : 0) - puxa) * .25;
    { const bw = mao.width || 1, bh = mao.height || 1, [mx, my] = maoTela(bw, bh);
      ndc.set(mx / bw * 2 - 1, -(my / bh * 2 - 1) + .02, .5).unproject(camera).sub(camera.position).normalize();
      hand3D.copy(camera.position).addScaledVector(ndc, 1.2); }

    for (const c of clouds) { c.position.x += c.userData.v + G.wind * .002; if (c.position.x > 30) c.position.x = -30; }

    for (let i = 0; i < G.n; i++) {
      const k = G.k[i], o = kites[i]; if (!o) continue;
      const off = k.y > GROUND + 80;
      o.grp.visible = !off; o.tailLine.visible = !off; o.ribbons.forEach(r => (r.visible = !off));
      // linha
      const L = linePts(G, i, 22);
      if (L.length) {
        const b0 = i === 0 ? v3(THREE, L[0][0], L[0][1], lineZ(0, 0)) : null;
        L.forEach(([x, y], j) => {
          const t = j / 22; tmp.copy(v3(THREE, x, y, lineZ(i, t)));
          if (i === 0) { const f = (1 - t) * (1 - t); tmp.x += (hand3D.x - b0.x) * f; tmp.y += (hand3D.y - b0.y) * f; tmp.z += (hand3D.z - b0.z) * f; }
          else tmp.y += lineY(t);
          o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3);
        });
        o.line.visible = true; o.lineGeo.attributes.position.needsUpdate = true; o.lineGeo.setDrawRange(0, L.length);
      } else {   // cortada: pedaço de linha caindo da mão
        const [hx, hy] = G.hands[i], d = hx < W / 2 ? 1 : -1;
        [[0, 0], [30 * d, 10], [55 * d, 30]].forEach(([dx, dy], j) => {
          if (i === 0) tmp.set(hand3D.x + dx * .002, hand3D.y - dy * .004, hand3D.z);
          else { tmp.copy(v3(THREE, hx + dx, hy + dy, ZH(i))); tmp.y += HAND_DROP; }
          o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3);
        });
        o.lineGeo.attributes.position.needsUpdate = true; o.lineGeo.setDrawRange(0, 3);
      }
      if (off) continue;
      // pipa: bico pra onde aponta (no plano do jogo, o y cresce pra baixo)
      const p = v3(THREE, k.x, k.y);
      o.grp.position.copy(p);
      o.grp.rotation.z = Math.atan2(-Math.sin(k.a), Math.cos(k.a)) - Math.PI / 2;
      o.mesh.rotation.y = Math.sin(now / 260 + i * 2) * (k.pull ? .18 : .45);
      o.mesh.rotation.x = -.25 + Math.sin(now / 410 + i) * .12;
      // rabiola: sai do rabo da pipa
      const tail = [k.x - Math.cos(k.a) * 26, k.y - Math.sin(k.a) * 26];
      tailStep(G, k, o.tail, tail);
      o.tail.forEach((q, j) => { tmp.copy(v3(THREE, q.x, q.y, -.01)); o.tailPos.set([tmp.x, tmp.y, tmp.z], j * 3); });
      o.tailGeo.attributes.position.needsUpdate = true;
      o.ribbons.forEach((r, j) => { const q = o.tail[j * 2 + 1]; r.position.copy(v3(THREE, q.x, q.y, -.005)); r.rotation.z = Math.sin((G.t + j * 7) / 6) * .6; });
    }

    // faíscas nos cruzamentos
    const cs = G.crosses || [];
    for (const c of cs) for (let n = 0; n < 2; n++) {
      const s = sparks.find(q => q.life <= 0); if (!s) break;
      const a = Math.random() * 6.3, v = .01 + Math.random() * .025;
      Object.assign(s, { life: 1, x: (c.p[0] - W / 2) * K, y: (GROUND - c.p[1]) * K, z: (lineZ(c.a, .7) + lineZ(c.b, .7)) / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v + .01 });
    }
    sparks.forEach((s, j) => {
      if (s.life > 0) { s.x += s.vx; s.y += s.vy; s.vy -= .0012; s.life -= .045; spPos.set([s.x, s.y, s.z], j * 3); }
      else spPos.set([0, -99, 0], j * 3);
    });
    spGeo.attributes.position.needsUpdate = true;
    ring.visible = cs.length > 0;
    if (cs.length) { const c = cs[0]; ring.position.set((c.p[0] - W / 2) * K, (GROUND - c.p[1]) * K, (lineZ(c.a, .7) + lineZ(c.b, .7)) / 2); ring.scale.setScalar(.35 + Math.sin(now / 70) * .08); }

    renderer.render(scene, camera);
    desenhaMaos();

    // textos por cima
    const r = box.getBoundingClientRect();
    for (let j = pops.length - 1; j >= 0; j--) {
      const q = pops[j]; q.t += 1 / 60; q.p.y += .006;
      tmp.copy(q.p).project(camera);
      q.el.style.left = ((tmp.x + 1) / 2 * r.width) + 'px'; q.el.style.top = ((1 - tmp.y) / 2 * r.height) + 'px';
      q.el.style.opacity = String(Math.max(0, 1 - Math.max(0, q.t - 1.4) / .8));
      if (q.t > 2.2) { q.el.remove(); pops.splice(j, 1); }
    }
  }

  function desenhaMaos() {
    const w = mao.width, h = mao.height; if (!w) return;
    const g = mg, s = h / maoDpr / 620 * maoDpr, [mx, my] = maoTela(w, h), [lx, ly] = lataTela(w, h);
    g.clearRect(0, 0, w, h); g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const sombra = 'rgba(0,0,0,.22)';
    // braço: pele até o pulso, manga da camiseta (cor da sua pipa) cobrindo de baixo
    const braco = (x0, y0, x1, y1) => {
      const sx = x1 + (x0 - x1) * .5, sy = y1 + (y0 - y1) * .5;
      g.strokeStyle = sombra; g.lineWidth = 44 * s; g.beginPath(); g.moveTo(x0 + 6 * s, y0); g.lineTo(x1 + 6 * s, y1 + 6 * s); g.stroke();
      g.strokeStyle = corPele; g.lineWidth = 38 * s; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = manga; g.lineWidth = 60 * s; g.beginPath(); g.moveTo(x0, y0 + 40 * s); g.lineTo(sx, sy); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(sx - 26 * s, sy + 6 * s); g.lineTo(sx + 26 * s, sy - 6 * s); g.stroke();
    };
    const rr = (x, y, ww, hh, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh); };
    // linha saindo da lata até a mão
    g.strokeStyle = corLinha; g.lineWidth = Math.max(1, 1.4 * s); g.beginPath(); g.moveTo(lx + 8 * s, ly - 34 * s); g.quadraticCurveTo((lx + mx) / 2, (ly + my) / 2 + 40 * s, mx + 2 * s, my + 6 * s); g.stroke();
    // mão esquerda segurando a lata
    braco(lx - 90 * s, h + 40 * s, lx - 26 * s, ly + 18 * s);
    g.fillStyle = '#8f98a3'; g.fillRect(lx - 28 * s, ly - 34 * s, 56 * s, 66 * s);
    g.fillStyle = corLinha; for (let k = 0; k < 9; k++) g.fillRect(lx - 28 * s, ly - 27 * s + k * 6 * s, 56 * s, 3.6 * s);
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(lx - 22 * s, ly - 34 * s, 7 * s, 66 * s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(lx + 16 * s, ly - 34 * s, 12 * s, 66 * s);
    g.fillStyle = '#cfd6dd'; g.beginPath(); g.ellipse(lx, ly - 34 * s, 28 * s, 7 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#5b636e'; g.beginPath(); g.ellipse(lx, ly - 34 * s, 20 * s, 4.5 * s, 0, 0, 7); g.fill();
    g.fillStyle = corPele; g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.6 * s;
    rr(lx - 40 * s, ly - 10 * s, 26 * s, 40 * s, 10 * s); g.fill();
    for (let k = 0; k < 4; k++) { rr(lx - 26 * s, ly - 14 * s + k * 11 * s, 22 * s, 11 * s, 5.5 * s); g.fill(); g.stroke(); }
    // mão direita: punho fechado com a linha passando
    braco(mx + 90 * s, h + 40 * s, mx + 14 * s, my + 30 * s);
    g.save(); g.translate(mx, my); g.rotate(-.3 + puxa * .18);
    g.fillStyle = corPele; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.8 * s;
    rr(-22 * s, -8 * s, 46 * s, 42 * s, 12 * s); g.fill(); g.stroke();                     // costas da mão
    for (let k = 0; k < 4; k++) { rr(-22 * s + k * 11.5 * s, -20 * s, 12 * s, 18 * s, 6 * s); g.fill(); g.stroke(); }   // dedos dobrados
    g.strokeStyle = corLinha; g.lineWidth = Math.max(1, 1.4 * s); g.beginPath(); g.moveTo(2 * s, -22 * s); g.lineTo(2 * s, 30 * s); g.stroke();
    g.fillStyle = corPele; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.8 * s;
    g.beginPath(); g.ellipse(-16 * s, 6 * s, 9 * s, 19 * s, -.9, 0, 7); g.fill(); g.stroke();   // dedão por cima
    g.fillStyle = 'rgba(255,255,255,.16)'; rr(-18 * s, -18 * s, 38 * s, 5 * s, 2.5 * s); g.fill();
    g.restore();
    if (night) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(8,14,40,.5)'; g.fillRect(0, 0, w, h); }
    else if (cen.id === 'tarde') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,120,60,.15)'; g.fillRect(0, 0, w, h); }
    g.restore();
  }

  function dispose() {
    mao.remove();
    pops.forEach(q => q.el.remove());
    disp.forEach(x => { try { x.dispose(); } catch {} });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch {}
    cv.remove();
  }
  return { draw, pop, resize, dispose, canvas: cv, setFoto(f) { Object.assign(foto, f); cenario(); } };
}

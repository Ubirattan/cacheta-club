'use client';
// Céu da pipa em 3D (Three.js), com a câmera em cima da laje olhando pro céu.
// A física é a mesma do lib/pipa.js (um plano de 960 x 540): esta tela só desenha.
// No fundo fica a foto da rua do Jd. Guaracy; dá pra jogar de dia ou de noite.
import { W, H, GROUND, linePts } from './pipa.js';
import { drawPipa, modelo } from './pipa-arte.js';

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
// bairro lá no fundo: casas, lajes, caixas d'água, postes e fios, desenhados (sem foto)
// largura 2048 x altura 256; a parte de baixo é toda preenchida (fica atrás da laje)
function bairroTex(THREE, night) {
  return canvasTex(THREE, 2048, 256, (g, w, h) => {
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const cores = night ? ['#2a2f45', '#2f3550', '#262b3f', '#34324a', '#2b3348']
      : ['#c98f6b', '#e3d3b8', '#b5654a', '#d9b98c', '#9fb7c9', '#e8c97a', '#c7c0b4', '#a8735a'];
    // fileira de trás (mais apagada) e da frente
    for (const [base, alt, fade] of [[h * .55, 70, .55], [h * .72, 95, 1]]) {
      let x = -20;
      while (x < w + 20) {
        const cw = 60 + r() * 110, ch = 30 + r() * alt, top = base - ch;
        g.globalAlpha = fade;
        g.fillStyle = cores[(r() * cores.length) | 0]; g.fillRect(x, top, cw, h - top);
        g.fillStyle = night ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.12)'; g.fillRect(x + cw - 6, top, 6, h - top);   // sombra
        g.fillStyle = night ? '#1a1d2b' : 'rgba(90,80,70,.55)'; g.fillRect(x - 2, top - 4, cw + 4, 5);            // beiral da laje
        // janelas
        for (let wy = top + 12; wy < base - 10; wy += 26) for (let wx = x + 10; wx < x + cw - 18; wx += 30) {
          if (r() < .35) continue;
          const aceso = night && r() < .55;
          g.fillStyle = aceso ? '#ffd98a' : night ? '#141826' : 'rgba(40,50,60,.55)'; g.fillRect(wx, wy, 12, 12);
        }
        // caixa d'água azul / antena
        if (r() < .55) { const cx = x + 10 + r() * (cw - 40); g.fillStyle = night ? '#2a4a7a' : '#2f6fb0'; g.fillRect(cx, top - 16, 24, 13); g.fillStyle = night ? '#335a90' : '#4b8bd0'; g.fillRect(cx - 2, top - 19, 28, 4); }
        if (r() < .35) { const ax = x + 8 + r() * (cw - 16); g.strokeStyle = night ? '#111' : '#444'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, top - 4); g.lineTo(ax, top - 30); g.moveTo(ax - 8, top - 24); g.lineTo(ax + 8, top - 24); g.stroke(); }
        x += cw + (r() < .2 ? 6 : 0);
      }
    }
    g.globalAlpha = 1;
    // postes e fios na altura dos telhados
    const postes = []; for (let x = 90; x < w; x += 300 + r() * 120) postes.push(x);
    g.strokeStyle = night ? '#0b0d16' : '#3a3530'; g.lineWidth = 6;
    postes.forEach(x => { g.beginPath(); g.moveTo(x, h); g.lineTo(x, h * .18); g.stroke(); g.fillStyle = g.strokeStyle; g.fillRect(x - 18, h * .2, 36, 5); });
    g.lineWidth = 1.6;
    for (const dy of [0, 8]) for (let j = 1; j < postes.length; j++) {
      const a = postes[j - 1], b = postes[j], y = h * .2 + dy;
      g.beginPath(); g.moveTo(a, y); g.quadraticCurveTo((a + b) / 2, y + 22, b, y); g.stroke();
    }
    if (night) { g.fillStyle = 'rgba(8,14,40,.35)'; g.fillRect(0, 0, w, h); }
  });
}
function lajeTex(THREE, img, night) {
  return canvasTex(THREE, 512, 128, (g, w, h) => {
    if (img) { g.drawImage(img, 0, 0, img.width, img.height * .5, 0, 0, w, h); g.fillStyle = 'rgba(120,110,100,.35)'; g.fillRect(0, 0, w, h); }
    else { g.fillStyle = '#8a8178'; g.fillRect(0, 0, w, h); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 6);                 // borda da laje
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 6, 2, h); }
    if (night) { g.fillStyle = 'rgba(5,10,30,.6)'; g.fillRect(0, 0, w, h); }
  });
}
function skyTex(THREE, night) {
  return canvasTex(THREE, 4, 512, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h);
    if (night) { s.addColorStop(0, '#02040c'); s.addColorStop(.55, '#0a1838'); s.addColorStop(.85, '#1d2c55'); s.addColorStop(1, '#3a3f66'); }
    else { s.addColorStop(0, '#1f5fae'); s.addColorStop(.5, '#5d9fe0'); s.addColorStop(.82, '#a9d3f3'); s.addColorStop(1, '#f6d9ae'); }
    g.fillStyle = s; g.fillRect(0, 0, w, h);
  });
}
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
 opts: { THREE, box, models: [id por jogador], night, foto: { fundo: Image|null, chao: Image|null } }
 devolve { draw(G, now), pop(texto, x, y), resize(), dispose() }
*/
export function createPipa3D({ THREE, box, models, night, foto = {} }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const cv = renderer.domElement;
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none', borderRadius: '14px' });
  box.appendChild(cv);
  const scene = new THREE.Scene();
  scene.background = skyTex(THREE, night);
  scene.fog = new THREE.Fog(night ? 0x0a1430 : 0xbcdcf5, 30, 90);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 200);
  const look = new THREE.Vector3(0, 1.7, 0);
  const disp = [];   // tudo que precisa ser liberado no fim
  const keep = x => (disp.push(x), x);

  /* ---- sol / lua / estrelas ---- */
  const astro = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(night ? moonTex(THREE) : glowTex(THREE, 'rgba(255,253,240,1)', 'rgba(255,252,235,.28)')), transparent: true, depthWrite: false, fog: false })));
  astro.position.set(night ? -14 : 20, night ? 22 : 26, -50); astro.scale.setScalar(night ? 9 : 12); scene.add(astro);
  if (night) {
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, e = .08 + Math.random() * 1.3, r = 70; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = -Math.abs(Math.sin(a) * Math.cos(e) * r) - 10; }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, keep(new THREE.PointsMaterial({ color: 0xffffff, size: .22, sizeAttenuation: true, fog: false, transparent: true, opacity: .85 }))));
  }

  /* ---- nuvens ---- */
  const cloudMap = keep(cloudTex(THREE));
  const clouds = Array.from({ length: night ? 5 : 9 }, () => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: cloudMap, transparent: true, depthWrite: false, opacity: night ? .18 : .85, color: night ? 0x8a94b8 : 0xffffff })));
    const z = -18 - Math.random() * 25; s.position.set(-25 + Math.random() * 50, 5 + Math.random() * 12, z); const k = 4 + Math.random() * 6; s.scale.set(k * 2, k, 1);
    s.userData.v = .002 + Math.random() * .004; scene.add(s); return s;
  });

  /* ---- a rua (foto) lá no fundo e a laje na frente ---- */
  let rua = null, laje = null;
  function cenario() {
    if (rua) { scene.remove(rua); } if (laje) { scene.remove(laje); }
    rua = new THREE.Mesh(keep(new THREE.PlaneGeometry(64, 8)), keep(new THREE.MeshBasicMaterial({ map: keep(bairroTex(THREE, night)), transparent: true, depthWrite: false, fog: false })));
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
    const line = new THREE.Line(lineGeo, keep(new THREE.LineBasicMaterial({ color: night ? (i ? 0xaab4d0 : 0xffe9b0) : (i ? 0x2b3445 : 0x3b1a05), transparent: true, opacity: .95 })));
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
    camera.lookAt(look);

    for (const c of clouds) { c.position.x += c.userData.v + G.wind * .002; if (c.position.x > 30) c.position.x = -30; }

    for (let i = 0; i < G.n; i++) {
      const k = G.k[i], o = kites[i]; if (!o) continue;
      const off = k.y > GROUND + 80;
      o.grp.visible = !off; o.tailLine.visible = !off; o.ribbons.forEach(r => (r.visible = !off));
      // linha
      const L = linePts(G, i, 22);
      if (L.length) {
        L.forEach(([x, y], j) => { tmp.copy(v3(THREE, x, y, lineZ(i, j / 22))); tmp.y += lineY(j / 22); o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3); });
        o.line.visible = true; o.lineGeo.attributes.position.needsUpdate = true; o.lineGeo.setDrawRange(0, L.length);
      } else {   // cortada: pedaço de linha caindo da mão
        const [hx, hy] = G.hands[i], d = hx < W / 2 ? 1 : -1;
        [[0, 0], [30 * d, 10], [55 * d, 30]].forEach(([dx, dy], j) => { tmp.copy(v3(THREE, hx + dx, hy + dy, ZH(i))); tmp.y += HAND_DROP; o.linePos.set([tmp.x, tmp.y, tmp.z], j * 3); });
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

  function dispose() {
    pops.forEach(q => q.el.remove());
    disp.forEach(x => { try { x.dispose(); } catch {} });
    try { renderer.dispose(); renderer.forceContextLoss(); } catch {}
    cv.remove();
  }
  return { draw, pop, resize, dispose, canvas: cv, setFoto(f) { Object.assign(foto, f); cenario(); } };
}

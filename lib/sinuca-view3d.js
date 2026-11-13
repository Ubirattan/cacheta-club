// Visão em PRIMEIRA PESSOA da sinuca (botão do olho): o jogador vê a mesa de perto, de trás da bola,
// com o taco, a bola e as caçapas, como na vida real. A física é a mesma do 2D (lib/sinuca.js).
import { W, H, R, POCKETS, POCKET_R } from './sinuca.js';
import { corBola, RAIL, tacoCores } from '../components/Sinuca.js';

export function createSinuca3D({ THREE, box }) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  box.appendChild(cv);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a120b');
  scene.fog = new THREE.Fog('#1a120b', 900, 1900);
  const camera = new THREE.PerspectiveCamera(52, 1, 2, 4000);
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
  const P = (x, y, z = 0) => new THREE.Vector3(x - W / 2, z, y - H / 2);   // mesa (x,y) → mundo

  /* ---------- luz ---------- */
  scene.add(new THREE.HemisphereLight('#fff6e0', '#2a1a0a', .55));
  const lamp = new THREE.SpotLight('#fff3d6', 1.25, 2200, Math.PI / 3.2, .55, 1);
  lamp.position.set(0, 620, 0); lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -.0005;
  scene.add(lamp, lamp.target);
  // luminária em cima da mesa
  const cupula = new THREE.Mesh(new THREE.CylinderGeometry(70, 120, 46, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#14532d', side: THREE.DoubleSide, roughness: .6 }));
  cupula.position.set(0, 640, 0); scene.add(cupula);

  /* ---------- mesa ---------- */
  const feltro = tex(512, 256, (g, w, h) => {
    g.fillStyle = '#0e7a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w * .25, 0); g.lineTo(w * .25, h); g.stroke();
  });
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshStandardMaterial({ map: feltro, roughness: .95 }));
  pano.rotation.x = -Math.PI / 2; pano.receiveShadow = true; scene.add(pano);
  const madeira = new THREE.MeshStandardMaterial({ color: '#6b3a1a', roughness: .45, metalness: .05 });
  const tabelaMat = new THREE.MeshStandardMaterial({ color: '#0b6331', roughness: .9 });
  const alt = R * 1.6, larg = RAIL;
  const barra = (x, z, sx, sz, mat, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat); m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  // tabelas de borracha (verde) e moldura de madeira
  barra(0, -H / 2 - 8, W + 16, 16, tabelaMat, alt); barra(0, H / 2 + 8, W + 16, 16, tabelaMat, alt);
  barra(-W / 2 - 8, 0, 16, H + 16, tabelaMat, alt); barra(W / 2 + 8, 0, 16, H + 16, tabelaMat, alt);
  barra(0, -H / 2 - 16 - larg / 2, W + 32 + larg * 2, larg, madeira, alt + 4); barra(0, H / 2 + 16 + larg / 2, W + 32 + larg * 2, larg, madeira, alt + 4);
  barra(-W / 2 - 16 - larg / 2, 0, larg, H + 32, madeira, alt + 4); barra(W / 2 + 16 + larg / 2, 0, larg, H + 32, madeira, alt + 4);
  // pés e chão
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#3b2716', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2; chao.position.y = -260; chao.receiveShadow = true; scene.add(chao);
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(W + 100, 120, H + 100), madeira); caixa.position.y = -60.5; scene.add(caixa);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(22, 16, 160, 12), madeira); p.position.set(x * (W / 2 + 10), -190, z * (H / 2 + 10)); scene.add(p); }
  // caçapas: buraco preto e boca de couro
  const buracoMat = new THREE.MeshBasicMaterial({ color: '#050505' }), couro = new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: .7 });
  for (const [px, py] of POCKETS) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(POCKET_R, 28), buracoMat); b.rotation.x = -Math.PI / 2; b.position.copy(P(px, py, .6)); scene.add(b);
    const anel = new THREE.Mesh(new THREE.TorusGeometry(POCKET_R + 2, 4, 8, 28), couro); anel.rotation.x = -Math.PI / 2; anel.position.copy(P(px, py, alt * .5)); scene.add(anel);
  }

  /* ---------- bolas ---------- */
  const bolaTex = n => tex(256, 128, (g, w, h) => {
    const cor = corBola(n), listrada = n > 8 && n < 100;
    g.fillStyle = n === 0 ? '#f8f6ee' : listrada ? '#f8f6ee' : cor; g.fillRect(0, 0, w, h);
    if (listrada) { g.fillStyle = cor; g.fillRect(0, h * .26, w, h * .48); }
    if (n > 0 && n < 100) for (const cx of [w * .25, w * .75]) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, h / 2, h * .17, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = `700 ${h * .2}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), cx, h / 2 + 1);
    }
    if (n === 0) { g.fillStyle = '#ef4444'; g.beginPath(); g.arc(w * .25, h / 2, 4, 0, 7); g.fill(); }
  });
  const geoBola = new THREE.SphereGeometry(R, 28, 18);
  const bolas = new Map();
  function malhaBola(b) {
    let m = bolas.get(b.n);
    if (!m) {
      m = new THREE.Mesh(geoBola, new THREE.MeshPhysicalMaterial ? new THREE.MeshPhysicalMaterial({ map: bolaTex(b.n), roughness: .18, clearcoat: 1, clearcoatRoughness: .08 }) : new THREE.MeshStandardMaterial({ map: bolaTex(b.n), roughness: .2 }));
      m.castShadow = true; m.userData.rot = new THREE.Quaternion(); scene.add(m); bolas.set(b.n, m);
      m.userData.ult = [b.x, b.y];
    }
    return m;
  }

  /* ---------- taco ---------- */
  let tacoKey = '';
  const tacoMat = new THREE.MeshStandardMaterial({ roughness: .35 });
  const taco = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 5.2, 440, 20), tacoMat);
  taco.castShadow = true;
  const tacoG = new THREE.Group(); taco.rotation.z = -Math.PI / 2; taco.position.x = -220; tacoG.add(taco); scene.add(tacoG);
  function pintaTaco() {
    const cs = tacoCores(), key = cs.join();
    if (key === tacoKey) return; tacoKey = key;
    const [pt, an, c1, c2, cb] = cs;
    tacoMat.map = tex(16, 512, (g, w, h) => {   // de cima (cabo) pra baixo (ponteira) ao longo do cilindro
      const gr = g.createLinearGradient(0, 0, 0, h);   // topo da imagem = ponteira
      gr.addColorStop(0, pt); gr.addColorStop(.03, pt); gr.addColorStop(.035, an); gr.addColorStop(.06, an); gr.addColorStop(.065, c1); gr.addColorStop(.6, c2); gr.addColorStop(.62, '#111'); gr.addColorStop(.64, cb); gr.addColorStop(1, cb);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    tacoMat.needsUpdate = true;
  }

  /* ---------- mira ---------- */
  const miraMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75 });
  const miraGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const mira = new THREE.Line(miraGeo, miraMat); scene.add(mira);
  const fantasma = new THREE.Mesh(new THREE.RingGeometry(R - 1.2, R, 32), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .7, side: THREE.DoubleSide }));
  fantasma.rotation.x = -Math.PI / 2; scene.add(fantasma);

  /* ---------- câmera ---------- */
  const cam = { pos: new THREE.Vector3(0, 300, 600), olha: new THREE.Vector3(), pronto: false };
  function resize() {
    const r = box.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  }
  resize(); const ro = new ResizeObserver(resize); ro.observe(box);

  // S: estado; cb: bola da tacada; ang/forca: mira; fim: onde a mira bate (x,y) ou null
  function render(S, cb, ang, forca, fim, mirando) {
    pintaTaco();
    const vivos = new Set();
    for (const b of S.balls) {
      const m = malhaBola(b); vivos.add(b.n);
      m.visible = !b.in;
      if (b.in) continue;
      const [ux, uy] = m.userData.ult, dx = b.x - ux, dy = b.y - uy, d = Math.hypot(dx, dy);
      if (d > .01 && d < 60) {   // rola de verdade: gira em volta do eixo perpendicular ao movimento
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dy / d, 0, -dx / d), d / R);
        m.quaternion.premultiply(q);
      }
      m.userData.ult = [b.x, b.y];
      m.position.copy(P(b.x, b.y, R));
    }
    for (const [n, m] of bolas) if (!vivos.has(n)) m.visible = false;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const vis = mirando && cb && !cb.in;
    tacoG.visible = vis; mira.visible = vis && !!fim; fantasma.visible = vis && !!fim;
    if (vis) {
      const recuo = R + 6 + forca * 120;
      tacoG.position.copy(P(cb.x - Math.cos(ang) * recuo, cb.y - Math.sin(ang) * recuo, R + 4));
      tacoG.rotation.set(0, -ang, 0); tacoG.rotateZ(-.07);   // levemente inclinado, como na mão
      if (fim) {
        const a = P(cb.x, cb.y, R * .3), b = P(fim[0], fim[1], R * .3);
        miraGeo.setFromPoints([a, b]); fantasma.position.copy(P(fim[0], fim[1], .8));
      }
    }
    // câmera atrás da bola, baixinha, olhando na direção da tacada; parada enquanto as bolas correm
    if (vis) {
      const atras = 150 + forca * 50;
      cam.alvoPos = P(cb.x, cb.y, 0).sub(dir.clone().multiplyScalar(atras)).add(new THREE.Vector3(0, 62, 0));
      cam.alvoOlha = P(cb.x, cb.y, 0).add(dir.clone().multiplyScalar(260));
    } else if (!cam.alvoPos) { cam.alvoPos = new THREE.Vector3(0, 620, 520); cam.alvoOlha = new THREE.Vector3(); }
    if (!cam.pronto) { cam.pos.copy(cam.alvoPos); cam.olha.copy(cam.alvoOlha); cam.pronto = true; }
    cam.pos.lerp(cam.alvoPos, .18); cam.olha.lerp(cam.alvoOlha, .18);
    camera.position.copy(cam.pos); camera.lookAt(cam.olha);
    renderer.render(scene, camera);
  }
  function destroy() { ro.disconnect(); renderer.dispose(); cv.remove(); }
  return { render, destroy, canvas: cv };
}

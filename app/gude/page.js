'use client';
// BOLINHA DE GUDE (triângulo) contra o computador. Precisa ter fichas no saldo, mas aqui elas não são gastas.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, Seg } from '../../components/ui.js';
import { fmt } from '../../lib/modes.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { W, H, LINE, TRI, MAXP, VK, newGame, step, shoot, botShot, left } from '../../lib/gude.js';

const BOTS = [['Tião', '🤠'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺']];

/* ---------- desenho ---------- */
function paintGround() {
  const K = 2, cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
  const g = cv.getContext('2d'); g.scale(K, K);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#bd8754'); gr.addColorStop(1, '#8c5a31');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.4 + .3, k = Math.random();
    g.fillStyle = k < .45 ? 'rgba(70,38,14,.28)' : k < .85 ? 'rgba(245,214,170,.22)' : 'rgba(30,15,5,.35)'; g.fillRect(x, y, r, r);
  }
  for (let i = 0; i < 30; i++) {
    let x = Math.random() * W, y = Math.random() * H, a = Math.random() * 6.3;
    g.strokeStyle = 'rgba(60,32,12,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { a += (Math.random() - .5) * 1.2; x += Math.cos(a) * 10; y += Math.sin(a) * 10; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * W, y = Math.random() * H, rx = Math.random() * 4.5 + 2, ry = rx * (.6 + Math.random() * .3), sh = 150 + Math.random() * 60 | 0;
    g.fillStyle = 'rgba(40,20,5,.35)'; g.beginPath(); g.ellipse(x + 1.5, y + 2, rx, ry, 0, 0, 7); g.fill();
    g.fillStyle = `rgb(${sh},${sh - 25},${sh - 55})`; g.beginPath(); g.ellipse(x, y, rx, ry, Math.random() * 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rx * .3, y - ry * .35, rx * .35, ry * .3, 0, 0, 7); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const top = Math.random() < .5, x = Math.random() * W, y = top ? Math.random() * 30 + 14 : H - Math.random() * 24;
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = k % 2 ? '#5f7d2a' : '#7a9a35'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + (k - 3) * 2, y - 8, x + (k - 3) * 3.5, y - 13 - Math.random() * 6); g.stroke();
    }
  }
  const groove = (pts, close, dash) => {
    g.setLineDash(dash || []); g.lineCap = 'round'; g.lineJoin = 'round';
    [[7, 'rgba(55,28,8,.55)', 0], [3, 'rgba(35,16,4,.75)', 0], [1.5, 'rgba(255,224,185,.45)', 2.5]].forEach(([w, col, o]) => {
      g.lineWidth = w; g.strokeStyle = col; g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(p[0], p[1] + o) : g.moveTo(p[0], p[1] + o)); if (close) g.closePath(); g.stroke();
    });
    g.setLineDash([]);
  };
  groove(TRI, true); groove([[LINE, 30], [LINE, H - 30]], false, [12, 8]);
  const v = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  return cv;
}

function marble(c, b) {
  const { x, y, r, k } = b;
  const sg = c.createRadialGradient(x + 4, y + 5, 1, x + 4, y + 5, r * 1.3);
  sg.addColorStop(0, 'rgba(20,8,0,.5)'); sg.addColorStop(1, 'rgba(20,8,0,0)');
  c.fillStyle = sg; c.beginPath(); c.ellipse(x + 4, y + 5, r * 1.25, r * 1.05, 0, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  const gb = c.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r * 1.05);
  if (b.type === 'leiteira') { gb.addColorStop(0, '#ffffff'); gb.addColorStop(.6, '#e2e8f0'); gb.addColorStop(1, '#94a3b8'); }
  else { gb.addColorStop(0, k[1]); gb.addColorStop(.35, k[0]); gb.addColorStop(1, k[2]); }
  c.fillStyle = gb; c.fillRect(x - r, y - r, r * 2, r * 2); c.translate(x, y); c.rotate(b.rot);
  if (b.type === 'leiteira') {
    c.strokeStyle = 'rgba(148,163,184,.55)'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(r * .2 * (i - 1), 0, r * (.5 + i * .2), -.5 + i, 1.2 + i); c.stroke(); }
  } else {
    const dark = b.type === 'olhopreto';
    for (let i = 0; i < 3; i++) {
      c.rotate(2.094);
      c.fillStyle = dark ? k[1] : 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(r * .3, -r * .35, r * .9, -r * .15, r * 1.05, 0); c.bezierCurveTo(r * .9, r * .12, r * .35, r * .2, 0, 0); c.fill();
      c.fillStyle = dark ? 'rgba(255,200,80,.5)' : k[1]; c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(r * .25, -r * .15, r * .6, -r * .08, r * .75, 0); c.bezierCurveTo(r * .6, r * .06, r * .25, r * .1, 0, 0); c.fill();
    }
  }
  c.restore();
  const hl = c.createRadialGradient(x - r * .38, y - r * .42, 0, x - r * .38, y - r * .42, r * .55);
  hl.addColorStop(0, 'rgba(255,255,255,.95)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl; c.beginPath(); c.arc(x - r * .38, y - r * .42, r * .55, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x + r * .35, y + r * .45, r * .28, r * .14, -.6, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r - .5, 0, 7); c.stroke();
}

/* ---------- som de vidro ---------- */
let AC = null;
function clack(vol, hi) {
  if (!soundOn()) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const n = AC.sampleRate * .04, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gn = AC.createGain();
    f.type = 'bandpass'; f.frequency.value = hi ? 4200 : 2600; f.Q.value = 3; gn.gain.value = Math.min(1, vol);
    s.buffer = b; s.connect(f).connect(gn).connect(AC.destination); s.start();
  } catch {}
}

/* ---------- página ---------- */
export default function Gude() {
  const router = useRouter();
  const { profile } = useAuth();
  const [level, setLevel] = useState('medio');
  const [game, setGame] = useState(null);            // {S, bot:[nome, avatar], id}
  const [hud, setHud] = useState(null);
  const [msg, setMsg] = useState('');
  const [rules, setRules] = useState(false);
  const [semFichas, setSemFichas] = useState(false);
  const [som, setSom] = useState(true);
  const cvRef = useRef(null), boxRef = useRef(null), firstRef = useRef(0);

  useEffect(() => { setSom(soundOn()); }, []);

  function start() {
    if (!profile) return;
    if ((profile.coins || 0) < 1) return setSemFichas(true);
    const bot = BOTS[Math.random() * BOTS.length | 0];
    const first = firstRef.current; firstRef.current = 1 - first;          // alterna quem começa
    const S = newGame(['Você', bot[0]], first);
    setGame({ S, bot, id: Date.now() });
    setMsg(first === 0 ? 'Sua vez: arraste da sua bolinha pra trás e solte' : `${bot[0]} começa`);
  }

  // laço do jogo: física, desenho, computador e toque
  useEffect(() => {
    if (!game) return;
    const { S } = game, cv = cvRef.current, box = boxRef.current, c = cv.getContext('2d');
    const ground = paintGround();
    let raf, view = { s: 1, ox: 0, oy: 0 }, drag = null, botAim = null, botT = null, dust = [], fx = [], lastHit = 0, alive = true;
    const sync = () => setHud({ scores: S.players.map(p => p.score), turn: S.turn, left: left(S), over: S.over, moving: S.moving });

    function fit() {
      const r = box.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const s = Math.min(r.width / W, r.height / H);
      view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
    }
    fit();
    const ro = new ResizeObserver(fit); ro.observe(box);

    function botTurn() {
      clearTimeout(botT);
      if (!alive || S.over || S.moving || S.turn !== 1) return;
      botT = setTimeout(() => {
        const sh = botShot(S, level); botAim = { ...sh, t: performance.now() };
        botT = setTimeout(() => { botAim = null; shoot(S, sh.ang, sh.power); setMsg(`${game.bot[0]} tecou…`); sync(); }, 850);
      }, 1100);
    }

    function events() {
      for (const e of S.events) {
        if (e.type === 'shoot') clack(.8, false);
        if (e.type === 'hit') {
          const now = performance.now();
          if (now - lastHit > 35) {
            lastHit = now; clack(e.force / 8, true);
            if (e.force > 3) { for (let i = 0; i < 5; i++) { const a = Math.random() * 6.3, v = Math.random() * 1.2; dust.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: 2 + Math.random() * 3 }); } try { navigator.vibrate && navigator.vibrate(12); } catch {} }
          }
        }
        if (e.type === 'settle') {
          const quem = e.pi === 0 ? 'Você' : game.bot[0];
          e.got.forEach(b => { fx.push({ x: b.x, y: b.y, life: 1 }); for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3; dust.push({ x: b.x, y: b.y, vx: Math.cos(a), vy: Math.sin(a), life: 1, r: 2 + Math.random() * 3 }); } });
          if (e.got.length) sfx('coin');
          if (e.over) {
            setMsg(e.over.winner < 0 ? 'Empatou!' : e.over.winner === 0 ? 'Você ganhou o jogo!' : `${game.bot[0]} ganhou dessa vez`);
            setTimeout(() => sfx(e.over.winner === 0 ? 'win' : 'lose'), 400);
          } else if (e.stuck) setMsg(`${e.pi === 0 ? 'Sua bolinha' : 'A bolinha do ' + game.bot[0]} ficou presa no triângulo: volta pra linha`);
          else if (e.again) setMsg(`${quem} ${e.pi === 0 ? 'tirou' : 'tirou'} ${e.got.length}! ${e.pi === 0 ? 'Joga de novo' : 'E joga de novo'}`);
          else setMsg(e.pi === 0 ? `Não tirou nenhuma. Vez do ${game.bot[0]}` : `${game.bot[0]} errou! Sua vez`);
          if (!e.over && S.turn === 0) sfx('turn');
          sync(); botTurn();
        }
      }
      S.events.length = 0;
    }

    function draw(now) {
      const { s, ox, oy, dpr } = view;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // fora do campo: o mesmo chão, mais escuro, pra não ficar faixa preta
      const cw = cv.width / dpr, ch = cv.height / dpr, k = Math.max(cw / W, ch / H);
      c.drawImage(ground, (cw - W * k) / 2, (ch - H * k) / 2, W * k, H * k); c.fillStyle = 'rgba(15,8,2,.55)'; c.fillRect(0, 0, cw, ch);
      c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      c.drawImage(ground, 0, 0, W, H);
      for (const p of dust) { c.fillStyle = `rgba(225,190,145,${p.life * .5})`; c.beginPath(); c.arc(p.x, p.y, p.r * (1.6 - p.life), 0, 7); c.fill(); }
      S.balls.forEach(b => { if (!b.out) marble(c, b); });
      S.players.forEach(p => marble(c, p.sh));
      const me = S.players[0].sh;
      if (S.turn === 0 && !S.moving && !drag && !S.over) {
        const k = (now / 900) % 1; c.strokeStyle = `rgba(255,240,200,${(1 - k) * .8})`; c.lineWidth = 2;
        c.beginPath(); c.arc(me.x, me.y, me.r + 4 + k * 18, 0, 7); c.stroke();
      }
      let aim = null;
      if (drag) { const dx = drag.x - me.x, dy = drag.y - me.y; aim = { sh: me, ang: Math.atan2(dy, dx) + Math.PI, p: Math.min(Math.hypot(dx, dy), MAXP) }; }
      if (botAim) aim = { sh: S.players[1].sh, ang: botAim.ang, p: Math.min(1, (now - botAim.t) / 650) * botAim.power };
      if (aim) {
        const { sh, ang, p } = aim, col = p > MAXP * .7 ? '239,68,68' : p > MAXP * .38 ? '245,158,11' : '74,222,128';
        for (let i = 1; i <= 16; i++) {
          const d = sh.r + 6 + i * p * .16; c.fillStyle = `rgba(255,255,255,${(1 - i / 17) * .9})`;
          c.beginPath(); c.arc(sh.x + Math.cos(ang) * d, sh.y + Math.sin(ang) * d, 3.2 - i * .12, 0, 7); c.fill();
        }
        c.lineWidth = 5; c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(sh.x, sh.y, sh.r + 10, 0, 7); c.stroke();
        c.strokeStyle = `rgb(${col})`; c.beginPath(); c.arc(sh.x, sh.y, sh.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p / MAXP); c.stroke();
        if (drag) { c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(drag.x, drag.y); c.stroke(); c.setLineDash([]); }
      }
      for (const f of fx) {
        c.globalAlpha = Math.min(1, f.life * 1.5); c.font = '700 26px Oswald, Rubik, sans-serif'; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = 'rgba(40,18,4,.8)'; c.strokeText('+1', f.x, f.y); c.fillStyle = '#fde68a'; c.fillText('+1', f.x, f.y); c.globalAlpha = 1;
      }
    }

    function loop(now) {
      if (!alive) return;
      const was = S.moving;
      step(S); events();
      for (const p of dust) { p.x += p.vx; p.y += p.vy; p.vx *= .95; p.vy *= .95; p.life -= .02; }
      dust = dust.filter(p => p.life > 0);
      for (const f of fx) { f.y -= .6; f.life -= .012; }
      fx = fx.filter(f => f.life > 0);
      if (was !== S.moving) sync();
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s }; };
    const down = e => {
      if (S.moving || S.turn !== 0 || S.over) return;
      const p = pt(e), me = S.players[0].sh;
      if (Math.hypot(p.x - me.x, p.y - me.y) < 70) { drag = p; try { cv.setPointerCapture(e.pointerId); } catch {} }
    };
    const move = e => { if (drag) drag = pt(e); };
    const up = () => {
      if (!drag) return;
      const me = S.players[0].sh, dx = drag.x - me.x, dy = drag.y - me.y, p = Math.min(Math.hypot(dx, dy), MAXP);
      drag = null; if (p < 10) return;
      shoot(S, Math.atan2(dy, dx) + Math.PI, p); setMsg('Rolando…'); sync();
    };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    sync(); botTurn(); raf = requestAnimationFrame(loop);
    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(botT); ro.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
    };
  }, [game, level]);

  /* ------------------------- MENU ------------------------- */
  if (!game) return (
    <div className="page lounge gd-menu">
      <div className="hdr"><a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a>
        <div className="gd-logo">BOLINHA DE GUDE <small>triângulo</small></div>
        <button className="rbtn" onClick={() => router.push('/')}>↩</button></div>
      <div className="gd-box">
        <div className="gd-art"><i className="mb a" /><i className="mb b" /><i className="mb c" /><i className="mb w" /></div>
        <h2>🤖 Contra o computador</h2>
        <Seg label="Computador" value={level} onChange={setLevel} options={[['facil', 'Fácil'], ['medio', 'Esperto']]} />
        <button className="go" disabled={!profile} onClick={start}>▶ Jogar</button>
        <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
        <p className="hint" style={{ textAlign: 'center' }}>É preciso ter fichas no saldo. Contra o computador elas não são gastas.</p>
      </div>
      {rules && <Rules onClose={() => setRules(false)} />}
      {semFichas && <Modal onClose={() => setSemFichas(false)}><h2>Sem fichas</h2>
        <p>Para jogar, inclusive contra o computador, você precisa ter fichas no saldo.</p>
        <button className="go" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas com Pix</button>
        <button className="sec" onClick={() => setSemFichas(false)}>Fechar</button></Modal>}
      <style>{CSS}</style>
    </div>
  );

  /* ------------------------- JOGO ------------------------- */
  const h = hud || { scores: [0, 0], turn: 0, left: 10, over: null };
  const pill = (i, nome, av) => (
    <div className={`gd-pill ${h.turn === i && !h.over ? 'on' : ''}`}>
      <span className="av">{av}</span>
      <div><b>{nome}</b><small>{h.turn === i && !h.over ? 'na vez' : 'aguardando'}</small></div>
      <strong>{h.scores[i]}</strong>
    </div>
  );
  return (
    <div className="page lounge gd">
      <div className="gd-top">
        {pill(0, 'Você', profile?.avatar || '😎')}
        <div className="gd-left">restam <b>{h.left}</b></div>
        {pill(1, game.bot[0], game.bot[1])}
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={() => { if (h.over || confirm('Sair da partida?')) setGame(null); }}>↩</button>
      </div>
      <div className="gd-field" ref={boxRef}><canvas ref={cvRef} /></div>
      <div id="msg" dangerouslySetInnerHTML={{ __html: msg || '&nbsp;' }} />
      {h.over && <Modal><h2>{h.over.winner === 0 ? '🏆 Você ganhou!' : h.over.winner < 0 ? 'Empate!' : `${game.bot[0]} ganhou`}</h2>
        <div className="prize">{h.scores[0]} x {h.scores[1]}</div>
        <p>{h.over.winner === 0 ? 'Limpou o triângulo! Boa tecada.' : 'Quase! Tenta de novo.'}</p>
        <button className="go" onClick={start}>Jogar de novo</button>
        <button className="sec" onClick={() => setGame(null)}>Voltar ao menu</button></Modal>}
      <style>{CSS}</style>
    </div>
  );
}

function Rules({ onClose }) {
  return (
    <Modal onClose={onClose}><h2>Como jogar</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• No chão tem um <b>triângulo</b> com 10 bolinhas. Você e o computador têm cada um o seu <b>tecador</b>.</p>
        <p>• Na sua vez, encoste na sua bolinha (a branca), <b>arraste pra trás</b> como um estilingue e solte. Quanto mais longe, mais forte.</p>
        <p>• Bolinha que sair do triângulo é sua. <b>Tirou alguma, joga de novo.</b> Não tirou, passa a vez.</p>
        <p>• Na próxima vez você teca de onde o seu tecador parou. Se ele parar <b>dentro do triângulo</b>, volta pra linha e você perde a vez.</p>
        <p>• Quando acabarem as bolinhas, ganha quem tirou mais.</p>
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

const CSS = `
.gd-menu .hdr{align-items:center}
.gd-logo{font:700 clamp(22px,5.4vmin,38px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;text-align:center}
.gd-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:4px}
.gd-box{margin:auto;width:min(440px,94vw);background:linear-gradient(180deg,#2a2218,#15110b);border:2px solid var(--gold2);border-radius:20px;padding:14px 18px;text-align:center}
.gd-box h2{margin:0 0 6px;font:700 22px Oswald;color:var(--gold);text-transform:uppercase;font-style:italic}
.gd-art{display:flex;justify-content:center;gap:10px;margin-bottom:6px}
.mb{width:30px;height:30px;border-radius:50%;display:inline-block;box-shadow:3px 4px 6px rgba(0,0,0,.5),inset -3px -4px 6px rgba(0,0,0,.35)}
.mb.a{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#93c5fd 20%,#2563eb 55%,#0b2a6b)}
.mb.b{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#fca5a5 20%,#dc2626 55%,#5c0a0a)}
.mb.c{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#86efac 20%,#16a34a 55%,#0a3d1c)}
.mb.w{width:38px;height:38px;background:radial-gradient(circle at 32% 30%,#fff 0 25%,#e2e8f0 50%,#94a3b8)}
.gd{overflow:hidden}
.gd-top{display:flex;align-items:center;gap:clamp(6px,1.6vw,14px);padding:8px 12px 6px}
.gd-pill{display:flex;align-items:center;gap:8px;background:#0c0a07;border:2px solid var(--gold2);border-radius:30px;padding:3px 14px 3px 4px;min-width:0}
.gd-pill.on{border-color:var(--gold);box-shadow:0 0 0 2px #000,0 0 14px rgba(242,201,76,.55)}
.gd-pill .av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 40% 30%,#0f7a48,#064a2b);flex:none}
.gd-pill div{display:flex;flex-direction:column;line-height:1.05;min-width:0}
.gd-pill b{font:500 15px Oswald;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gd-pill small{font:500 11px Oswald;color:var(--mut)}
.gd-pill.on small{color:var(--gold)}
.gd-pill strong{font:700 26px Oswald;color:var(--gold);margin-left:4px}
.gd-left{font:500 14px Oswald;color:var(--mut);background:#000a;border:1.5px solid var(--gold2);border-radius:20px;padding:5px 12px;white-space:nowrap}
.gd-left b{color:#fff;font-size:17px}
.gd-top .rbtn:first-of-type{margin-left:auto}
.gd-top .rbtn{width:42px;height:42px;font-size:18px}
.gd-field{flex:1;min-height:0;position:relative;margin:0 8px}
.gd-field canvas{position:absolute;inset:0;display:block;touch-action:none;border-radius:14px}
`;

'use client';
// Sinuca: desenho da mesa e das bolas, sons, regras e estilo (usado contra o computador e no online).
import { Modal } from './ui.js';
import { audioCtx, soundOn } from '../lib/sfx.js';
import { W, H, R, POCKETS } from '../lib/sinuca.js';

export const RAIL = 34;                 // largura da tabela (madeira) em volta da área de jogo
export const COR = { 1: '#f5c518', 2: '#1d4ed8', 3: '#dc2626', 4: '#6d28d9', 5: '#f97316', 6: '#15803d', 7: '#7f1d1d', 8: '#111' };
export const corBola = n => (n > 200 ? '#facc15' : n > 100 ? '#dc2626' : COR[n > 8 ? n - 8 : n] || '#fff');
export const NOME_MODO = { bola8: 'bola 8', lisa: 'bola lisa', bolinho: 'bolinho' };

/* ---------- sons da mesa (curtinhos, sintetizados) ---------- */
export function toc(v, grave = false) {
  if (!soundOn()) return;
  const AC = audioCtx(); if (!AC) return;
  try {
    const t = AC.currentTime, n = AC.sampleRate * .05, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, grave ? 2 : 6);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    f.type = 'bandpass'; f.frequency.value = grave ? 180 : 2600; f.Q.value = grave ? 1 : 2.5;
    g.gain.setValueAtTime(Math.min(.9, .08 + v * (grave ? .5 : .05)), t);
    s.buffer = b; s.connect(f).connect(g).connect(AC.destination); s.start(t);
  } catch {}
}

/* ---------- desenho ---------- */
export function bola(c, b, s = 1) {
  const r = R * s, x = b.x, y = b.y;
  c.save();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 2.5, y + 3, r, r * .9, 0, 0, 7); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
  if (b.n === 0) { c.fillStyle = '#f8f6ee'; c.fillRect(x - r, y - r, r * 2, r * 2); }
  else if (b.n > 8 && b.n < 100) { c.fillStyle = '#f8f6ee'; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = corBola(b.n); c.fillRect(x - r, y - r * .55, r * 2, r * 1.1); }
  else { c.fillStyle = corBola(b.n); c.fillRect(x - r, y - r, r * 2, r * 2); }
  if (b.n && b.n < 100) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * .48, 0, 7); c.fill();
    c.fillStyle = '#111'; c.font = `700 ${r * .62}px Rubik, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(b.n), x, y + r * .04);
  }
  const g = c.createRadialGradient(x - r * .4, y - r * .45, r * .1, x, y, r * 1.1);
  g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(.25, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.38)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
export function mesa(c) {
  // madeira
  const m = c.createLinearGradient(0, -RAIL, 0, H + RAIL); m.addColorStop(0, '#5a3418'); m.addColorStop(.5, '#3d220f'); m.addColorStop(1, '#5a3418');
  c.fillStyle = m; c.beginPath(); c.roundRect ? c.roundRect(-RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2, 26) : c.rect(-RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2); c.fill();
  c.strokeStyle = '#c8901c'; c.lineWidth = 3; c.stroke();
  // pano verde
  const p = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .7); p.addColorStop(0, '#1f8a4c'); p.addColorStop(1, '#0f5a30');
  c.fillStyle = '#0c4a27'; c.fillRect(-14, -14, W + 28, H + 28);
  c.fillStyle = p; c.fillRect(0, 0, W, H);
  // marcações
  c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * .25, 0); c.lineTo(W * .25, H); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(W * .72, H / 2, 3, 0, 7); c.fill();
  // losangos na madeira
  c.fillStyle = '#e8d8a8';
  for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = W * k / 8; [[x, -RAIL / 2], [x, H + RAIL / 2]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a, b - 4); c.lineTo(a + 3, b); c.lineTo(a, b + 4); c.lineTo(a - 3, b); c.fill(); }); }
  for (let k = 1; k < 4; k++) { const y = H * k / 4; [[-RAIL / 2, y], [W + RAIL / 2, y]].forEach(([a, b]) => { c.beginPath(); c.moveTo(a, b - 4); c.lineTo(a + 3, b); c.lineTo(a, b + 4); c.lineTo(a - 3, b); c.fill(); }); }
  // caçapas
  for (const [x, y] of POCKETS) {
    c.fillStyle = '#2b1606'; c.beginPath(); c.arc(x, y, 27, 0, 7); c.fill();
    c.fillStyle = '#050505'; c.beginPath(); c.arc(x, y, 21, 0, 7); c.fill();
  }
}

export function Regras({ onClose }) {
  return (
    <Modal onClose={onClose}><h2>Como jogar</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• <b>Mirar:</b> arraste o dedo na mesa. A linha mostra onde a branca bate e pra onde a bola vai.</p>
        <p>• <b>Tacar:</b> puxe a barra de <b>FORÇA</b> (à esquerda) pra baixo e solte. Quanto mais puxa, mais forte.</p>
        <p><b>Bola 8:</b></p><p>• <b>Lisas (1 a 7) x listradas (9 a 15):</b> quem encaçapar primeiro depois da saída fica com aquele grupo.</p>
        <p>• Encaçapou uma bola sua: <b>joga de novo</b>.</p>
        <p>• <b>Falta</b> (branca na caçapa, não encostar em nada ou bater primeiro na bola do outro): o adversário joga com a <b>bola na mão</b> e coloca a branca onde quiser.</p>
        <p>• <b>A 8 é a última.</b> Matou a 8 depois de limpar as suas: ganhou. Matou antes da hora: perdeu.</p>
        <p><b>Bola lisa:</b> sem a branca. Você é das vermelhas, o computador das amarelas. Antes de começar, cada um arruma as suas 5 bolas onde quiser, no seu lado da mesa (você arrasta as suas na metade da esquerda). Depois de COMEÇAR ninguém mexe mais. Na sua vez, toque em qualquer bola vermelha e taque com ela pra <b>matar as amarelas</b>. Matou bola dele: joga de novo. Se cair bola sua, você perdeu ela. Quem ficar sem bolas perde.</p>
        <p><b>Bolinho:</b> 3 bolas na mesa por jogo (são 5 jogos com as 15 bolas). Quem matar a última ganha o jogo. Se cegar (não encostar em nenhuma) ou a branca cair, perde o jogo. Sempre se jogam os 5 jogos: quem ganhar mais leva a partida.</p>
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

export const SINUCA_CSS = `
.sn-menu .hdr{align-items:center}
.sn-logo{font:700 clamp(24px,5.6vmin,40px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;text-align:center;flex:1}
.sn-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:6px}
.sn-box{margin:auto;width:min(420px,94vw);background:radial-gradient(circle at 50% 0%,#1f8a4c,#0b3d22);border:3px solid #5a3418;outline:2px solid var(--gold2);border-radius:20px;padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.sn-prev{display:flex;justify-content:center;gap:6px;margin:4px 0}
.sn-prev span{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset -4px -5px 8px #0006,inset 3px 3px 5px #fff5,0 3px 5px #0007}
.sn-prev b{width:16px;height:16px;border-radius:50%;background:#fff;color:#111;font:700 10px Rubik,Arial;display:flex;align-items:center;justify-content:center}
.sn{overflow:hidden;background:radial-gradient(ellipse at 50% 55%,#1c2a3c,#070a10 75%)}
.sn-top{display:flex;align-items:center;gap:8px;padding:max(4px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 2px max(10px,env(safe-area-inset-left));justify-content:center}
.sn-top .rbtn:first-child{margin-right:auto}.sn-top .rbtn:last-child{margin-left:auto}
.sn-top .rbtn{width:34px;height:34px;font-size:15px;border-width:2px}
.sn-pl{flex:1;min-width:0;max-width:300px;display:flex;align-items:center;gap:7px;background:linear-gradient(#0f1622,#05080d);border:2px solid #ffffff1c;border-radius:12px;padding:2px 8px 2px 2px}
.sn-pl.dir{flex-direction:row-reverse;padding:2px 2px 2px 8px;text-align:right}
.sn-pl.vez{border-color:var(--gold);box-shadow:0 0 10px #f2c94c77}
.sn-pl .av{width:30px;height:30px;border-radius:9px;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
.sn-pl>div{min-width:0;display:flex;flex-direction:column;gap:2px}
.sn-pl.dir>div{align-items:flex-end}
.sn-pl b{font:500 13px Oswald;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
.sn-pl b small{color:var(--gold);font-size:11px}
.sn-fila{display:flex;flex-direction:row;gap:3px}
.sn-fila span{width:11px;height:11px;border-radius:50%;box-shadow:inset -2px -2px 3px #0007}
.sn-fila span.vazio{background:#ffffff18;box-shadow:none}
.sn-fila span.foi{opacity:.18}
.sn-fila span.ganho{background:var(--gold);box-shadow:0 0 6px #f2c94c}
.sn-vs{font:700 15px Oswald;color:var(--gold);font-style:italic;text-align:center;line-height:1}
.sn-area{flex:1;min-height:0;display:flex;align-items:stretch;gap:6px;padding:2px max(6px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left))}
.sn-bar{flex:none;width:30px;align-self:center;height:78%;max-height:380px;border-radius:15px;border:2px solid #ffffff44;background:linear-gradient(#ef4444,#f59e0b 50%,#22c55e);position:relative;overflow:hidden;touch-action:none;cursor:ns-resize;display:flex;align-items:flex-end;justify-content:center;box-shadow:0 0 0 3px #0008}
.sn-bar i{position:absolute;left:0;right:0;top:0;height:0;background:#000c;border-bottom:3px solid #fff}
.sn-bar span{position:relative;writing-mode:vertical-rl;transform:rotate(180deg);font:600 10px Oswald;color:#fff;letter-spacing:2px;margin-bottom:8px;text-shadow:0 1px 2px #000;pointer-events:none}
.sn-comeca{flex:none;width:64px;align-self:center;height:64px;border-radius:50%;border:3px solid #fff;background:radial-gradient(circle at 40% 30%,#ffe08a,#c8901c);color:#3a2300;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 0 #6b4a05,0 6px 14px #0008;padding:0}
.sn-comeca b{font:700 9px Oswald;letter-spacing:.3px}
.sn-mesa{flex:1;min-width:0;position:relative;touch-action:none}
.sn-mesa canvas{position:absolute;inset:0;display:block;touch-action:none;user-select:none;-webkit-user-select:none}
.sn-msg{position:absolute;left:50%;top:2px;transform:translateX(-50%);max-width:80%;pointer-events:none;font:500 clamp(11px,2.2vmin,14px) Oswald;color:#fff;background:#000a;border-radius:10px;padding:2px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sn-msg:empty{display:none}
.sn-caiu{flex:none;width:22px;align-self:center;height:78%;max-height:380px;border-radius:11px;background:linear-gradient(90deg,#05080d,#1a2232,#05080d);border:2px solid #ffffff22;display:flex;flex-direction:column-reverse;align-items:center;gap:2px;padding:3px 0;overflow:hidden}
.sn-caiu span{width:16px;height:16px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;box-shadow:inset -2px -3px 4px #0007}
.sn-caiu b{width:8px;height:8px;border-radius:50%;background:#fff;color:#111;font:700 6px Arial;display:flex;align-items:center;justify-content:center}
`;


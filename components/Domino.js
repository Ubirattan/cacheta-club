'use client';
// Dominó: desenho das pedras, a "cobrinha" da mesa, regras e estilo (contra o computador e online).
import { Modal } from './ui.js';
import { META, PONTOS } from '../lib/domino.js';

// pontinhos de cada número numa grade 3x3 (meia pedra em pé)
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const PIPS_H = { ...PIPS, 6: [0, 1, 2, 6, 7, 8] };   // meia pedra deitada

function Meia({ n, deitada }) {
  const on = new Set((deitada ? PIPS_H : PIPS)[n]);
  return <span className="dm-meia">{Array.from({ length: 9 }, (_, i) => <i key={i} className={on.has(i) ? 'on' : ''} />)}</span>;
}
// pedra: deitada (a à esquerda, b à direita) ou em pé (a em cima, b embaixo)
export function Pedra({ a, b, deitada, u, cls = '', onClick, style }) {
  return <div className={`dm-pedra ${deitada ? 'h' : 'v'} ${cls}`} style={{ '--u': u + 'px', ...style }} onClick={onClick}>
    <Meia n={a} deitada={deitada} /><span className="dm-risco" /><Meia n={b} deitada={deitada} /></div>;
}

// monta a "cobrinha" da mesa: linha da esquerda pra direita, quebrando em fileiras que vão e voltam
export function montar(linha, W, H) {
  if (!linha.length || !W) return { u: 20, itens: [] };
  for (let u = Math.min(36, Math.floor(H / 3.2)); u >= 10; u--) {
    const gap = 2, rowH = 2 * u + 8, maxRows = Math.max(1, Math.floor((H + 8) / rowH));
    const rows = [[]]; let x = 0;
    for (const p of linha) {
      const w = (p.a === p.b ? u : 2 * u) + gap;
      if (x + w > W && rows[rows.length - 1].length) { rows.push([]); x = 0; }
      rows[rows.length - 1].push({ ...p, w }); x += w;
    }
    if (rows.length > maxRows) continue;
    const itens = [], top0 = (H - rows.length * rowH + 8) / 2;
    rows.forEach((row, k) => {
      const tot = row.reduce((t, p) => t + p.w, 0), dir = k % 2 ? -1 : 1;
      let x0 = rows.length === 1 ? (W - tot) / 2 : dir > 0 ? 0 : W - tot;
      const seq = dir > 0 ? row : row.slice().reverse();
      for (const p of seq) {
        const dupla = p.a === p.b, w = p.w - gap;
        itens.push({ id: p.id, a: dir > 0 ? p.a : p.b, b: dir > 0 ? p.b : p.a, deitada: !dupla, left: x0, top: top0 + k * rowH + (dupla ? 0 : u / 2) });
        x0 += w + gap;
      }
    });
    return { u, itens };
  }
  return { u: 10, itens: [] };
}

// tamanho das pedras da sua mão (maiores no celular deitado)
export function uDaMao() {
  if (typeof window === 'undefined') return 28;
  return Math.max(22, Math.min(36, Math.floor(Math.min(window.innerWidth / 24, window.innerHeight / 10))));
}

export function RegrasDomino({ onClose }) {
  return <Modal onClose={onClose}><h2>Dominó em duplas</h2>
    <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
      <p>• 4 jogadores, <b>7 pedras</b> cada, sem monte. Você joga com o <b>parceiro da frente</b> contra os dois dos lados.</p>
      <p>• Na 1ª mão, quem tem a <b>carroça de 6</b> sai com ela. Depois, quem bateu começa a mão seguinte com qualquer pedra.</p>
      <p>• Na sua vez, encaixe uma pedra numa das pontas. Sem pedra que encaixe, você <b>passa</b>.</p>
      <p>• Quem acabar as pedras <b>bate</b>: simples vale <b>{PONTOS.simples}</b>, de carroça <b>{PONTOS.carroca}</b>, <b>lá-e-lô</b> (pedra que serve nas duas pontas) <b>{PONTOS.laelo}</b> e <b>cruzada</b> (carroça que serve nas duas pontas) <b>{PONTOS.cruzada}</b>.</p>
      <p>• Se ninguém tiver pedra pra jogar, <b>trancou</b>: a dupla com menos pontos nas mãos marca {PONTOS.trancou}.</p>
      <p>• Ganha a dupla que fizer <b>{META} pontos</b>.</p>
    </div>
    <button className="go" onClick={onClose}>Entendi</button></Modal>;
}

export const DOMINO_CSS = `
.dm-menu .hdr{align-items:center}
.dm-logo{font:700 clamp(26px,6vmin,40px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px}
.dm-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:4px}
.dm-box{margin:auto;width:min(440px,94vw);background:linear-gradient(180deg,#2a2218,#15110b);border:2px solid var(--gold2);border-radius:20px;padding:16px 18px;text-align:center}
.dm-box h2{margin:0 0 8px;font:700 24px Oswald;color:var(--gold);text-transform:uppercase;font-style:italic}
.dm-demo{display:flex;align-items:center;justify-content:center;gap:3px;margin:4px 0 10px}
.dm-pedra{--u:20px;position:relative;display:flex;align-items:center;background:linear-gradient(160deg,#fffdf6,#ece4cf);border-radius:calc(var(--u)*.18);box-shadow:0 2px 0 #b9ad8f,0 3px 6px #0007;flex:none}
.dm-pedra.v{flex-direction:column;width:var(--u);height:calc(var(--u)*2)}
.dm-pedra.h{width:calc(var(--u)*2);height:var(--u)}
.dm-meia{width:var(--u);height:var(--u);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:calc(var(--u)*.14);box-sizing:border-box}
.dm-meia i{border-radius:50%;margin:14%}
.dm-meia i.on{background:radial-gradient(circle at 35% 35%,#555,#111)}
.dm-risco{background:#9b8f74;flex:none}
.dm-pedra.v .dm-risco{width:70%;height:1.5px}
.dm-pedra.h .dm-risco{height:70%;width:1.5px}
.dm{overflow:hidden;display:flex;flex-direction:column}
.dm-top{display:flex;align-items:center;gap:clamp(8px,2vw,18px);padding:6px 12px 0}
.dm-placar{display:flex;align-items:center;gap:8px;background:#0c0a07;border:2px solid var(--gold2);border-radius:16px;padding:3px 14px}
.dm-placar div{display:flex;flex-direction:column;align-items:center;line-height:1}
.dm-placar small{font:500 11px Oswald;color:var(--mut)}.dm-placar b{font:700 24px Oswald;color:#fff}
.dm-placar .hot b{color:#f97316}.dm-placar i{font:500 16px Oswald;color:var(--mut);font-style:normal}
.dm-info{font:500 14px Oswald;color:#eadfca;margin-right:auto;background:#000a;border:1.5px solid var(--gold2);border-radius:20px;padding:4px 12px}
.dm-info b{color:var(--gold)}
.dm-top .rbtn{width:38px;height:38px;font-size:16px}
.dm-feltro{flex:1;min-height:0;position:relative;margin:6px clamp(6px,3vw,50px) 0;border-radius:26px;border:6px solid #5a3a1a;box-shadow:inset 0 0 40px #0009,0 6px 18px #000a;
  background:radial-gradient(ellipse at 50% 45%,#1d8a52,#0d5a33 60%,#073d22)}
.dm-mesa{position:absolute;left:clamp(58px,10%,110px);right:clamp(58px,10%,110px);top:clamp(38px,13%,56px);bottom:6px}
.dm-mesa .dm-pedra{position:absolute;transition:left .25s,top .25s}
.dm-mesa .dm-pedra.ponta{box-shadow:0 2px 0 #b9ad8f,0 0 0 2px #fde04799,0 3px 6px #0007}
.dm-vazio{position:absolute;inset:0;display:grid;place-items:center;color:#ffffffaa;font:500 16px Rubik}
.dm-lugar{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:2}
.dm-lugar.cima{top:4px;left:50%;transform:translateX(-50%);flex-direction:row;gap:8px}
.dm-lugar.esq{left:6px;top:50%;transform:translateY(-50%)}
.dm-lugar.dir{right:6px;top:50%;transform:translateY(-50%)}
.dm-av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:radial-gradient(circle at 40% 30%,#0f7a48,#064a2b);border:3px solid #ffffff55}
.dm-lugar.vez .dm-av,.dm-eu.vez span{border-color:var(--gold);animation:pulse 1s infinite alternate}
.dm-np{display:flex;flex-direction:column;align-items:center;line-height:1.1}
.dm-np b{font:600 13px Rubik;color:#fff;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-np small{font:500 11px Rubik;color:#d1fae5}
.dm-costas{display:flex;gap:2px;flex-wrap:wrap;max-width:76px;justify-content:center}
.dm-costas i{width:8px;height:14px;border-radius:2px;background:linear-gradient(180deg,#1e3a8a,#172554);border:1px solid #93c5fd88}
.dm-aberta{display:flex;gap:2px;flex-wrap:wrap;max-width:110px;justify-content:center}
.dm-grito{position:absolute;top:-8px;left:50%;transform:translate(-50%,-100%);background:linear-gradient(180deg,#ffe08a,#e0a100);color:#3a2300;font:700 18px Oswald;padding:3px 12px;border-radius:14px;border:2px solid #000;white-space:nowrap;z-index:9;box-shadow:0 6px 14px #0008;animation:pop .2s}
.dm-lugar.cima .dm-grito{top:auto;bottom:-8px;transform:translate(-50%,100%)}
.dm-grito.eu{top:auto;bottom:8px;transform:translateX(-50%)}
.dm-msg{text-align:center;min-height:22px}
.dm-minha{display:flex;align-items:center;justify-content:center;gap:10px;padding:2px 10px 8px;position:relative}
.dm-eu span{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:radial-gradient(circle at 40% 30%,#0f7a48,#064a2b);border:3px solid #ffffff55}
.dm-mao{display:flex;gap:clamp(4px,1vw,10px);align-items:flex-end}
.dm-mao .dm-pedra{cursor:pointer;transition:transform .15s,opacity .15s}
.dm-mao .dm-pedra.pode{box-shadow:0 2px 0 #b9ad8f,0 0 0 2px #fde047,0 3px 8px #0008}
.dm-mao .dm-pedra.pode:active{transform:translateY(-10px)}
@media (hover:hover){.dm-mao .dm-pedra.pode:hover{transform:translateY(-8px)}}
.dm-mao .dm-pedra.nao{opacity:.45}
.dm-mao .dm-pedra.sel{transform:translateY(-14px);box-shadow:0 2px 0 #b9ad8f,0 0 0 3px #22c55e,0 6px 12px #000a}
.dm-lados{display:flex;flex-direction:column;gap:6px}
.dm-lados button{border:2px solid #000;border-radius:16px;padding:8px 12px;font:700 15px Oswald;color:#fff;background:linear-gradient(180deg,#22c55e,#15803d);box-shadow:0 3px 0 #0007;white-space:nowrap}
`;

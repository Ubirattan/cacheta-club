'use client';
// Truco: regras, estilo da mesa e posições (usado contra o computador e no truco online).
import { Modal } from './ui.js';
import { CALL_NAME, VALUES } from '../lib/truco.js';

// posição na mesa vista por quem joga (lugar 0 = você, embaixo)
export const SEATS = { 2: [null, [50, 9]], 4: [null, [7, 46], [50, 9], [93, 46]] };
export const PLAYED = { 2: [[50, 72], [50, 47]], 4: [[50, 74], [33, 54], [50, 48], [67, 54]] };
export const nextCall = v => CALL_NAME[VALUES[VALUES.indexOf(v) + 1]];

export function Rules({ onClose }) {
  return (
    <Modal onClose={onClose}><h2>Truco paulista</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• Baralho sem 8, 9 e 10. Cada um recebe <b>3 cartas</b> e uma carta é virada: a <b>vira</b>.</p>
        <p>• Da mais fraca pra mais forte: <b>4 5 6 7 Q J K A 2 3</b>.</p>
        <p>• <b>Manilha</b> é a carta seguinte à vira (vira 7 → manilha Q; vira 3 → manilha 4). Ela ganha de todas. Entre as manilhas: ♦ pica-fumo, ♠ espadilha, ♥ copas e ♣ <b>zap</b>, a mais forte.</p>
        <p>• A mão tem até 3 rodadas: quem fizer <b>2</b> leva. Se a 1ª empatar, quem ganhar a 2ª leva. Se empatar depois, leva quem fez a 1ª.</p>
        <p>• A mão vale 1. Na sua vez você pode pedir <b>truco</b> (3). O outro aceita, corre ou aumenta pra <b>seis</b>, <b>nove</b> e <b>doze</b>. Quem corre dá o valor de antes do pedido.</p>
        <p>• <b>Mão de onze:</b> quem tem 11 vê as cartas (nas duplas, também as do parceiro) e decide se joga, valendo 3, ou corre, dando 1 ao outro. Não tem truco.</p>
        <p>• Ganha quem fizer <b>12 pontos</b>.</p>
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

export const TRUCO_CSS = `
.tr-menu .hdr{align-items:center}
.tr-logo{font:700 clamp(26px,6vmin,40px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px}
.tr-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:4px}
.tr-box{margin:auto;width:min(440px,94vw);background:linear-gradient(180deg,#2a2218,#15110b);border:2px solid var(--gold2);border-radius:20px;padding:16px 18px;text-align:center}
.tr-box h2{margin:0 0 8px;font:700 24px Oswald;color:var(--gold);text-transform:uppercase;font-style:italic}
.tr{overflow:hidden}
.tr-top{display:flex;align-items:center;gap:clamp(8px,2vw,20px);padding:8px 12px 0}
.tr-score{display:flex;align-items:center;gap:8px;background:#0c0a07;border:2px solid var(--gold2);border-radius:16px;padding:3px 14px}
.tr-score div{display:flex;flex-direction:column;align-items:center;line-height:1}
.tr-score small{font:500 11px Oswald;color:var(--mut);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tr-score b{font:700 26px Oswald;color:#fff}
.tr-score .hot b{color:#f97316}
.tr-score i{font:500 16px Oswald;color:var(--mut);font-style:normal}
.tr-val{font:500 15px Oswald;background:#000a;border:1.5px solid var(--gold2);border-radius:20px;padding:5px 14px;display:flex;align-items:baseline;gap:6px}
.tr-val b{font-size:22px;color:var(--gold)}.tr-val small{font-size:11px;color:#f97316}
.tr-vz{display:flex;gap:6px;margin-left:auto}
.tr-vz i{width:16px;height:16px;border-radius:50%;background:#0006;border:2px solid #fff4}
.tr-vz i.ok{background:#22c55e;border-color:#bbf7d0}.tr-vz i.no{background:#ef4444;border-color:#fecaca}.tr-vz i.eq{background:#a3a3a3;border-color:#eee}
.tr .rail{inset:4px clamp(6px,3vw,60px) 0}
.tr-vira{position:absolute;left:22%;top:26%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;z-index:2}
.tr-vira .card{--cw:clamp(34px,8vmin,56px);transform:rotate(-8deg);box-shadow:0 3px 8px rgba(0,0,0,.45)}
.tr-vira span{font:500 12px Oswald;color:#0009;background:#fff6;border-radius:8px;padding:1px 8px;white-space:nowrap}
.tr-vira b{color:#7a0010}
.tr-backs{display:flex;position:absolute;left:calc(50% + clamp(26px,5vmin,36px));top:4px}
.seat.rt .tr-backs{left:auto;right:calc(50% + clamp(26px,5vmin,36px))}
.tr-backs .back{--cw:clamp(18px,4vmin,28px);border-width:2px;margin-left:calc(var(--cw)*-.45);box-shadow:0 2px 4px rgba(0,0,0,.4)}
.tr-backs .back:first-child{margin-left:0}.tr-backs .back::after{display:none}
.tr-played{position:absolute;transform:translate(-50%,-50%);z-index:3;animation:trIn .25s cubic-bezier(.2,.8,.3,1)}
.tr-played .card{--cw:clamp(44px,10vmin,72px);box-shadow:0 4px 10px rgba(0,0,0,.45)}
.tr-played.win .card{box-shadow:0 0 0 3px var(--gold),0 0 20px var(--gold)}
@keyframes trIn{from{transform:translate(-50%,-50%) scale(1.4);opacity:0}}
.card.mani{background:linear-gradient(160deg,#fff9e0,#fde68a);box-shadow:0 0 0 2px var(--gold),0 3px 8px rgba(0,0,0,.4)}
.tr-shout{position:absolute;top:-6px;left:50%;transform:translate(-50%,-100%);background:linear-gradient(180deg,#ffe08a,#e0a100);color:#3a2300;font:700 20px Oswald;padding:4px 14px;border-radius:14px;border:2px solid #000;white-space:nowrap;animation:pop .2s;z-index:9;box-shadow:0 6px 14px rgba(0,0,0,.5)}
.tr-shout.me{top:auto;bottom:6%;transform:translateX(-50%)}
.tr-dealer{position:absolute;top:-4px;left:-6px;width:20px;height:20px;border-radius:50%;background:#fff;color:#123;font:700 11px Rubik;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px #0006}
.tr-mine{display:flex;align-items:flex-end;gap:12px;padding:2px 12px 8px;justify-content:center}
.tr-me{position:relative;align-self:center}
.tr-me .av{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:radial-gradient(circle at 40% 30%,#0f7a48,#064a2b);border:3px solid rgba(255,255,255,.35)}
.tr-me.turn .av{border-color:var(--gold);animation:pulse 1s infinite alternate}
.tr-hand{display:flex;gap:clamp(6px,1.5vw,14px);min-height:calc(clamp(58px,15vmin,96px)*1.42)}
.tr-hand .card{--cw:clamp(58px,15vmin,96px);transition:transform .15s;box-shadow:0 4px 10px rgba(0,0,0,.45)}
.tr-hand .card.can{cursor:pointer}
.tr-hand .card.can:active{transform:translateY(-14px)}
@media (hover:hover){.tr-hand .card.can:hover{transform:translateY(-12px)}}
.tr-acts{display:flex;flex-direction:column;gap:6px;align-self:center;min-width:clamp(110px,18vw,160px)}
.tr-acts.resp{flex-direction:row}.tr-acts.resp .tr-b{padding:12px clamp(10px,1.8vw,18px);font-size:clamp(16px,3vmin,20px);white-space:nowrap}
.seat.rt .tr-dealer{left:auto;right:-6px}
.tr-b{border:2px solid #000;border-radius:24px;padding:8px 14px;font:700 17px Oswald;color:#fff;text-shadow:0 1px 2px #0008;box-shadow:0 4px 0 #0007}
.tr-b.big{font-size:24px;padding:12px 16px}
.tr-b.up{background:linear-gradient(180deg,#fb923c,#c2410c)}
.tr-b.ok{background:linear-gradient(180deg,#34d399,#059669)}
.tr-b.no{background:linear-gradient(180deg,#f87171,#b91c1c)}
.tr-b:disabled{opacity:.35;filter:grayscale(.7)}
.tr-onze{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin:6px 0}
.tr-onze small{display:block;font:500 12px Oswald;color:var(--mut);margin-bottom:4px}
.tr-onze>div>div{display:flex;gap:4px}.tr-onze .card{--cw:52px}
`;

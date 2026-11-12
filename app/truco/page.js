'use client';
// TRUCO PAULISTA contra o computador (1x1 ou duplas). Precisa ter fichas no saldo, mas aqui elas não são gastas.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Card, Modal, Seg, toast } from '../../components/ui.js';
import { fmt } from '../../lib/modes.js';
import { sfx } from '../../lib/sfx.js';
import { newMatch, act, needs, botMove, canCall, isManilha, teamOf, manilhaRank, RANKS, CALL_NAME, MAN_NAME, VALUES } from '../../lib/truco.js';

const BOTS = [['Tião', '🤠'], ['Dona Cida', '🦉'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zé', '🎩']];
// posição na mesa vista por quem joga (lugar 0 = você, embaixo)
const SEATS = { 2: [null, [50, 9]], 4: [null, [7, 46], [50, 9], [93, 46]] };
const PLAYED = { 2: [[50, 70], [50, 38]], 4: [[50, 72], [33, 52], [50, 40], [67, 52]] };
const verb = (G, t, um, varios) => G.n === 4 && t === 1 ? varios : um;
const nextCall = v => CALL_NAME[VALUES[VALUES.indexOf(v) + 1]];

export default function Truco() {
  const router = useRouter();
  const { profile } = useAuth();
  const [cfg, setCfg] = useState({ n: 2, level: 'medio' });
  const [M, setM] = useState(null);
  const [ver, setVer] = useState(0);
  const [shout, setShout] = useState(null);
  const [msg, setMsg] = useState('');
  const [rules, setRules] = useState(false);
  const tRef = useRef(null);
  const bump = () => setVer(v => v + 1);

  const say = useCallback((pi, text, ms = 1300) => {
    setShout({ pi, text }); clearTimeout(say._t); say._t = setTimeout(() => setShout(null), ms);
  }, []);

  const nameOf = (G, pi) => pi === 0 ? 'Você' : G.players[pi].name;
  const teamName = (G, t) => G.n === 2 ? (t === 0 ? 'Você' : G.players[1].name) : (t === 0 ? 'Sua dupla' : 'Os adversários');

  // aplica uma jogada e mostra o que aconteceu
  const play = useCallback((G, pi, mv) => {
    const r = act(G, pi, mv);
    if (!r.ok) { if (pi === 0) { sfx('err'); toast(r.err); } return false; }
    const ev = r.ev;
    if (mv.type === 'play') sfx('card');
    if (ev.type === 'truco') { say(pi, (ev.value === 3 ? 'TRUCO!' : ev.value + '! ' + CALL_NAME[ev.value] + '!'), 1500); sfx('turn'); setMsg(`<b>${nameOf(G, pi)}</b> ${ev.raise ? 'aumentou pra' : 'pediu'} <b>${CALL_NAME[ev.value]}</b> (vale ${ev.value})`); }
    if (ev.type === 'aceitar') { say(pi, 'Desce!'); setMsg(`<b>${nameOf(G, pi)}</b> aceitou: a mão vale <b>${ev.value}</b>`); }
    if (ev.type === 'onze') { say(pi, 'Vamos jogar!'); setMsg('Mão de onze: vale <b>3</b>'); }
    if (ev.type === 'play' && !ev.vazaEv) setMsg('');
    const vz = ev.vazaEv || (ev.type === 'play' && ev.vaza !== undefined ? ev : null);
    if (vz && vz.vaza !== undefined && ev.type !== 'hand') setMsg(vz.vaza < 0 ? 'Empatou (cangou)' : `<b>${teamName(G, vz.vaza)}</b> ${verb(G, vz.vaza, 'fez', 'fizeram')} a rodada`);
    if (ev.type === 'hand') {
      if (mv.type === 'correr' || mv.type === 'onze') say(pi, 'Corro!');
      const who = ev.team < 0 ? null : teamName(G, ev.team);
      setMsg(ev.team < 0 ? 'Tudo empatado: ninguém marca' : `<b>${who}</b> ${verb(G, ev.team, 'ganhou', 'ganharam')} a mão <b>+${ev.pts}</b>${ev.why === 'correu' ? ' (o outro correu)' : ev.why === 'correu da mão de onze' ? ' (correram da mão de onze)' : ''}`);
      setTimeout(() => sfx(ev.team === 0 ? 'coin' : 'lose'), 250);
      if (G.over) setTimeout(() => sfx(G.over.team === 0 ? 'win' : 'lose'), 900);
    }
    bump();
    return true;
  }, [say]);

  // computador e passagem do tempo
  useEffect(() => {
    clearTimeout(tRef.current);
    if (!M || M === 'semfichas') return;
    const nd = needs(M);
    if (nd.kind === 'over') return;
    if (nd.kind === 'vaza') { tRef.current = setTimeout(() => { act(M, 0, { type: 'next' }); bump(); }, 1200); return; }
    if (nd.kind === 'hand') { tRef.current = setTimeout(() => { act(M, 0, { type: 'next' }); setMsg(''); sfx('card'); bump(); }, 2200); return; }
    if (nd.kind === 'onze') { if (nd.team === 0) { sfx('turn'); return; } tRef.current = setTimeout(() => play(M, 1, botMove(M, 1, cfg.level)), 1100); return; }
    if (nd.kind === 'resp') { if (nd.team === 0) return; tRef.current = setTimeout(() => play(M, nd.pi, botMove(M, nd.pi, cfg.level)), 1300); return; }
    if (nd.pi === 0) { sfx('turn'); return; }
    tRef.current = setTimeout(() => play(M, nd.pi, botMove(M, nd.pi, cfg.level)), M.table.length ? 750 : 950);
    return () => clearTimeout(tRef.current);
  }, [M, ver, play, cfg.level]);

  function start() {
    if (!profile) return;
    if ((profile.coins || 0) < 1) return setM('semfichas');
    const pool = BOTS.slice().sort(() => Math.random() - .5);
    const players = [{ name: profile.nickname || 'Você', avatar: profile.avatar || '😎' }];
    for (let i = 1; i < cfg.n; i++) players.push({ name: pool[i][0], avatar: pool[i][1], bot: true });
    const G = newMatch(players);
    setMsg(''); setShout(null); setM(G); bump(); sfx('card');
  }

  /* ------------------------- MENU ------------------------- */
  if (!M || M === 'semfichas') return (
    <div className="page lounge tr-menu">
      <div className="hdr"><button className="rbtn" onClick={() => router.push('/')}>↩</button>
        <div className="tr-logo">TRUCO <small>paulista</small></div>
        <a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a></div>
      <div className="tr-box">
        <h2>🤖 Contra o computador</h2>
        <Seg label="Mesa" value={cfg.n} onChange={v => setCfg(c => ({ ...c, n: v }))} options={[[2, '1 contra 1'], [4, 'Duplas (2x2)']]} />
        <Seg label="Computador" value={cfg.level} onChange={v => setCfg(c => ({ ...c, level: v }))} options={[['facil', 'Fácil'], ['medio', 'Esperto']]} />
        <button className="go" disabled={!profile} onClick={start}>▶ Jogar</button>
        <button className="sec" onClick={() => setRules(true)}>📖 Regras do truco paulista</button>
        <p className="hint" style={{ textAlign: 'center' }}>É preciso ter fichas no saldo. Contra o computador elas não são gastas. Truco online com amigos: em breve.</p>
      </div>
      {rules && <Rules onClose={() => setRules(false)} />}
      {M === 'semfichas' && <Modal onClose={() => setM(null)}><h2>Sem fichas</h2>
        <p>Para jogar, inclusive contra o computador, você precisa ter fichas no saldo.</p>
        <button className="go" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas com Pix</button>
        <button className="sec" onClick={() => setM(null)}>Fechar</button></Modal>}
      <style>{CSS}</style>
    </div>
  );

  /* ------------------------- MESA ------------------------- */
  const G = M, nd = needs(G), me = G.players[0];
  const myTurn = nd.kind === 'play' && nd.pi === 0;
  const respond = nd.kind === 'resp' && nd.team === 0;
  const onzeMe = nd.kind === 'onze' && nd.team === 0;
  const man = RANKS[manilhaRank(G.vira)];
  const partner = G.n === 4 ? G.players[2] : null;
  const canRaise = respond && VALUES.indexOf(G.pending.value) < VALUES.length - 1;

  return (
    <div className="page lounge tr">
      <div className="tr-top">
        <button className="rbtn" onClick={() => { if (G.phase === 'over' || confirm('Sair da partida?')) setM(null); }}>↩</button>
        <div className="tr-score">
          <div className={G.score[0] >= 11 ? 'hot' : ''}><small>{G.n === 2 ? 'VOCÊ' : 'NÓS'}</small><b>{G.score[0]}</b></div>
          <i>x</i>
          <div className={G.score[1] >= 11 ? 'hot' : ''}><small>{G.n === 2 ? G.players[1].name.toUpperCase() : 'ELES'}</small><b>{G.score[1]}</b></div>
        </div>
        <div className="tr-val">Vale <b>{G.value}</b>{G.ferro && <small>mão de ferro</small>}{G.onze !== null && <small>mão de onze</small>}</div>
        <div className="tr-vz">{[0, 1, 2].map(k => <i key={k} className={G.vazas[k] === undefined ? '' : G.vazas[k] < 0 ? 'eq' : G.vazas[k] === 0 ? 'ok' : 'no'} />)}</div>
      </div>

      <div id="arena"><div className="rail"><div className="felt">
        <div className="wm"><b>Cacheta Club</b><small>TRUCO PAULISTA</small></div>
        <div className="tr-vira"><Card c={G.vira} /><span>Vira · manilha <b>{man}</b></span></div>
        {G.players.map((p, i) => i === 0 ? null : (
          <div key={i} className={`seat ${SEATS[G.n][i][0] > 60 ? 'rt' : ''} ${nd.pi === i && (nd.kind === 'play' || nd.kind === 'resp') ? 'turn' : ''}`} style={{ left: SEATS[G.n][i][0] + '%', top: SEATS[G.n][i][1] + '%' }}>
            <div className="av">{p.avatar}</div>
            <div className="np"><b>{p.name}</b><small>{G.n === 4 && i === 2 ? 'parceiro' : 'adversário'}</small></div>
            <div className="tr-backs">{p.hand.map(c => <div key={c.id} className="back" />)}</div>
            {shout && shout.pi === i && <div className="tr-shout">{shout.text}</div>}
            {G.dealer === i && <span className="tr-dealer">D</span>}
          </div>))}
        {G.table.map(x => (
          <div key={x.card.id} className={`tr-played ${G.vazaWinner === x.pi ? 'win' : ''}`} style={{ left: PLAYED[G.n][x.pi][0] + '%', top: PLAYED[G.n][x.pi][1] + '%' }}>
            <Card c={x.card} cls={isManilha(x.card, G.vira) ? 'mani' : ''} />
          </div>))}
        {shout && shout.pi === 0 && <div className="tr-shout me">{shout.text}</div>}
      </div></div></div>

      <div id="msg" dangerouslySetInnerHTML={{ __html: msg || (myTurn ? 'Sua vez: <b>toque numa carta</b>' : respond ? `<b>${CALL_NAME[G.pending.value]}!</b> Aceita, corre ou aumenta?` : '&nbsp;') }} />

      <div className="tr-mine">
        <div className={`tr-me ${myTurn ? 'turn' : ''}`}><div className="av">{me.avatar}</div>{G.dealer === 0 && <span className="tr-dealer">D</span>}</div>
        <div className="tr-hand">
          {me.hand.map(c => <Card key={c.id} c={c} cls={`${isManilha(c, G.vira) ? 'mani' : ''} ${myTurn ? 'can' : ''}`} onClick={() => myTurn && play(G, 0, { type: 'play', id: c.id })} />)}
        </div>
        <div className={`tr-acts ${respond ? 'resp' : ''}`}>
          {respond ? <>
            <button className="tr-b ok" onClick={() => play(G, 0, { type: 'aceitar' })}>✔ Aceito</button>
            {canRaise && <button className="tr-b up" onClick={() => play(G, 0, { type: 'aumentar' })}>{nextCall(G.pending.value)}!</button>}
            <button className="tr-b no" onClick={() => play(G, 0, { type: 'correr' })}>✖ Corro</button>
          </> : <button className="tr-b up big" disabled={!canCall(G, 0)} onClick={() => play(G, 0, { type: 'truco' })}>{nextCall(G.value) || 'TRUCO'}!</button>}
        </div>
      </div>

      {onzeMe && <Modal><h2>Mão de onze</h2>
        <p>{G.n === 2 ? 'Você está' : 'Sua dupla está'} com 11. Olhe as cartas e decida: jogar vale <b>3</b>; correr dá <b>1</b> ponto pro outro time.</p>
        <div className="tr-onze"><div><small>Suas cartas</small><div>{me.hand.map(c => <Card key={c.id} c={c} cls={isManilha(c, G.vira) ? 'mani' : ''} />)}</div></div>
          {partner && <div><small>Cartas do {partner.name}</small><div>{partner.hand.map(c => <Card key={c.id} c={c} cls={isManilha(c, G.vira) ? 'mani' : ''} />)}</div></div>}</div>
        <p style={{ fontSize: 13 }}>Vira <b>{RANKS[G.vira.r]}</b> · manilha <b>{man}</b></p>
        <button className="go" onClick={() => play(G, 0, { type: 'onze', jogar: true })}>Jogar (vale 3)</button>
        <button className="sec" onClick={() => play(G, 0, { type: 'onze', jogar: false })}>Correr</button></Modal>}

      {G.phase === 'over' && <Modal><h2>{G.over.team === 0 ? '🏆 Vitória!' : 'Não foi dessa vez'}</h2>
        <div className="prize">{G.score[0]} x {G.score[1]}</div>
        <p>{G.over.team === 0 ? (G.n === 2 ? 'Você ganhou a partida!' : 'Sua dupla ganhou a partida!') : `${teamName(G, 1)} ${verb(G, 1, 'ganhou', 'ganharam')} a partida.`}</p>
        <button className="go" onClick={start}>Jogar de novo</button>
        <button className="sec" onClick={() => setM(null)}>Voltar ao menu</button></Modal>}
      <style>{CSS}</style>
    </div>
  );
}

function Rules({ onClose }) {
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

const CSS = `
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

'use client';
// TRUCO PAULISTA contra o computador (1x1 ou duplas). Cada partida custa 1 ficha (cobrada no servidor: /api/treino).
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Card, Modal, Seg, toast } from '../../components/ui.js';
import { fmt } from '../../lib/modes.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx } from '../../lib/sfx.js';
import { SEATS, PLAYED, nextCall, Rules, TRUCO_CSS as CSS } from '../../components/Truco.js';
import { newMatch, act, needs, botMove, canCall, isManilha, teamOf, manilhaRank, RANKS, CALL_NAME, MAN_NAME, VALUES } from '../../lib/truco.js';

const BOTS = [['Tião', '🤠'], ['Dona Cida', '🦉'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zé', '🎩']];
const verb = (G, t, um, varios) => G.n === 4 && t === 1 ? varios : um;

export default function Truco() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth();
  const [cfg, setCfg] = useState({ n: 2, level: 'medio' });
  const [M, setM] = useState(null);
  const [busy, setBusy] = useState(false);
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

  async function start() {
    if (!profile || busy) return;
    if ((profile.coins || 0) < 1) return setM('semfichas');
    setBusy(true);
    try { await api('/api/treino', { jogo: 'truco' }); reloadProfile && reloadProfile(); }
    catch (e) { setBusy(false); if (/fichas/i.test(e.message)) return setM('semfichas'); return toast(e.message); }
    setBusy(false);
    const pool = BOTS.slice().sort(() => Math.random() - .5);
    const players = [{ name: profile.nickname || 'Você', avatar: profile.avatar || '😎' }];
    for (let i = 1; i < cfg.n; i++) players.push({ name: pool[i][0], avatar: pool[i][1], bot: true });
    const G = newMatch(players);
    setMsg(''); setShout(null); setM(G); bump(); sfx('card');
  }

  /* ------------------------- MENU ------------------------- */
  if (!M || M === 'semfichas') return (
    <div className="page lounge tr-menu">
      <div className="hdr"><button className="rbtn" onClick={() => router.push('/jogos/truco')}>↩</button>
        <div className="tr-logo">TRUCO <small>paulista</small></div>
        <a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a></div>
      <div className="tr-box">
        <h2>🤖 Contra o computador</h2>
        <Seg label="Mesa" value={cfg.n} onChange={v => setCfg(c => ({ ...c, n: v }))} options={[[2, '1 contra 1'], [4, 'Duplas (2x2)']]} />
        <Seg label="Computador" value={cfg.level} onChange={v => setCfg(c => ({ ...c, level: v }))} options={[['facil', 'Fácil'], ['medio', 'Esperto']]} />
        <button className="go" disabled={!profile || busy} onClick={start}>{busy ? 'Começando…' : '▶ Jogar · 1 ficha'}</button>
        <button className="sec" onClick={() => setRules(true)}>📖 Regras do truco paulista</button>
        <p className="hint" style={{ textAlign: 'center' }}>Contra o computador cada partida custa 1 ficha. Pra jogar com amigos valendo fichas, use o Truco online.</p>
      </div>
      {rules && <Rules onClose={() => setRules(false)} />}
      {M === 'semfichas' && <Modal onClose={() => setM(null)}><h2>Sem fichas</h2>
        <p>Cada partida contra o computador custa 1 ficha. Compre fichas pra jogar.</p>
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
        <div className="tr-score">
          <div className={G.score[0] >= 11 ? 'hot' : ''}><small>{G.n === 2 ? 'VOCÊ' : 'NÓS'}</small><b>{G.score[0]}</b></div>
          <i>x</i>
          <div className={G.score[1] >= 11 ? 'hot' : ''}><small>{G.n === 2 ? G.players[1].name.toUpperCase() : 'ELES'}</small><b>{G.score[1]}</b></div>
        </div>
        <div className="tr-val">Vale <b>{G.value}</b>{G.ferro && <small>mão de ferro</small>}{G.onze !== null && <small>mão de onze</small>}</div>
        <div className="tr-vz">{[0, 1, 2].map(k => <i key={k} className={G.vazas[k] === undefined ? '' : G.vazas[k] < 0 ? 'eq' : G.vazas[k] === 0 ? 'ok' : 'no'} />)}</div>
        <button className="rbtn" title="Voltar" onClick={() => { if (G.phase === 'over' || confirm('Sair da partida?')) setM(null); }}>↩</button>
      </div>

      <div id="arena"><div className="rail"><div className="felt">
        <div className="wm"><b>Casa de Jogos</b><small>TRUCO PAULISTA</small></div>
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
        <button className="go" disabled={busy} onClick={start}>Jogar de novo · 1 ficha</button>
        <button className="sec" onClick={() => setM(null)}>Voltar ao menu</button></Modal>}
      <style>{CSS}</style>
    </div>
  );
}


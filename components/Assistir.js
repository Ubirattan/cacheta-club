'use client';
// Assistir uma mesa de cacheta em andamento (só salas públicas).
// Quem assiste vê a mesa ao vivo (descarte, vira, monte, de quem é a vez, quantas cartas cada um tem),
// mas NUNCA as cartas da mão de ninguém: o servidor só manda o estado público.
// Não joga, não senta no meio da partida e só lê o chat. Assistir é grátis.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb, api } from '../lib/supabase-browser.js';
import { Header, Card, Modal, toast } from './ui.js';
import { Engine } from '../lib/engine.js';
import { modeName, fmt } from '../lib/modes.js';
import { sfx } from '../lib/sfx.js';
import { looks } from '../lib/shop-items.js';
import Chat from './Chat.js';

const name = c => Engine.RANKS[c.r] + Engine.SUITS[c.s];
const corTxt = cor => { const c = Engine.corColor(cor); return Engine.RANKS[Engine.corRank(cor)] + (c < 0 ? ' (todos)' : c === 1 ? ' ♥♦' : ' ♠♣'); };
const lastTxt = l => !l ? '' : l.t === 'draw' ? (l.from === 'desc' ? `pegou ${name(l.card)}` : 'comprou do monte') : l.t === 'discard' ? `descartou ${name(l.card)}` : l.t === 'bateuErrado' ? 'errou a batida!' : l.t === 'leave' ? 'saiu da mesa' : l.t === 'bater' ? 'BATEU!' : '';

// todos os jogadores em volta da mesa (a parte de baixo fica livre, ninguém é "você")
function seatPos(k, n, portrait) {
  if (!portrait && n > 4) { const x = 8 + 84 * (k - 1) / (n - 2), dx = (x - 50) / 47; return { x, y: Math.max(15, 56 - 46 * Math.sqrt(Math.max(0, 1 - dx * dx))) }; }
  const [a0, a1] = portrait ? (n <= 4 ? [200, 340] : [165, 375]) : [180, 360];
  const t = n === 2 ? 270 : a0 + (a1 - a0) * (k - 1) / (n - 2), rad = t * Math.PI / 180;
  let x = 50 + (portrait ? 44 : 47) * Math.cos(rad); x = Math.max(portrait ? 12 : 6, Math.min(portrait ? 88 : 94, x));
  const y = 50 + (portrait ? 46 : 44) * Math.sin(rad);
  return { x, y: portrait ? y : Math.max(15, y) };
}

// quantas pessoas estão assistindo (presença em tempo real, sem gravar nada no banco)
export function useWatchers(roomId, user, track) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user || !roomId) return;
    const ch = sb().channel('olho-' + roomId, { config: { presence: { key: user.id } } });
    ch.on('presence', { event: 'sync' }, () => setN(Object.keys(ch.presenceState()).length))
      .subscribe(async st => { if (st === 'SUBSCRIBED' && track) await ch.track({ uid: user.id }); });
    return () => { sb().removeChannel(ch); };
  }, [roomId, user, track]);
  return n;
}

export default function Assistir({ id, user, profile, onSit, onLeave }) {
  const router = useRouter();
  const [d, setD] = useState(null);       // { room, players, state, version, msgs }
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [portrait, setPortrait] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [placar, setPlacar] = useState(false);
  const [visto, setVisto] = useState(null); // partida encerrada que já foi fechada na tela
  const verRef = useRef({ m: null, v: -1 }), lastRef = useRef(null), msgRef = useRef(0), chatRef = useRef(false);
  chatRef.current = chatOpen;
  const watchers = useWatchers(id, user, true);

  // a mesa chega pelo servidor a cada 2 s (só o que é público)
  useEffect(() => {
    let alive = true, busy = false;
    const load = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const r = await api(`/api/rooms/${id}/watch`, {});
        if (!alive) return;
        const st = r.state, cur = verRef.current;
        // ignora resposta atrasada (versão mais velha da mesma partida)
        const keep = st && cur.m === st.matchId && r.version < cur.v;
        if (!keep) verRef.current = { m: st ? st.matchId : null, v: r.version };
        const lastId = r.msgs.length ? r.msgs[r.msgs.length - 1].id : 0;
        if (msgRef.current && lastId > msgRef.current && !chatRef.current) setUnread(u => u + r.msgs.filter(m => m.id > msgRef.current).length);
        msgRef.current = lastId;
        setD(o => keep && o ? { ...r, state: o.state, version: o.version } : r);
        setErr('');
      } catch (e) { if (alive) setErr(e.message); }
      finally { busy = false; }
    };
    load(); const t = setInterval(load, 2000);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    const onR = () => setPortrait(innerHeight > innerWidth); onR(); addEventListener('resize', onR);
    return () => { clearInterval(t); removeEventListener('resize', onR); };
  }, []);

  // som da carta quando alguém joga
  const game = d?.state;
  useEffect(() => {
    if (!game) return;
    const L = game.last, key = JSON.stringify([game.matchId, game.round, L ? [L.t, L.pi, L.card ? L.card.id : null] : null]);
    if (lastRef.current && lastRef.current !== key && L && ['draw', 'discard', 'bater', 'bateuErrado'].includes(L.t)) sfx('card');
    lastRef.current = key;
  }, [game]);

  const sair = () => (onLeave ? onLeave() : router.push('/lobby'));

  if (!d) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      {err ? <><h2 style={{ font: '700 24px Oswald', color: 'var(--gold)' }}>Não dá pra assistir</h2><p>{err}</p>
        <button className="go" onClick={sair}>Voltar às salas</button></> : 'Abrindo a mesa…'}
    </div></div></div>
  );

  const { room, players, msgs } = d;
  const roChat = (onClose) => <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={onClose} readOnly />;
  const olho = <span className="cpill" title="Pessoas assistindo">👁 {Math.max(1, watchers)}</span>;
  const inMatch = game && visto !== game.matchId && (room.status === 'playing' || game.over);

  /* ---------- mesa esperando jogadores (partida acabou ou ainda não começou) ---------- */
  if (!inMatch) {
    const seats = Array.from({ length: room.max_players }, (_, i) => players.find(p => p.seat === i));
    const livre = room.status === 'waiting' && !room.tournament_id && players.length < room.max_players;
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={sair} title="Parar de assistir">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>👁 Assistindo · {room.name}</h3>
            <div className="meta"><span>{modeName(room.mode)}</span><span>👥 {players.length}/{room.max_players}</span><span>Pontos {room.points}</span>
              <span>{room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</span><span>👁 {Math.max(1, watchers)} assistindo</span></div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small></div>
                : <div key={i} className="wseat free">Lugar vago</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>A mesa está esperando a próxima partida. Você continua assistindo quando ela começar.</p>
            {livre && onSit && <button className="go" onClick={onSit}>Sentar na mesa</button>}
            <button className="sec" onClick={sair}>Parar de assistir</button>
          </div>
          {roChat()}
        </div>
      </div>
    );
  }

  /* ---------- MESA (só olhando) ---------- */
  const n = game.players.length;
  const left = game.deadline ? Math.max(0, game.deadline - now) : 0;
  const turnName = game.players[game.turn]?.name;
  const res = game.result;
  const msg = game.over ? (res?.empate ? 'Monte esgotado' : res?.semJogo ? 'Rodada sem jogo' : `<b>${game.players[res?.winner]?.name || ''}</b> bateu!`)
    : game.phase === 'decide' ? 'Os jogadores estão decidindo se jogam a rodada…'
    : `Vez de <b>${turnName}</b> · ${Math.ceil(left / 1000)}s`;
  const lk = looks(profile);
  const feltBg = `radial-gradient(ellipse at 50% 45%,${lk.felt.colors[0]} 0%,${lk.felt.colors[1]} 45%,${lk.felt.colors[2]} 100%)`;
  const backBg = `repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 3px,transparent 3px 7px),linear-gradient(135deg,${lk.back.colors[0]},${lk.back.colors[1]})`;

  return (
    <div className="view on" id="game">
      <div className="gtop">
        <div className="l">
          <button className="ico" onClick={() => setPlacar(true)}>👥</button>
          <button className="ico" onClick={() => { setChatOpen(o => !o); setUnread(0); }}>💬{unread > 0 && <span className="badge-n">{unread}</span>}</button>
          <div className="cpill">{game.cor >= 0 ? <>Coringa <b>{corTxt(game.cor)}</b> ★</> : 'Sem coringa'}</div>
          {olho}
        </div>
        <button className="mesas" onClick={sair}><i>👁</i><span>Sair</span></button>
      </div>
      <div id="arena">
        <div className="rail"><div className="felt" style={{ background: feltBg }}>
          <div className="wm"><b>CASA DE JOGOS</b><small>{modeName(room.mode)} · {game.cfg.entry ? `Pote ${fmt(game.pot)} · ` : ''}Sala {room.code}</small></div>
          <div className="center">
            <div id="msg"><span dangerouslySetInnerHTML={{ __html: msg }} /></div>
            <div className="piles">
              <div className="pile">
                <div id="viraBox">{game.vira && <Card c={game.vira} cor={game.cor} cls="vira" />}</div>
                <div id="monte"><div className="back" style={{ background: backBg, borderColor: lk.back.gold ? '#f2c94c' : '#fff' }}><b>{game.monte}</b></div></div></div>
              <div className="pile"><div className="corbox">
                {game.cor >= 0
                  ? <div className="vcol"><small>Coringas</small><div className="cc">{Engine.corSuits(game.cor).map(s => <Card key={s} c={{ id: -10 - s, r: Engine.corRank(game.cor), s }} cor={game.cor} />)}</div></div>
                  : <div className="vcol"><small>Sem<br />coringa</small></div>}</div></div>
              <div className="pile"><div id="desc">
                {game.descTop ? <Card c={game.descTop} cor={game.cor} cls={Engine.isJ(game.descTop, game.cor) ? 'lockj' : ''} /> : <div className="slot">🗑</div>}</div></div>
            </div>
          </div>
          <div id="seats" className={n >= 8 ? 'many' : ''}>
            {game.players.map((p, pi) => {
              const { x, y } = seatPos(pi + 1, n + 1, portrait), turn = game.turn === pi && !game.over;
              return (
                <div key={p.uid} id={`seat-${pi}`} className={`seat ${turn && game.phase !== 'decide' ? 'turn' : ''} ${p.fichas <= 0 || p.out ? 'out' : ''} ${x > 60 ? 'rt' : ''}`} style={{ left: x + '%', top: y + '%' }}>
                  <div className="av">{p.avatar}{p.fichas > 0 && <span className="cnt">🂠{p.count}</span>}</div>
                  <div className="np"><b>{p.name}</b><small>{p.left ? 'saiu' : p.fichas > 0 ? `${p.fichas} pts` : 'eliminado'}</small></div>
                  {game.phase === 'decide' && p.fichas > 0 ? <div className="bubble">{p.dec ? '✓ decidiu' : 'decidindo…'}</div>
                    : game.last?.t === 'decidido' && p.dec ? <div className="bubble">{p.dec === 'go' ? 'vai jogar' : p.dec === 'quit' ? 'desistiu' : 'correu (−1)'}</div>
                    : game.last?.pi === pi && lastTxt(game.last) && <div className="bubble">{lastTxt(game.last)}{game.last.timeout ? ' ⏱' : ''}</div>}
                </div>
              );
            })}
          </div>
        </div></div>
      </div>
      <div id="mine"><div className="hint" style={{ textAlign: 'center', padding: '10px 0', color: 'var(--gold)' }}>👁 Você está assistindo. As cartas dos jogadores ficam escondidas.</div></div>

      {chatOpen && <div className="chatfloat">{roChat(() => setChatOpen(false))}</div>}

      {placar && <Modal onClose={() => setPlacar(false)}><h2>Placar</h2>
        <div className="score">{game.players.map(p => <div key={p.uid}><span>{p.avatar} {p.name}</span><b>{p.left ? 'saiu' : p.fichas > 0 ? p.fichas + ' pts' : 'fora'}</b></div>)}</div>
        {game.cfg.entry ? <p>Pote: 💰 {fmt(game.pot)}</p> : null}<button className="go" onClick={() => setPlacar(false)}>Fechar</button></Modal>}

      {game.over && res && (
        <Modal>
          <h2>{res.empate ? 'Monte esgotado' : res.matchOver ? `${game.players[res.champion]?.name || 'Ninguém'} venceu 🏆` : res.semJogo ? 'Rodada sem jogo' : `${game.players[res.winner]?.name} bateu`}</h2>
          {res.melds && <div className="melds">{res.melds.map((m, i) => <div key={i} className="meld">{m.map(c => <Card key={c.id} c={c} cor={game.cor} />)}</div>)}</div>}
          <div className="score">{game.players.map((p, i) => {
            const dd = res.before ? p.fichas - res.before[i] : 0;
            return <div key={p.uid}><span>{p.avatar} {p.name}</span>{dd < 0 && <span className="d" style={{ flex: 'none' }}>{dd}</span>}{i === res.winner && !res.empate && <span className="w" style={{ flex: 'none' }}>{res.semJogo ? 'ganhou' : 'bateu'}</span>}<b>{p.fichas > 0 ? p.fichas + ' pts' : 'fora'}</b></div>;
          })}</div>
          {res.matchOver
            ? <><p>Partida encerrada.</p><button className="go" onClick={() => setVisto(game.matchId)}>Ver a sala</button><button className="sec" onClick={sair}>Parar de assistir</button></>
            : <p style={{ marginTop: 14, color: 'var(--gold)' }}>Próxima rodada em {Math.max(0, Math.ceil(((game.nextRoundAt || now) - now) / 1000))} s…</p>}
        </Modal>
      )}
    </div>
  );
}

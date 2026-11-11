'use client';
// Sala online: espera (lugares, pronto, convite, chat) e mesa da partida em tempo real.
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../components/useAuth.js';
import { Header, Card, Modal, toast } from '../../../components/ui.js';
import { Engine } from '../../../lib/engine.js';
import { MODES, fmt } from '../../../lib/modes.js';
import { sfx } from '../../../lib/sfx.js';
import { looks } from '../../../lib/shop-items.js';

// animação de carta voando (mesmo efeito do modo offline)
function cardStr(c, cor) {
  const red = c.s === 1 || c.s === 2, r = Engine.RANKS[c.r], s = Engine.SUITS[c.s] + '\uFE0E', jk = Engine.isJ(c, cor);
  const mid = c.r >= 10 ? `<div class="face"><b>${r}</b><i>${s}</i></div>` : `<div class="ctr">${s}</div>`;
  return `<div class="card s${c.s} ${red ? 'red' : ''} ${jk ? 'joker' : ''}"><div class="ix"><b>${r}</b><i>${s}</i></div>${mid}<div class="ix br"><b>${r}</b><i>${s}</i></div></div>`;
}
function fly(fromSel, toSel, html) {
  const a = document.querySelector(fromSel), b = document.querySelector(toSel);
  if (!a || !b) return;
  const fr = a.getBoundingClientRect(), tr = b.getBoundingClientRect();
  const g = document.createElement('div'); g.className = 'ghost'; g.innerHTML = html;
  g.style.left = (fr.left + fr.width / 2 - 30) + 'px'; g.style.top = (fr.top + fr.height / 2 - 42) + 'px';
  document.body.appendChild(g);
  const dx = (tr.left + tr.width / 2) - (fr.left + fr.width / 2), dy = (tr.top + tr.height / 2) - (fr.top + fr.height / 2);
  try {
    g.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx}px,${dy}px) rotate(${dx > 0 ? 6 : -6}deg)`, offset: .7 }, { transform: `translate(${dx}px,${dy}px)` }], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' })
      .finished.then(() => g.remove(), () => g.remove());
  } catch { g.remove(); }
}

const name = c => Engine.RANKS[c.r] + Engine.SUITS[c.s];

// onde soltar a carta arrastada: em cima de um grupo = entra nele; no espaço entre grupos = grupo novo
function dropTarget(x, id) {
  const info = [...document.querySelectorAll('#hand .grp')].map(g => { const r = g.getBoundingClientRect(); return { el: g, gi: +g.dataset.gi, l: r.left, r: r.right, cs: [...g.querySelectorAll('.card')].filter(c => +c.dataset.id !== id) }; });
  for (const it of info) {
    if (it.cs.length && x >= it.l + 8 && x <= it.r - 8) { let idx = 0; for (const c of it.cs) { const r = c.getBoundingClientRect(); if (x > r.left + r.width / 2) idx++; } return { kind: 'join', it, idx, info }; }
  }
  let pos = 0; for (const it of info) if (x > (it.l + it.r) / 2) pos++;
  return { kind: 'new', pos, info };
}
const clearMarks = () => { document.querySelectorAll('#hand .insL,#hand .insR,#hand .gapL,#hand .gapR').forEach(e => e.classList.remove('insL', 'insR', 'gapL', 'gapR')); document.getElementById('desc')?.classList.remove('droptgt'); };
function overDesc(x, y) { const e = document.getElementById('desc'); if (!e) return false; const r = e.getBoundingClientRect(); return x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24; }
function corTxt(cor) { const c = Engine.corColor(cor); return Engine.RANKS[Engine.corRank(cor)] + (c < 0 ? ' (todos)' : c === 1 ? ' ♥♦' : ' ♠♣'); }

function seatPos(k, n, portrait) {
  if (!portrait && n > 4) { const x = 8 + 84 * (k - 1) / (n - 2), dx = (x - 50) / 47; return { x, y: 56 - 46 * Math.sqrt(Math.max(0, 1 - dx * dx)) }; }
  const [a0, a1] = portrait ? (n <= 4 ? [218, 322] : [165, 375]) : [192, 348];
  const t = n === 2 ? 270 : a0 + (a1 - a0) * (k - 1) / (n - 2), rad = t * Math.PI / 180;
  let x = 50 + (portrait ? 44 : 47) * Math.cos(rad); x = Math.max(portrait ? 12 : 6, Math.min(portrait ? 88 : 94, x));
  return { x, y: 50 + (portrait ? 46 : 44) * Math.sin(rad) };
}

function Chat({ roomId, user, profile, msgs, onClose }) {
  const [txt, setTxt] = useState('');
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  async function send(e) {
    e.preventDefault();
    const t = txt.trim(); if (!t) return;
    setTxt('');
    const { error } = await sb().from('messages').insert({ room_id: roomId, user_id: user.id, nickname: profile?.nickname || 'Jogador', text: t.slice(0, 300) });
    if (error) toast('Mensagem não enviada');
  }
  return (
    <div className="panel chat">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 18 }}>💬 Chat da mesa</h3>{onClose && <button className="sec" style={{ width: 'auto', margin: 0, padding: '4px 12px' }} onClick={onClose}>✕</button>}
      </div>
      <div className="msgs" ref={box}>
        {!msgs.length && <div className="hint">Ninguém falou nada ainda. Mande um oi!</div>}
        {msgs.map(m => <div key={m.id} className={`m ${m.user_id === user.id ? 'me' : ''}`}><b>{m.nickname}</b>{m.text}</div>)}
      </div>
      <form onSubmit={send}><input value={txt} onChange={e => setTxt(e.target.value)} maxLength={300} placeholder="Escreva uma mensagem…" /><button className="pillbtn" style={{ padding: '8px 14px' }}>Enviar</button></form>
    </div>
  );
}

export default function Sala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [hand, setHand] = useState([]);
  const [grp, setGrp] = useState([]); // grupos da mão, montados pelo jogador (listas de ids)
  const [msgs, setMsgs] = useState([]);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [modal, setModal] = useState(null);
  const [pass, setPass] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(null);
  const [portrait, setPortrait] = useState(true);
  const [sortMode, setSortMode] = useState(0);
  const lastRef = useRef(null), chatOpenRef = useRef(false), dealRef = useRef(false);
  const dragRef = useRef(null), suppressRef = useRef(false), canDiscardRef = useRef(false), discardRef = useRef(() => {});
  // arrastar cartas da mão com o dedo/mouse para montar os jogos
  useEffect(() => {
    const mv = e => {
      const d = dragRef.current; if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.on && Math.hypot(dx, dy) > 8) { d.on = true; d.el.classList.add('dragging'); }
      if (!d.on) return;
      e.preventDefault();
      d.el.style.transform = `translate(${dx}px,${dy}px) scale(1.06)`;
      clearMarks();
      if (overDesc(e.clientX, e.clientY)) { if (canDiscardRef.current) document.getElementById('desc')?.classList.add('droptgt'); return; }
      const t = dropTarget(e.clientX, d.id);
      if (t.kind === 'join') { if (t.it.cs[t.idx]) t.it.cs[t.idx].classList.add('insL'); else t.it.cs[t.it.cs.length - 1].classList.add('insR'); }
      else if (t.info[t.pos]) t.info[t.pos].el.classList.add('gapL'); else if (t.info.length) t.info[t.info.length - 1].el.classList.add('gapR');
    };
    const up = (e, cancel) => {
      const d = dragRef.current; dragRef.current = null;
      if (!d || !d.on) return;
      d.el.style.transform = ''; d.el.classList.remove('dragging');
      clearMarks();
      suppressRef.current = true; setTimeout(() => { suppressRef.current = false; }, 60);
      if (cancel) return;
      if (overDesc(e.clientX, e.clientY)) { if (canDiscardRef.current) discardRef.current(d.id); return; } // arrastou até o descarte
      const t = dropTarget(e.clientX, d.id);
      setGrp(G => {
        const n = G.map(g => g.filter(x => x !== d.id));
        if (t.kind === 'join') {
          const g = n[t.it.gi]; if (!g) return G;
          const ref = t.it.cs[t.idx] ? +t.it.cs[t.idx].dataset.id : null;
          const at = ref != null ? g.indexOf(ref) : -1; g.splice(at < 0 ? g.length : at, 0, d.id);
        } else {
          const nxt = t.info[t.pos]; n.splice(nxt ? nxt.gi : n.length, 0, [d.id]);
        }
        return n.filter(g => g.length);
      });
      sfx('card');
    };
    const u = e => up(e, false), c = e => up(e, true);
    addEventListener('pointermove', mv, { passive: false }); addEventListener('pointerup', u); addEventListener('pointercancel', c);
    return () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', u); removeEventListener('pointercancel', c); };
  }, []);
  chatOpenRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);

  const loadRoom = useCallback(async () => {
    const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle();
    setRoom(data || null);
  }, [id]);
  const loadPlayers = useCallback(async () => {
    const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat');
    setPlayers(data || []);
  }, [id]);
  const loadGame = useCallback(async () => {
    const { data } = await sb().from('games').select('state').eq('room_id', id).maybeSingle();
    setGame(data ? data.state : null);
  }, [id]);
  const loadHand = useCallback(async () => {
    if (!user) return;
    const { data } = await sb().from('hands').select('cards').eq('room_id', id).eq('user_id', user.id).maybeSingle();
    setHand(data ? data.cards : []);
  }, [id, user]);
  const loadMsgs = useCallback(async () => {
    const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60);
    setMsgs((data || []).reverse());
  }, [id]);

  // carga inicial + tempo real
  useEffect(() => {
    if (!user) return;
    loadRoom(); loadPlayers();
    const ch = sb().channel('sala-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, p => { if (p.eventType === 'DELETE') setRoom(null); else setRoom(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, p => { if ((p.new && p.new.room_id === id) || (p.old && (p.old.room_id === id || !p.old.room_id))) loadPlayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.state) setGame(p.new.state); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.user_id === user.id) setHand(p.new.cards); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` }, p => {
        setMsgs(m => [...m.slice(-80), p.new]);
        if (p.new.user_id !== user.id) { if (!chatOpenRef.current) setUnread(u => u + 1); sfx('msg'); }
      })
      .subscribe(st => { if (st === 'SUBSCRIBED') { loadGame(); loadHand(); loadMsgs(); } });
    return () => { sb().removeChannel(ch); };
  }, [user, id, loadRoom, loadPlayers, loadGame, loadHand, loadMsgs]);

  // depois de entrar na sala, recarrega o que só membros podem ver
  useEffect(() => { if (isMember) { loadGame(); loadHand(); loadMsgs(); } }, [isMember, loadGame, loadHand, loadMsgs]);

  // relógio + "tick" no servidor (cronômetro e próxima rodada)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    const onR = () => setPortrait(innerHeight > innerWidth); onR(); addEventListener('resize', onR);
    return () => { clearInterval(t); removeEventListener('resize', onR); };
  }, []);
  useEffect(() => {
    if (!game || !isMember || room?.status !== 'playing') return;
    const due = (!game.over && game.deadline && now > game.deadline + 1500) || (game.over && game.nextRoundAt && now > game.nextRoundAt);
    if (due && !tickBusy.current) { tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 1500)); }
  }, [now, game, isMember, room, id]);
  const tickBusy = useRef(false);

  // ordem das cartas na mão (cada um organiza do seu jeito)
  useEffect(() => {
    setGrp(G => {
      if (!G.length || dealRef.current) { dealRef.current = false; return groupsFor(hand, sortMode); }
      const ids = new Set(hand.map(c => c.id));
      const kept = G.map(g => g.filter(x => ids.has(x))).filter(g => g.length), seen = new Set(kept.flat());
      return [...kept, ...hand.filter(c => !seen.has(c.id)).map(c => [c.id])]; // carta nova: grupo só dela
    });
    if (sel != null && !hand.some(c => c.id === sel)) setSel(null);
  }, [hand]); // eslint-disable-line
  const myGroups = useMemo(() => grp.map((ids, gi) => ({ gi, cards: ids.map(i => hand.find(c => c.id === i)).filter(Boolean) })).filter(x => x.cards.length), [grp, hand]);
  const myHand = useMemo(() => myGroups.flatMap(x => x.cards), [myGroups]);

  // sons e avisos quando algo acontece na mesa
  const myIdx = game && user ? game.players.findIndex(p => p.uid === user.id) : -1;
  useEffect(() => {
    if (!game) return;
    const key = JSON.stringify([game.round, game.turn, game.phase, game.last, game.over]);
    if (lastRef.current === key) return;
    const first = lastRef.current == null; lastRef.current = key;
    if (first) return;
    if (game.last && ['draw', 'discard', 'bater', 'bateuErrado'].includes(game.last.t)) {
      sfx('card');
      const L = game.last, who = L.pi === myIdx ? '#hand' : `#seat-${L.pi} .av`;
      const back = `<div class="bk" style="--cw:60px"></div>`;
      if (L.t === 'draw') fly(L.from === 'desc' ? '#desc' : '#monte', who, L.card ? `<div style="--cw:60px">${cardStr(L.card, game.cor)}</div>` : back);
      else if (L.card) fly(who, '#desc', `<div style="--cw:60px">${cardStr(L.card, game.cor)}</div>`);
    }
    if (game.over && game.result && !game.result.empate) sfx(game.result.winner === myIdx ? 'win' : 'lose');
    else if (!game.over && game.turn === myIdx && game.phase === 'draw') sfx('turn');
    if (game.last?.t === 'bateuErrado' && game.last.pi === myIdx) setModal(game.last.card ? 'errou' : game.last.fora ? 'errouFora' : 'errouDesc');
    if (game.last?.t === 'deal') { dealRef.current = true; setTimeout(() => { dealRef.current = false; }, 3000); sortHand(sortMode); }
    if (game.over && game.result?.matchOver) reloadProfile();
  }, [game]); // eslint-disable-line

  // 0 = jogos formados + soltas por naipe, 1 = naipe, 2 = valor
  function groupsFor(cards, mode) {
    const cor = game ? game.cor : -1, j = c => Engine.isJ(c, cor);
    const bySuit = (a, b) => a.s - b.s || a.r - b.r, byRank = (a, b) => a.r - b.r || a.s - b.s;
    const split = (list, key) => { const m = new Map(); list.forEach(c => { if (!m.has(key(c))) m.set(key(c), []); m.get(key(c)).push(c); }); return [...m.values()]; };
    let lists;
    if (mode === 0 && game) {
      const an = Engine.analyze(cards, cor, { ...game.cfg, maxJ: 99, aceHigh: true });
      const used = new Set(an.melds.flat().map(c => c.id)), loose = cards.filter(c => !used.has(c.id));
      lists = [...an.melds, ...split(loose.filter(c => !j(c)).sort(bySuit), c => c.s), loose.filter(j)];
    } else {
      const nat = cards.filter(c => !j(c)).sort(mode === 1 ? bySuit : byRank);
      lists = [...split(nat, mode === 1 ? (c => c.s) : (c => c.r)), cards.filter(j)];
    }
    return lists.filter(l => l.length).map(l => l.map(c => c.id));
  }
  function sortHand(mode) { setGrp(groupsFor(hand, mode)); }

  async function act(body) {
    if (busy) return; setBusy(true);
    try { await api(`/api/rooms/${id}/action`, body); if (body.type !== 'draw') setSel(null); }
    catch (e) { sfx('err'); toast(e.message); }
    setBusy(false);
  }
  async function join() {
    setJoinErr('');
    try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); }
    catch (e) { setJoinErr(e.message); }
  }
  async function leave() {
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby');
  }
  async function ready(v) {
    try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); }
  }

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby')}>Ver salas</button></div></div></div>
  );

  // ainda não sentou: tela de entrada (chegou pelo link de convite)
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        {room.vip_only && <p className="vip">👑 Sala exclusiva para VIP</p>}
        <p>{MODES[room.mode]?.name} · 👥 {players.length}/{room.max_players} · Pontos {room.points} · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora. Assim que a partida acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={join}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby')}>Voltar às salas</button>
      </div></div></div>
  );

  const inGame = game && myIdx >= 0 && (room.status === 'playing' || (game.result?.matchOver && dismissed !== game.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- MESA DE TORNEIO ENCERRADA ---------- */
  if (!inGame && room.status === 'closed') return (
    <div className="page lounge"><div className="center-box"><div className="authcard closedbox">
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Mesa encerrada</h2>
      <p>Essa mesa do torneio já terminou.</p>
      {room.tournament_id && <button className="go" onClick={() => router.push('/torneios/' + room.tournament_id)}>Ver o torneio</button>}
      <button className="sec" onClick={leave}>Sair</button></div></div></div>
  );

  /* ---------- SALA DE ESPERA ---------- */
  if (!inGame) {
    const me = players.find(p => p.user_id === user.id);
    const seats = Array.from({ length: room.max_players }, (_, i) => players.find(p => p.seat === i));
    const nReady = players.filter(p => p.ready).length;
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={leave} title="Sair da sala">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>{MODES[room.mode]?.name}</span><span>👥 {players.length}/{room.max_players}</span><span>Pontos {room.points}</span>
              <span>{room.entry ? `Entrada 💰 ${fmt(room.entry)} · pote ${fmt(room.entry * players.length)}` : 'Grátis'}</span><span>⏱ {room.turn_seconds} s</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="invite"><input readOnly value={link} onFocus={e => e.target.select()} />
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(`Bora jogar cacheta! ${link}${room.is_private ? ' (peça a senha pra quem te convidou)' : ''}`); toast('Convite copiado'); } catch { toast('Copie o link acima'); } }}>Copiar convite</button></div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small></div>
                : <div key={i} className="wseat free">Lugar vago</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
              {players.length < 2 ? 'Esperando mais jogadores. Mande o convite!' : `${nReady} de ${players.length} prontos. A partida começa sozinha quando todos estiverem prontos.`}
            </p>
            <button className="go" style={me?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} onClick={() => ready(!me?.ready)}>
              {me?.ready ? 'Cancelar pronto' : '✓ Estou pronto'}</button>
            <button className="sec" onClick={leave}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
      </div>
    );
  }

  /* ---------- MESA ---------- */
  const n = game.players.length;
  const me = game.players[myIdx];
  const cfgFull = { ...game.cfg, maxJ: 99, aceHigh: true };
  const an = Engine.analyze(myHand, game.cor, cfgFull);
  const inM = new Set(an.melds.flat().map(c => c.id));
  const myTurn = !game.over && game.turn === myIdx;
  const canDraw = myTurn && game.phase === 'draw';
  const canEnd = myTurn && game.phase === 'discard';
  canDiscardRef.current = canEnd; discardRef.current = cid => act({ type: 'discard', cardId: cid });
  const turnName = game.players[game.turn]?.name;
  const left = game.deadline ? Math.max(0, game.deadline - now) : 0;
  const pct = game.cfg.turn ? Math.min(100, left / (game.cfg.turn * 1000) * 100) : 0;
  const W = Math.min(typeof innerWidth !== 'undefined' ? innerWidth : 400, 900) - 20;
  const short = typeof innerHeight !== 'undefined' && innerHeight < 520 && !portrait;
  const groups = myGroups, ngap = groups.length - 1;
  const gType = groups.map(x => (x.cards.length >= 3 ? Engine.meldType(x.cards, game.cor, cfgFull) : null));
  const okN = gType.filter(Boolean).length, full = groups.reduce((n, x, i) => n + (gType[i] ? x.cards.length : 0), 0) >= game.cfg.hand;
  const hcw = Math.max(28, Math.min(84, (short ? innerHeight * .2 : 96) / 1.42, (W - (short ? 160 : 0) - (typeof document !== 'undefined' && document.body.classList.contains('nfb') ? 190 : 0) - (ngap + 1) * 12) / (1 + (myHand.length - 1) * .64 + ngap * .55)));
  const lastTxt = l => !l ? '' : l.t === 'draw' ? (l.from === 'desc' ? `pegou ${name(l.card)}` : 'comprou do monte') : l.t === 'discard' ? `descartou ${name(l.card)}` : l.t === 'bateuErrado' ? 'errou a batida!' : l.t === 'leave' ? 'saiu da mesa' : l.t === 'bater' ? 'BATEU!' : '';
  const msg = game.over ? (game.result?.empate ? 'Monte esgotado' : `${game.players[game.result?.winner]?.name || ''} bateu!`)
    : myTurn ? (game.phase === 'draw' ? 'Sua vez: compre do <b>monte</b>, pegue o <b>descarte</b> ou <b>BATA</b> com ele'
      : full && myHand.length === game.cfg.hand + 1 ? '✅ <b>Seus jogos estão completos!</b> Toque na carta que sobrou e depois em BATER'
      : 'Escolha uma carta e toque em <b>DESCARTAR</b> ou <b>BATER</b>')
    : `Vez de <b>${turnName}</b>`;
  const others = [];
  for (let k = 1; k < n; k++) others.push((myIdx + k) % n);

  function tapHand(c) {
    if (suppressRef.current) return;
    if (sel === c.id && canEnd) return act({ type: 'discard', cardId: c.id });
    setSel(sel === c.id ? null : c.id);
  }
  // BATER fica sempre disponível: na vez, ou fora dela com a carta que o adversário acabou de descartar
  function bater() {
    if (game.over) return;
    if (!canEnd) {
      if (game.phase === 'draw' && game.descTop && !me.queimado) return act({ type: 'baterDesc' });
      return toast(me.queimado ? 'Você errou uma batida: agora só pode bater comprando do monte, na sua vez' : myTurn ? 'Ainda não tem carta no descarte: compre do monte' : 'Espere o próximo descarte para bater');
    }
    let id = sel;
    if (id == null) { const b = (me.queimado && game.taken != null) ? -1 : Engine.findBater({ ...game, cfg: cfgFull }, myHand, game.taken); if (b >= 0) id = myHand[b].id; }
    if (id == null) return toast('Toque na carta que vai descartar e depois em BATER');
    act({ type: 'bater', cardId: id });
  }

  const res = game.result;
  const lk = looks(profile);
  const feltBg = `radial-gradient(ellipse at 50% 45%,${lk.felt.colors[0]} 0%,${lk.felt.colors[1]} 45%,${lk.felt.colors[2]} 100%)`;
  const backBg = `repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 3px,transparent 3px 7px),linear-gradient(135deg,${lk.back.colors[0]},${lk.back.colors[1]})`;
  return (
    <div className="view on" id="game">
      <div className="gtop">
        <div className="l">
          <button className="ico" onClick={() => setModal('placar')}>👥</button>
          <button className="ico" onClick={() => { setChatOpen(o => !o); setUnread(0); }}>💬{unread > 0 && <span className="badge-n">{unread}</span>}</button>
          <div className="cpill">{game.cor >= 0 ? <>Coringa <b>{corTxt(game.cor)}</b> ★</> : 'Sem coringa'}</div>
        </div>
        <button className="mesas" onClick={() => setModal('sair')}><i>🃏</i><span>Sair</span></button>
      </div>
      <div id="arena">
        <div className="rail"><div className="felt" style={{ background: feltBg }}>
          <div className="wm"><b>CACHETA CLUB</b><small>{MODES[room.mode]?.name} · {game.cfg.entry ? `Pote ${fmt(game.pot)} · ` : ''}Sala {room.code}</small></div>
          <div className="center">
            <div id="msg"><span dangerouslySetInnerHTML={{ __html: msg }} /></div>
            <div className="piles">
              <div className="pile">
                <div id="viraBox">{game.vira && <Card c={game.vira} cor={game.cor} cls="vira" />}</div>
                <div id="monte" onClick={() => canDraw && act({ type: 'draw', from: 'monte' })}><div className={`back ${canDraw ? 'glow' : ''}`} style={{ background: backBg, borderColor: lk.back.gold ? '#f2c94c' : '#fff' }}><b>{game.monte}</b></div></div></div>
              <div className="pile"><div className="corbox">
                {game.cor >= 0
                  ? <div className="vcol"><small>Coringas</small><div className="cc">{Engine.corSuits(game.cor).map(s => <Card key={s} c={{ id: -10 - s, r: Engine.corRank(game.cor), s }} cor={game.cor} />)}</div></div>
                  : <div className="vcol"><small>Sem<br />coringa</small></div>}</div></div>
              <div className="pile"><div id="desc" onClick={() => { if (canEnd && sel != null) act({ type: 'discard', cardId: sel }); else if (canDraw && game.descTop) act({ type: 'draw', from: 'desc' }); }}>
                {game.descTop ? <Card c={game.descTop} cor={game.cor} cls={canDraw ? 'glow' : ''} /> : <div className="slot">🗑</div>}</div></div>
            </div>
          </div>
          <div id="seats" className={n >= 8 ? 'many' : ''}>
            {others.map((pi, k) => {
              const p = game.players[pi], { x, y } = seatPos(k + 1, n, portrait), turn = game.turn === pi && !game.over;
              return (
                <div key={p.uid} id={`seat-${pi}`} className={`seat ${turn ? 'turn' : ''} ${p.fichas <= 0 ? 'out' : ''} ${x > 60 ? 'rt' : ''}`} style={{ left: x + '%', top: y + '%' }}>
                  <div className="av">{p.avatar}{p.fichas > 0 && <span className="cnt">🂠{p.count}</span>}</div>
                  <div className="np"><b>{p.name}</b><small>{p.left ? 'saiu' : p.fichas > 0 ? `${p.fichas} pts${turn ? ` · ${Math.ceil(left / 1000)}s` : ''}` : 'eliminado'}</small></div>
                  {game.last?.pi === pi && lastTxt(game.last) && <div className="bubble">{lastTxt(game.last)}{game.last.timeout ? ' ⏱' : ''}</div>}
                </div>
              );
            })}
          </div>
        </div></div>
      </div>
      <div id="mine">
        <div id="meRow" className={myTurn ? 'turn' : ''}><div className="av">{me.avatar}</div>
          <div className="info"><b>{me.name}</b>{me.fichas} pts <small>· {okN} {okN === 1 ? 'jogo montado' : 'jogos montados'}</small>
            {me.queimado && <span className="burn">🔥 só bate comprando do monte</span>}</div></div>
        <div id="timer" className={left < 6000 ? 'warn' : ''} style={{ visibility: myTurn ? 'visible' : 'hidden' }}><i style={{ width: pct + '%' }} /></div>
        <div id="hand" style={{ '--hcw': hcw + 'px' }} onPointerDown={e => {
          const el = e.target.closest('.card'); if (!el) return;
          dragRef.current = { id: +el.dataset.id, el, x: e.clientX, y: e.clientY, on: false };
        }}>
          {groups.map(({ gi, cards: g }, k) => (
            <div key={gi + ':' + g[0].id} data-gi={gi} className={`grp ${gType[k] ? 'ok' : g.length >= 3 ? 'bad' : ''}`}>
              {g.length >= 3 && <span className="gtag">{gType[k] ? `✓ ${gType[k] === 'trinca' ? 'Trinca' : 'Sequência'}` : 'Inválido'}</span>}
              {g.map(c => <Card key={c.id} c={c} cor={game.cor} onClick={() => tapHand(c)}
                cls={[sel === c.id ? 'sel' : '', inM.has(c.id) ? 'inm' : '', game.last?.t === 'draw' && game.last.pi === myIdx && hand[hand.length - 1]?.id === c.id ? 'new' : ''].join(' ')} />)}
            </div>))}
        </div>
        <div id="bar">
          <button id="bSort" onClick={() => { const m = (sortMode + 1) % 3; setSortMode(m); sortHand(m); toast(['Organizado por jogos', 'Organizado por naipe', 'Organizado por valor'][m]); }}>{['🃏 Jogos', '♠ Naipe', '7 Valor'][sortMode]}</button>
          <button className="disc" id="bDisc" disabled={!canEnd || sel == null || busy} onClick={() => act({ type: 'discard', cardId: sel })}>DESCARTAR</button>
          <button className="bate" id="bBate" disabled={game.over || busy} onClick={bater}>BATER</button>
        </div>
      </div>

      {chatOpen && <div className="chatfloat"><Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}

      {modal === 'placar' && <Modal onClose={() => setModal(null)}><h2>Placar</h2>
        <div className="score">{game.players.map((p, i) => <div key={p.uid}><span>{p.avatar} {p.name}{i === myIdx ? ' (você)' : ''}</span><b>{p.left ? 'saiu' : p.fichas > 0 ? p.fichas + ' pts' : 'fora'}</b></div>)}</div>
        {game.cfg.entry ? <p>Pote: 💰 {fmt(game.pot)}</p> : null}<button className="go" onClick={() => setModal(null)}>Fechar</button></Modal>}
      {modal === 'sair' && <Modal onClose={() => setModal(null)}><h2>Sair da mesa?</h2>
        <p>{room.status === 'playing' ? `A partida não acabou. Saindo agora você é eliminado${game.cfg.entry ? ` e perde a entrada de 💰 ${fmt(game.cfg.entry)}` : ''}.` : 'Você vai voltar para a lista de salas.'}</p>
        <button className="go" onClick={leave}>Sair</button><button className="sec" onClick={() => setModal(null)}>Continuar jogando</button></Modal>}
      {(modal === 'errou' || modal === 'errouDesc' || modal === 'errouFora') && <Modal><h2>Batida errada!</h2><p>{modal === 'errou' ? 'Suas cartas não fechavam. A carta foi pro descarte e você perdeu a vez.' : modal === 'errouFora' ? 'Com a carta do descarte suas cartas não fecham.' : 'Com a carta do descarte suas cartas não fecham. Você perdeu a vez.'}</p>
        <p>🔥 Até o fim da rodada você <b>só pode bater comprando do monte</b>.</p><button className="go" onClick={() => setModal(null)}>Continuar</button></Modal>}

      {game.over && res && (
        <Modal>
          {res.empate ? <><h2>Monte esgotado</h2><p>Ninguém bateu. Ninguém perde pontos.</p></> : <>
            <h2>{res.matchOver ? (res.champion === myIdx ? 'Você venceu! 🏆' : `${game.players[res.champion]?.name || 'Ninguém'} venceu`) : res.winner === myIdx ? 'Você bateu!' : `${game.players[res.winner]?.name} bateu`}</h2>
            {res.forfeit ? <p>Os outros jogadores saíram da mesa.</p> : <p>{res.limpa && game.cfg.limpaDobro ? <><b>Batida limpa</b>, sem coringa: os outros perdem 2 pontos.</> : `Os outros perdem ${res.loss} ponto.`}</p>}
            {res.melds && <div className="melds">{res.melds.map((m, i) => <div key={i} className="meld">{m.map(c => <Card key={c.id} c={c} cor={game.cor} />)}</div>)}</div>}
            {res.matchOver && res.champion === myIdx && game.pot > 0 && <div className="prize">+ 💰 {fmt(game.pot)}</div>}
            <div className="score">{game.players.map((p, i) => {
              const d = res.before ? p.fichas - res.before[i] : 0;
              return <div key={p.uid}><span>{p.avatar} {p.name}</span>{d < 0 && <span className="d" style={{ flex: 'none' }}>{d}</span>}{i === res.winner && <span className="w" style={{ flex: 'none' }}>bateu</span>}<b>{p.fichas > 0 ? p.fichas + ' pts' : 'fora'}</b></div>;
            })}</div></>}
          {res.matchOver && room.tournament_id
            ? <><p>{res.champion === myIdx ? '✅ Você passou para a próxima rodada do torneio! Aguarde a próxima mesa.' : 'Você foi eliminado do torneio.'}</p>
                <button className="go" onClick={() => router.push('/torneios/' + room.tournament_id)}>Ver o torneio</button></>
            : res.matchOver
            ? <><button className="go" onClick={() => { setDismissed(game.matchId); ready(true); }}>Jogar de novo</button>
                <button className="sec" onClick={() => setDismissed(game.matchId)}>Voltar para a sala</button></>
            : <p style={{ marginTop: 14, color: 'var(--gold)' }}>Próxima rodada em {Math.max(0, Math.ceil(((game.nextRoundAt || now) - now) / 1000))} s…</p>}
        </Modal>
      )}
    </div>
  );
}

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

// 9 cartas: 3+3+3 · 10 cartas: 3+3+4 · a carta comprada fica num grupo à parte
function handGroups(h, size) {
  const sizes = size === 10 ? [3, 3, 4] : [3, 3, 3], out = []; let i = 0;
  for (const n of sizes) { if (i >= h.length) break; out.push(h.slice(i, i + n)); i += n; }
  if (i < h.length) out.push(h.slice(i));
  return out;
}
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
  const [order, setOrder] = useState([]);
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
  const dragRef = useRef(null), suppressRef = useRef(false);
  // arrastar cartas da mão com o dedo/mouse para montar os jogos
  useEffect(() => {
    const dropIdx = (x, id) => {
      const cs = [...document.querySelectorAll('#hand .card')].filter(c => +c.dataset.id !== id);
      let i = 0; for (const c of cs) { const r = c.getBoundingClientRect(); if (x > r.left + r.width / 2) i++; }
      return { i, cs };
    };
    const mv = e => {
      const d = dragRef.current; if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.on && Math.hypot(dx, dy) > 8) { d.on = true; d.el.classList.add('dragging'); }
      if (!d.on) return;
      e.preventDefault();
      d.el.style.transform = `translate(${dx}px,${dy}px) scale(1.06)`;
      const { i, cs } = dropIdx(e.clientX, d.id);
      cs.forEach(c => c.classList.remove('insL', 'insR'));
      if (cs[i]) cs[i].classList.add('insL'); else if (cs.length) cs[cs.length - 1].classList.add('insR');
    };
    const up = (e, cancel) => {
      const d = dragRef.current; dragRef.current = null;
      if (!d || !d.on) return;
      d.el.style.transform = ''; d.el.classList.remove('dragging');
      document.querySelectorAll('#hand .card').forEach(c => c.classList.remove('insL', 'insR'));
      suppressRef.current = true; setTimeout(() => { suppressRef.current = false; }, 60);
      if (cancel) return;
      const { i } = dropIdx(e.clientX, d.id);
      setOrder(o => { const n = o.filter(x => x !== d.id); n.splice(i, 0, d.id); return n; });
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
    setOrder(o => {
      if (!o.length || dealRef.current) { dealRef.current = false; return sortedIds(hand, sortMode); }
      const ids = hand.map(c => c.id); const keep = o.filter(x => ids.includes(x));
      return [...keep, ...ids.filter(x => !keep.includes(x))];
    });
    if (sel != null && !hand.some(c => c.id === sel)) setSel(null);
  }, [hand]); // eslint-disable-line
  const myHand = useMemo(() => order.map(i => hand.find(c => c.id === i)).filter(Boolean), [order, hand]);

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
    if (game.last?.t === 'bateuErrado' && game.last.pi === myIdx) setModal('errou');
    if (game.last?.t === 'deal') { dealRef.current = true; setTimeout(() => { dealRef.current = false; }, 3000); sortHand(sortMode); }
    if (game.over && game.result?.matchOver) reloadProfile();
  }, [game]); // eslint-disable-line

  // 0 = jogos formados primeiro, 1 = naipe, 2 = valor
  function sortedIds(cards, mode) {
    const cor = game ? game.cor : -1, j = c => (Engine.isJ(c, cor) ? 1 : 0);
    const bySuit = (a, b) => j(a) - j(b) || a.s - b.s || a.r - b.r, byRank = (a, b) => j(a) - j(b) || a.r - b.r || a.s - b.s;
    if (mode === 0 && game) {
      const an = Engine.analyze(cards, cor, { ...game.cfg, maxJ: 99, aceHigh: true });
      const used = new Set(an.melds.flat().map(c => c.id));
      return [...an.melds.flat(), ...cards.filter(c => !used.has(c.id)).sort(bySuit)].map(c => c.id);
    }
    return [...cards].sort(mode === 1 ? bySuit : byRank).map(c => c.id);
  }
  function sortHand(mode) { setOrder(sortedIds(hand, mode)); }
  function move(dir) {
    if (sel == null) return;
    setOrder(o => { const i = o.indexOf(sel), k = i + dir; if (k < 0 || k >= o.length) return o; const n = [...o]; [n[i], n[k]] = [n[k], n[i]]; return n; });
  }

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
  const turnName = game.players[game.turn]?.name;
  const left = game.deadline ? Math.max(0, game.deadline - now) : 0;
  const pct = game.cfg.turn ? Math.min(100, left / (game.cfg.turn * 1000) * 100) : 0;
  const W = Math.min(typeof innerWidth !== 'undefined' ? innerWidth : 400, 900) - 20;
  const short = typeof innerHeight !== 'undefined' && innerHeight < 520 && !portrait;
  const groups = handGroups(myHand, game.cfg.hand), ngap = groups.length - 1;
  const gType = groups.map(g => (g.length >= 3 ? Engine.meldType(g, game.cor, cfgFull) : null));
  const okN = gType.slice(0, 3).filter(Boolean).length, full = groups.length >= 3 && okN === 3;
  const hcw = Math.max(28, Math.min(84, (short ? innerHeight * .2 : 96) / 1.42, (W - (short ? 160 : 0) - (typeof document !== 'undefined' && document.body.classList.contains('nfb') ? 190 : 0) - (ngap + 1) * 12) / (1 + (myHand.length - 1) * .64 + ngap * .55)));
  const lastTxt = l => !l ? '' : l.t === 'draw' ? (l.from === 'desc' ? `pegou ${name(l.card)}` : 'comprou do monte') : l.t === 'discard' ? `descartou ${name(l.card)}` : l.t === 'bateuErrado' ? 'errou a batida!' : l.t === 'leave' ? 'saiu da mesa' : l.t === 'bater' ? 'BATEU!' : '';
  const msg = game.over ? (game.result?.empate ? 'Monte esgotado' : `${game.players[game.result?.winner]?.name || ''} bateu!`)
    : myTurn ? (game.phase === 'draw' ? 'Sua vez: compre do <b>monte</b> ou pegue o <b>descarte</b>'
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
  function bater() {
    if (!canEnd) return toast('Compre uma carta primeiro');
    if (sel == null) return toast('Toque na carta que vai descartar e depois em BATER');
    act({ type: 'bater', cardId: sel });
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
                <div id="monte" onClick={() => canDraw && act({ type: 'draw', from: 'monte' })}><div className={`back ${canDraw ? 'glow' : ''}`} style={{ background: backBg, borderColor: lk.back.gold ? '#f2c94c' : '#fff' }}><b>{game.monte}</b></div></div></div>
              <div className="pile"><div className="corbox">
                {game.vira && <div className="vcol"><small>Vira</small><Card c={game.vira} cor={game.cor} cls="vira" /></div>}
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
          <div className="info"><b>{me.name}</b>{me.fichas} pts <small>· {okN} de 3 jogos montados</small>
            {me.queimado && <span className="burn">🔥 só bate comprando do monte</span>}</div></div>
        <div id="timer" className={left < 6000 ? 'warn' : ''} style={{ visibility: myTurn ? 'visible' : 'hidden' }}><i style={{ width: pct + '%' }} /></div>
        <div id="hand" style={{ '--hcw': hcw + 'px' }} onPointerDown={e => {
          const el = e.target.closest('.card'); if (!el) return;
          dragRef.current = { id: +el.dataset.id, el, x: e.clientX, y: e.clientY, on: false };
        }}>
          {groups.map((g, gi) => (
            <div key={gi} className={`grp ${gType[gi] ? 'ok' : ''}`}>
              {gType[gi] && <span className="gtag">✓ {gType[gi] === 'trinca' ? 'Trinca' : 'Sequência'}</span>}
              {g.map(c => <Card key={c.id} c={c} cor={game.cor} onClick={() => tapHand(c)}
                cls={[sel === c.id ? 'sel' : '', inM.has(c.id) ? 'inm' : '', game.last?.t === 'draw' && game.last.pi === myIdx && hand[hand.length - 1]?.id === c.id ? 'new' : ''].join(' ')} />)}
            </div>))}
        </div>
        <div id="bar">
          <button id="bSort" onClick={() => { const m = (sortMode + 1) % 3; setSortMode(m); sortHand(m); toast(['Organizado por jogos', 'Organizado por naipe', 'Organizado por valor'][m]); }}>{['🃏 Jogos', '♠ Naipe', '7 Valor'][sortMode]}</button>
          <button className="disc" id="bDisc" disabled={!canEnd || sel == null || busy} onClick={() => act({ type: 'discard', cardId: sel })}>DESCARTAR</button>
          <button className="bate" id="bBate" disabled={!canEnd || busy} onClick={bater}>BATER</button>
        </div>
      </div>

      {chatOpen && <div className="chatfloat"><Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}

      {modal === 'placar' && <Modal onClose={() => setModal(null)}><h2>Placar</h2>
        <div className="score">{game.players.map((p, i) => <div key={p.uid}><span>{p.avatar} {p.name}{i === myIdx ? ' (você)' : ''}</span><b>{p.left ? 'saiu' : p.fichas > 0 ? p.fichas + ' pts' : 'fora'}</b></div>)}</div>
        {game.cfg.entry ? <p>Pote: 💰 {fmt(game.pot)}</p> : null}<button className="go" onClick={() => setModal(null)}>Fechar</button></Modal>}
      {modal === 'sair' && <Modal onClose={() => setModal(null)}><h2>Sair da mesa?</h2>
        <p>{room.status === 'playing' ? `A partida não acabou. Saindo agora você é eliminado${game.cfg.entry ? ` e perde a entrada de 💰 ${fmt(game.cfg.entry)}` : ''}.` : 'Você vai voltar para a lista de salas.'}</p>
        <button className="go" onClick={leave}>Sair</button><button className="sec" onClick={() => setModal(null)}>Continuar jogando</button></Modal>}
      {modal === 'errou' && <Modal><h2>Batida errada!</h2><p>Suas cartas não fechavam. A carta foi pro descarte e você perdeu a vez.</p>
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

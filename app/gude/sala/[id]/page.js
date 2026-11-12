'use client';
// Sala online da BOLINHA DE GUDE (1 contra 1): espera, convite, chat e a partida em tempo real.
// O servidor confere cada tecada e manda a velocidade; os dois celulares refazem a jogada igualzinho.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { GudeField, Hud, Regras, recado, GUDE_CSS } from '../../../../components/Gude.js';
import { modeName, isGudeMode, fmt } from '../../../../lib/modes.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';

export default function GudeSala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [srv, setSrv] = useState(null);           // mesa como o servidor mandou
  const [init, setInit] = useState(null);         // começo da partida (cria o desenho)
  const [S, setS] = useState(null);               // mesa como está na tela
  const [msgs, setMsgs] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rules, setRules] = useState(false);
  const [pass, setPass] = useState(''), [joinErr, setJoinErr] = useState('');
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(null);
  const [som, setSom] = useState(true);
  const viewRef = useRef(null), srvRef = useRef(null), seen = useRef({ m: null, n: 0, v: 0 }), pend = useRef(false), myRef = useRef(-1), chatRef = useRef(false), tickBusy = useRef(false);
  chatRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);
  const myIdx = srv && user ? srv.players.findIndex(p => p.uid === user.id) : -1;
  myRef.current = myIdx;

  // chegou mesa nova do servidor: anima a tecada que ainda não foi mostrada
  const showGame = useCallback((st, v) => {
    if (!st || st.game !== 'gude') return;
    const cur = seen.current;
    if (cur.m === st.matchId && v != null && v < cur.v) return;   // atualização velha chegando atrasada
    srvRef.current = st; setSrv(st);
    if (cur.m !== st.matchId) {                                  // partida nova
      seen.current = { m: st.matchId, n: st.shots, v: v || 0 };
      setInit({ state: st, key: st.matchId }); setMsg('');
      return;
    }
    seen.current.v = v || cur.v;
    const vw = viewRef.current; if (!vw) return;
    const L = st.last;
    if (L && L.t === 'shot' && L.n > cur.n) {
      const mine = L.pi === myRef.current && cur.local === L.n;   // eu já animei a minha na hora
      if (!mine) vw.push([L]);
      seen.current.n = L.n;
    } else if (L && L.t === 'timeout' && st.shots >= cur.n) {
      if (L.pi === myRef.current) setMsg('Seu tempo acabou: passou a vez.'); else setMsg(`Tempo de ${st.players[L.pi]?.name} acabou. Sua vez!`);
    }
    vw.setFinal(st);
  }, []);

  const loadRoom = useCallback(async () => { const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle(); setRoom(data || null); }, [id]);
  const loadPlayers = useCallback(async () => { const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat'); setPlayers(data || []); }, [id]);
  const loadGame = useCallback(async (hard) => {
    const { data } = await sb().from('games').select('state,version').eq('room_id', id).maybeSingle();
    if (!data) return;
    if (hard && viewRef.current && data.state.matchId === seen.current.m) {
      srvRef.current = data.state; setSrv(data.state); seen.current = { m: data.state.matchId, n: data.state.shots, v: data.version };
      viewRef.current.reset(data.state);
    } else showGame(data.state, data.version);
  }, [id, showGame]);
  const loadMsgs = useCallback(async () => {
    const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60);
    setMsgs((data || []).reverse());
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setSom(soundOn());
    loadRoom(); loadPlayers();
    const ch = sb().channel('gude-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, p => { if (p.eventType === 'DELETE') setRoom(null); else setRoom(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, p => { if ((p.new && p.new.room_id === id) || (p.old && (p.old.room_id === id || !p.old.room_id))) loadPlayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.state) showGame(p.new.state, p.new.version); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` }, p => {
        setMsgs(m => [...m.slice(-80), p.new]);
        if (p.new.user_id !== user.id) { if (!chatRef.current) setUnread(u => u + 1); sfx('msg'); }
      })
      .subscribe(st => { if (st === 'SUBSCRIBED') { loadGame(); loadMsgs(); } });
    return () => { sb().removeChannel(ch); };
  }, [user, id, loadRoom, loadPlayers, loadGame, loadMsgs, showGame]);
  useEffect(() => { if (isMember) { loadGame(); loadMsgs(); } }, [isMember, loadGame, loadMsgs]);
  useEffect(() => { if (room && !isGudeMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);

  // relógio + cronômetro no servidor + "estou aqui"
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!srv || !isMember || room?.status !== 'playing' || srv.over) return;
    if (srv.deadline && now > srv.deadline + 1500 && !tickBusy.current) {
      tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 1500));
    }
  }, [now, srv, isMember, room, id]);
  useEffect(() => {
    if (!isMember) return;
    const p = () => { if (document.visibilityState === 'visible') api(`/api/rooms/${id}/ping`).catch(() => {}); };
    p(); const t = setInterval(p, 120000); document.addEventListener('visibilitychange', p);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', p); };
  }, [isMember, id]);

  async function onShoot(v) {
    pend.current = true; seen.current.local = (viewRef.current?.state.shots) || 0; setMsg('Rolando…');
    try {
      const r = await api(`/api/rooms/${id}/action`, { type: 'shot', ...v });
      if (r && r.state) showGame(r.state, r.version);
    } catch (e) { sfx('err'); toast(e.message); loadGame(true); }
    finally { pend.current = false; }
  }
  function onSettle(e, st) {
    const t = recado(e, st, myRef.current); if (t) setMsg(t);
    if (!st.over && st.turn === myRef.current && !e.again) sfx('turn');
  }
  const canPlay = () => { const s = srvRef.current; return !pend.current && !!s && !s.over && s.turn === myRef.current; };

  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && myIdx >= 0 && !srv?.over && !confirm('Sair agora? Você perde a partida e a entrada.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=gude');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }

  // fim da partida: som e saldo novo
  const overShown = S && S.over && srv?.result?.matchOver && !(viewRef.current && viewRef.current.busy());
  const endRef = useRef(null);
  useEffect(() => {
    if (!overShown || endRef.current === srv.matchId) return;
    endRef.current = srv.matchId; reloadProfile();
    sfx(srv.result.tie ? 'turn' : srv.result.champion === myIdx ? 'win' : 'lose');
  }, [overShown]); // eslint-disable-line

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=gude')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=gude')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>{modeName(room.mode)} · 1 contra 1 · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora. Assim que a partida acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=gude')}>Voltar às salas</button>
      </div></div></div>
  );

  const inGame = srv && myIdx >= 0 && (room.status === 'playing' || (srv.result?.matchOver && dismissed !== srv.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- SALA DE ESPERA ---------- */
  if (!inGame) {
    const me = players.find(p => p.user_id === user.id);
    const seats = [0, 1].map(i => players.find(p => p.seat === i));
    const convite = `Bora jogar bolinha de gude (${modeName(room.mode).replace('Gude · ', '')}) no Cacheta Club! 🔵 Entra na minha mesa: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
    const inRoom = new Set(players.map(p => p.user_id));
    const free = online.filter(o => o.uid !== user.id && !inRoom.has(o.uid) && o.where !== 'sala');
    const base = { roomId: id, roomName: room.name, entry: room.entry, isPrivate: room.is_private, fromNick: profile?.nickname, fromAvatar: profile?.avatar };
    const inv = (to, who) => { const e = sendInvite({ ...base, to }); toast(e || (to === 'all' ? `Convite enviado para ${free.length} jogador${free.length === 1 ? '' : 'es'} online` : `Convite enviado para ${who}`)); };
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={() => leave(true)} title="Sair da sala">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>{modeName(room.mode)}</span><span>1 contra 1</span>
              <span>{room.entry ? `Entrada 💰 ${fmt(room.entry)} · pote ${fmt(room.entry * 2)}` : 'Grátis'}</span><span>⏱ {room.turn_seconds} s</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="invite"><input readOnly value={link} onFocus={e => e.target.select()} />
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(convite); toast('Convite copiado'); } catch { toast('Copie o link acima'); } }}>Copiar convite</button></div>
            <div className="invite" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="pillbtn" style={{ background: 'linear-gradient(180deg,#25d366,#128c4a)', textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(convite)}`}>📲 Convidar no WhatsApp</a>
              <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} disabled={!free.length} onClick={() => inv('all')}>📣 Convidar todos online ({free.length})</button>
            </div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small></div>
                : <div key={i} className="wseat free">Lugar vago</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
              {players.length < 2 ? 'Esperando o adversário. Mande o convite!' : 'A partida começa sozinha quando os dois estiverem prontos.'}
            </p>
            <button className="go" style={me?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} onClick={() => { unlockAudio(); ready(!me?.ready); }}>
              {me?.ready ? 'Cancelar pronto' : '✓ Estou pronto'}</button>
            <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
            <button className="sec" onClick={() => leave(true)}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
        {rules && <Regras mode={room.mode.slice(5)} onClose={() => setRules(false)} />}
        <style>{GUDE_CSS}</style>
      </div>
    );
  }

  /* ---------- MESA ---------- */
  const clock = srv.deadline && !srv.over ? Math.max(0, Math.ceil((srv.deadline - now) / 1000)) : null;
  const res = srv.result;
  return (
    <div className="page lounge gd">
      <Hud S={S} me={myIdx} clock={clock != null && clock <= srv.cfg.turn ? clock : null}
        extra={srv.cfg.entry ? <> · pote <b>{fmt(srv.pot)}</b></> : null}
        right={<>
          <button className="rbtn" title="Chat" onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
          <button className="rbtn" title="Regras" onClick={() => setRules(true)}>📖</button>
          <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
          <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button></>} />
      <GudeField init={init} me={myIdx} viewRef={viewRef} canPlay={canPlay} onShoot={onShoot} onSettle={onSettle} onChange={st => setS({ ...st })} />
      <div id="msg">{msg || (S && !S.over ? (S.turn === myIdx ? 'Sua vez: arraste da sua bolinha pra trás e solte' : `Vez de ${S.players[S.turn]?.name}…`) : ' ')}</div>
      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {rules && <Regras mode={srv.mode} onClose={() => setRules(false)} />}
      {overShown && <Modal><h2>{res.tie ? 'Empate!' : res.champion === myIdx ? '🏆 Você ganhou!' : `${srv.players[res.champion]?.name} ganhou`}</h2>
        <div className="prize">{srv.players[myIdx].score} x {srv.players[1 - myIdx].score}</div>
        <p>{res.forfeit ? 'O adversário saiu da mesa. ' : ''}{res.tie ? 'Cada um recebeu a entrada de volta.' : res.champion === myIdx ? (srv.cfg.entry ? `Você levou o pote de ${fmt(srv.pot)} fichas!` : 'Boa tecada!') : 'Quase! Pede revanche.'}</p>
        <button className="go" onClick={() => { setDismissed(srv.matchId); setMsg(''); }}>🔁 Revanche</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{GUDE_CSS + '.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}.rbtn{position:relative}'}</style>
    </div>
  );
}

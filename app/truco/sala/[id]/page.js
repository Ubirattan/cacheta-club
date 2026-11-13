'use client';
// Sala online do TRUCO PAULISTA (1x1 ou duplas): espera, convite, chat e a partida em tempo real.
// O servidor guarda a partida (lib/truco-service.js); cada um só recebe as próprias cartas (tabela hands).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, Card, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { SEATS, PLAYED, nextCall, Rules, TRUCO_CSS } from '../../../../components/Truco.js';
import { modeName, isTrucoMode, fmt } from '../../../../lib/modes.js';
import { premioPorVencedor } from '../../../../lib/taxa.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';
import { isManilha, teamOf, manilhaRank, needs, canCall, RANKS, CALL_NAME, VALUES } from '../../../../lib/truco.js';

export default function TrucoSala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [G, setG] = useState(null);
  const [hand, setHand] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rules, setRules] = useState(false);
  const [pass, setPass] = useState(''), [joinErr, setJoinErr] = useState('');
  const [msg, setMsg] = useState('');
  const [shout, setShout] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [som, setSom] = useState(true);
  const verRef = useRef(0), chatRef = useRef(false), tickBusy = useRef(false), lastSeen = useRef(null);
  chatRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);
  const me = G && user ? G.players.findIndex(p => p.uid === user.id) : -1;

  const showGame = useCallback((st, v) => {
    if (!st || st.game !== 'truco') return;
    if (v != null && v < verRef.current) return;
    verRef.current = v || verRef.current; setG(st);
  }, []);
  const loadRoom = useCallback(async () => { const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle(); setRoom(data || null); }, [id]);
  const loadPlayers = useCallback(async () => { const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat'); setPlayers(data || []); }, [id]);
  const loadGame = useCallback(async () => { const { data } = await sb().from('games').select('state,version').eq('room_id', id).maybeSingle(); if (data) showGame(data.state, data.version); }, [id, showGame]);
  const loadHand = useCallback(async () => { if (!user) return; const { data } = await sb().from('hands').select('cards').eq('room_id', id).eq('user_id', user.id).maybeSingle(); setHand(data ? data.cards || [] : []); }, [id, user]);
  const loadMsgs = useCallback(async () => { const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60); setMsgs((data || []).reverse()); }, [id]);

  useEffect(() => {
    if (!user) return;
    setSom(soundOn()); loadRoom(); loadPlayers();
    const ch = sb().channel('truco-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, p => { if (p.eventType === 'DELETE') setRoom(null); else setRoom(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, p => { if ((p.new && p.new.room_id === id) || (p.old && (p.old.room_id === id || !p.old.room_id))) loadPlayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.state) showGame(p.new.state, p.new.version); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.user_id === user.id) setHand(p.new.cards || []); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` }, p => {
        setMsgs(m => [...m.slice(-80), p.new]);
        if (p.new.user_id !== user.id) { if (!chatRef.current) setUnread(u => u + 1); sfx('msg'); }
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') { loadGame(); loadHand(); loadMsgs(); } });
    return () => { sb().removeChannel(ch); };
  }, [user, id, loadRoom, loadPlayers, loadGame, loadHand, loadMsgs, showGame]);
  useEffect(() => { if (isMember) { loadGame(); loadHand(); loadMsgs(); } }, [isMember, loadGame, loadHand, loadMsgs]);
  useEffect(() => { if (G && G.round) loadHand(); }, [G?.round, G?.matchId]); // eslint-disable-line
  useEffect(() => { if (room && !isTrucoMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);

  // relógio: o servidor segue a mão sozinho e joga por quem deixar o tempo acabar
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!G || !isMember || room?.status !== 'playing' || G.phase === 'over') return;
    const due = (G.nextAt && now > G.nextAt + 200) || (G.deadline && now > G.deadline + 1500);
    if (due && !tickBusy.current) {
      tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 1200));
    }
  }, [now, G, isMember, room, id]);
  useEffect(() => {
    if (!isMember) return;
    const p = () => { if (document.visibilityState === 'visible') api(`/api/rooms/${id}/ping`).catch(() => {}); };
    p(); const t = setInterval(p, 120000); document.addEventListener('visibilitychange', p);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', p); };
  }, [isMember, id]);

  // o que acabou de acontecer: grito, recado e som
  const nomeDe = useCallback(pi => (pi === me ? 'Você' : G?.players[pi]?.name || '?'), [G, me]);
  const timeNome = useCallback(t => (G.n === 2 ? (t === teamOf(me) ? 'Você' : G.players[1 - me]?.name) : (t === teamOf(me) ? 'Sua dupla' : 'Os adversários')), [G, me]);
  useEffect(() => {
    if (!G || me < 0 || !G.last) return;
    const key = G.matchId + ':' + G.last.n; if (lastSeen.current === key) return; lastSeen.current = key;
    const L = G.last, pi = L.pi;
    const say = (text, ms = 1400) => { setShout({ pi, text }); clearTimeout(say._t); say._t = setTimeout(() => setShout(null), ms); };
    if (L.t === 'play') sfx('card');
    if (L.t === 'truco') { say(L.value === 3 ? 'TRUCO!' : `${L.value}! ${CALL_NAME[L.value]}!`, 1600); sfx('turn'); setMsg(`<b>${nomeDe(pi)}</b> ${L.raise ? 'aumentou pra' : 'pediu'} <b>${CALL_NAME[L.value]}</b> (vale ${L.value})`); }
    if (L.t === 'aceitar') { say('Desce!'); setMsg(`<b>${nomeDe(pi)}</b> aceitou: a mão vale <b>${L.value}</b>`); }
    if (L.t === 'onze') { say(L.jogar === false ? 'Corro!' : 'Vamos jogar!'); }
    if (L.t === 'deal') { setMsg(''); sfx('card'); }
    if (L.t === 'hand' && G.handResult) {
      const r = G.handResult;
      setMsg(r.team < 0 ? 'Tudo empatado: ninguém marca' : `<b>${timeNome(r.team)}</b> ${G.n === 4 ? 'ganharam' : 'ganhou'} a mão <b>+${r.pts}</b>${r.why === 'correu' ? ' (o outro correu)' : ''}`);
      setTimeout(() => sfx(r.team === teamOf(me) ? 'coin' : 'lose'), 250);
    }
    if (L.t === 'leave') setMsg(`<b>${nomeDe(pi)}</b> saiu da mesa`);
    if (L.auto) setMsg(`O tempo de <b>${nomeDe(pi)}</b> acabou: jogou sozinho`);
  }, [G, me, nomeDe, timeNome]);

  async function jogar(a) {
    if (busy) return; setBusy(true);
    try { const r = await api(`/api/rooms/${id}/action`, a); if (r && r.state) showGame(r.state, r.version); if (r && r.hand) setHand(r.hand); }
    catch (e) { sfx('err'); toast(e.message); loadGame(); loadHand(); }
    finally { setBusy(false); }
  }
  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && me >= 0 && G?.phase !== 'over' && !confirm('Sair agora? Seu time perde a partida e a entrada.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=truco');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }

  const overShown = G && G.phase === 'over' && G.result?.matchOver;
  const endRef = useRef(null);
  useEffect(() => {
    if (!overShown || endRef.current === G.matchId) return;
    endRef.current = G.matchId; reloadProfile();
    setTimeout(() => sfx(G.over.team === teamOf(me) ? 'win' : 'lose'), 600);
  }, [overShown]); // eslint-disable-line

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=truco')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=truco')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>{modeName(room.mode)} · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora. Assim que a partida acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=truco')}>Voltar às salas</button>
      </div></div></div>
  );

  const lugares = room.mode === 'truco-duplas' ? 4 : 2;
  const inGame = G && me >= 0 && (room.status === 'playing' || (G.result?.matchOver && dismissed !== G.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- SALA DE ESPERA ---------- */
  if (!inGame) {
    const eu = players.find(p => p.user_id === user.id);
    const seats = Array.from({ length: lugares }, (_, i) => players.find(p => p.seat === i));
    const convite = `Bora jogar truco (${lugares === 4 ? 'duplas' : '1 contra 1'}) na Casa de Jogos! ♣️ Entra na minha mesa: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
    const inRoom = new Set(players.map(p => p.user_id));
    const free = online.filter(o => o.uid !== user.id && !inRoom.has(o.uid) && o.where !== 'sala');
    const base = { roomId: id, roomName: room.name, entry: room.entry, isPrivate: room.is_private, fromNick: profile?.nickname, fromAvatar: profile?.avatar };
    const inv = to => { const e = sendInvite({ ...base, to }); toast(e || `Convite enviado para ${free.length} jogador${free.length === 1 ? '' : 'es'} online`); };
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={() => leave(true)} title="Sair da sala">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>{modeName(room.mode)}</span>
              <span>{room.entry ? `Entrada 💰 ${fmt(room.entry)} · ${lugares === 4 ? 'cada vencedor leva' : 'quem ganha leva'} ${fmt(premioPorVencedor(room.entry, lugares, lugares === 4 ? 2 : 1))}` : 'Grátis'}</span><span>⏱ {room.turn_seconds} s</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="invite"><input readOnly value={link} onFocus={e => e.target.select()} />
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(convite); toast('Convite copiado'); } catch { toast('Copie o link acima'); } }}>Copiar convite</button></div>
            <div className="invite" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="pillbtn" style={{ background: 'linear-gradient(180deg,#25d366,#128c4a)', textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(convite)}`}>📲 Convidar no WhatsApp</a>
              <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} disabled={!free.length} onClick={() => inv('all')}>📣 Convidar todos online ({free.length})</button>
            </div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small>{lugares === 4 && <small style={{ color: 'var(--gold)' }}>Dupla {i % 2 ? 'B' : 'A'}</small>}</div>
                : <div key={i} className="wseat free">Lugar vago{lugares === 4 && <small>Dupla {i % 2 ? 'B' : 'A'}</small>}</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>{players.length < lugares ? `Faltam ${lugares - players.length} jogador${lugares - players.length > 1 ? 'es' : ''}. A partida começa com a mesa cheia e todos prontos.` : 'A partida começa sozinha quando todos estiverem prontos.'}</p>
            <button className="go" style={eu?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} onClick={() => { unlockAudio(); ready(!eu?.ready); }}>{eu?.ready ? 'Cancelar pronto' : '✓ Estou pronto'}</button>
            <button className="sec" onClick={() => setRules(true)}>📖 Regras do truco paulista</button>
            <button className="sec" onClick={() => leave(true)}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
        {rules && <Rules onClose={() => setRules(false)} />}
        <style>{TRUCO_CSS}</style>
      </div>
    );
  }

  /* ---------- MESA ---------- */
  const n = G.n, meuTime = teamOf(me), outroTime = 1 - meuTime;
  const lugar = pi => (pi - me + n) % n;              // você sempre embaixo
  const fase = G.phase;
  const nd = needs(G);
  const myTurn = nd.kind === 'play' && nd.pi === me;
  const respond = nd.kind === 'resp' && nd.team === meuTime;
  const onzeMe = nd.kind === 'onze' && nd.team === meuTime;
  const podePedir = canCall(G, me);
  const canRaise = respond && VALUES.indexOf(G.pending.value) < VALUES.length - 1;
  const man = RANKS[manilhaRank(G.vira)];
  const clock = G.deadline && fase !== 'over' ? Math.max(0, Math.ceil((G.deadline - now) / 1000)) : null;
  const vez = nd.kind === 'play' ? nd.pi : nd.kind === 'resp' ? nd.pi : null;
  const vazaCls = v => (v === undefined ? '' : v < 0 ? 'eq' : v === meuTime ? 'ok' : 'no');

  return (
    <div className="page lounge tr">
      <div className="tr-top">
        <div className="tr-score">
          <div className={G.score[meuTime] >= 11 ? 'hot' : ''}><small>{n === 2 ? 'VOCÊ' : 'NÓS'}</small><b>{G.score[meuTime]}</b></div>
          <i>x</i>
          <div className={G.score[outroTime] >= 11 ? 'hot' : ''}><small>{n === 2 ? (G.players[1 - me]?.name || '').toUpperCase() : 'ELES'}</small><b>{G.score[outroTime]}</b></div>
        </div>
        <div className="tr-val">Vale <b>{G.value}</b>{G.ferro && <small>mão de ferro</small>}{G.onze !== null && <small>mão de onze</small>}</div>
        <div className="tr-vz">{[0, 1, 2].map(k => <i key={k} className={vazaCls(G.vazas[k])} />)}</div>
        <button className="rbtn" title="Chat" style={{ position: 'relative' }} onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button>
      </div>

      <div id="arena"><div className="rail"><div className="felt">
        <div className="wm"><b>Casa de Jogos</b><small>TRUCO ONLINE{G.cfg.entry ? ` · prêmio ${fmt(G.prize)}` : ''}</small></div>
        <div className="tr-vira"><Card c={G.vira} /><span>Vira · manilha <b>{man}</b></span></div>
        {G.players.map((p, pi) => {
          const d = lugar(pi); if (d === 0) return null;
          const [x, y] = SEATS[n][d];
          return (
            <div key={pi} className={`seat ${x > 60 ? 'rt' : ''} ${vez === pi ? 'turn' : ''}`} style={{ left: x + '%', top: y + '%' }}>
              <div className="av">{p.avatar}</div>
              <div className="np"><b>{p.name}{p.left ? ' (saiu)' : ''}</b><small>{n === 4 && teamOf(pi) === meuTime ? 'parceiro' : 'adversário'}{vez === pi && clock != null && clock <= G.cfg.turn ? ` · ⏱ ${clock}s` : ''}</small></div>
              <div className="tr-backs">{Array.from({ length: p.count }, (_, k) => <div key={k} className="back" />)}</div>
              {shout && shout.pi === pi && <div className="tr-shout">{shout.text}</div>}
              {G.dealer === pi && <span className="tr-dealer">D</span>}
            </div>);
        })}
        {G.table.map(t => { const [x, y] = PLAYED[n][lugar(t.pi)]; return (
          <div key={t.card.id} className={`tr-played ${G.vazaWinner === t.pi ? 'win' : ''}`} style={{ left: x + '%', top: y + '%' }}>
            <Card c={t.card} cls={isManilha(t.card, G.vira) ? 'mani' : ''} />
          </div>); })}
        {shout && shout.pi === me && <div className="tr-shout me">{shout.text}</div>}
      </div></div></div>

      <div id="msg" dangerouslySetInnerHTML={{ __html: msg || (myTurn ? `Sua vez: <b>toque numa carta</b>${clock != null && clock <= G.cfg.turn ? ` · ⏱ ${clock}s` : ''}` : respond ? `<b>${CALL_NAME[G.pending.value]}!</b> Aceita, corre ou aumenta?` : vez != null && vez !== me ? `Vez de <b>${G.players[vez]?.name}</b>…` : '&nbsp;') }} />

      <div className="tr-mine">
        <div className={`tr-me ${myTurn ? 'turn' : ''}`}><div className="av">{G.players[me].avatar}</div>{G.dealer === me && <span className="tr-dealer">D</span>}</div>
        <div className="tr-hand">
          {hand.map(c => <Card key={c.id} c={c} cls={`${isManilha(c, G.vira) ? 'mani' : ''} ${myTurn ? 'can' : ''}`} onClick={() => myTurn && jogar({ type: 'play', id: c.id })} />)}
        </div>
        <div className={`tr-acts ${respond ? 'resp' : ''}`}>
          {respond ? <>
            <button className="tr-b ok" disabled={busy} onClick={() => jogar({ type: 'aceitar' })}>✔ Aceito</button>
            {canRaise && <button className="tr-b up" disabled={busy} onClick={() => jogar({ type: 'aumentar' })}>{nextCall(G.pending.value)}!</button>}
            <button className="tr-b no" disabled={busy} onClick={() => jogar({ type: 'correr' })}>✖ Corro</button>
          </> : <button className="tr-b up big" disabled={!podePedir || busy} onClick={() => jogar({ type: 'truco' })}>{nextCall(G.value) || 'TRUCO'}!</button>}
        </div>
      </div>

      {onzeMe && <Modal><h2>Mão de onze</h2>
        <p>{n === 2 ? 'Você está' : 'Sua dupla está'} com 11. Olhe as cartas e decida: jogar vale <b>3</b>; correr dá <b>1</b> ponto pro outro time.</p>
        <div className="tr-onze"><div><small>Suas cartas</small><div>{hand.map(c => <Card key={c.id} c={c} cls={isManilha(c, G.vira) ? 'mani' : ''} />)}</div></div></div>
        <p style={{ fontSize: 13 }}>Vira <b>{RANKS[G.vira.r]}</b> · manilha <b>{man}</b></p>
        <button className="go" disabled={busy} onClick={() => jogar({ type: 'onze', jogar: true })}>Jogar (vale 3)</button>
        <button className="sec" disabled={busy} onClick={() => jogar({ type: 'onze', jogar: false })}>Correr</button></Modal>}

      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {rules && <Rules onClose={() => setRules(false)} />}

      {overShown && <Modal><h2>{G.over.team === meuTime ? '🏆 Vitória!' : 'Não foi dessa vez'}</h2>
        <div className="prize">{G.score[meuTime]} x {G.score[outroTime]}</div>
        <p>{G.result.forfeit ? 'Alguém saiu da mesa. ' : ''}{G.over.team === meuTime ? (G.cfg.entry ? `Você levou ${fmt(G.prize)} fichas!` : 'Boa!') : 'Pede revanche!'}</p>
        <button className="go" onClick={() => { setDismissed(G.matchId); setMsg(''); }}>🔁 Revanche</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{TRUCO_CSS + '.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}'}</style>
    </div>
  );
}

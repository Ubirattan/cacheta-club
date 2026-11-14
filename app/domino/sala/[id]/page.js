'use client';
// Sala online do DOMINÓ em duplas: espera, convite, chat e a partida em tempo real.
// O servidor guarda a partida (lib/domino-service.js); cada um só recebe as próprias pedras (tabela hands).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { Pedra, montar, RegrasDomino as Rules, DOMINO_CSS } from '../../../../components/Domino.js';
import { modeName, isDominoMode, fmt } from '../../../../lib/modes.js';
import { premioPorVencedor } from '../../../../lib/taxa.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';
import { lados, dupla, precisa, META, NOME_BATIDA } from '../../../../lib/domino.js';

export default function DominoSala() {
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
    if (!st || st.game !== 'domino') return;
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
    const ch = sb().channel('domino-' + id)
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
  useEffect(() => { if (room && !isDominoMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);

  // relógio: o servidor segue a mão sozinho e joga por quem deixar o tempo acabar
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!G || !isMember || room?.status !== 'playing' || G.fase === 'fim') return;
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
  const dNome = useCallback(d => (d === dupla(me) ? 'Vocês' : 'Eles'), [me]);
  useEffect(() => {
    if (!G || me < 0 || !G.last) return;
    const key = G.matchId + ':' + G.last.n; if (lastSeen.current === key) return; lastSeen.current = key;
    const L = G.last, pi = L.pi;
    const say = (p, text, ms = 1400) => { setShout({ pi: p, text }); clearTimeout(say._t); say._t = setTimeout(() => setShout(null), ms); };
    if (L.t === 'jogou') { sfx('card'); setMsg(L.auto ? `O tempo de <b>${nomeDe(pi)}</b> acabou: jogou sozinho` : ''); }
    if (L.t === 'passou') { say(pi, 'Passo!'); sfx('turn'); setMsg(`<b>${nomeDe(pi)}</b> passou (sem pedra)`); }
    if (L.t === 'deal') { setMsg(''); sfx('card'); }
    if (L.t === 'mao') {
      sfx('card');
      if (L.tipo !== 'trancou' && pi != null) say(pi, L.tipo === 'simples' ? 'Bati!' : NOME_BATIDA[L.tipo] + '!', 2400);
      setMsg(L.tipo === 'trancou'
        ? (L.dupla < 0 ? `Trancou! Empate nos pontos: ninguém marca` : `Trancou! <b>${dNome(L.dupla)}</b> com menos pontos na mão <b>+1</b>`)
        : `<b>${nomeDe(pi)}</b> bateu: <b>${NOME_BATIDA[L.tipo]}</b> · <b>${dNome(L.dupla)} +${L.pts}</b>`);
      setTimeout(() => sfx(L.dupla === dupla(me) ? 'coin' : L.dupla < 0 ? 'turn' : 'lose'), 300);
    }
    if (L.t === 'leave') setMsg(`<b>${nomeDe(pi)}</b> saiu da mesa`);
  }, [G, me, nomeDe, dNome]);

  async function jogar(a) {
    if (busy) return; setBusy(true);
    try { const r = await api(`/api/rooms/${id}/action`, a); if (r && r.state) showGame(r.state, r.version); if (r && r.hand) setHand(r.hand); }
    catch (e) { sfx('err'); toast(e.message); loadGame(); loadHand(); }
    finally { setBusy(false); }
  }
  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && me >= 0 && G?.fase !== 'fim' && !confirm('Sair agora? Sua dupla perde a partida e a entrada.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=domino');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }

  const [sel, setSel] = useState(null);
  const [mesa, setMesa] = useState({ w: 0, h: 0 });
  const mesaRef = useRef(null);
  useEffect(() => {
    const el = mesaRef.current; if (!el) return;
    const medir = () => setMesa({ w: el.clientWidth, h: el.clientHeight });
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  });
  useEffect(() => { setSel(null); }, [G?.last?.n]);

  const overShown = G && G.fase === 'fim' && G.result?.matchOver;
  const endRef = useRef(null);
  useEffect(() => {
    if (!overShown || endRef.current === G.matchId) return;
    endRef.current = G.matchId; reloadProfile();
    setTimeout(() => sfx(G.over.dupla === dupla(me) ? 'win' : 'lose'), 600);
  }, [overShown]); // eslint-disable-line

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=domino')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=domino')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>{modeName(room.mode)} · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora. Assim que a partida acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=domino')}>Voltar às salas</button>
      </div></div></div>
  );

  const lugares = 4;
  const inGame = G && me >= 0 && (room.status === 'playing' || (G.result?.matchOver && dismissed !== G.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- SALA DE ESPERA ---------- */
  if (!inGame) {
    const eu = players.find(p => p.user_id === user.id);
    const seats = Array.from({ length: lugares }, (_, i) => players.find(p => p.seat === i));
    const convite = `Bora jogar dominó em duplas na Casa de Jogos! 🁫 Entra na minha mesa: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
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
            <button className="sec" onClick={() => setRules(true)}>📖 Regras do dominó</button>
            <button className="sec" onClick={() => leave(true)}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
        {rules && <Rules onClose={() => setRules(false)} />}
        <style>{DOMINO_CSS}</style>
      </div>
    );
  }

  /* ---------- MESA ---------- */
  const meuTime = dupla(me), outroTime = 1 - meuTime;
  const lugar = pi => (pi - me + 4) % 4;              // você sempre embaixo
  const LUG = { 1: 'dir', 2: 'cima', 3: 'esq' };
  const nd = precisa(G);
  const minhaVez = nd.kind === 'jogar' && nd.pi === me;
  const clock = G.deadline && G.fase === 'jogo' ? Math.max(0, Math.ceil((G.deadline - now) / 1000)) : null;
  const { u, itens } = montar(G.linha || [], mesa.w, mesa.h);
  const uMao = Math.max(16, Math.min(26, Math.floor((typeof window !== 'undefined' ? window.innerWidth : 800) / 34)));
  function tocar(p) {
    if (!minhaVez || busy) return;
    const ls = lados(G, p);
    if (!ls.length) { sfx('err'); return toast(G.obrigaSena && !G.pontas ? 'Comece com a carroça de 6' : 'Essa pedra não encaixa'); }
    if (ls.length === 1) return jogar({ type: 'jogar', id: p.id, lado: ls[0] });
    setSel(sel === p.id ? null : p.id);
  }

  return (
    <div className="page lounge dm">
      <div className="dm-top">
        <div className="dm-placar">
          <div className={G.placar[meuTime] >= META - 1 ? 'hot' : ''}><small>NÓS</small><b>{G.placar[meuTime]}</b></div><i>x</i>
          <div className={G.placar[outroTime] >= META - 1 ? 'hot' : ''}><small>ELES</small><b>{G.placar[outroTime]}</b></div>
        </div>
        <div className="dm-info">Até <b>{META}</b> · mão {G.round}{G.cfg.entry ? <> · prêmio <b>{fmt(G.prize)}</b></> : null}</div>
        <button className="rbtn" title="Chat" style={{ position: 'relative' }} onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Regras" onClick={() => setRules(true)}>📖</button>
        <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button>
      </div>

      <div className="dm-feltro">
        {G.players.map((p, pi) => { const d = lugar(pi); if (d === 0) return null; return (
          <div key={pi} className={`dm-lugar ${LUG[d]} ${G.fase === 'jogo' && G.vez === pi ? 'vez' : ''}`}>
            <div className="dm-av">{p.avatar}</div>
            <div className="dm-np"><b>{p.name}{p.left ? ' (saiu)' : ''}</b><small>{dupla(pi) === meuTime ? 'parceiro' : 'adversário'} · {p.count}{G.fase === 'jogo' && G.vez === pi && clock != null && clock <= G.cfg.turn ? ` · ⏱ ${clock}s` : ''}</small></div>
            {p.mao ? <div className="dm-aberta">{p.mao.map(x => <Pedra key={x.id} a={x.a} b={x.b} u={9} />)}</div>
              : <div className="dm-costas">{Array.from({ length: p.count }, (_, k) => <i key={k} />)}</div>}
            {shout && shout.pi === pi && <div className="dm-grito">{shout.text}</div>}
          </div>); })}
        <div className="dm-mesa" ref={mesaRef}>
          {!(G.linha || []).length && <div className="dm-vazio">{G.obrigaSena ? 'Quem tem a carroça de 6 começa' : `${nomeDe(G.vez)} começa`}</div>}
          {itens.map((p, k) => <Pedra key={p.id} a={p.a} b={p.b} deitada={p.deitada} u={u} cls={k === itens.length - 1 || k === 0 ? 'ponta' : ''} style={{ left: p.left, top: p.top }} />)}
        </div>
        {shout && shout.pi === me && <div className="dm-grito eu">{shout.text}</div>}
      </div>

      <div id="msg" className="dm-msg" dangerouslySetInnerHTML={{ __html: msg || (minhaVez ? (sel != null ? 'Escolha a <b>ponta</b>' : `Sua vez: <b>toque numa pedra</b>${clock != null && clock <= G.cfg.turn ? ` · ⏱ ${clock}s` : ''}`) : nd.kind === 'passar' && nd.pi === me ? 'Você não tem pedra: <b>passou</b>' : G.fase === 'jogo' ? `Vez de <b>${nomeDe(G.vez)}</b>…` : '&nbsp;') }} />

      <div className="dm-minha">
        <div className={`dm-eu ${minhaVez ? 'vez' : ''}`}><span>{G.players[me].avatar}</span></div>
        <div className="dm-mao">
          {hand.map(p => { const pode = minhaVez && lados(G, p).length > 0; return (
            <Pedra key={p.id} a={p.a} b={p.b} u={uMao} cls={`${pode ? 'pode' : minhaVez ? 'nao' : ''} ${sel === p.id ? 'sel' : ''}`} onClick={() => tocar(p)} />); })}
        </div>
        {sel != null && minhaVez && G.pontas && <div className="dm-lados">
          <button disabled={busy} onClick={() => jogar({ type: 'jogar', id: sel, lado: 'L' })}>◀ Ponta {G.pontas[0]}</button>
          <button disabled={busy} onClick={() => jogar({ type: 'jogar', id: sel, lado: 'R' })}>Ponta {G.pontas[1]} ▶</button>
        </div>}
      </div>

      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {rules && <Rules onClose={() => setRules(false)} />}

      {overShown && <Modal><h2>{G.over.dupla === meuTime ? '🏆 Vitória!' : 'Não foi dessa vez'}</h2>
        <div className="prize">{G.placar[meuTime]} x {G.placar[outroTime]}</div>
        <p>{G.result.forfeit ? 'Alguém saiu da mesa. ' : ''}{G.over.dupla === meuTime ? (G.cfg.entry ? `Você levou ${fmt(G.prize)} fichas!` : 'Boa!') : 'Pede revanche!'}</p>
        <button className="go" onClick={() => { setDismissed(G.matchId); setMsg(''); }}>🔁 Revanche</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{DOMINO_CSS + '.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}'}</style>
    </div>
  );
}

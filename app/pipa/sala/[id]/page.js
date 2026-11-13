'use client';
// Sala online da PIPA (1 contra 1, valendo fichas): espera, convite, chat e a partida ao vivo.
// Os dois celulares rodam a mesma partida trocando só os toques (lib/pipa-lockstep.js).
// No fim, cada um manda o resultado; o servidor só paga se os dois baterem (lib/pipa-service.js).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { modeName, isPipaMode, fmt } from '../../../../lib/modes.js';
import { premioOnline } from '../../../../lib/taxa.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';
import { createLockstep } from '../../../../lib/pipa-lockstep.js';
import { createPipa3D } from '../../../../lib/pipa-view3d.js';
import { loadThree, webglOk } from '../../../../lib/three-loader.js';
import { createSom } from '../../../../lib/pipa-som.js';
import { PIPA_PADRAO } from '../../../../lib/pipa-arte.js';

const OUTRA = 'pipa-estrela';

/* ---------------- a partida ao vivo ---------------- */
function Partida({ roomId, srv, me, onFim, onMsg, onHud }) {
  const boxRef = useRef(null), ctlRef = useRef({ x: 0, y: 0, solta: false, puxa: false });
  const [botoes, setBotoes] = useState({ puxa: false, solta: false });
  const [espera, setEspera] = useState(0);
  const btn = (k, on) => { ctlRef.current[k] = on; setBotoes(b => ({ ...b, [k]: on })); };

  useEffect(() => {
    const box = boxRef.current, ctl = ctlRef.current;
    const nomes = srv.players.map((p, i) => (i === me ? 'Você' : p.name));
    let alive = true, raf, v3 = null, acc = 0, last = performance.now(), reportou = false, ultHud = 0;
    const som3 = createSom();
    const ch = sb().channel(`pipa:${roomId}:${srv.matchId}`, { config: { broadcast: { self: false } } });
    const L = createLockstep({ seed: srv.seed, me, names: nomes, enviar: m => { try { ch.send({ type: 'broadcast', event: 'toque', payload: m }); } catch {} } });
    ch.on('broadcast', { event: 'toque' }, ({ payload }) => L.recebe(payload)).subscribe();
    const G = L.G;

    // 3D (a sua pipa com a sua linha; a do adversário com o modelo padrão dele)
    const models = srv.players.map((p, i) => (i === me ? (p.pipa || PIPA_PADRAO) : (p.pipa || OUTRA)));
    if (webglOk()) loadThree().then(THREE => {
      if (!alive) return;
      try { v3 = createPipa3D({ THREE, box, models, cenario: 'bairro', linha: 'chilena', pele: 1, cam: '3d', me }); } catch (e) { console.error(e); }
    });
    else onMsg('Seu celular não tem 3D: a pipa online precisa dele.');

    const nome = i => nomes[i];
    function eventos() {
      for (const e of G.events) {
        if (e.type === 'go') onMsg('Já! Cruze a linha e segure PUXAR ou DESCARREGAR pra cortar');
        if (e.type === 'cruzou' && (e.a === me || e.b === me)) { sfx('tick'); try { navigator.vibrate && navigator.vibrate(15); } catch {} }
        if (e.type === 'corte') {
          if (v3) v3.pop(e.winner === me ? 'HEEELOOOU!' : 'CORTOU!', e.x, e.y);
          if (e.winner === me) { som3.grito('Heeeeelooooou!'); sfx('coin'); } else if (e.loser === me) { som3.grito('Eeei, tomou réééélo!', { voz: 'outro' }); sfx('err'); }
          onMsg(e.winner === me ? 'Você cortou a pipa dele!' : e.loser === me ? `${nome(e.winner)} cortou a sua pipa!` : '');
          if (v3 && (e.winner === me || e.loser === me)) v3.shake(e.loser === me ? .2 : .1);
        }
        if (e.type === 'aparou') { if (v3) v3.pop('APAROU!', e.x, e.y); onMsg(e.by === me ? 'Você aparou a pipa!' : `${nome(e.by)} aparou a pipa`); }
        if (e.type === 'rodada') { onMsg(e.winner === me ? 'Você ganhou a rodada!' : `${nome(e.winner)} ganhou a rodada`); sfx(e.winner === me ? 'coin' : 'err'); }
      }
      G.events.length = 0;
    }

    async function reporta() {
      if (reportou) return; reportou = true;
      onFim(G.over.winner);
      for (let k = 0; k < 4; k++) {
        try { await api(`/api/rooms/${roomId}/action`, { type: 'resultado', winner: G.over.winner, hash: L.resumo() }); return; }
        catch (e) { if (/acabou/i.test(e.message)) return; await new Promise(r => setTimeout(r, 1500)); }
      }
    }

    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      // só começa na hora marcada pelo servidor (os dois juntos)
      if (Date.now() < srv.startAt) { onMsg(`Começa em ${Math.ceil((srv.startAt - Date.now()) / 1000)}…`); last = now; if (v3) v3.draw(G, now); return; }
      acc = Math.min(acc + (now - last), 250); last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n < 6) { if (!L.quadroUm(ctl)) { acc = 0; break; } acc -= 1000 / 60; n++; eventos(); }
      if (G.over) reporta();
      const tr = L.travado(); if ((tr > 1500) !== (espera > 1500)) setEspera(tr);
      if (v3) v3.draw(G, now);
      som3.update({ vento: G.wind, cruzando: G.crosses.some(c => c.a === me || c.b === me), forte: G.k[me].pull || G.k[me].solta, solta: !!G.k[me].solta });
      if (now - ultHud > 250) { ultHud = now; onHud({ score: [...G.score], round: G.round, phase: G.phase }); }
    }
    raf = requestAnimationFrame(loop);

    // toques: lado esquerdo/direito = pipa pra esquerda/direita; arrastar = sobe/desce
    let dedo = null;
    const lado = e => { const r = box.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? -1 : 1; };
    function down(e) { if (e.target.closest && e.target.closest('.pp-desc, .pp-puxa')) return; dedo = { id: e.pointerId, y0: e.clientY }; ctl.x = lado(e); ctl.y = 0; try { e.target.setPointerCapture(e.pointerId); } catch {} }
    function move(e) { if (!dedo || e.pointerId !== dedo.id) return; const dy = e.clientY - dedo.y0; if (Math.abs(dy) > 14) { ctl.y = Math.max(-1, Math.min(1, dy / 45)); ctl.x = 0; } else { ctl.y = 0; ctl.x = lado(e); } }
    const up = e => { if (dedo && e.pointerId === dedo.id) { dedo = null; ctl.x = 0; ctl.y = 0; } };
    box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => v3 && v3.resize()); ro.observe(box);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); som3.stop();
      box.removeEventListener('pointerdown', down); box.removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      try { sb().removeChannel(ch); } catch {}
      if (v3) v3.dispose();
    };
  }, [srv.matchId]); // eslint-disable-line

  return (
    <div className="pp-field" ref={boxRef}>
      {espera > 1500 && <div className="pp-espera">📶 Esperando a conexão do adversário…</div>}
      <button className={`pp-puxa ${botoes.puxa ? 'on' : ''}`} onPointerDown={e => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} btn('puxa', true); }} onPointerUp={() => btn('puxa', false)} onPointerCancel={() => btn('puxa', false)} onContextMenu={e => e.preventDefault()}>✊<b>PUXAR</b></button>
      <button className={`pp-desc ${botoes.solta ? 'on' : ''}`} onPointerDown={e => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} btn('solta', true); }} onPointerUp={() => btn('solta', false)} onPointerCancel={() => btn('solta', false)} onContextMenu={e => e.preventDefault()}>🧵<b>DESCARREGAR</b></button>
    </div>
  );
}

/* ---------------- a página da sala ---------------- */
export default function PipaSala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [srv, setSrv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pass, setPass] = useState(''), [joinErr, setJoinErr] = useState('');
  const [msg, setMsg] = useState('');
  const [hud, setHud] = useState(null);
  const [meuFim, setMeuFim] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [som, setSom] = useState(true);
  const [now, setNow] = useState(Date.now());
  const chatRef = useRef(false), tickBusy = useRef(false), verRef = useRef(0);
  chatRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);
  const me = srv && user ? srv.players.findIndex(p => p.uid === user.id) : -1;
  const showGame = useCallback((st, v) => { if (!st || st.game !== 'pipa') return; if (v != null && v < verRef.current) return; verRef.current = v || verRef.current; setSrv(st); }, []);
  const loadRoom = useCallback(async () => { const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle(); setRoom(data || null); }, [id]);
  const loadPlayers = useCallback(async () => { const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat'); setPlayers(data || []); }, [id]);
  const loadGame = useCallback(async () => { const { data } = await sb().from('games').select('state,version').eq('room_id', id).maybeSingle(); if (data) showGame(data.state, data.version); }, [id, showGame]);
  const loadMsgs = useCallback(async () => { const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60); setMsgs((data || []).reverse()); }, [id]);

  useEffect(() => {
    if (!user) return;
    setSom(soundOn()); loadRoom(); loadPlayers();
    const ch = sb().channel('pipasala-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, p => { if (p.eventType === 'DELETE') setRoom(null); else setRoom(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, p => { if ((p.new && p.new.room_id === id) || (p.old && (p.old.room_id === id || !p.old.room_id))) loadPlayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.state) showGame(p.new.state, p.new.version); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` }, p => {
        setMsgs(m => [...m.slice(-80), p.new]);
        if (p.new.user_id !== user.id) { if (!chatRef.current) setUnread(u => u + 1); sfx('msg'); }
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') { loadGame(); loadMsgs(); } });
    return () => { sb().removeChannel(ch); };
  }, [user, id, loadRoom, loadPlayers, loadGame, loadMsgs, showGame]);
  useEffect(() => { if (isMember) { loadGame(); loadMsgs(); } }, [isMember, loadGame, loadMsgs]);
  useEffect(() => { if (room && !isPipaMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // o servidor fecha sozinho quando um dos dois não manda o resultado
  useEffect(() => {
    if (!srv || !isMember || srv.over || !meuFim && !(srv.deadline && now > srv.deadline)) return;
    if (!tickBusy.current && (srv.firstReportAt && now > srv.firstReportAt + 46000 || srv.deadline && now > srv.deadline)) {
      tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 3000));
    }
  }, [now, srv, isMember, meuFim, id]);
  useEffect(() => {
    if (!isMember) return;
    const p = () => { if (document.visibilityState === 'visible') api(`/api/rooms/${id}/ping`).catch(() => {}); };
    p(); const t = setInterval(p, 120000); document.addEventListener('visibilitychange', p);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', p); };
  }, [isMember, id]);
  useEffect(() => { setMeuFim(null); setHud(null); }, [srv?.matchId]);

  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && me >= 0 && !srv?.over && !confirm('Sair agora? Você perde a partida e a entrada.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=pipa');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }

  const overShown = srv && srv.over && srv.result?.matchOver;
  const endRef = useRef(null);
  useEffect(() => {
    if (!overShown || endRef.current === srv.matchId) return;
    endRef.current = srv.matchId; reloadProfile();
    sfx(srv.result.tie ? 'turn' : srv.result.champion === me ? 'win' : 'lose');
  }, [overShown]); // eslint-disable-line

  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=pipa')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=pipa')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>{modeName(room.mode)} · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=pipa')}>Voltar às salas</button>
      </div></div></div>
  );

  const inGame = srv && me >= 0 && (room.status === 'playing' || (srv.result?.matchOver && dismissed !== srv.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  if (!inGame) {
    const eu = players.find(p => p.user_id === user.id);
    const seats = [0, 1].map(i => players.find(p => p.seat === i));
    const convite = `Bora soltar pipa valendo na Casa de Jogos! 🪁 Entra na minha sala: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
    const inRoom = new Set(players.map(p => p.user_id));
    const free = online.filter(o => o.uid !== user.id && !inRoom.has(o.uid) && o.where !== 'sala');
    const base = { roomId: id, roomName: room.name, entry: room.entry, isPrivate: room.is_private, fromNick: profile?.nickname, fromAvatar: profile?.avatar };
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={() => leave(true)} title="Sair da sala">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>{modeName(room.mode)}</span><span>{room.entry ? `Entrada 💰 ${fmt(room.entry)} · quem ganha leva ${fmt(premioOnline(room.entry))}` : 'Grátis'}</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="invite"><input readOnly value={link} onFocus={e => e.target.select()} />
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(convite); toast('Convite copiado'); } catch { toast('Copie o link acima'); } }}>Copiar convite</button></div>
            <div className="invite" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="pillbtn" style={{ background: 'linear-gradient(180deg,#25d366,#128c4a)', textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(convite)}`}>📲 Convidar no WhatsApp</a>
              <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} disabled={!free.length} onClick={() => { const e = sendInvite({ ...base, to: 'all' }); toast(e || 'Convite enviado'); }}>📣 Convidar todos online ({free.length})</button>
            </div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small></div>
                : <div key={i} className="wseat free">Lugar vago</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>Ganha quem vencer 2 rodadas. Os dois celulares conferem o resultado: se não baterem, cada um recebe a entrada de volta.</p>
            <button className="go" style={eu?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} onClick={() => { unlockAudio(); ready(!eu?.ready); }}>{eu?.ready ? 'Cancelar pronto' : '✓ Estou pronto'}</button>
            <button className="sec" onClick={() => leave(true)}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
      </div>
    );
  }

  const h = hud || { score: [0, 0], round: 1 };
  const outro = 1 - me, res = srv.result;
  return (
    <div className="page pp">
      <Partida key={srv.matchId} roomId={id} srv={srv} me={me} onFim={setMeuFim} onMsg={setMsg} onHud={setHud} />
      <div className="pp-top">
        <div className="pp-pills">
          <div className="pp-pill"><span className="av">{srv.players[me].avatar}</span><b>Você</b><i>{h.score[me]}</i></div>
          <div className="pp-pill"><span className="av">{srv.players[outro].avatar}</span><b>{srv.players[outro].name}</b><i>{h.score[outro]}</i></div>
        </div>
        <div className="pp-mid">Rodada <b>{h.round}</b>{srv.cfg.entry ? <> · 💰 {fmt(srv.prize)}</> : null}</div>
        <button className="rbtn" title="Chat" style={{ position: 'relative' }} onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button>
      </div>
      <div className="pp-msg">{msg}</div>
      {meuFim != null && !overShown && <Modal><h2>{meuFim === me ? '🏆 Você ganhou!' : `${srv.players[outro].name} ganhou`}</h2><p>Conferindo o resultado com o outro celular…</p></Modal>}
      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {overShown && <Modal><h2>{res.tie ? 'Partida anulada' : res.champion === me ? '🏆 Você ganhou!' : `${srv.players[res.champion]?.name} ganhou`}</h2>
        <p>{res.tie ? (res.why === 'diferente' ? 'Os dois celulares não chegaram no mesmo resultado. Cada um recebeu a entrada de volta.' : 'A partida não terminou a tempo. Cada um recebeu a entrada de volta.')
          : res.forfeit ? (res.champion === me ? `O adversário saiu. Você levou ${fmt(srv.prize)} fichas!` : 'Você saiu da partida.')
          : res.champion === me ? `Você levou ${fmt(srv.prize)} fichas!` : 'Pede revanche!'}</p>
        <button className="go" onClick={() => { setDismissed(srv.matchId); setMsg(''); }}>🔁 Revanche</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{`
.pp{overflow:hidden;padding:0;background:#000}
.pp-field{position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none}
.pp-top{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;gap:8px;padding:max(6px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 14px max(10px,env(safe-area-inset-left));background:linear-gradient(#000a,#0000)}
.pp-pills{flex:1;display:flex;gap:6px;min-width:0}
.pp-pill{display:flex;align-items:center;gap:6px;background:#000b;border:2px solid #ffffff33;border-radius:20px;padding:2px 10px 2px 2px;color:#fff;font:500 13px Oswald;min-width:0}
.pp-pill .av{width:28px;height:28px;border-radius:50%;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:16px}
.pp-pill b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px}
.pp-pill i{font-style:normal;color:var(--gold);font:700 18px Oswald}
.pp-mid{color:#fff;font:500 14px Oswald;white-space:nowrap}
.pp-top .rbtn{width:36px;height:36px;font-size:15px;border-width:2px}
.pp-msg{position:absolute;left:50%;transform:translateX(-50%);top:clamp(52px,12vh,64px);z-index:4;pointer-events:none;font:500 clamp(12px,2.4vmin,16px) Oswald;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap}
.pp-espera{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:6;background:#000c;color:#fde68a;font:500 16px Oswald;padding:10px 18px;border-radius:14px;pointer-events:none}
.pp-puxa,.pp-desc{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));z-index:4;width:clamp(64px,11vmin,84px);height:clamp(64px,11vmin,84px);border-radius:50%;border:3px solid #fff;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;font-size:24px;line-height:1;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 4px 0 #000a,0 6px 14px #0008}
.pp-puxa{left:max(14px,env(safe-area-inset-left));background:radial-gradient(circle at 40% 30%,#ef4444,#991b1b)}
.pp-desc{right:max(14px,env(safe-area-inset-right));background:radial-gradient(circle at 40% 30%,#4b5563,#111827)}
.pp-puxa b,.pp-desc b{font:600 8.5px Oswald;margin-top:3px}
.pp-puxa.on,.pp-desc.on{transform:translateY(3px);box-shadow:0 1px 0 #000a;filter:brightness(1.3)}
.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}
`}</style>
    </div>
  );
}

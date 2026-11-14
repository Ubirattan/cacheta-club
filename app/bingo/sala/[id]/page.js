'use client';
// Sala online do BINGO (75 bolas): espera com escolha de cartelas, convite, chat e o sorteio ao vivo.
// O servidor sorteia e confere (lib/bingo-service.js); aqui o cliente marca o X nas cartelas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { modeName, isBingoMode, fmt } from '../../../../lib/modes.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';
import { COLUNAS, MAX_CARTELAS, letra, faltam, premioBingo, taxaBingo } from '../../../../lib/bingo.js';

const COR = { B: '#3b82f6', I: '#ef4444', N: '#f59e0b', G: '#22c55e', O: '#a855f7' };
const f2 = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function Cartela({ c, saiu, marcas, onMarca, mini, sel, cls = '' }) {
  return (
    <div className={`bg-cart ${mini ? 'mini' : ''} ${sel ? 'sel' : ''} ${cls}`}>
      <div className="bg-cab">{COLUNAS.map(l => <b key={l} style={{ background: COR[l] }}>{l}</b>)}</div>
      {c.linhas.map((l, r) => <div key={r} className="bg-lin">{l.map((n, k) => {
        const livre = n === 0, saiuN = saiu && saiu.has(n), x = livre || (marcas && marcas.has(n));
        return <span key={k} className={`${livre ? 'livre' : ''} ${saiuN && !x ? 'saiu' : ''} ${x ? 'x' : ''}`} onClick={() => onMarca && !livre && onMarca(n)}>
          {livre ? '★' : n}{x && !livre && <i>✕</i>}</span>;
      })}</div>)}
    </div>
  );
}

export default function BingoSala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [G, setG] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pass, setPass] = useState(''), [joinErr, setJoinErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [som, setSom] = useState(true);
  const [auto, setAuto] = useState(false);
  const [marcas, setMarcas] = useState({});
  const [todas, setTodas] = useState(false);
  const [regras, setRegras] = useState(false);
  const verRef = useRef(0), chatRef = useRef(false), tickBusy = useRef(false), lastSeen = useRef(null);
  chatRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);
  const jogando = G && G.fase !== 'espera';
  const me = jogando && user ? G.players.findIndex(p => p.uid === user.id) : -1;

  const showGame = useCallback((st, v) => {
    if (!st || st.game !== 'bingo') return;
    if (v != null && v < verRef.current) return;
    verRef.current = v || verRef.current; setG(st);
  }, []);
  const loadRoom = useCallback(async () => { const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle(); setRoom(data || null); }, [id]);
  const loadPlayers = useCallback(async () => { const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat'); setPlayers(data || []); }, [id]);
  const loadGame = useCallback(async () => { const { data } = await sb().from('games').select('state,version').eq('room_id', id).maybeSingle(); if (data) showGame(data.state, data.version); }, [id, showGame]);
  const loadMsgs = useCallback(async () => { const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60); setMsgs((data || []).reverse()); }, [id]);

  useEffect(() => {
    if (!user) return;
    setSom(soundOn()); loadRoom(); loadPlayers();
    try { setAuto(localStorage.getItem('bingo_auto') === '1'); } catch {}
    const ch = sb().channel('bingo-' + id)
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
  useEffect(() => { if (room && !isBingoMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);

  // relógio: a bola sai sozinha no servidor quando alguém da sala avisa (tick)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 400); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!G || !isMember || room?.status !== 'playing' || G.fase !== 'jogo') return;
    if (G.nextAt && now > G.nextAt + 200 && !tickBusy.current) {
      tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 900));
    }
  }, [now, G, isMember, room, id]);
  useEffect(() => {
    if (!isMember) return;
    const p = () => { if (document.visibilityState === 'visible') api(`/api/rooms/${id}/ping`).catch(() => {}); };
    p(); const t = setInterval(p, 120000); document.addEventListener('visibilitychange', p);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', p); };
  }, [isMember, id]);

  // antes de começar: pede as opções de cartela
  const minhaEsc = G && G.fase === 'espera' && user ? G.escolhas?.[user.id] : null;
  const pediu = useRef(false);
  useEffect(() => {
    if (!isMember || room?.status !== 'waiting' || pediu.current) return;
    if (G && G.fase === 'espera' && minhaEsc) return;
    if (G && G.fase === 'fim' && dismissed !== G.matchId && G.players.some(p => p.uid === user.id)) return;
    pediu.current = true; acao({ type: 'cartelas' }).finally(() => { pediu.current = false; });
  }, [isMember, room?.status, G?.fase, !!minhaEsc, dismissed]); // eslint-disable-line

  // som de cada bola e do bingo
  useEffect(() => {
    if (!G || !G.last || G.fase === 'espera') return;
    const key = G.matchId + ':' + G.last.n; if (lastSeen.current === key) return; lastSeen.current = key;
    if (G.last.t === 'bola') sfx('card');
    if (G.last.t === 'bingo') { sfx(G.result?.pagamentos?.[me] ? 'win' : 'lose'); reloadProfile(); }
  }, [G, me, reloadProfile]);
  // nova partida: limpa os X
  useEffect(() => { setMarcas({}); }, [G?.matchId]);

  async function acao(a) {
    try { const r = await api(`/api/rooms/${id}/action`, a); if (r && r.state) showGame(r.state, r.version); return r; }
    catch (e) { sfx('err'); toast(e.message); loadGame(); }
  }
  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && me >= 0 && G?.fase === 'jogo' && !confirm('Sair agora? Você perde suas cartelas.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=bingo');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }
  function marca(cid, n) {
    if (!saiu.has(n)) { sfx('err'); return toast('Esse número ainda não saiu'); }
    setMarcas(m => { const s = new Set(m[cid] || []); s.has(n) ? s.delete(n) : s.add(n); return { ...m, [cid]: s }; });
  }
  const saiu = new Set(jogando ? G.saiu : []);

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=bingo')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=bingo')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>🎟️ Bingo · cartela 💰 {fmt(room.entry)} · até {room.max_players} jogadores</p>
        {room.status === 'playing' ? <p>Essa sala está jogando agora. Assim que acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=bingo')}>Voltar às salas</button>
      </div></div><style>{CSS}</style></div>
  );

  const inGame = jogando && me >= 0 && (room.status === 'playing' || (G.result?.matchOver && dismissed !== G.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- SALA DE ESPERA + ESCOLHA DAS CARTELAS ---------- */
  if (!inGame) {
    const eu = players.find(p => p.user_id === user.id);
    const W = G && G.fase === 'espera' ? G : null;
    const nCart = uid => (W?.escolhas?.[uid]?.minhas || []).length;
    const poteEst = players.reduce((t, p) => t + nCart(p.user_id), 0) * room.entry;
    const convite = `Bora jogar bingo na Casa de Jogos! 🎟️ Cartela de ${room.entry} fichas. Entra na minha sala: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
    const inRoom = new Set(players.map(p => p.user_id));
    const free = online.filter(o => o.uid !== user.id && !inRoom.has(o.uid) && o.where !== 'sala');
    const base = { roomId: id, roomName: room.name, entry: room.entry, isPrivate: room.is_private, fromNick: profile?.nickname, fromAvatar: profile?.avatar };
    const inv = to => { const e = sendInvite({ ...base, to }); toast(e || `Convite enviado para ${free.length} jogador${free.length === 1 ? '' : 'es'} online`); };
    const meus = minhaEsc?.minhas || [];
    return (
      <div className="page lounge bg">
        <Header profile={profile} right={<button className="rbtn" onClick={() => leave(true)} title="Sair da sala">↩</button>} />
        <div className="bg-espera">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>🎟️ Bingo</span><span>Cartela 💰 {fmt(room.entry)}</span><span>👥 {players.length}/{room.max_players}</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="bg-pote">Pote agora: <b>{fmt(poteEst)}</b> · prêmio <b>{f2(premioBingo(poteEst))}</b> <small>(casa {taxaBingo(poteEst)}%)</small></div>
            <div className="invite" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="pillbtn" style={{ background: 'linear-gradient(180deg,#25d366,#128c4a)', textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(convite)}`}>📲 Convidar no WhatsApp</a>
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(convite); toast('Convite copiado'); } catch { toast(link); } }}>🔗 Copiar link</button>
              <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} disabled={!free.length} onClick={() => inv('all')}>📣 Online ({free.length})</button>
            </div>
            <div className="bg-quem">
              {players.map(p => <div key={p.user_id} className={p.ready ? 'rdy' : ''}><span>{p.avatar}</span><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small>{nCart(p.user_id)} 🎟️ · {p.ready ? '✓ pronto' : 'escolhendo'}</small></div>)}
              {Array.from({ length: Math.max(0, room.max_players - players.length) }, (_, k) => <div key={'v' + k} className="vago"><span>➕</span><b>Lugar vago</b></div>)}
            </div>
          </div>

          <div className="panel">
            <h3>Escolha suas cartelas <small>({meus.length}/{MAX_CARTELAS})</small></h3>
            <p className="hint" style={{ margin: '0 0 8px' }}>Toque pra escolher de 1 a {MAX_CARTELAS}. Cada cartela custa <b>{fmt(room.entry)}</b> fichas{meus.length ? <> · total <b>{fmt(room.entry * meus.length)}</b></> : null}.</p>
            {!minhaEsc ? <div className="hint">Carregando cartelas…</div> : <div className="bg-opcoes">
              {minhaEsc.opcoes.map(c => <div key={c.id} className="bg-op" onClick={() => !eu?.ready && acao({ type: 'escolher', id: c.id })}>
                <Cartela c={c} mini sel={meus.includes(c.id)} />{meus.includes(c.id) && <i className="bg-ok">✓</i>}</div>)}
            </div>}
            <div className="bg-bts">
              <button className="sec" disabled={eu?.ready} onClick={() => acao({ type: 'trocar' })}>🔄 Trocar opções</button>
              <button className="go" style={eu?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} disabled={!meus.length && !eu?.ready}
                onClick={() => { unlockAudio(); ready(!eu?.ready); }}>{eu?.ready ? 'Cancelar pronto' : meus.length ? `✓ Pronto · ${fmt(room.entry * meus.length)} fichas` : 'Escolha uma cartela'}</button>
            </div>
            <p className="hint" style={{ textAlign: 'center' }}>Começa sozinho quando todos que sentaram (2 ou mais) estiverem prontos.</p>
            <button className="sec" onClick={() => setRegras(true)}>📖 Regras do bingo</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
        {regras && <Regras onClose={() => setRegras(false)} />}
        <style>{CSS}</style>
      </div>
    );
  }

  /* ---------- JOGO ---------- */
  const eu = G.players[me];
  const ult = G.saiu[G.saiu.length - 1];
  const prox = G.nextAt ? Math.max(0, Math.ceil((G.nextAt - now) / 1000)) : null;
  const marcasDe = c => auto ? new Set(numeros(c).filter(n => saiu.has(n))) : (marcas[c.id] || new Set());
  const ranking = G.players.map((p, pi) => ({ p, pi, f: Math.min(...p.cartelas.map(c => faltam(c, saiu))) })).sort((a, b) => a.f - b.f);
  const fim = G.fase === 'fim';
  const meuPremio = fim ? (G.result.pagamentos?.[me] || 0) : 0;

  return (
    <div className="page lounge bg">
      <div className="bg-top">
        <div className="bg-bola">{ult ? <span className="bl" style={{ background: COR[letra(ult)] }} key={ult}><small>{letra(ult)}</small>{ult}</span> : <span className="bl esp">🎱</span>}</div>
        <div className="bg-info">
          <b>{ult ? `Bola ${G.saiu.length} de 75` : `Começa em ${prox ?? 0}s`}</b>
          <small>Prêmio <b>{f2(G.premio)}</b> · pote {fmt(G.pote)}</small>
          <div className="bg-ult">{G.saiu.slice(-6, -1).reverse().map(n => <i key={n} style={{ background: COR[letra(n)] }}>{n}</i>)}</div>
        </div>
        <div className="bg-btop">
          <button className="rbtn" title="Chat" style={{ position: 'relative' }} onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
          <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
          <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button>
        </div>
      </div>
      <div className="bg-acoes">
        <button className={auto ? 'on' : ''} onClick={() => { const v = !auto; setAuto(v); try { localStorage.setItem('bingo_auto', v ? '1' : '0'); } catch {} }}>{auto ? '✅' : '⬜'} Marcar sozinho</button>
        <button onClick={() => setTodas(true)}>🔢 Bolas que saíram</button>
      </div>

      <div className="bg-jogo">
        <div className="bg-minhas">
          {eu.cartelas.map(c => { const fl = faltam(c, saiu); return (
            <div key={c.id} className="bg-cw">
              <Cartela c={c} saiu={saiu} marcas={marcasDe(c)} onMarca={auto ? null : n => marca(c.id, n)} cls={fl === 0 ? 'cheia' : ''} />
              <small className={fl <= 3 ? 'quase' : ''}>{fl === 0 ? '🎉 CARTELA CHEIA!' : `Faltam ${fl}`}</small>
            </div>); })}
        </div>
        <div className="bg-rank">
          <b>Quem está perto</b>
          {ranking.map(({ p, pi, f }) => <div key={pi} className={pi === me ? 'eu' : ''}><span>{p.avatar}</span><em>{pi === me ? 'Você' : p.name}{p.left ? ' (saiu)' : ''}</em><i>{p.cartelas.length}🎟️</i><b>{f === 0 ? 'BINGO' : `falta ${f}`}</b></div>)}
        </div>
      </div>

      {todas && <Modal onClose={() => setTodas(false)}><h2>Bolas que saíram ({G.saiu.length})</h2>
        <div className="bg-todas">{COLUNAS.map((l, c) => <div key={l}><b style={{ background: COR[l] }}>{l}</b>
          {Array.from({ length: 15 }, (_, k) => c * 15 + k + 1).map(n => <i key={n} className={saiu.has(n) ? 'on' : ''} style={saiu.has(n) ? { background: COR[l] } : null}>{n}</i>)}</div>)}</div>
        <button className="go" onClick={() => setTodas(false)}>Fechar</button></Modal>}
      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {fim && G.result?.matchOver && <Modal><h2>{meuPremio > 0 ? '🎉 BINGO!' : '🎟️ Bingo!'}</h2>
        <p>{G.result.cartelas.length ? <>Cartela cheia de <b>{[...new Set(G.result.cartelas.map(w => w.pi))].map(pi => pi === me ? 'você' : G.players[pi].name).join(', ')}</b> na bola <b>{G.result.bola}</b>.</> : 'Partida encerrada.'}</p>
        {meuPremio > 0 ? <div className="prize">+{f2(meuPremio)} fichas</div> : <p>Não foi dessa vez.</p>}
        {G.result.cartelas.length > 1 && <p style={{ fontSize: 13 }}>{G.result.cartelas.length} cartelas completaram juntas: o prêmio foi dividido.</p>}
        <button className="go" onClick={() => { setDismissed(G.matchId); }}>🔁 Jogar de novo</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{CSS + '.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}'}</style>
    </div>
  );
}
const numeros = c => c.linhas.flat().filter(n => n > 0);

function Regras({ onClose }) {
  return <Modal onClose={onClose}><h2>Bingo</h2>
    <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
      <p>• 75 bolas e cartelas de 5x5 (<b>B I N G O</b>), com o centro livre ★.</p>
      <p>• Cada jogador escolhe de <b>1 a {MAX_CARTELAS} cartelas</b>. Cada cartela custa o valor da sala.</p>
      <p>• Sai uma bola a cada 4,5 segundos. Toque no número da sua cartela pra marcar o <b>X</b> (ou ligue <b>Marcar sozinho</b>).</p>
      <p>• Ganha quem completar a <b>cartela inteira</b> primeiro. O site confere sozinho: você não perde o prêmio por distração.</p>
      <p>• Se mais de uma cartela completar na mesma bola, o prêmio é dividido.</p>
      <p>• Prêmio = soma das cartelas menos a taxa da casa: <b>10%</b> (pote até 100 fichas) ou <b>20%</b> (acima de 100).</p>
    </div>
    <button className="go" onClick={onClose}>Entendi</button></Modal>;
}

const CSS = `
.bg{overflow:hidden;display:flex;flex-direction:column}
.bg-espera{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:8px 10px 14px}
.bg-espera .panel{margin:0}
.bg-espera h3 small{font:500 14px Rubik;color:var(--mut)}
.bg-pote{font:500 14px Rubik;color:#eadfca;margin:6px 0}.bg-pote b{color:#4ade80}.bg-pote small{color:var(--mut)}
.bg-quem{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-top:8px}
.bg-quem div{display:flex;flex-direction:column;align-items:center;padding:6px;border-radius:12px;background:#0006;border:1.5px solid #ffffff1a}
.bg-quem div.rdy{border-color:#4ade80}.bg-quem .vago{opacity:.5}
.bg-quem span{font-size:22px}.bg-quem b{font:600 13px Rubik;color:#fff}.bg-quem small{font:500 12px Rubik;color:#a8a29e}
.bg-opcoes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.bg-op{position:relative;cursor:pointer}
.bg-ok{position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:50%;background:#22c55e;color:#fff;display:grid;place-items:center;font:700 16px Rubik;font-style:normal;border:2px solid #fff}
.bg-bts{display:flex;gap:8px;margin-top:10px}.bg-bts button{flex:1;margin:0!important}
.bg-cart{background:#fffdf6;border-radius:12px;padding:5px;box-shadow:0 4px 10px #0008;border:3px solid transparent}
.bg-cart.sel{border-color:#22c55e;box-shadow:0 0 0 2px #22c55e66,0 4px 10px #0008}
.bg-cart.cheia{border-color:#fde047;animation:pulse 1s infinite alternate}
.bg-cab,.bg-lin{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
.bg-cab{margin-bottom:3px}
.bg-cab b{color:#fff;text-align:center;border-radius:6px;font:700 18px Oswald;padding:1px 0}
.bg-lin{margin-top:3px}
.bg-lin span{position:relative;aspect-ratio:1;display:grid;place-items:center;border-radius:7px;background:#f1ead6;color:#1c1917;font:700 clamp(15px,4.6vw,22px) Oswald;cursor:pointer;user-select:none}
.bg-lin span.livre{background:#fde68a;color:#b45309}
.bg-lin span.saiu{background:#fef3c7;box-shadow:inset 0 0 0 2px #f59e0b}
.bg-lin span i{position:absolute;inset:0;display:grid;place-items:center;color:#dc2626;font:700 clamp(26px,8vw,40px) Rubik;font-style:normal;opacity:.85;animation:bgx .2s ease-out}
@keyframes bgx{from{transform:scale(1.6);opacity:0}to{transform:scale(1);opacity:.85}}
.bg-cart.mini{padding:3px;border-radius:9px}
.bg-cart.mini .bg-cab b{font-size:11px}.bg-cart.mini .bg-lin{gap:2px;margin-top:2px}
.bg-cart.mini .bg-lin span{font-size:11px;border-radius:4px}
.bg-top{display:flex;align-items:center;gap:10px;padding:8px 10px 4px}
.bg-bola .bl{width:70px;height:70px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 30px Oswald;line-height:1;border:4px solid #fff;box-shadow:0 6px 16px #000a,inset 0 -6px 10px #0004;animation:bgbola .5s ease-out}
.bg-bola .bl small{font:700 14px Oswald}.bg-bola .bl.esp{background:#1f1a12;font-size:30px}
@keyframes bgbola{from{transform:scale(.3) rotate(-200deg)}to{transform:scale(1) rotate(0)}}
.bg-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;color:#fff}
.bg-info>b{font:700 20px Oswald}.bg-info>small{font:500 13px Rubik;color:#d6cbb3}.bg-info>small b{color:#4ade80}
.bg-ult{display:flex;gap:4px}.bg-ult i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff;font:700 12px Oswald;font-style:normal;opacity:.9}
.bg-btop{display:flex;flex-direction:column;gap:4px}.bg-btop .rbtn{width:36px;height:36px;font-size:15px}
.bg-acoes{display:flex;gap:8px;padding:2px 10px 6px}
.bg-acoes button{flex:1;border:1.5px solid #ffffff2a;background:#0008;color:#fff;border-radius:12px;padding:8px 4px;font:600 14px Rubik}
.bg-acoes button.on{border-color:#4ade80;color:#4ade80}
.bg-jogo{flex:1;min-height:0;overflow-y:auto;padding:0 10px 14px;display:flex;flex-direction:column;gap:10px}
.bg-minhas{display:flex;flex-direction:column;gap:10px}
.bg-cw{display:flex;flex-direction:column;align-items:center;gap:3px}.bg-cw .bg-cart{width:min(420px,100%)}
.bg-cw small{font:700 15px Oswald;color:#d6cbb3}.bg-cw small.quase{color:#fde047}
.bg-rank{background:#0008;border:1.5px solid #ffffff1a;border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}
.bg-rank>b{font:700 15px Oswald;color:var(--gold)}
.bg-rank div{display:flex;align-items:center;gap:8px;color:#fff;font:500 14px Rubik}
.bg-rank div.eu{color:#fde047}.bg-rank em{flex:1;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-rank i{font-style:normal;font-size:12px;color:#a8a29e}.bg-rank div b{font:700 14px Oswald}
.bg-todas{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:10px}
.bg-todas div{display:flex;flex-direction:column;gap:3px}
.bg-todas b{color:#fff;text-align:center;border-radius:6px;font:700 16px Oswald}
.bg-todas i{font-style:normal;text-align:center;border-radius:6px;background:#ffffff14;color:#a8a29e;font:600 13px Rubik;padding:3px 0}
.bg-todas i.on{color:#fff;font-weight:700}
`;

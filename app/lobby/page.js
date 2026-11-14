'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { premioOnline, taxaPct } from '../../lib/taxa.js';
import { useRouter } from 'next/navigation';
import { sb, api } from '../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../components/useAuth.js';
import { voltar, Header, Modal, Seg, toast } from '../../components/ui.js';
import ProfileModal from '../../components/ProfileModal.js';
import JoinCode from '../../components/JoinCode.js';
import { MODES, GUDE_ROOMS, SINUCA_ROOMS, TRUCO_ROOMS, PIPA_ROOMS, DOMINO_ROOMS, BINGO_ROOMS, isBingoMode, isGudeMode, isSinucaMode, isTrucoMode, isPipaMode, isDominoMode, isMiniMode, is1x1Mode, modeName, ENTRIES, POINTS, TURN_SECONDS, fmt } from '../../lib/modes.js';

const salaUrl = (id, m) => (isGudeMode(m) ? '/gude/sala/' : isSinucaMode(m) ? '/sinuca/sala/' : isTrucoMode(m) ? '/truco/sala/' : isPipaMode(m) ? '/pipa/sala/' : isDominoMode(m) ? '/domino/sala/' : isBingoMode(m) ? '/bingo/sala/' : '/sala/') + id;
const JOGO_ABA = { gude: ['gude-triangulo', isGudeMode], sinuca: ['sinuca-bola8', isSinucaMode], truco: ['truco-1x1', isTrucoMode], pipa: ['pipa-1x1', isPipaMode], domino: ['domino-duplas', isDominoMode], bingo: ['bingo', isBingoMode] };

const JOGOS_SALA = [['cacheta', '🃏 Cacheta'], ['truco', '🂡 Truco'], ['gude', '🔵 Gude'], ['sinuca', '🎱 Sinuca'], ['pipa', '🪁 Pipa'], ['domino', '🁫 Dominó'], ['bingo', '🎟️ Bingo']];

function CreateRoom({ profile, onClose, gude, jogo }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', mode: JOGO_ABA[jogo] ? JOGO_ABA[jogo][0] : MODES[jogo] ? jogo : 'cacheta', maxPlayers: jogo === 'bingo' ? 10 : 4, points: 5, entry: jogo === 'bingo' ? 5 : JOGO_ABA[jogo] ? 2 : 1, turnSeconds: 30, isPrivate: false, password: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  // só mostra as modalidades do jogo de onde a pessoa veio (gude, sinuca…); na aba Todas, escolhe o jogo primeiro
  const fixo = !!MODES[jogo] || !!JOGO_ABA[jogo];
  const [jg, setJg] = useState(JOGO_ABA[jogo] ? jogo : 'cacheta');
  const escolheJogo = v => { setJg(v); setF(o => ({ ...o, mode: JOGO_ABA[v] ? JOGO_ABA[v][0] : 'cacheta', entry: v === 'bingo' ? Math.max(5, o.entry) : JOGO_ABA[v] ? Math.max(2, o.entry) : o.entry, maxPlayers: v === 'bingo' ? 10 : o.maxPlayers })); };
  // gude: entrada mínima de 2 fichas
  const set = (k, v) => setF(o => { const n = { ...o, [k]: v }; if (isMiniMode(n.mode) && n.entry < 2) n.entry = 2; return n; });
  async function create() {
    setErr(''); setBusy(true);
    try { const r = await api('/api/rooms', f); router.push(salaUrl(r.id, f.mode)); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal onClose={onClose}>
      <h2>Criar sala</h2>
      <input className="field" placeholder={`Nome da sala (ex.: Mesa de ${profile?.nickname || 'amigos'})`} maxLength={30} value={f.name} onChange={e => set('name', e.target.value)} />
      {!fixo && <Seg label="Jogo" value={jg} onChange={escolheJogo} options={JOGOS_SALA.map(([k, n]) => [k, n])} />}
      {jg === 'cacheta' && <Seg label="Modalidade" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(MODES).map(([k, m]) => [k, m.name])} />}
      {jg === 'gude' && <Seg label="Bolinha de gude (1 contra 1)" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(GUDE_ROOMS).map(([k, m]) => [k, m.name.replace('Gude · ', '')])} />}
      {jg === 'truco' && <Seg label="Truco paulista" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(TRUCO_ROOMS).map(([k, m]) => [k, m.name.replace('Truco · ', '')])} />}
      {jg === 'pipa' && <Seg label="Pipa (1 contra 1)" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(PIPA_ROOMS).map(([k, m]) => [k, m.name.replace('Pipa · ', '')])} />}
      {jg === 'domino' && <Seg label="Dominó" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(DOMINO_ROOMS).map(([k, m]) => [k, m.name.replace('Dominó · ', '')])} />}
      {jg === 'sinuca' && <Seg label="Sinuca (1 contra 1)" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(SINUCA_ROOMS).map(([k, m]) => [k, m.name.replace('Sinuca · ', '')])} />}
      {!isMiniMode(f.mode) && <Seg label="Jogadores na mesa" value={f.maxPlayers} onChange={v => set('maxPlayers', v)} options={(isBingoMode(f.mode) ? [2, 3, 4, 5, 6, 7, 8, 9, 10] : [2, 3, 4, 5, 6, 7, 8, 9]).map(n => [n, String(n)])} hint="A partida começa sozinha quando todos que sentaram estiverem prontos (mínimo 2)." />}
      {isBingoMode(f.mode) ? <Seg label="Valor da cartela (fichas)" value={f.entry} onChange={v => set('entry', v)} options={[5, 10, 20, 50, 100, 200].map(e => [e, fmt(e)])} />
        : <Seg label="Entrada (fichas virtuais)" value={f.entry} onChange={v => set('entry', v)} options={ENTRIES.slice(0, 7).filter(e => !isMiniMode(f.mode) || e >= 2).map(e => [e, fmt(e)])} />}
      {isBingoMode(f.mode) ? <div className="hint" style={{ textAlign: 'center' }}>Bingo: cada jogador escolhe de 1 a 3 cartelas. Ganha quem completar a cartela inteira. A casa fica com 10% do pote até 100 fichas e 20% acima de 100.</div>
      : isMiniMode(f.mode) ? <div className="hint" style={{ textAlign: 'center' }}>{isDominoMode(f.mode) ? 'Dominó em duplas: 4 jogadores, a mesa começa cheia. Cada um da dupla vencedora leva o mesmo prêmio. Entrada mínima de 2 fichas.' : isTrucoMode(f.mode) ? (f.mode === 'truco-duplas' ? 'Truco em duplas: 4 jogadores, a mesa começa cheia. Cada um da dupla vencedora leva o mesmo prêmio.' : 'Truco 1 contra 1') : isSinucaMode(f.mode) ? 'Sinuca é sempre 1 contra 1' : isPipaMode(f.mode) ? 'Pipa online é 1 contra 1' : 'Gude é sempre 1 contra 1'}, entrada mínima de 2 fichas. Quem ganha leva {fmt(premioOnline(+f.entry || 0))}{taxaPct(+f.entry || 0) ? ` (a casa fica com ${taxaPct(+f.entry || 0)}% do pote)` : ' (a entrada dele + metade da do outro; o resto fica pra casa)'}. Até 10 fichas: metade da entrada do outro fica pra casa · acima de 10: 10% do pote · acima de 100: 20%.</div>
        : <Seg label="Pontos" value={f.points} onChange={v => set('points', v)} options={POINTS.map(p => [p, String(p)])} />}
      {!isBingoMode(f.mode) && <Seg label="Tempo por jogada" value={f.turnSeconds} onChange={v => set('turnSeconds', v)} options={TURN_SECONDS.map(t => [t, t + ' s'])} />}
      <Seg label="Tipo de sala" value={f.isPrivate} onChange={v => set('isPrivate', v)} options={[[false, '🌐 Pública'], [true, '🔒 Privada']]} />
      {profile?.vip_until && new Date(profile.vip_until) > new Date() && <Seg label="Sala VIP" value={!!f.vipOnly} onChange={v => set('vipOnly', v)} options={[[false, 'Aberta a todos'], [true, '👑 Só VIP']]} />}
      {f.isPrivate && <input className="field" placeholder="Senha da sala" maxLength={20} value={f.password} onChange={e => set('password', e.target.value)} />}
      {err && <div className="err">{err}</div>}
      <button className="go" disabled={busy} onClick={create}>{busy ? 'Criando…' : 'Criar e sentar'}</button>
      <button className="sec" onClick={onClose}>Cancelar</button>
    </Modal>
  );
}

export default function Lobby() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: false });
  const online = useOnline(user, profile, 'lobby');
  const [rooms, setRooms] = useState(null);
  const [mode, setMode] = useState('todas');
  useEffect(() => { try { const j = new URLSearchParams(location.search).get('jogo'); if (j === 'gude' || j === 'sinuca' || j === 'truco' || j === 'pipa' || j === 'domino' || j === 'bingo') setMode(j); } catch {} }, []);
  const [filt, setFilt] = useState({ waiting: true, playing: true, priv: true });
  const [modal, setModal] = useState(null);
  const tRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await sb().from('rooms').select('*, room_players(count)').order('created_at', { ascending: false }).limit(80);
    if (!error) setRooms(data.map(r => ({ ...r, n: r.room_players?.[0]?.count || 0 })));
  }, []);
  useEffect(() => {
    load();   // visitante também vê as mesas
    const later = () => { clearTimeout(tRef.current); tRef.current = setTimeout(load, 400); };
    const ch = sb().channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, later)
      .subscribe();
    let tk = null, lp = null;
    if (user) {   // só quem tem conta dispara as tarefas do servidor
      tk = setInterval(() => api('/api/tournaments', { op: 'tick' }).catch(() => {}), 30000);
      // fecha mesas abandonadas (10 min sem ninguém e sem jogada)
      const limpa = () => api('/api/rooms/cleanup', {}).then(r => { if (r && r.closed) load(); }).catch(() => {});
      limpa(); lp = setInterval(limpa, 120000);
    }
    return () => { sb().removeChannel(ch); clearTimeout(tRef.current); clearInterval(tk); clearInterval(lp); };
  }, [user, load]);

  const list = (rooms || []).filter(r => !r.tournament_id && r.status !== 'closed' && (mode === 'todas' || r.mode === mode || (mode === 'gude' && isGudeMode(r.mode)) || (mode === 'sinuca' && isSinucaMode(r.mode)) || (mode === 'truco' && isTrucoMode(r.mode)) || (mode === 'pipa' && isPipaMode(r.mode)) || (mode === 'domino' && isDominoMode(r.mode)) || (mode === 'bingo' && isBingoMode(r.mode)))
    && (r.status === 'waiting' ? filt.waiting : filt.playing) && (!r.is_private || filt.priv));

  async function sit(r) {
    // mesa pública de cacheta jogando: entra só pra assistir
    if (r.status === 'playing' && !r.is_private && !isMiniMode(r.mode) && !isBingoMode(r.mode)) return router.push('/sala/' + r.id + '?assistir=1');
    if (r.is_private) return setModal({ t: 'senha', room: r });
    try { await api(`/api/rooms/${r.id}/join`, {}); router.push(salaUrl(r.id, r.mode)); }
    catch (e) { toast(e.message); }
  }
  async function quick() {
    const ab = JOGO_ABA[mode], m0 = ab ? ab[0] : 'cacheta', tipo = m => (ab ? ab[1](m) : !isMiniMode(m));
    const r = (rooms || []).find(x => x.status === 'waiting' && tipo(x.mode) && !x.is_private && !x.vip_only && !x.tournament_id && x.n < x.max_players && x.entry <= (profile?.coins || 0));
    if (r) return sit(r);
    try { const c = await api('/api/rooms', { mode: m0, maxPlayers: m0 === 'bingo' ? 10 : 4, points: 5, entry: m0 === 'bingo' ? 5 : ab ? 2 : 1, turnSeconds: 30 }); router.push(salaUrl(c.id, m0)); }
    catch (e) { toast(e.message); }
  }
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')}
        right={<><button className="online" onClick={() => setModal('online')}><i />{online.length} online</button><button className="rbtn" onClick={() => voltar(router, '/')}>↩</button></>} />
      <div className="tabs">
        {[['todas', 'Todas'], ...Object.entries(MODES).map(([k, m]) => [k, m.name]), ['truco', '♣️ Truco'], ['gude', '🔵 Gude'], ['sinuca', '🎱 Sinuca'], ['pipa', '🪁 Pipa'], ['domino', '🁫 Dominó'], ['bingo', '🎟️ Bingo']].map(([k, t]) =>
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t}</button>)}
      </div>
      <div className="lobbar">
        <button className="pillbtn" onClick={() => setModal('criar')}>➕ Criar sala</button>
        <button className="pillbtn blue" onClick={quick}>⚡ Partida rápida</button>
        <button className="pillbtn dark" onClick={() => setModal('codigo')}>🔑 Entrar com código</button>
        <button className="pillbtn dark" onClick={() => router.push('/torneios')}>🏆 Torneios</button>
      </div>
      <div className="tables">
        {rooms === null && <div className="empty">Carregando salas…</div>}
        {rooms && !list.length && <div className="empty">Nenhuma sala aberta agora. Crie uma e chame os amigos!</div>}
        {list.map(r => (
          <button key={r.id} className={`tbl ${r.status === 'playing' ? 'lock' : ''} ${r.entry >= 100 ? 'hot' : ''}`} onClick={() => sit(r)}>
            <span className={`st ${r.status === 'playing' ? 'play' : ''}`}>{r.status === 'playing' ? (!r.is_private && !is1x1Mode(r.mode) && !isBingoMode(r.mode) && !isDominoMode(r.mode) && !isTrucoMode(r.mode) ? 'Jogando · 👁 Assistir' : 'Jogando') : 'Aguardando'}</span>
            {(r.is_private || r.vip_only) && <span className="lk">{r.vip_only ? '👑' : ''}{r.is_private ? '🔒' : ''}</span>}
            <div className="val">{fmt(r.entry)}<small>{modeName(r.mode)}</small></div>
            <div className="nm">{r.name}</div>
            <div className="row"><span>👥 {r.n}/{r.max_players}</span><span>{isBingoMode(r.mode) ? `Até ${r.max_players} · cartela ${fmt(r.entry)}` : isDominoMode(r.mode) ? 'Duplas' : isTrucoMode(r.mode) ? (r.mode === 'truco-duplas' ? 'Duplas' : '1 contra 1') : is1x1Mode(r.mode) ? '1 contra 1' : `Pontos: ${r.points}`}</span></div>
          </button>
        ))}
      </div>
      <div className="lobfoot">
        {[['waiting', 'Aguardando'], ['playing', 'Jogando'], ['priv', 'Privadas']].map(([k, t]) =>
          <button key={k} className="chk" onClick={() => setFilt(o => ({ ...o, [k]: !o[k] }))}><i>{filt[k] ? '✓' : ''}</i>{t}</button>)}
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      {modal === 'criar' && <CreateRoom profile={profile} gude={mode === 'gude'} jogo={mode} onClose={() => setModal(null)} />}
      {modal === 'codigo' && <JoinCode onClose={() => setModal(null)} />}
      {modal === 'online' && <Modal onClose={() => setModal(null)}><h2>Jogadores online</h2>
        <div className="score">{online.map(o => <div key={o.uid}><span>{o.avatar} {o.nick}</span><small style={{ color: 'var(--mut)' }}>{o.where === 'sala' ? 'numa sala' : o.where === 'lobby' ? 'procurando mesa' : 'no início'}</small></div>)}</div>
        <button className="go" onClick={() => setModal(null)}>Fechar</button></Modal>}
      {modal?.t === 'senha' && <PassModal room={modal.room} onClose={() => setModal(null)} />}
    </div>
  );
}

function PassModal({ room, onClose }) {
  const router = useRouter();
  const [p, setP] = useState(''), [err, setErr] = useState('');
  async function go() {
    try { await api(`/api/rooms/${room.id}/join`, { password: p }); router.push(salaUrl(room.id, room.mode)); }
    catch (e) { setErr(e.message); }
  }
  return (
    <Modal onClose={onClose}>
      <h2>🔒 {room.name}</h2><p>Essa sala é privada. Digite a senha.</p>
      <input className="field" placeholder="Senha" value={p} onChange={e => setP(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <button className="go" onClick={go}>Entrar</button><button className="sec" onClick={onClose}>Cancelar</button>
    </Modal>
  );
}

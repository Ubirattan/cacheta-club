'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sb, api } from '../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../components/useAuth.js';
import { Header, Modal, Seg, toast } from '../../components/ui.js';
import ProfileModal from '../../components/ProfileModal.js';
import JoinCode from '../../components/JoinCode.js';
import { MODES, GUDE_ROOMS, isGudeMode, modeName, ENTRIES, POINTS, TURN_SECONDS, fmt } from '../../lib/modes.js';

const salaUrl = (id, m) => (isGudeMode(m) ? '/gude/sala/' : '/sala/') + id;

function CreateRoom({ profile, onClose, gude }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', mode: gude ? 'gude-triangulo' : 'cacheta', maxPlayers: 4, points: 5, entry: 1, turnSeconds: 30, isPrivate: false, password: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  async function create() {
    setErr(''); setBusy(true);
    try { const r = await api('/api/rooms', f); router.push(salaUrl(r.id, f.mode)); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal onClose={onClose}>
      <h2>Criar sala</h2>
      <input className="field" placeholder={`Nome da sala (ex.: Mesa de ${profile?.nickname || 'amigos'})`} maxLength={30} value={f.name} onChange={e => set('name', e.target.value)} />
      <Seg label="Modalidade" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(MODES).map(([k, m]) => [k, m.name])} />
      <Seg label="Bolinha de gude (1 contra 1)" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(GUDE_ROOMS).map(([k, m]) => [k, m.name.replace('Gude · ', '')])} />
      {!isGudeMode(f.mode) && <Seg label="Jogadores na mesa" value={f.maxPlayers} onChange={v => set('maxPlayers', v)} options={[2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, String(n)])} hint="A partida começa sozinha quando todos que sentaram estiverem prontos (mínimo 2)." />}
      <Seg label="Entrada (fichas virtuais)" value={f.entry} onChange={v => set('entry', v)} options={ENTRIES.slice(0, 7).map(e => [e, fmt(e)])} />
      {isGudeMode(f.mode) ? <div className="hint" style={{ textAlign: 'center' }}>Gude é sempre 1 contra 1: quem ganhar leva o pote.</div>
        : <Seg label="Pontos" value={f.points} onChange={v => set('points', v)} options={POINTS.map(p => [p, String(p)])} />}
      <Seg label="Tempo por jogada" value={f.turnSeconds} onChange={v => set('turnSeconds', v)} options={TURN_SECONDS.map(t => [t, t + ' s'])} />
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
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'lobby');
  const [rooms, setRooms] = useState(null);
  const [mode, setMode] = useState('todas');
  useEffect(() => { try { if (new URLSearchParams(location.search).get('jogo') === 'gude') setMode('gude'); } catch {} }, []);
  const [filt, setFilt] = useState({ waiting: true, playing: true, priv: true });
  const [modal, setModal] = useState(null);
  const tRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await sb().from('rooms').select('*, room_players(count)').order('created_at', { ascending: false }).limit(80);
    if (!error) setRooms(data.map(r => ({ ...r, n: r.room_players?.[0]?.count || 0 })));
  }, []);
  useEffect(() => {
    if (!user) return;
    load();
    const later = () => { clearTimeout(tRef.current); tRef.current = setTimeout(load, 400); };
    const ch = sb().channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, later)
      .subscribe();
    const tk = setInterval(() => api('/api/tournaments', { op: 'tick' }).catch(() => {}), 30000);
    // fecha mesas abandonadas (10 min sem ninguém e sem jogada)
    const limpa = () => api('/api/rooms/cleanup', {}).then(r => { if (r && r.closed) load(); }).catch(() => {});
    limpa(); const lp = setInterval(limpa, 120000);
    return () => { sb().removeChannel(ch); clearTimeout(tRef.current); clearInterval(tk); clearInterval(lp); };
  }, [user, load]);

  const list = (rooms || []).filter(r => !r.tournament_id && r.status !== 'closed' && (mode === 'todas' || r.mode === mode || (mode === 'gude' && isGudeMode(r.mode)))
    && (r.status === 'waiting' ? filt.waiting : filt.playing) && (!r.is_private || filt.priv));

  async function sit(r) {
    if (r.is_private) return setModal({ t: 'senha', room: r });
    try { await api(`/api/rooms/${r.id}/join`, {}); router.push(salaUrl(r.id, r.mode)); }
    catch (e) { toast(e.message); }
  }
  async function quick() {
    const g = mode === 'gude';
    const r = (rooms || []).find(x => x.status === 'waiting' && isGudeMode(x.mode) === g && !x.is_private && !x.vip_only && !x.tournament_id && x.n < x.max_players && x.entry <= (profile?.coins || 0));
    if (r) return sit(r);
    try { const c = await api('/api/rooms', { mode: g ? 'gude-triangulo' : 'cacheta', maxPlayers: 4, points: 5, entry: 1, turnSeconds: 30 }); router.push(salaUrl(c.id, g ? 'gude-triangulo' : 'cacheta')); }
    catch (e) { toast(e.message); }
  }
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')}
        right={<><button className="online" onClick={() => setModal('online')}><i />{online.length} online</button><button className="rbtn" onClick={() => router.push('/')}>↩</button></>} />
      <div className="tabs">
        {[['todas', 'Todas'], ...Object.entries(MODES).map(([k, m]) => [k, m.name]), ['gude', '🔵 Gude']].map(([k, t]) =>
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
            <span className={`st ${r.status === 'playing' ? 'play' : ''}`}>{r.status === 'playing' ? 'Jogando' : 'Aguardando'}</span>
            {(r.is_private || r.vip_only) && <span className="lk">{r.vip_only ? '👑' : ''}{r.is_private ? '🔒' : ''}</span>}
            <div className="val">{fmt(r.entry)}<small>{modeName(r.mode)}</small></div>
            <div className="nm">{r.name}</div>
            <div className="row"><span>👥 {r.n}/{r.max_players}</span><span>{isGudeMode(r.mode) ? '1 contra 1' : `Pontos: ${r.points}`}</span></div>
          </button>
        ))}
      </div>
      <div className="lobfoot">
        {[['waiting', 'Aguardando'], ['playing', 'Jogando'], ['priv', 'Privadas']].map(([k, t]) =>
          <button key={k} className="chk" onClick={() => setFilt(o => ({ ...o, [k]: !o[k] }))}><i>{filt[k] ? '✓' : ''}</i>{t}</button>)}
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      {modal === 'criar' && <CreateRoom profile={profile} gude={mode === 'gude'} onClose={() => setModal(null)} />}
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

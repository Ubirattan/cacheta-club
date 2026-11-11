'use client';
// Painel administrativo
import { useEffect, useState, useCallback } from 'react';
import Shell from '../../components/Shell.js';
import { api, sb } from '../../lib/supabase-browser.js';
import { MODES, fmt, TURN_SECONDS } from '../../lib/modes.js';
import { Seg, toast } from '../../components/ui.js';

const adm = (op, b = {}) => api('/api/admin', { op, ...b });

function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => { adm('stats').then(setS).catch(e => toast(e.message)); }, []);
  if (!s) return <div className="empty">Carregando…</div>;
  return <>
    <div className="statg">
      <div><b>{fmt(s.users)}</b><small>jogadores cadastrados</small></div>
      <div><b>{s.roomsWaiting}</b><small>salas esperando</small></div>
      <div><b>{s.roomsPlaying}</b><small>salas jogando</small></div>
      <div><b>{s.matchesToday}</b><small>partidas nas últimas 24 h</small></div>
      <div><b>{fmt(s.matchesTotal)}</b><small>partidas no total</small></div>
      <div><b>{fmt(s.potToday)}</b><small>fichas em potes (24 h)</small></div>
      <div><b>{s.tournamentsOpen}</b><small>torneios abertos</small></div>
      <div><b>{s.tournamentsRunning}</b><small>torneios rolando</small></div>
    </div>
    <div className="panel"><h3 style={{ fontSize: 18 }}>Mais fichas</h3><div className="rows">{s.rich.map((p, i) => <div key={i} className="rowi"><div className="grow"><b>{p.nickname}</b></div><span className="num">🪙 {fmt(p.coins)}</span></div>)}</div></div>
  </>;
}

function Players({ me }) {
  const [q, setQ] = useState(''), [list, setList] = useState(null), [delta, setDelta] = useState({});
  const load = useCallback(() => adm('players', { q }).then(r => setList(r.players)).catch(e => toast(e.message)), [q]);
  useEffect(() => { load(); }, []); // eslint-disable-line
  async function block(p) { try { await adm('block', { uid: p.id, blocked: !p.blocked }); toast(p.blocked ? 'Desbloqueado' : 'Bloqueado'); load(); } catch (e) { toast(e.message); } }
  async function coins(p) { try { const r = await adm('coins', { uid: p.id, delta: Number(delta[p.id] || 0) }); toast('Saldo agora: ' + fmt(r.coins)); setDelta(d => ({ ...d, [p.id]: '' })); load(); } catch (e) { toast(e.message); } }
  return <>
    <form className="invite" style={{ marginTop: 0 }} onSubmit={e => { e.preventDefault(); load(); }}><input placeholder="Buscar por apelido" value={q} onChange={e => setQ(e.target.value)} /><button className="pillbtn">Buscar</button></form>
    <div className="rows">{list === null ? <div className="empty">Carregando…</div> : list.map(p => (
      <div key={p.id} className="rowi" style={{ flexWrap: 'wrap' }}>
        <span className="av">{p.avatar}</span>
        <div className="grow"><b>{p.nickname}{p.is_admin ? ' 🛠' : ''}{p.vip_until && new Date(p.vip_until) > new Date() ? ' 👑' : ''}{p.blocked ? ' 🚫' : ''}</b>
          <small>🪙 {fmt(p.coins)} · {p.games} partidas · {p.wins} vitórias · desde {new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div>
        <input className="mini-in" type="number" placeholder="± fichas" value={delta[p.id] || ''} onChange={e => setDelta(d => ({ ...d, [p.id]: e.target.value }))} />
        <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => coins(p)}>Ajustar</button>
        {p.id !== me && <button className="pillbtn" style={{ padding: '6px 12px', background: p.blocked ? '' : 'linear-gradient(180deg,#ef4444,#991b1b)' }} onClick={() => block(p)}>{p.blocked ? 'Desbloquear' : 'Bloquear'}</button>}
      </div>))}</div>
  </>;
}

function Matches() {
  const [m, setM] = useState(null);
  useEffect(() => { adm('matches').then(r => setM(r.matches)).catch(e => toast(e.message)); }, []);
  if (!m) return <div className="empty">Carregando…</div>;
  if (!m.length) return <div className="empty">Nenhuma partida terminada ainda.</div>;
  return <div className="rows">{m.map(x => (
    <div key={x.id} className="rowi"><span className="av">{x.tournament_id ? '🏆' : '🃏'}</span>
      <div className="grow"><b>{x.room_name}</b><small>{new Date(x.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {MODES[x.mode]?.name} · {x.players.map(p => p.name).join(', ')}</small></div>
      <span className="num">{x.winner_name || '—'}<br /><small className="hint">pote {fmt(x.pot)}</small></span></div>))}</div>;
}

function Rooms() {
  const [r, setR] = useState(null);
  const load = () => adm('rooms').then(x => setR(x.rooms)).catch(e => toast(e.message));
  useEffect(() => { load(); }, []);
  if (!r) return <div className="empty">Carregando…</div>;
  return <div className="rows">{r.map(x => (
    <div key={x.id} className="rowi"><span className="av">{x.is_private ? '🔒' : '🌐'}</span>
      <div className="grow"><b>{x.name}</b><small>{x.code} · {MODES[x.mode]?.name} · {x.status} · entrada {fmt(x.entry)}{x.tournament_id ? ' · torneio' : ''}</small></div>
      <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={async () => { try { await adm('closeRoom', { roomId: x.id }); toast('Sala fechada'); load(); } catch (e) { toast(e.message); } }}>Fechar</button></div>))}</div>;
}

function Tournaments() {
  const [f, setF] = useState({ name: '', mode: 'cacheta', tableSize: 4, maxPlayers: 36, entry: 100, prize: 1000, points: 3, turnSeconds: 30, startsAt: '' });
  const [list, setList] = useState([]);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const load = () => sb().from('tournaments').select('*, tournament_players(count)').order('created_at', { ascending: false }).limit(30).then(({ data }) => setList(data || []));
  useEffect(() => { load(); }, []);
  async function create() {
    try { await adm('createTournament', { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null }); toast('Torneio criado'); set('name', ''); load(); } catch (e) { toast(e.message); }
  }
  async function run(op, id, msg) { try { const r = await adm(op, { id }); toast(r.canceled ? 'Menos de 2 inscritos: torneio cancelado e fichas devolvidas' : msg); load(); } catch (e) { toast(e.message); } }
  return <>
    <div className="panel"><h3 style={{ fontSize: 20 }}>Novo torneio</h3>
      <input className="field" placeholder="Nome (ex.: Copa de Sábado)" value={f.name} onChange={e => set('name', e.target.value)} />
      <Seg label="Modalidade" value={f.mode} onChange={v => set('mode', v)} options={Object.entries(MODES).map(([k, m]) => [k, m.name])} />
      <Seg label="Jogadores por mesa" value={f.tableSize} onChange={v => set('tableSize', v)} options={[2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, String(n)])} />
      <Seg label="Pontos por mesa" value={f.points} onChange={v => set('points', v)} options={[3, 5, 7].map(n => [n, String(n)])} />
      <Seg label="Tempo por jogada" value={f.turnSeconds} onChange={v => set('turnSeconds', v)} options={TURN_SECONDS.map(t => [t, t + ' s'])} />
      <div className="opt-row"><label>Inscrição · Prêmio extra da casa · Máximo de inscritos</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="mini-in" style={{ flex: 1 }} type="number" value={f.entry} onChange={e => set('entry', e.target.value)} />
          <input className="mini-in" style={{ flex: 1 }} type="number" value={f.prize} onChange={e => set('prize', e.target.value)} />
          <input className="mini-in" style={{ flex: 1 }} type="number" value={f.maxPlayers} onChange={e => set('maxPlayers', e.target.value)} /></div></div>
      <div className="opt-row"><label>Começa sozinho em (opcional; sem data, você clica em "Começar")</label>
        <input className="field" style={{ marginTop: 0 }} type="datetime-local" value={f.startsAt} onChange={e => set('startsAt', e.target.value)} /></div>
      <button className="go" onClick={create}>Criar torneio</button>
    </div>
    <div className="rows">{list.map(t => (
      <div key={t.id} className="rowi"><span className="av">🏆</span>
        <div className="grow"><b>{t.name}</b><small>{t.status} · rodada {t.round} · {t.tournament_players?.[0]?.count || 0} inscritos · inscrição {fmt(t.entry)} · prêmio extra {fmt(t.prize)}{t.champion_name ? ' · campeão ' + t.champion_name : ''}</small></div>
        {t.status === 'open' && <button className="pillbtn blue" style={{ padding: '6px 12px' }} onClick={() => run('startTournament', t.id, 'Torneio começou! Mesas sorteadas')}>Começar</button>}
        {['open', 'running'].includes(t.status) && <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => run('cancelTournament', t.id, 'Cancelado, inscrições devolvidas')}>Cancelar</button>}
      </div>))}</div>
  </>;
}

function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { adm('settings').then(r => setS(r.settings)).catch(e => toast(e.message)); }, []);
  if (!s) return <div className="empty">Carregando…</div>;
  const set = (k, v) => setS(o => ({ ...o, [k]: v }));
  async function save() { try { const r = await adm('saveSettings', { settings: s }); setS(r.settings); toast('Configurações salvas'); } catch (e) { toast(e.message); } }
  return <div className="panel">
    <div className="opt-row"><label>Modalidades liberadas</label><div className="seg">{Object.entries(MODES).map(([k, m]) => {
      const on = s.modes_enabled.includes(k);
      return <button key={k} className={on ? 'on' : ''} onClick={() => set('modes_enabled', on ? s.modes_enabled.filter(x => x !== k) : [...s.modes_enabled, k])}>{m.name}</button>;
    })}</div></div>
    <div className="opt-row"><label>Bônus diário (fichas)</label><input className="field" style={{ marginTop: 0 }} type="number" value={s.daily_bonus} onChange={e => set('daily_bonus', e.target.value)} /></div>
    <div className="opt-row"><label>Entrada máxima das salas</label><input className="field" style={{ marginTop: 0 }} type="number" value={s.max_entry} onChange={e => set('max_entry', e.target.value)} /></div>
    <Seg label="Espaço de anúncios" value={!!s.ads_enabled} onChange={v => set('ads_enabled', v)} options={[[false, 'Desligado'], [true, 'Ligado']]} hint="Quando ligado, aparece um espaço de publicidade no lobby (VIP não vê)." />
    <div className="opt-row"><label>Recado na tela inicial</label><input className="field" style={{ marginTop: 0 }} maxLength={140} value={s.motd || ''} onChange={e => set('motd', e.target.value)} /></div>
    <button className="go" onClick={save}>Salvar</button>
  </div>;
}

const TABS = [['geral', 'Visão geral'], ['jog', 'Jogadores'], ['part', 'Partidas'], ['salas', 'Salas'], ['tor', 'Torneios'], ['cfg', 'Regras e configurações']];
function Body({ profile, user }) {
  const [tab, setTab] = useState('geral');
  if (!profile) return <div className="empty">Carregando…</div>;
  if (!profile.is_admin) return <div className="empty">Área só para administradores.</div>;
  return <>
    <div className="admtabs">{TABS.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
    {tab === 'geral' && <Overview />}{tab === 'jog' && <Players me={user.id} />}{tab === 'part' && <Matches />}
    {tab === 'salas' && <Rooms />}{tab === 'tor' && <Tournaments />}{tab === 'cfg' && <Settings />}
  </>;
}
export default function Admin() { return <Shell title="🛠 Painel administrativo">{auth => <Body {...auth} />}</Shell>; }

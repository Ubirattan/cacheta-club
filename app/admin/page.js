'use client';
import { PIX_TIPOS, fmtPix } from '../../lib/pix.js';
// Painel administrativo
import { useEffect, useState, useCallback } from 'react';
import Shell from '../../components/Shell.js';
import { api, sb } from '../../lib/supabase-browser.js';
import { MODES, modeName, fmt, TURN_SECONDS } from '../../lib/modes.js';
import { Seg, toast } from '../../components/ui.js';

// sessão do painel (login e senha próprios), guardada só nesta aba do navegador
const getTok = () => { try { return sessionStorage.getItem('cc_admin') || ''; } catch { return ''; } };
const setTok = t => { try { t ? sessionStorage.setItem('cc_admin', t) : sessionStorage.removeItem('cc_admin'); } catch {} };
const adm = async (op, b = {}) => {
  try { return await api('/api/admin', { op, ...b, adminToken: getTok() }); }
  catch (e) {
    if (e.message === 'PAINEL_LOGIN') { setTok(''); window.dispatchEvent(new Event('cc-admin-logout')); throw new Error('Sessão do painel expirou, entre de novo'); }
    throw e;
  }
};

function PanelLogin({ onOk }) {
  const [st, setSt] = useState(null), [u, setU] = useState(''), [p, setP] = useState(''), [p2, setP2] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/admin', { op: 'authStatus' }).then(setSt).catch(e => setErr(e.message)); }, []);
  async function go(e) {
    e.preventDefault(); setErr('');
    if (!st.configured && p !== p2) return setErr('As senhas não são iguais');
    setBusy(true);
    try { const r = await api('/api/admin', { op: st.configured ? 'login' : 'setup', username: u, password: p }); setTok(r.token); onOk(); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  if (!st) return <div className="empty">{err || 'Carregando…'}</div>;
  return (
    <div className="center-box"><form className="authcard" onSubmit={go}>
      <h2 style={{ font: '700 24px Oswald', color: 'var(--gold)', textAlign: 'center', margin: 0 }}>🔐 {st.configured ? 'Entrar no painel' : 'Criar login do painel'}</h2>
      <p className="hint" style={{ textAlign: 'center' }}>{st.configured ? 'Digite o usuário e a senha do painel administrativo.' : 'Primeira vez aqui: crie um usuário e uma senha só para o painel (mínimo 8 caracteres). Guarde bem: ela será pedida sempre que abrir o painel.'}</p>
      <input className="field" placeholder="Usuário do painel" autoComplete="username" value={u} onChange={e => setU(e.target.value)} />
      <input className="field" type="password" placeholder="Senha do painel" autoComplete={st.configured ? 'current-password' : 'new-password'} value={p} onChange={e => setP(e.target.value)} />
      {!st.configured && <input className="field" type="password" placeholder="Repita a senha" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} />}
      {err && <div className="err">{err}</div>}
      <button className="go" disabled={busy}>{busy ? 'Aguarde…' : st.configured ? 'Entrar' : 'Criar e entrar'}</button>
    </form></div>
  );
}

function ChangePass() {
  const [f, setF] = useState({ current: '', username: '', password: '', p2: '' }), [msg, setMsg] = useState('');
  async function save() {
    setMsg('');
    if (f.password !== f.p2) return setMsg('As senhas novas não são iguais');
    try { const r = await adm('changePass', { current: f.current, username: f.username || undefined, password: f.password }); setTok(r.token); toast('Senha do painel trocada'); setF({ current: '', username: '', password: '', p2: '' }); }
    catch (e) { setMsg(e.message); }
  }
  return <div className="panel"><h3 style={{ fontSize: 20 }}>🔐 Trocar login e senha do painel</h3>
    <input className="field" type="password" placeholder="Senha atual" value={f.current} onChange={e => setF({ ...f, current: e.target.value })} />
    <input className="field" placeholder="Novo usuário (deixe vazio para manter)" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
    <input className="field" type="password" placeholder="Nova senha (mín. 8)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
    <input className="field" type="password" placeholder="Repita a nova senha" value={f.p2} onChange={e => setF({ ...f, p2: e.target.value })} />
    {msg && <div className="err">{msg}</div>}
    <button className="go" onClick={save}>Trocar</button></div>;
}

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
    <div className="panel"><h3 style={{ fontSize: 18 }}>Mais fichas</h3><div className="rows">{s.rich.map((p, i) => <div key={i} className="rowi"><div className="grow"><b>{p.nickname}</b></div><span className="num">💰 {fmt(p.coins)}</span></div>)}</div></div>
  </>;
}

function Players({ me }) {
  const [q, setQ] = useState(''), [list, setList] = useState(null), [delta, setDelta] = useState({});
  const load = useCallback(() => adm('players', { q }).then(r => setList(r.players)).catch(e => toast(e.message)), [q]);
  useEffect(() => { load(); }, []); // eslint-disable-line
  async function block(p) { try { await adm('block', { uid: p.id, blocked: !p.blocked }); toast(p.blocked ? 'Desbloqueado' : 'Bloqueado'); load(); } catch (e) { toast(e.message); } }
  async function excluir(p) {
    if (!confirm(`Excluir a conta de ${p.nickname}?\n\nIsso apaga o login, as fichas (${fmt(p.coins)}), o histórico e as compras dele. Não dá para desfazer.`)) return;
    try { await adm('deleteUser', { uid: p.id }); toast(`${p.nickname} foi excluído`); load(); } catch (e) { toast(e.message); }
  }
  const [info, setInfo] = useState({});
  async function dados(p) {
    if (info[p.id]) return setInfo(o => ({ ...o, [p.id]: null }));
    try { const r = await adm('playerData', { uid: p.id }); setInfo(o => ({ ...o, [p.id]: r })); } catch (e) { toast(e.message); }
  }
  const copiar = t => { try { navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast(t); } };
  async function coins(p) { try { const r = await adm('coins', { uid: p.id, delta: Number(delta[p.id] || 0) }); toast('Saldo agora: ' + fmt(r.coins)); setDelta(d => ({ ...d, [p.id]: '' })); load(); } catch (e) { toast(e.message); } }
  return <>
    <form className="invite" style={{ marginTop: 0 }} onSubmit={e => { e.preventDefault(); load(); }}><input placeholder="Buscar por apelido" value={q} onChange={e => setQ(e.target.value)} /><button className="pillbtn">Buscar</button></form>
    <div className="rows">{list === null ? <div className="empty">Carregando…</div> : list.map(p => (
      <div key={p.id} className="rowi" style={{ flexWrap: 'wrap' }}>
        <span className="av">{p.avatar}</span>
        <div className="grow"><b>{p.nickname}{p.is_admin ? ' 🛠' : ''}{p.vip_until && new Date(p.vip_until) > new Date() ? ' 👑' : ''}{p.blocked ? ' 🚫' : ''}</b>
          <small>💰 {fmt(p.coins)} · {p.games} partidas · {p.wins} vitórias · desde {new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div>
        <input className="mini-in" type="number" placeholder="± fichas" value={delta[p.id] || ''} onChange={e => setDelta(d => ({ ...d, [p.id]: e.target.value }))} />
        <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => coins(p)}>Ajustar</button>
        {p.id !== me && <button className="pillbtn" style={{ padding: '6px 12px', background: p.blocked ? '' : 'linear-gradient(180deg,#ef4444,#991b1b)' }} onClick={() => block(p)}>{p.blocked ? 'Desbloquear' : 'Bloquear'}</button>}
        {p.id !== me && <button className="pillbtn dark" style={{ padding: '6px 12px', color: '#fca5a5' }} onClick={() => excluir(p)}>🗑 Excluir</button>}
        <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => dados(p)}>{info[p.id] ? 'Fechar' : '📋 Dados'}</button>
        {info[p.id] && <div style={{ flexBasis: '100%', fontSize: 14, lineHeight: 1.7, padding: '6px 4px 2px 44px' }}>
          <div>E-mail: <b>{info[p.id].email || '—'}</b>{info[p.id].provider === 'google' ? ' (entra com Google)' : ''}</div>
          <div>Chave Pix: {info[p.id].pixChave
            ? <><b>{fmtPix(info[p.id].pixTipo, info[p.id].pixChave)}</b> <small>({PIX_TIPOS.find(t => t[0] === info[p.id].pixTipo)?.[1]})</small> <button className="pillbtn dark" style={{ padding: '2px 10px' }} onClick={() => copiar(info[p.id].pixChave)}>Copiar</button></>
            : <i>não cadastrada</i>}</div>
          <div>Cadastro: {info[p.id].createdAt ? new Date(info[p.id].createdAt).toLocaleString('pt-BR') : '—'} · Último login: {info[p.id].lastLogin ? new Date(info[p.id].lastLogin).toLocaleString('pt-BR') : '—'}</div>
        </div>}
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
      <div className="grow"><b>{x.room_name}</b><small>{new Date(x.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {modeName(x.mode)} · {x.players.map(p => p.name).join(', ')}</small></div>
      <span className="num">{x.winner_name || '—'}<br /><small className="hint">pote {fmt(x.pot)}</small></span></div>))}</div>;
}

function Rooms() {
  const [r, setR] = useState(null);
  const load = () => adm('rooms').then(x => setR(x.rooms)).catch(e => toast(e.message));
  useEffect(() => { load(); }, []);
  if (!r) return <div className="empty">Carregando…</div>;
  return <div className="rows">{r.map(x => (
    <div key={x.id} className="rowi"><span className="av">{x.is_private ? '🔒' : '🌐'}</span>
      <div className="grow"><b>{x.name}</b><small>{x.code} · {modeName(x.mode)} · {x.status} · entrada {fmt(x.entry)}{x.tournament_id ? ' · torneio' : ''}</small></div>
      <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={async () => { try { await adm('closeRoom', { roomId: x.id }); toast('Sala fechada'); load(); } catch (e) { toast(e.message); } }}>Fechar</button></div>))}</div>;
}

function Tournaments() {
  const [f, setF] = useState({ name: '', mode: 'cacheta', tableSize: 4, maxPlayers: 36, entry: 10, prize: 100, points: 3, turnSeconds: 30, startsAt: '' });
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

// reduz a foto no próprio celular antes de salvar (fica leve para carregar no lobby)
function fotoParaDataUrl(file) {
  return new Promise((ok, bad) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 900 / img.width, 300 / img.height), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = .85, d = c.toDataURL('image/jpeg', q);
      while (d.length > 380000 && q > .4) { q -= .15; d = c.toDataURL('image/jpeg', q); }
      ok(d);
    };
    img.onerror = () => bad(new Error('Não deu para abrir essa imagem'));
    img.src = url;
  });
}
function AdsEditor({ ads, onChange }) {
  const upd = (i, k, v) => onChange(ads.map((a, j) => j === i ? { ...a, [k]: v } : a));
  const del = i => onChange(ads.filter((_, j) => j !== i));
  async function foto(i, e) { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { upd(i, 'img', await fotoParaDataUrl(f)); } catch (er) { toast(er.message); } }
  return <div className="opt-row"><label>Anúncios ({ads.length})</label>
    {ads.map((a, i) => <div key={i} className="adedit">
      {a.img && <img className="prev" src={a.img} alt="" />}
      <div className="row">
        <label className="pillbtn blue" style={{ padding: '6px 12px', cursor: 'pointer' }}>📷 Enviar imagem<input type="file" accept="image/*" hidden onChange={e => foto(i, e)} /></label>
        {a.img && <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => upd(i, 'img', '')}>Tirar imagem</button>}
      </div>
      {!String(a.img || '').startsWith('data:') && <input className="field" style={{ marginTop: 0 }} placeholder="ou cole o link da imagem (https://…)" value={a.img || ''} onChange={e => upd(i, 'img', e.target.value)} />}
      <input className="field" style={{ marginTop: 0 }} placeholder="Link ao tocar (ex.: https://wa.me/5511999999999)" value={a.link || ''} onChange={e => upd(i, 'link', e.target.value)} />
      <input className="field" style={{ marginTop: 0 }} maxLength={80} placeholder="Texto (opcional)" value={a.text || ''} onChange={e => upd(i, 'text', e.target.value)} />
      <div className="row">
        <button className={`pillbtn ${a.on === false ? 'dark' : 'blue'}`} style={{ padding: '6px 12px' }} onClick={() => upd(i, 'on', a.on === false)}>{a.on === false ? '⏸ Pausado' : '▶ No ar'}</button>
        <button className="pillbtn dark" style={{ padding: '6px 12px' }} onClick={() => { if (confirm('Apagar este anúncio?')) del(i); }}>🗑 Apagar</button>
      </div>
    </div>)}
    {ads.length < 10 && <button className="pillbtn" style={{ padding: '8px 14px', marginTop: 6 }} onClick={() => onChange([...ads, { img: '', link: '', text: '', on: true }])}>➕ Novo anúncio</button>}
    <small style={{ color: 'var(--mut)', display: 'block', marginTop: 4 }}>Depois de mexer, toque em Salvar.</small>
  </div>;
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
    <Seg label="Espaço de anúncios" value={!!s.ads_enabled} onChange={v => set('ads_enabled', v)} options={[[false, 'Desligado'], [true, 'Ligado']]} hint="Quando ligado, um dos anúncios abaixo abre grande na tela quando o jogador toca em Resgatar fichas (VIP não vê)." />
    <AdsEditor ads={s.ads || []} onChange={v => set('ads', v)} />
    <div className="opt-row"><label>Recado na tela inicial</label><input className="field" style={{ marginTop: 0 }} maxLength={140} value={s.motd || ''} onChange={e => set('motd', e.target.value)} /></div>
    <button className="go" onClick={save}>Salvar</button>
  </div>;
}

const keyBytes = k => { const p = '='.repeat((4 - k.length % 4) % 4), raw = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
function PushBox() {
  const [st, setSt] = useState('…'), [busy, setBusy] = useState(false), [count, setCount] = useState(0);
  const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  useEffect(() => {
    if (!ok) return setSt('sem');
    adm('pushKey').then(r => setCount(r.count)).catch(() => {});
    navigator.serviceWorker.getRegistration('/').then(reg => reg && reg.pushManager.getSubscription()).then(sub => setSt(sub && Notification.permission === 'granted' ? 'on' : 'off')).catch(() => setSt('off'));
  }, [ok]);
  async function ativar() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações deste site nas configurações do navegador.');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); await navigator.serviceWorker.ready;
      const { key } = await adm('pushKey');
      let sub = await reg.pushManager.getSubscription();
      if (sub) { const cur = sub.options && sub.options.applicationServerKey; const a = cur ? new Uint8Array(cur) : null, b = keyBytes(key); if (!a || a.length !== b.length || a.some((x, i) => x !== b[i])) { await sub.unsubscribe(); sub = null; } }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      const r = await adm('pushSubscribe', { sub: sub.toJSON() }); setCount(r.count);
      await adm('pushTest'); setSt('on'); toast('Pronto! Deve chegar uma notificação de teste');
    } catch (e) { toast(e.message || 'Não deu pra ativar'); }
    setBusy(false);
  }
  async function desativar() {
    setBusy(true);
    try { const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription();
      if (sub) { await adm('pushUnsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); } setSt('off'); toast('Notificações desligadas neste aparelho'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  return <div className="panel" style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
    <div style={{ flex: 1, minWidth: 220 }}><b>🔔 Notificação de vendas no celular</b><br />
      <small style={{ color: 'var(--mut)' }}>{st === 'sem' ? (ios ? 'No iPhone: abra o site no Safari, toque em Compartilhar → "Adicionar à Tela de Início", abra pelo ícone e volte aqui.' : 'Este navegador não aceita notificações. Use o Chrome.')
        : st === 'on' ? `Ativada neste aparelho${count > 1 ? ` (${count} aparelhos no total)` : ''}. Avisa mesmo com o painel fechado.` : 'Receba um aviso a cada compra, mesmo com o painel fechado.'}</small></div>
    {st === 'off' && <button className="pillbtn" disabled={busy} style={{ background: 'linear-gradient(180deg,#34d399,#059669)' }} onClick={ativar}>{busy ? 'Ativando…' : 'Ativar neste celular'}</button>}
    {st === 'on' && <><button className="pillbtn dark" disabled={busy} onClick={() => adm('pushTest').then(r => toast(r.sent ? 'Teste enviado' : 'Nenhum aparelho recebeu')).catch(e => toast(e.message))}>Testar</button>
      <button className="pillbtn dark" disabled={busy} onClick={desativar}>Desligar</button></>}
  </div>;
}

function Sales({ onSeen }) {
  const [list, setList] = useState(null);
  const load = useCallback(() => adm('sales').then(r => { setList(r.sales); if (r.unread) adm('salesSeen').then(onSeen).catch(() => {}); else onSeen(); }).catch(e => toast(e.message)), [onSeen]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  if (!list) return <><PushBox /><div className="empty">Carregando…</div></>;
  if (!list.length) return <><PushBox /><div className="empty">Nenhuma venda ainda.</div></>;
  const hoje = list.filter(x => Date.now() - new Date(x.at).getTime() < 86400000);
  return <>
    <PushBox />
    <div className="panel" style={{ marginBottom: 10 }}>Últimas 24h: <b>{hoje.length}</b> vendas · <b>R$ {fmt(hoje.reduce((s, x) => s + (x.brl || 0), 0))}</b> em Pix · <b>{fmt(hoje.reduce((s, x) => s + x.coins, 0))}</b> fichas gastas na loja</div>
    <div className="rows">{list.map(x => (
      <div key={x.id} className="rowi" style={x.isNew ? { border: '2px solid #4ade80', background: 'rgba(74,222,128,.10)' } : {}}>
        <span className="av">{x.brl != null ? '💰' : x.resgate ? '🏆' : '🛍'}</span>
        <div className="grow"><b>{x.isNew ? '🆕 ' : ''}{x.who} {x.resgate ? 'resgatou' : 'comprou'} {x.item}</b>
          <small>{new Date(x.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {x.brl != null ? `R$ ${x.brl.toFixed(2).replace('.', ',')} → ${fmt(x.got)} fichas` : `${fmt(x.coins)} fichas`}</small></div>
      </div>))}</div>
  </>;
}

function Resgates({ onChange }) {
  const [list, setList] = useState(null), [busy, setBusy] = useState(null);
  const load = useCallback(() => adm('resgates').then(r => { setList(r.resgates); onChange(r.resgates.length); }).catch(e => toast(e.message)), [onChange]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  async function decidir(x, liberar) {
    if (!liberar && !confirm(`Recusar o resgate de ${x.who}? As ${fmt(x.coins)} fichas voltam para ele.`)) return;
    setBusy(x.id);
    try { await adm(liberar ? 'liberarResgate' : 'recusarResgate', { id: x.id }); toast(liberar ? `${x.em} Liberado para ${x.who}` : 'Recusado, fichas devolvidas'); load(); }
    catch (e) { toast(e.message); load(); }
    setBusy(null);
  }
  if (!list) return <div className="empty">Carregando…</div>;
  if (!list.length) return <div className="empty">Nenhum resgate esperando liberação. 🎉</div>;
  return <div className="rows">{list.map(x => (
    <div key={x.id} className="rowi" style={{ flexWrap: 'wrap' }}>
      {x.ouro ? <span className="trgold"><i>🏆</i><b>{fmt(x.coins)}</b></span> : <span className="av" style={{ fontSize: 28 }}>{x.em}</span>}
      <div className="grow"><b>{x.who} quer o {x.item}{x.ouro ? ` de ${fmt(x.coins)} fichas` : ''}</b>
        <small>{new Date(x.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {fmt(x.coins)} fichas já descontadas</small></div>
      <button className="pillbtn" disabled={busy === x.id} style={{ background: 'linear-gradient(180deg,#34d399,#059669)', padding: '6px 14px' }} onClick={() => decidir(x, true)}>✔ Liberar</button>
      <button className="pillbtn dark" disabled={busy === x.id} style={{ padding: '6px 14px', color: '#fca5a5' }} onClick={() => decidir(x, false)}>✖ Recusar</button>
    </div>))}</div>;
}

const TABS = [['geral', 'Visão geral'], ['resgates', 'Resgates'], ['vendas', 'Vendas'], ['jog', 'Jogadores'], ['part', 'Partidas'], ['salas', 'Salas'], ['tor', 'Torneios'], ['cfg', 'Regras e configurações']];
function Body({ profile, user }) {
  const [tab, setTab] = useState('geral');
  const [logged, setLogged] = useState(() => !!getTok());
  useEffect(() => { const f = () => setLogged(false); window.addEventListener('cc-admin-logout', f); return () => window.removeEventListener('cc-admin-logout', f); }, []);
  const [unread, setUnread] = useState(0), [pend, setPend] = useState(0);
  const clearUnread = useCallback(() => setUnread(0), []);
  useEffect(() => {
    if (!logged || !profile?.is_admin) return;
    let last = -1;
    const poll = () => adm('sales').then(r => {
      if (last >= 0 && r.unread > last) { toast(`🔔 Nova venda: ${r.sales[0]?.who} comprou ${r.sales[0]?.item}`); try { navigator.vibrate && navigator.vibrate(200); } catch {} }
      last = r.unread; setUnread(r.unread); setPend(r.pendentes || 0);
    }).catch(() => {});
    poll(); const t = setInterval(poll, 20000); return () => clearInterval(t);
  }, [logged, profile]);
  if (!profile) return <div className="empty">Carregando…</div>;
  if (!profile.is_admin) return <div className="empty">Área só para administradores.</div>;
  if (!logged) return <PanelLogin onOk={() => setLogged(true)} />;
  return <>
    <div className="admtabs">{TABS.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}{k === 'vendas' && unread > 0 && tab !== 'vendas' && <span className="badge-n" style={{ position: 'static', marginLeft: 6 }}>{unread}</span>}{k === 'resgates' && pend > 0 && <span className="badge-n" style={{ position: 'static', marginLeft: 6 }}>{pend}</span>}</button>)}
      <button onClick={() => { setTok(''); setLogged(false); }}>🚪 Sair do painel</button></div>
    {tab === 'geral' && <Overview />}{tab === 'vendas' && <Sales onSeen={clearUnread} />}{tab === 'resgates' && <Resgates onChange={setPend} />}{tab === 'jog' && <Players me={user.id} />}{tab === 'part' && <Matches />}
    {tab === 'salas' && <Rooms />}{tab === 'tor' && <Tournaments />}{tab === 'cfg' && <><Settings /><ChangePass /></>}
  </>;
}
export default function Admin() { return <Shell required title="🛠 Painel administrativo">{auth => <Body {...auth} />}</Shell>; }

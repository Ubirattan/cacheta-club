'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '../../../components/Shell.js';
import { sb, api } from '../../../lib/supabase-browser.js';
import { MODES, fmt } from '../../../lib/modes.js';
import { toast } from '../../../components/ui.js';

const STATUS = { open: 'Inscrições abertas', running: 'Em andamento', finished: 'Encerrado', canceled: 'Cancelado' };

function Body({ user, profile, reloadProfile }) {
  const { id } = useParams();
  const router = useRouter();
  const [t, setT] = useState(null), [ps, setPs] = useState([]), [tables, setTables] = useState([]), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
      sb().from('tournaments').select('*').eq('id', id).maybeSingle(),
      sb().from('tournament_players').select('*').eq('tournament_id', id).order('joined_at'),
      sb().from('tournament_tables').select('*').eq('tournament_id', id).order('round')]);
    setT(a || false); setPs(b || []); setTables(c || []);
  }, [id]);
  useEffect(() => {
    load();
    const ch = sb().channel('torneio-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_tables', filter: `tournament_id=eq.${id}` }, load).subscribe();
    const tk = setInterval(() => api('/api/tournaments', { op: 'tick' }).catch(() => {}), 15000);
    return () => { sb().removeChannel(ch); clearInterval(tk); };
  }, [id, load]);
  if (t === null) return <div className="empty">Carregando…</div>;
  if (t === false) return <div className="empty">Torneio não encontrado.</div>;
  const me = user && ps.find(p => p.user_id === user.id);
  const myTable = user && tables.find(x => x.round === t.round && !x.done && x.players.some(p => p.uid === user.id));
  async function op(o) {
    setBusy(true);
    try { await api('/api/tournaments', { op: o, id }); await load(); reloadProfile(); toast(o === 'join' ? 'Inscrição feita! Boa sorte 🍀' : 'Inscrição cancelada, fichas devolvidas'); }
    catch (e) { toast(e.message); }
    setBusy(false);
  }
  const rounds = [...new Set(tables.map(x => x.round))].sort((a, b) => a - b);
  return <>
    <div className="panel">
      <span className={`tag ${t.status}`} style={{ float: 'right', font: '600 12px Oswald', padding: '3px 10px', borderRadius: 10 }}>{STATUS[t.status]}</span>
      <h3>{t.name}</h3>
      <div className="meta"><span>{MODES[t.mode]?.name}</span><span>Mesas de até {t.table_size}</span><span>Pontos {t.points}</span><span>⏱ {t.turn_seconds} s</span>
        <span>Inscrição {t.entry ? '🪙 ' + fmt(t.entry) : 'grátis'}</span><span>👥 {ps.length}/{t.max_players}</span>
        {t.starts_at && <span>Início {new Date(t.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}</div>
      <div className="prize" style={{ marginTop: 10 }}>Prêmio 🪙 {fmt(t.entry * ps.length + t.prize)}</div>
      {t.status === 'finished' && <p style={{ fontSize: 18 }}>🏆 Campeão: <b className="vip">{t.champion_name || '—'}</b></p>}
      {t.status === 'open' && (me
        ? <><p className="okmsg">Você está inscrito. {t.starts_at ? 'O torneio começa no horário marcado.' : 'Espere o administrador começar.'}</p>
            <button className="sec" disabled={busy} onClick={() => op('leave')}>Cancelar inscrição (devolve as fichas)</button></>
        : <button className="go" disabled={busy || (profile && profile.coins < t.entry)} onClick={() => op('join')}>{profile && profile.coins < t.entry ? 'Fichas insuficientes' : `Inscrever-se${t.entry ? ` (🪙 ${fmt(t.entry)})` : ''}`}</button>)}
      {myTable && <button className="go" onClick={() => router.push('/sala/' + myTable.room_id)}>▶ Ir para a minha mesa (rodada {t.round})</button>}
      {t.status === 'running' && me && me.status === 'out' && <p className="hint">Você foi eliminado na rodada {me.round_reached}. Acompanhe as mesas abaixo.</p>}
    </div>
    {rounds.length > 0 && <div className="panel"><h3 style={{ fontSize: 20 }}>Chaveamento</h3>
      <div className="bracket">{rounds.map(r => (
        <div key={r} className="bcol"><h5>{r === rounds[rounds.length - 1] && t.status === 'finished' ? 'Final' : `Rodada ${r}`}</h5>
          {tables.filter(x => x.round === r).map(x => (
            <div key={x.room_id} className="btable">
              {x.players.map(p => <div key={p.uid} className={x.done ? (p.uid === x.winner ? 'w' : 'x') : ''}><span>{p.avatar} {p.name}</span>{x.done && p.uid === x.winner && <span>✓</span>}</div>)}
              {!x.done && <div style={{ color: 'var(--mut)' }}>jogando…</div>}
              {x.players.length === 1 && <div style={{ color: 'var(--mut)' }}>passou direto</div>}
            </div>))}
        </div>))}</div></div>}
    <div className="panel"><h3 style={{ fontSize: 20 }}>Inscritos ({ps.length})</h3>
      <div className="rows" style={{ marginTop: 8 }}>{ps.map(p => (
        <div key={p.user_id} className={`rowi ${user && p.user_id === user.id ? 'me' : ''}`}><span className="av">{p.avatar}</span>
          <div className="grow"><b>{p.nickname}</b></div>
          <span className="num">{p.status === 'champion' ? '🏆 Campeão' : p.status === 'out' ? <span className="lost">fora (R{p.round_reached})</span> : t.status === 'running' ? <span className="won">na disputa</span> : ''}</span></div>))}</div>
    </div>
  </>;
}
export default function TorneioPage() {
  return <Shell back="/torneios">{auth => <Body {...auth} />}</Shell>;
}

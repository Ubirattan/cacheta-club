'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import { sb } from '../../lib/supabase-browser.js';
import { MODES, modeName, fmt } from '../../lib/modes.js';

function List({ user }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mine } = await sb().from('match_players').select('match_id,won,coins_delta,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      const ids = (mine || []).map(m => m.match_id);
      const { data: ms } = ids.length ? await sb().from('match_history').select('*').in('id', ids) : { data: [] };
      setRows((mine || []).map(m => ({ ...m, h: (ms || []).find(x => x.id === m.match_id) })).filter(r => r.h));
    })();
  }, [user]);
  if (rows === null) return <div className="empty">Carregando…</div>;
  if (!rows.length) return <div className="empty">Você ainda não terminou nenhuma partida online.</div>;
  const wins = rows.filter(r => r.won).length;
  return <>
    <div className="statg">
      <div><b>{rows.length}</b><small>últimas partidas</small></div>
      <div><b>{wins}</b><small>vitórias</small></div>
      <div><b>{Math.round(wins / rows.length * 100)}%</b><small>aproveitamento</small></div>
      <div><b className={rows.reduce((s, r) => s + r.coins_delta, 0) >= 0 ? 'won' : 'lost'}>{fmt(rows.reduce((s, r) => s + r.coins_delta, 0))}</b><small>saldo de fichas</small></div>
    </div>
    <div className="rows">{rows.map(r => (
      <div key={r.match_id} className="rowi">
        <span className="av">{r.won ? '🏆' : '🃏'}</span>
        <div className="grow"><b>{r.h.room_name}</b>
          <small>{new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {modeName(r.h.mode)} · {r.h.players.length} jogadores · {r.h.rounds} rodada{r.h.rounds === 1 ? '' : 's'}{r.won ? '' : ` · venceu ${r.h.winner_name || '—'}`}</small></div>
        <span className={`num ${r.coins_delta >= 0 ? 'won' : 'lost'}`}>{r.won ? 'Venceu' : 'Perdeu'}<br />{r.coins_delta ? (r.coins_delta > 0 ? '+' : '') + fmt(r.coins_delta) : ''}</span>
      </div>))}</div>
  </>;
}
export default function Historico() {
  return <Shell required title="📜 Histórico de partidas">{({ user }) => <List user={user} />}</Shell>;
}

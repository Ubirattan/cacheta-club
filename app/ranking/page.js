'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import { sb } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';

// início da semana (segunda 00:00, horário de Brasília) — back = semanas para trás
function weekStart(back = 0) {
  const off = 3 * 3600e3, local = new Date(Date.now() - off);
  const diff = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diff) + off - back * 7 * 86400e3);
}
const dm = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

// ranking da semana: 10 pontos por vitória e 1 por partida, contado das partidas online
async function weekly(back) {
  const from = weekStart(back), to = weekStart(back - 1);
  const { data } = await sb().from('match_players').select('user_id,won,created_at')
    .gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(20000);
  const agg = new Map();
  for (const r of data || []) {
    const a = agg.get(r.user_id) || { id: r.user_id, games: 0, wins: 0 };
    a.games++; if (r.won) a.wins++; agg.set(r.user_id, a);
  }
  const ids = [...agg.keys()];
  const profs = ids.length ? (await sb().from('profiles').select('id,nickname,avatar,vip_until,blocked').in('id', ids)).data || [] : [];
  return profs.filter(p => !p.blocked).map(p => { const a = agg.get(p.id); return { ...p, ...a, pts: a.wins * 10 + a.games }; })
    .sort((x, y) => y.pts - x.pts || y.wins - x.wins).slice(0, 100);
}

export default function Ranking() {
  const [by, setBy] = useState('semana');
  const [list, setList] = useState(null);
  useEffect(() => {
    setList(null);
    if (by === 'semana' || by === 'passada') { weekly(by === 'semana' ? 0 : 1).then(setList); return; }
    sb().from('profiles').select('id,nickname,avatar,rank_points,wins,games,coins,vip_until').eq('blocked', false)
      .order(by, { ascending: false }).order('wins', { ascending: false }).limit(100).then(({ data }) => setList(data || []));
  }, [by]);
  const wk = by === 'semana' || by === 'passada';
  const s = weekStart(by === 'passada' ? 1 : 0), e = new Date(weekStart(by === 'passada' ? 0 : -1) - 1);
  return (
    <Shell title="🏆 Ranking">{({ user }) => <>
      <div className="tabs" style={{ margin: 0 }}>
        {[['semana', 'Semana'], ['passada', 'Campeões da semana passada'], ['rank_points', 'Geral'], ['wins', 'Vitórias'], ['coins', 'Fichas']].map(([k, t]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{t}</button>)}
      </div>
      <p className="hint">{wk
        ? <>Semana de <b>{dm(s)}</b> a <b>{dm(e)}</b>: 10 pontos por vitória e 1 por partida nas mesas online. {by === 'semana' ? 'Os 3 primeiros no domingo à noite ganham o troféu da semana 🏆.' : 'Os campeões da semana passada 🏆.'}</>
        : 'Pontos: 10 por partida vencida, 1 por partida jogada, e bônus grande para campeão de torneio.'}</p>
      <div className="rows">
        {list === null && <div className="empty">Carregando…</div>}
        {list && !list.length && <div className="empty">{wk ? 'Ninguém jogou nesta semana ainda. Seja o primeiro!' : 'Sem jogadores ainda.'}</div>}
        {list && list.map((p, i) => (
          <div key={p.id} className={`rowi ${i < 3 ? 'top' + (i + 1) : ''} ${user && p.id === user.id ? 'me' : ''}`}>
            <span className="pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span className="av">{p.avatar}</span>
            <div className="grow"><b>{p.nickname}{p.vip_until && new Date(p.vip_until) > new Date() ? ' 👑' : ''}{by === 'passada' && i < 3 ? ' 🏆' : ''}</b>
              <small>{p.games} partidas · {p.wins} vitórias · {p.games ? Math.round(p.wins / p.games * 100) : 0}%</small></div>
            <span className="num">{wk ? fmt(p.pts) + ' pts' : by === 'coins' ? '💰 ' + fmt(p.coins) : by === 'wins' ? p.wins : fmt(p.rank_points) + ' pts'}</span>
          </div>))}
      </div></>}
    </Shell>
  );
}

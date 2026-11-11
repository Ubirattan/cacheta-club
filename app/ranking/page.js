'use client';
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import { sb } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';

export default function Ranking() {
  const [by, setBy] = useState('rank_points');
  const [list, setList] = useState(null);
  useEffect(() => {
    setList(null);
    sb().from('profiles').select('id,nickname,avatar,rank_points,wins,games,coins,vip_until').eq('blocked', false)
      .order(by, { ascending: false }).order('wins', { ascending: false }).limit(100).then(({ data }) => setList(data || []));
  }, [by]);
  return (
    <Shell title="🏆 Ranking geral">{({ user }) => <>
      <div className="tabs" style={{ margin: 0 }}>
        {[['rank_points', 'Pontos'], ['wins', 'Vitórias'], ['coins', 'Fichas']].map(([k, t]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{t}</button>)}
      </div>
      <p className="hint">Pontos: 10 por partida vencida, 1 por partida jogada, e bônus grande para campeão de torneio.</p>
      <div className="rows">
        {list === null && <div className="empty">Carregando…</div>}
        {list && list.map((p, i) => (
          <div key={p.id} className={`rowi ${i < 3 ? 'top' + (i + 1) : ''} ${user && p.id === user.id ? 'me' : ''}`}>
            <span className="pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span className="av">{p.avatar}</span>
            <div className="grow"><b>{p.nickname}{p.vip_until && new Date(p.vip_until) > new Date() ? ' 👑' : ''}</b>
              <small>{p.games} partidas · {p.wins} vitórias · {p.games ? Math.round(p.wins / p.games * 100) : 0}%</small></div>
            <span className="num">{by === 'coins' ? '🪙 ' + fmt(p.coins) : by === 'wins' ? p.wins : fmt(p.rank_points) + ' pts'}</span>
          </div>))}
      </div></>}
    </Shell>
  );
}

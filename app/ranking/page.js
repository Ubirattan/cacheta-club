'use client';
// Ranking de cada jogo (/ranking?jogo=truco): 10 pontos por vitória e 1 por partida nas mesas online daquele jogo.
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import { sb } from '../../lib/supabase-browser.js';
import { fmt, jogoDoModo, JOGOS_RANKING } from '../../lib/modes.js';
import { JOGOS } from '../../lib/jogos.js';

// início da semana (segunda 00:00, horário de Brasília) — back = semanas para trás
function weekStart(back = 0) {
  const off = 3 * 3600e3, local = new Date(Date.now() - off);
  const diff = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diff) + off - back * 7 * 86400e3);
}
const dm = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

async function ranking(jogo, from, to) {
  let q = sb().from('match_players').select('user_id,won,created_at,match_history(mode)');
  if (from) q = q.gte('created_at', from.toISOString());
  if (to) q = q.lt('created_at', to.toISOString());
  const { data } = await q.order('created_at', { ascending: false }).limit(20000);
  const agg = new Map();
  for (const r of data || []) {
    if (jogoDoModo(r.match_history?.mode || 'cacheta') !== jogo) continue;
    const a = agg.get(r.user_id) || { id: r.user_id, games: 0, wins: 0 };
    a.games++; if (r.won) a.wins++; agg.set(r.user_id, a);
  }
  const ids = [...agg.keys()];
  const profs = ids.length ? (await sb().from('profiles').select('id,nickname,avatar,vip_until,blocked').in('id', ids)).data || [] : [];
  return profs.filter(p => !p.blocked).map(p => { const a = agg.get(p.id); return { ...p, ...a, pts: a.wins * 10 + a.games }; })
    .sort((x, y) => y.pts - x.pts || y.wins - x.wins).slice(0, 100);
}

export default function Ranking() {
  const [jogo, setJogo] = useState(null);
  const [by, setBy] = useState('semana');
  const [list, setList] = useState(null);
  useEffect(() => {
    let j = 'cacheta'; try { j = new URLSearchParams(location.search).get('jogo') || 'cacheta'; } catch {}
    setJogo(JOGOS_RANKING.includes(j) ? j : 'cacheta');
  }, []);
  useEffect(() => {
    if (!jogo) return;
    setList(null);
    const r = by === 'semana' ? ranking(jogo, weekStart(0), null) : by === 'passada' ? ranking(jogo, weekStart(1), weekStart(0)) : ranking(jogo, null, null);
    r.then(setList, () => setList([]));
  }, [by, jogo]);
  const J = jogo ? JOGOS[jogo] : null;
  const s = weekStart(by === 'passada' ? 1 : 0), e = new Date(weekStart(by === 'passada' ? 0 : -1) - 1);
  return (
    <Shell title={`🏆 Ranking${J ? ' · ' + J.nome : ''}`} back={J ? J.href : '/'}>{({ user }) => <>
      <div className="tabs" style={{ margin: 0 }}>
        {[['semana', 'Semana'], ['passada', 'Semana passada'], ['geral', 'Geral']].map(([k, t]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{t}</button>)}
      </div>
      <p className="hint">{by === 'geral'
        ? <>Todas as partidas online de <b>{J?.nome}</b>: 10 pontos por vitória e 1 por partida.</>
        : <>Semana de <b>{dm(s)}</b> a <b>{dm(e)}</b> no <b>{J?.nome}</b>: 10 pontos por vitória e 1 por partida nas mesas online.{by === 'passada' ? ' Os campeões da semana passada 🏆.' : ''}</>}</p>
      <div className="rows">
        {list === null && <div className="empty">Carregando…</div>}
        {list && !list.length && <div className="empty">{by === 'geral' ? 'Ninguém jogou online ainda. Seja o primeiro!' : 'Ninguém jogou nesta semana ainda. Seja o primeiro!'}</div>}
        {list && list.map((p, i) => (
          <div key={p.id} className={`rowi ${i < 3 ? 'top' + (i + 1) : ''} ${user && p.id === user.id ? 'me' : ''}`}>
            <span className="pos">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span className="av">{p.avatar}</span>
            <div className="grow"><b>{p.nickname}{p.vip_until && new Date(p.vip_until) > new Date() ? ' 👑' : ''}{by === 'passada' && i < 3 ? ' 🏆' : ''}</b>
              <small>{p.games} partidas · {p.wins} vitórias · {p.games ? Math.round(p.wins / p.games * 100) : 0}%</small></div>
            <span className="num">{fmt(p.pts)} pts</span>
          </div>))}
      </div></>}
    </Shell>
  );
}

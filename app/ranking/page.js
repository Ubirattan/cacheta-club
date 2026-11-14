'use client';
// Ranking de cada jogo (/ranking?jogo=truco): 10 pontos por vitória e 1 por partida nas mesas online daquele jogo.
import { useEffect, useState } from 'react';
import Shell from '../../components/Shell.js';
import { sb, api } from '../../lib/supabase-browser.js';
import { fmt, jogoDoModo, JOGOS_RANKING } from '../../lib/modes.js';
import { JOGOS } from '../../lib/jogos.js';

// início da semana (segunda 00:00, horário de Brasília) — back = semanas para trás
function weekStart(back = 0) {
  const off = 3 * 3600e3, local = new Date(Date.now() - off);
  const diff = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - diff) + off - back * 7 * 86400e3);
}
// início do mês (dia 1, 00:00 de Brasília) — back = meses para trás
function monthStart(back = 0) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1) + 3 * 3600e3);
}
const NOME_MES = d => d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' });
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
  const [by, setBy] = useState('mes');
  const [promo, setPromo] = useState(null);
  const [list, setList] = useState(null);
  useEffect(() => {
    let j = 'cacheta'; try { j = new URLSearchParams(location.search).get('jogo') || 'cacheta'; } catch {}
    setJogo(JOGOS_RANKING.includes(j) ? j : 'cacheta');
  }, []);
  useEffect(() => {
    if (!jogo) return;
    setList(null);
    const r = by === 'mes' ? ranking(jogo, monthStart(0), null) : by === 'mespassado' ? ranking(jogo, monthStart(1), monthStart(0)) : by === 'semana' ? ranking(jogo, weekStart(0), null) : by === 'passada' ? ranking(jogo, weekStart(1), weekStart(0)) : ranking(jogo, null, null);
    r.then(setList, () => setList([]));
  }, [by, jogo]);
  useEffect(() => { if (jogo === 'cacheta') api('/api/promo', { op: 'status' }).then(setPromo).catch(() => {}); }, [jogo]);
  const J = jogo ? JOGOS[jogo] : null;
  const s = weekStart(by === 'passada' ? 1 : 0), e = new Date(weekStart(by === 'passada' ? 0 : -1) - 1);
  return (
    <Shell title={`🏆 Ranking${J ? ' · ' + J.nome : ''}`} back={J ? J.href : '/'}>{({ user }) => <>
      <div className="tabs" style={{ margin: 0 }}>
        {[['mes', 'Mês'], ['mespassado', 'Mês passado'], ['semana', 'Semana'], ['geral', 'Geral']].map(([k, t]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{t}</button>)}
      </div>
      {promo && <div className="promo">
        <span className="promo-em">🏆</span>
        <div className="grow">
          <b>Promoção de {NOME_MES(monthStart(0))}: {fmt(promo.meta)} pontos = {promo.premio} fichas!</b>
          <small>O primeiro a fazer {fmt(promo.meta)} pontos no mês na cacheta online ganha {promo.premio} fichas na hora. Valem mesas com entrada de {promo.entradaMin} fichas ou mais (fora de torneio).</small>
          {promo.ganhador ? <small className="promo-g">🎉 Ganhador do mês: <b>{promo.ganhador.avatar} {promo.ganhador.nick}</b> ({fmt(promo.ganhador.pontos)} pts). Mês que vem tem de novo!</small>
            : promo.meusPontos != null && <div className="promo-bar"><i style={{ width: Math.min(100, promo.meusPontos / promo.meta * 100) + '%' }} /><span>Você: {fmt(promo.meusPontos)} / {fmt(promo.meta)} pts</span></div>}
        </div>
        <style>{`.promo{display:flex;gap:10px;align-items:flex-start;background:linear-gradient(135deg,#3a2a08,#120e08);border:2px solid var(--gold);border-radius:14px;padding:10px 12px}
.promo-em{font-size:30px;line-height:1}.promo b{display:block;font:600 16px Oswald;color:var(--gold)}.promo small{display:block;font:400 12px Rubik;color:#e8dcc0;margin-top:2px}
.promo-g{color:#4ade80!important}.promo-g b{display:inline!important;color:#fff!important;font:500 13px Rubik!important}
.promo-bar{position:relative;margin-top:6px;height:20px;border-radius:10px;background:#0008;overflow:hidden;border:1px solid #f2c94c66}
.promo-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#f59e0b,#facc15)}
.promo-bar span{position:relative;display:block;text-align:center;font:600 12px Rubik;line-height:20px;color:#fff;text-shadow:0 1px 2px #000}`}</style>
      </div>}
      <p className="hint">{by === 'mes' || by === 'mespassado'
        ? <>Mês de <b>{NOME_MES(monthStart(by === 'mespassado' ? 1 : 0))}</b> no <b>{J?.nome}</b>: 10 pontos por vitória e 1 por partida nas mesas online.</>
        : by === 'geral'
        ? <>Todas as partidas online de <b>{J?.nome}</b>: 10 pontos por vitória e 1 por partida.</>
        : <>Semana de <b>{dm(s)}</b> a <b>{dm(e)}</b> no <b>{J?.nome}</b>: 10 pontos por vitória e 1 por partida nas mesas online.{by === 'passada' ? ' Os campeões da semana passada 🏆.' : ''}</>}</p>
      <div className="rows">
        {list === null && <div className="empty">Carregando…</div>}
        {list && !list.length && <div className="empty">{by === 'geral' ? 'Ninguém jogou online ainda. Seja o primeiro!' : 'Ninguém jogou nesse período ainda. Seja o primeiro!'}</div>}
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

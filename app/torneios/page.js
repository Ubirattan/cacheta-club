'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '../../components/Shell.js';
import { sb, api } from '../../lib/supabase-browser.js';
import { MODES, fmt } from '../../lib/modes.js';

const STATUS = { open: 'Inscrições abertas', running: 'Em andamento', finished: 'Encerrado', canceled: 'Cancelado' };

export default function Torneios() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const load = useCallback(async () => {
    const { data } = await sb().from('tournaments').select('*, tournament_players(count)').order('created_at', { ascending: false }).limit(40);
    setList((data || []).map(t => ({ ...t, n: t.tournament_players?.[0]?.count || 0 })));
  }, []);
  useEffect(() => {
    load(); api('/api/tournaments', { op: 'tick' }).catch(() => {});
    const ch = sb().channel('torneios').on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players' }, load).subscribe();
    const t = setInterval(() => api('/api/tournaments', { op: 'tick' }).catch(() => {}), 20000);
    return () => { sb().removeChannel(ch); clearInterval(t); };
  }, [load]);
  const order = { open: 0, running: 1, finished: 2, canceled: 3 };
  return (
    <Shell title="🏆 Torneios">
      <p className="hint">Inscreva-se, e quando o torneio começar você é sorteado numa mesa. Quem vence a mesa passa de rodada até sobrar o campeão, que leva todas as inscrições mais o prêmio da casa.</p>
      <div className="cards3">
        {list === null && <div className="empty">Carregando…</div>}
        {list && !list.length && <div className="empty">Nenhum torneio por enquanto. O administrador cria os torneios pelo painel.</div>}
        {list && [...list].sort((a, b) => order[a.status] - order[b.status]).map(t => (
          <button key={t.id} className="tcard" onClick={() => router.push('/torneios/' + t.id)}>
            <span className={`tag ${t.status}`}>{STATUS[t.status]}</span>
            <h4>{t.name}</h4>
            <div className="kv"><span>{MODES[t.mode]?.name}</span><span>Mesas de {t.table_size}</span><span>👥 {t.n}/{t.max_players}</span><span>Inscrição {t.entry ? '💰 ' + fmt(t.entry) : 'grátis'}</span></div>
            <div style={{ font: '600 18px Oswald', color: 'var(--gold)' }}>Prêmio 💰 {fmt(t.entry * t.n + t.prize)}</div>
            {t.starts_at && t.status === 'open' && <small className="hint">Começa {new Date(t.starts_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small>}
            {t.status === 'finished' && <small className="hint">Campeão: {t.champion_name || '—'}</small>}
          </button>))}
      </div>
    </Shell>
  );
}

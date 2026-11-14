'use client';
// Conta o tempo de jogo do dia (jogo responsável): nas telas de jogo, avisa o servidor a cada minuto.
// Avisa quando faltam 5 min e trava com um aviso quando o limite que o cliente escolheu acaba.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, sb } from '../lib/supabase-browser.js';
import { toast } from './ui.js';

const JOGOS = /^\/(sala|truco|gude|sinuca|pipa|roleta|roleta-vivo|foguete|onca|mines|double|futebol|lobby|torneios)(\/|$)/;

export default function TempoJogo() {
  const path = usePathname() || '';
  const [fim, setFim] = useState(null);   // { excluido, limite }
  const noJogo = JOGOS.test(path);
  useEffect(() => {
    if (!noJogo) return;
    let vivo = true, avisou = false;
    async function bate() {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data } = await sb().auth.getSession(); if (!data.session || !vivo) return;
        const r = await api('/api/jr', { op: 'ping' });
        if (!vivo) return;
        if (r.acabou) setFim({ excluido: r.excluido, limite: r.limite });
        else if (r.limite != null && r.limite - r.usoHoje <= 5 && !avisou) { avisou = true; toast(`⏱ Faltam ${r.limite - r.usoHoje} min do seu tempo de jogo de hoje`); }
      } catch {}
    }
    bate(); const t = setInterval(bate, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [noJogo]);
  if (!fim || !noJogo) return null;
  return (
    <div className="overlay" style={{ zIndex: 70 }}>
      <div className="modal">
        <div style={{ fontSize: 44, lineHeight: 1 }}>{fim.excluido ? '⛔' : '⏱'}</div>
        <h2>{fim.excluido ? 'Autoexclusão' : 'Tempo de hoje acabou'}</h2>
        <p>{fim.excluido ? 'Você está em autoexclusão. Até ela acabar, não dá pra jogar nem apostar.' : `Você chegou no seu limite de ${fim.limite} min de jogo hoje. Os jogos voltam amanhã.`}</p>
        <a className="go" style={{ display: 'block', textDecoration: 'none' }} href="/">Voltar pro início</a>
        <a className="sec" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} href="/jogo-responsavel">Ver meus limites</a>
      </div>
    </div>
  );
}

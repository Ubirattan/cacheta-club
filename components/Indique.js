'use client';
// Indique um amigo: mostra o link do jogador, botão de compartilhar e quantos amigos já renderam fichas.
import { useEffect, useState } from 'react';
import { Modal } from './ui.js';
import { sb } from '../lib/supabase-browser.js';
import { PREMIO_INDICACAO, DEPOSITO_MIN, META_INDICACAO, BONUS_META } from '../lib/indicacao.js';

export default function Indique({ profile, onClose }) {
  const [lista, setLista] = useState(null), [copiou, setCopiou] = useState(false);
  const link = typeof window !== 'undefined' && profile ? `${location.origin}/login?ind=${profile.id}` : '';
  useEffect(() => {
    if (!profile) return;
    sb().from('indicacoes').select('pago').eq('indicador', profile.id)
      .then(({ data }) => setLista(data || []), () => setLista([]));
  }, [profile]);
  const msg = `Bora jogar comigo na Casa de Jogos! Cacheta, truco, sinuca, pipa e mais. Cria sua conta por esse link: ${link}`;
  async function compartilhar() {
    try { if (navigator.share) { await navigator.share({ title: 'Casa de Jogos', text: msg }); return; } } catch { return; }
    copiar();
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiou(true); setTimeout(() => setCopiou(false), 2000); } catch {}
  }
  const pagos = lista ? lista.filter(x => x.pago).length : 0;
  return (
    <Modal onClose={onClose}>
      <h2>🤝 Indique e ganhe</h2>
      <p style={{ fontSize: 14, lineHeight: 1.45, color: '#eadfca', margin: '6px 0 10px' }}>
        Mande seu link pra um amigo. Quando ele criar a conta por esse link e fizer o <b>primeiro depósito de R$ {DEPOSITO_MIN}</b> ou mais,
        você ganha <b style={{ color: 'var(--gold)' }}>{PREMIO_INDICACAO} fichas</b>.
      </p>
      <div style={{ background: 'linear-gradient(135deg,#3a2a08,#120e08)', border: '2px solid var(--gold)', borderRadius: 12, padding: '8px 10px', margin: '0 0 10px', textAlign: 'left' }}>
        <b style={{ font: '600 15px Oswald', color: 'var(--gold)' }}>🎁 Promoção: {META_INDICACAO} amigos = +{BONUS_META} fichas</b>
        <div style={{ fontSize: 12, color: '#e8dcc0', margin: '2px 0 6px' }}>Quando {META_INDICACAO} amigos seus criarem a conta e depositarem R$ {DEPOSITO_MIN} ou mais, você ganha mais {BONUS_META} fichas, além das {PREMIO_INDICACAO} de cada um.</div>
        <div style={{ position: 'relative', height: 22, borderRadius: 11, background: '#0008', border: '1px solid #f2c94c66', overflow: 'hidden' }}>
          <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, (lista ? pagos : 0) / META_INDICACAO * 100) + '%', background: 'linear-gradient(90deg,#16a34a,#4ade80)' }} />
          <span style={{ position: 'relative', display: 'block', textAlign: 'center', font: '700 13px Rubik', lineHeight: '22px', color: '#fff', textShadow: '0 1px 2px #000' }}>
            {lista == null ? '…' : pagos >= META_INDICACAO ? `🎉 ${pagos} amigos · você ganhou as ${BONUS_META} fichas!` : `${pagos} / ${META_INDICACAO} amigos`}</span>
        </div>
      </div>
      <div style={{ background: '#0006', border: '1px solid #c8a24a', borderRadius: 10, padding: '8px 10px', fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{link}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '10px 0 6px', flexWrap: 'wrap' }}>
        <button className="go" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank')}>📲 WhatsApp</button>
        <button className="go" onClick={compartilhar}>📤 Compartilhar</button>
        <button className="sec" onClick={copiar}>{copiou ? '✅ Copiado' : '📋 Copiar link'}</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--mut)', margin: '6px 0' }}>
        {lista == null ? 'Carregando…' : `Amigos cadastrados: ${lista.length} · Já depositaram: ${pagos} · Você ganhou ${pagos * PREMIO_INDICACAO + (pagos >= META_INDICACAO ? BONUS_META : 0)} fichas`}
      </p>
      <button className="sec" onClick={onClose}>Fechar</button>
    </Modal>
  );
}

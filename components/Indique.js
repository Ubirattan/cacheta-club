'use client';
// Indique um amigo: mostra o link do jogador, botão de compartilhar e quantos amigos já renderam fichas.
import { useEffect, useState } from 'react';
import { Modal } from './ui.js';
import { sb } from '../lib/supabase-browser.js';
import { PREMIO_INDICACAO, DEPOSITO_MIN } from '../lib/indicacao.js';

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
      <div style={{ background: '#0006', border: '1px solid #c8a24a', borderRadius: 10, padding: '8px 10px', fontSize: 12, wordBreak: 'break-all', userSelect: 'all' }}>{link}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '10px 0 6px', flexWrap: 'wrap' }}>
        <button className="go" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank')}>📲 WhatsApp</button>
        <button className="go" onClick={compartilhar}>📤 Compartilhar</button>
        <button className="sec" onClick={copiar}>{copiou ? '✅ Copiado' : '📋 Copiar link'}</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--mut)', margin: '6px 0' }}>
        {lista == null ? 'Carregando…' : `Amigos cadastrados: ${lista.length} · Já depositaram: ${pagos} · Você ganhou ${pagos * PREMIO_INDICACAO} fichas`}
      </p>
      <button className="sec" onClick={onClose}>Fechar</button>
    </Modal>
  );
}

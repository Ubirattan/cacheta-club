'use client';
// Barra de baixo (celular em pé), como nos sites de apostas: Futebol · Cassino · Cacheta · Jogos · Home.
// Promoções saiu da barra: agora é um botão flutuante na tela do futebol.
// Aparece nas telas de menu; some dentro dos jogos (que são na horizontal).
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const ITENS = [
  ['/', '⚽', 'Futebol', p => p === '/' || p.startsWith('/futebol')],
  ['/jogos/cassino', '🎰', 'Cassino', p => p.startsWith('/jogos/cassino')],
  ['/cacheta', '🃏', 'Cacheta', p => p.startsWith('/cacheta') || p.startsWith('/jogos/cacheta') || p.startsWith('/jogos/truco')],
  ['/inicio', '🎮', 'Jogos', p => p.startsWith('/inicio') || (p.startsWith('/jogos/') && !p.startsWith('/jogos/cassino') && !p.startsWith('/jogos/truco'))],
  ['/home', '🏠', 'Home', p => p.startsWith('/home')],
];
const MOSTRA = /^\/(|futebol|inicio|home|jogos|cacheta|promocoes|loja|ranking|resgate|historico|jogo-responsavel|torneios)(\/|$)/;

// guarda o pedido de instalação do Chrome (beforeinstallprompt) pro botão "Baixar o app" da Home usar
if (typeof window !== 'undefined' && !window.__cjInstalar) {
  window.__cjInstalar = { ev: null };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__cjInstalar.ev = e; window.dispatchEvent(new Event('cj-instalar')); });
  window.addEventListener('appinstalled', () => { window.__cjInstalar.ev = null; window.__cjInstalar.ok = true; window.dispatchEvent(new Event('cj-instalar')); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

export default function BarraNav() {
  const path = usePathname() || '/';
  const on = MOSTRA.test(path);
  useEffect(() => { document.body.classList.toggle('tem-barra', on); }, [on]);
  if (!on) return null;
  return (
    <nav className="barra-nav">
      {ITENS.map(([href, em, nome, ativo]) => (
        <a key={href} href={href} className={ativo(path) ? 'on' : ''}><i>{em}</i><span>{nome}</span></a>
      ))}
    </nav>
  );
}

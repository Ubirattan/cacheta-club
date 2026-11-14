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

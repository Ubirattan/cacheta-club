'use client';
// Botão "Baixar app": instala a Casa de Jogos na tela inicial do celular (sem loja de aplicativos).
// Android/Chrome: abre a janela de instalação. iPhone: mostra o passo a passo do Safari.
// Some quando o site já está aberto como aplicativo.
import { useEffect, useState } from 'react';
import { Modal } from './ui.js';

const instalado = () => { try { return window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch { return false; } };
const iphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function BaixarApp() {
  const [pronto, setPronto] = useState(false), [ja, setJa] = useState(true), [ajuda, setAjuda] = useState(null);
  useEffect(() => {
    setJa(instalado());
    if (window.__bip) setPronto(true);
    const pega = e => { e.preventDefault(); window.__bip = e; setPronto(true); };
    const fim = () => { window.__bip = null; setJa(true); setAjuda(null); };
    window.addEventListener('beforeinstallprompt', pega); window.addEventListener('appinstalled', fim);
    return () => { window.removeEventListener('beforeinstallprompt', pega); window.removeEventListener('appinstalled', fim); };
  }, []);
  if (ja) return null;
  async function baixar() {
    const e = window.__bip;
    if (e) { try { e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') setJa(true); window.__bip = null; setPronto(false); } catch {} return; }
    setAjuda(iphone() ? 'ios' : 'android');
  }
  return <>
    <button className="baixar-app" onClick={baixar} title="Instalar o aplicativo">📲 <span>Baixar app</span></button>
    {ajuda && <Modal onClose={() => setAjuda(null)}><h2>📲 Instalar a Casa de Jogos</h2>
      <div style={{ textAlign: 'left', fontSize: 15, lineHeight: 1.5, color: '#eadfca' }}>
        {ajuda === 'ios' ? <>
          <p>1. Abra este site no <b>Safari</b>.</p>
          <p>2. Toque no botão <b>Compartilhar</b> <span style={{ display: 'inline-block', border: '1.5px solid #eadfca', borderRadius: 4, padding: '0 5px' }}>⬆</span> (embaixo ou em cima da tela).</p>
          <p>3. Role e toque em <b>Adicionar à Tela de Início</b> ➕.</p>
          <p>4. Toque em <b>Adicionar</b>. Pronto: o ícone da Casa de Jogos aparece junto com os seus apps.</p>
        </> : <>
          <p>1. Abra este site no <b>Chrome</b>.</p>
          <p>2. Toque nos <b>três pontinhos ⋮</b> no canto de cima.</p>
          <p>3. Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</p>
          <p>4. Confirme. Pronto: o ícone da Casa de Jogos aparece junto com os seus apps e abre em tela cheia.</p>
        </>}
        <p style={{ fontSize: 12, color: 'var(--mut)' }}>Não ocupa quase nada de espaço e atualiza sozinho.</p>
      </div>
      <button className="go" onClick={() => setAjuda(null)}>Entendi</button></Modal>}
    <style>{`
.baixar-app{display:inline-flex;align-items:center;gap:6px;border:2px solid #fff;border-radius:20px;padding:4px 12px;background:linear-gradient(180deg,#38bdf8,#1d4ed8);color:#fff;font:600 15px Oswald;box-shadow:0 3px 0 #0008;animation:baixa 2.4s infinite}
.baixar-app:active{transform:translateY(2px)}
@keyframes baixa{0%,100%{box-shadow:0 3px 0 #0008,0 0 0 0 #38bdf8aa}50%{box-shadow:0 3px 0 #0008,0 0 0 8px #38bdf800}}
`}</style>
  </>;
}

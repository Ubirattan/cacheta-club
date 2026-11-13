'use client';
// CASA DE JOGOS — tela inicial: um cartão grande pra cada jogo.
// A cacheta (online, torneio, contra o computador, código) agora fica em /cacheta.
import { useState, useEffect } from 'react';
import { sb } from '../lib/supabase-browser.js';
import { useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../components/useAuth.js';
import { Header } from '../components/ui.js';
import ProfileModal from '../components/ProfileModal.js';
import JoinCode from '../components/JoinCode.js';

const JOGOS = [
  { id: 'cacheta', nome: 'Cacheta', sub: 'Online, torneio e contra o computador', em: '🃏', href: '/cacheta', g: 'linear-gradient(160deg,#38b6ff,#1565d8 55%,#0a3fa8)' },
  { id: 'truco', nome: 'Truco', sub: 'Paulista · 1x1 e duplas', em: '♣️', href: '/truco', g: 'linear-gradient(160deg,#f87171,#c81e3a 55%,#7f0d22)' },
  { id: 'sinuca', nome: 'Sinuca', sub: 'Bola 8, bola lisa e bolinho', em: '🎱', href: '/sinuca', g: 'linear-gradient(160deg,#4ade80,#15803d 55%,#0b4d25)', novo: true },
  { id: 'gude', nome: 'Bolinha de gude', sub: 'Triângulo, buraco e mata-mata', em: null, href: '/gude', g: 'linear-gradient(160deg,#a78bfa,#6d28d9 55%,#3b0f80)' },
  { id: 'pipa', nome: 'Pipa', sub: 'Corta, apara e manda busca', em: '🪁', href: '/pipa', g: 'linear-gradient(160deg,#fbbf24,#ea7a0a 55%,#9a3412)' },
];

// link de teste do Netlify (deploy-preview-N--...): abre sem login
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);

export default function Home() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: !TESTE });
  const online = useOnline(user, profile, 'inicio');
  const [modal, setModal] = useState(null);
  const [motd, setMotd] = useState('');
  useEffect(() => { if (user) sb().from('app_settings').select('value').eq('key', 'motd').maybeSingle().then(({ data }) => setMotd(data ? data.value : '')); }, [user]);
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')}
        mid={<div className="cj-logo">CASA DE <b>JOGOS</b></div>}
        right={<span className="online"><i />{online.length} online</span>} />
      {motd && <div className="note" style={{ fontSize: 14, color: 'var(--gold)' }}>📣 {motd}</div>}
      <div className="cj-grade">
        {JOGOS.map(j => (
          <button key={j.id} className="cj-jogo" style={{ '--g': j.g }} onClick={() => router.push(j.href)}>
            <span className="cj-brilho" />
            <span className="cj-em">{j.em || <i className="gude cj-gude" />}</span>
            <b>{j.nome}</b><small>{j.sub}</small>
            {j.novo && <em>NOVO</em>}
          </button>
        ))}
      </div>
      <div className="cj-acoes">
        <button className="buybtn" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas <small>Pix · QR Code na hora</small></button>
        <button className="buybtn" style={{ background: 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => router.push('/resgate')}>🎁 Resgatar fichas</button>
        <button className="buybtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} onClick={() => router.push('/ranking')}>🏆 Ranking <small>da semana</small></button>
        <button className="buybtn" style={{ background: 'linear-gradient(180deg,#ff6fd8,#a21caf)' }} onClick={() => setModal('codigo')}>🔑 Entrar com código</button>
      </div>
      <div className="footbar">
        <button onClick={() => setModal('perfil')} title="Perfil e configurações">⚙️</button>
        <button onClick={() => router.push('/ranking')} title="Ranking">🏆</button>
        <button onClick={() => router.push('/historico')} title="Histórico">📜</button>
        {profile?.is_admin && <button onClick={() => router.push('/admin')} title="Painel admin">🛠</button>}
        <div className="ver">Casa de Jogos · v4.0</div>
        <button className="shop" onClick={() => router.push('/loja')} style={{ position: 'relative' }}><i>🛒</i>Loja</button>
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      {modal === 'codigo' && <JoinCode onClose={() => setModal(null)} />}
      <style>{`
.cj-logo{font:700 clamp(20px,4.6vmin,34px) Oswald;color:#fff;font-style:italic;letter-spacing:1px;text-shadow:0 2px 0 #000a;white-space:nowrap}
.cj-logo b{color:var(--gold)}
.cj-grade{flex:1;min-height:0;display:grid;grid-template-columns:repeat(5,minmax(0,170px));grid-template-rows:minmax(0,1fr);justify-content:center;gap:clamp(8px,1.6vw,18px);padding:clamp(6px,1.5vh,14px) clamp(10px,3vw,40px)}
.cj-jogo{position:relative;overflow:hidden;border-radius:22px;border:3px solid #ffffffcc;background:var(--g);box-shadow:0 6px 0 #0007,0 10px 24px #0009;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding:8px 6px 12px;height:100%;max-height:230px;align-self:center;min-height:0;cursor:pointer;transition:transform .12s}
.cj-jogo:active{transform:translateY(4px) scale(.98);box-shadow:0 2px 0 #0007}
.cj-brilho{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#ffffff55,transparent 55%),repeating-linear-gradient(115deg,#ffffff10 0 12px,transparent 12px 26px);pointer-events:none}
.cj-em{position:absolute;left:0;right:0;top:10%;display:flex;justify-content:center;font-size:clamp(34px,8vmin,70px);filter:drop-shadow(0 6px 6px #0008);line-height:1}
.cj-gude{border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 14%,#93c5fd 22%,#2563eb 58%,#0b2a6b);box-shadow:2px 4px 8px rgba(0,0,0,.5);display:inline-block;width:clamp(34px,8vmin,68px)!important;height:clamp(34px,8vmin,68px)!important}
.cj-jogo b{position:relative;font:700 clamp(15px,3vmin,22px) Oswald;font-style:italic;text-shadow:0 2px 0 #0008;text-align:center;line-height:1.05}
.cj-jogo small{position:relative;font:500 clamp(9px,1.7vmin,12px) Rubik;opacity:.92;text-align:center;line-height:1.2}
.cj-jogo em{position:absolute;top:10px;right:-30px;transform:rotate(35deg);background:#facc15;color:#3a2300;font:700 11px Oswald;font-style:normal;padding:2px 34px;box-shadow:0 2px 4px #0006}
.cj-acoes{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:0 10px 8px}
@media (orientation:portrait){.cj-grade{grid-template-columns:1fr 1fr;grid-template-rows:none;align-content:start}.cj-jogo{height:auto;aspect-ratio:1}}
`}</style>
    </div>
  );
}

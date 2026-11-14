'use client';
// CASA DE JOGOS — todos os jogos (aba Jogos da barra de baixo): um cartão pra cada jogo.
// O site agora abre no futebol (app/page.js).
// Comprar/resgatar fichas, indique e os ícones (perfil, histórico, jogo responsável, admin, loja) foram pra aba Home (/home).
// A cacheta (online, torneio, contra o computador, código) agora fica em /cacheta.
import { useState, useEffect } from 'react';
import { sb } from '../../lib/supabase-browser.js';
import { useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../../components/useAuth.js';
import { Header } from '../../components/ui.js';
import { JOGOS as J } from '../../lib/jogos.js';
// Na aba Jogos ficam sinuca, pipa, bolinha de gude, dominó e jogo do bicho (cacheta, futebol e cassino têm aba própria na barra de baixo).
const JOGOS = ['sinuca', 'pipa', 'gude', 'domino', 'bicho'].map(id => ({ id, ...J[id] }));
import IconeDomino from '../../components/IconeDomino.js';
import ProfileModal from '../../components/ProfileModal.js';


// link de teste do Netlify (deploy-preview-N--...): abre sem login
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);

export default function Home() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: false });
  useOnline(user, profile, 'inicio');   // continua contando quem está no site (o número aparece só dentro da cacheta)
  const [modal, setModal] = useState(null);
  const [motd, setMotd] = useState('');
  useEffect(() => { if (user) sb().from('app_settings').select('value').eq('key', 'motd').maybeSingle().then(({ data }) => setMotd(data ? data.value : '')); }, [user]);
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')} semVisitante
        mid={<div className="cj-logo">🎮 <b>JOGOS</b></div>} />
      {motd && <div className="note" style={{ fontSize: 14, color: 'var(--gold)' }}>📣 {motd}</div>}
      <div className="cx-top" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', rowGap: 8, marginTop: 10 }}>
        <button className="buybtn" style={{ marginLeft: 10, background: 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => router.push('/resgate')}>🎁 Resgatar fichas</button>
        <button className="buybtn" style={{ marginLeft: 10 }} onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas</button>
        <button className="buybtn" style={{ marginLeft: 10, background: 'linear-gradient(180deg,#c084fc,#7e22ce)' }} onClick={() => router.push('/loja')}>✨ Loja</button>
      </div>
      <div className="modes jg-modes">
        {JOGOS.map(j => (
          <button key={j.id} className="mode" style={{ '--g': j.g }} onClick={() => router.push(j.href)}>
            <div className="art"><span className="burst" /><span className="jg-em">{j.id === 'domino' ? <IconeDomino size={70} /> : j.em || <i className="cj-gude" />}</span></div>
            <h3>{j.nome}</h3>
            {j.novo && <em>NOVO</em>}
          </button>
        ))}
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      <style>{`
.cj-logo{font:700 clamp(20px,4.6vmin,34px) Oswald;color:#fff;font-style:italic;letter-spacing:1px;text-shadow:0 2px 0 #000a;white-space:nowrap}
.cj-logo b{color:var(--gold)}
.cj-grade{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,150px));grid-template-rows:minmax(0,1fr);justify-content:center;gap:clamp(8px,1.6vw,18px);padding:clamp(6px,1.5vh,14px) clamp(10px,3vw,40px)}
.cj-jogo{position:relative;overflow:hidden;border-radius:22px;border:3px solid #ffffffcc;background:var(--g);box-shadow:0 6px 0 #0007,0 10px 24px #0009;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding:8px 6px 12px;height:100%;max-height:230px;align-self:center;min-height:0;cursor:pointer;transition:transform .12s}
.cj-jogo:active{transform:translateY(4px) scale(.98);box-shadow:0 2px 0 #0007}
.cj-brilho{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#ffffff55,transparent 55%),repeating-linear-gradient(115deg,#ffffff10 0 12px,transparent 12px 26px);pointer-events:none}
.cj-em{position:absolute;left:0;right:0;top:10%;display:flex;justify-content:center;font-size:clamp(34px,8vmin,70px);filter:drop-shadow(0 6px 6px #0008);line-height:1}
.cj-gude{border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 14%,#93c5fd 22%,#2563eb 58%,#0b2a6b);box-shadow:2px 4px 8px rgba(0,0,0,.5);display:inline-block;width:clamp(34px,8vmin,68px)!important;height:clamp(34px,8vmin,68px)!important}
.cj-jogo b{position:relative;font:700 clamp(15px,3vmin,22px) Oswald;font-style:italic;text-shadow:0 2px 0 #0008;text-align:center;line-height:1.05}
.cj-jogo small{position:relative;font:500 clamp(9px,1.7vmin,12px) Rubik;opacity:.92;text-align:center;line-height:1.2}
.cj-jogo em{position:absolute;top:10px;right:-30px;transform:rotate(35deg);background:#facc15;color:#3a2300;font:700 11px Oswald;font-style:normal;padding:2px 34px;box-shadow:0 2px 4px #0006}
.jg-modes{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,220px));justify-content:center;gap:clamp(10px,2vw,22px);align-content:center;padding:10px clamp(12px,4vw,48px)}
.jg-em{position:relative;z-index:2;font-size:clamp(44px,10vmin,80px);line-height:1;filter:drop-shadow(0 6px 6px #0008)}
.jg-em .cj-gude{display:inline-block}
.cj-acoes{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:0 10px 8px}
.cj-hero{display:none}
@media (orientation:portrait){
.hdr .games{display:none}
.cj-hero{display:flex;flex-direction:column;align-items:center;padding:10px 12px 2px}
.cj-hero b{font:700 clamp(28px,9vw,40px) Oswald;font-style:italic;color:#fff;letter-spacing:1px;text-shadow:0 3px 0 #000a;line-height:1}
.cj-hero b i{color:var(--gold)}
.cj-hero small{font:500 13px Rubik;color:#e8dcc0;opacity:.85;margin-top:4px}
.cj-grade{flex:none;display:flex;flex-wrap:wrap;justify-content:center;gap:10px;padding:10px 12px}
.cj-jogo{flex:0 0 calc((100% - 20px) / 3);height:auto;max-height:none;aspect-ratio:1/1.12;border-radius:18px;border-width:2px;padding:6px 4px 8px}
.cj-em{top:12%;font-size:clamp(30px,10vw,44px)}
.cj-gude{width:clamp(30px,10vw,44px)!important;height:clamp(30px,10vw,44px)!important}
.cj-jogo b{font-size:clamp(13px,4vw,17px)}
.cj-jogo small{display:none}
.cj-jogo em{font-size:9px;top:6px;right:-34px}
.jg-modes{grid-template-columns:repeat(3,1fr);gap:12px 10px;flex:none;align-content:start;padding:12px 12px 10px}
.jg-modes .mode{aspect-ratio:.86;border-radius:16px;box-shadow:0 0 0 3px var(--gold2),0 0 0 4px #000,0 6px 14px rgba(0,0,0,.55)}
.jg-modes .mode .art{top:4%;height:62%}
.jg-em{font-size:44px}
.jg-modes .mode h3{font-size:clamp(12px,3.6vw,15px);margin:0 0 9%;padding:0 3px;line-height:1.05}
.cx-top{flex-wrap:nowrap!important;gap:6px;padding:0 10px}
.cx-top .buybtn{margin:0!important;flex:1;min-width:0;padding:8px 4px!important;font-size:15px!important;justify-content:center;white-space:nowrap}
.cj-acoes{flex-direction:column;align-items:stretch;padding:4px 14px 12px;gap:8px}
.cj-acoes .buybtn{margin:0!important;width:100%;justify-content:center}
}
`}</style>
    </div>
  );
}

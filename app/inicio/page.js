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
// Na aba Jogos ficam só sinuca, pipa e bolinha de gude (cacheta, futebol e cassino têm aba própria na barra de baixo).
const JOGOS = ['sinuca', 'pipa', 'gude'].map(id => ({ id, ...J[id] }));
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
        mid={<div className="cj-logo">CASA DE <b>JOGOS</b></div>} />
      <div className="cj-hero"><b>CASA DE <i>JOGOS</i></b><small>Escolha o seu jogo</small></div>
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
.cj-acoes{flex-direction:column;align-items:stretch;padding:4px 14px 12px;gap:8px}
.cj-acoes .buybtn{margin:0!important;width:100%;justify-content:center}
}
`}</style>
    </div>
  );
}

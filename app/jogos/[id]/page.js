'use client';
// Tela de cada jogo (truco, sinuca, gude, pipa): as opções do jogo e a loja dele, igual à cacheta.
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../../../components/useAuth.js';
import { Header } from '../../../components/ui.js';
import ProfileModal from '../../../components/ProfileModal.js';
import { JOGOS } from '../../../lib/jogos.js';
import { ARTES } from '../../../components/CassinoArte.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);

export default function Jogo() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: false });
  const online = useOnline(user, profile, 'inicio');
  const [modal, setModal] = useState(null);
  const J = JOGOS[id];
  if (!J || !J.opcoes) { if (typeof window !== 'undefined') router.replace('/inicio'); return null; }
  const rank = !J.semLoja && !['roleta', 'foguete', 'onca'].includes(id) ? [{ t: `Ranking ${id === 'gude' ? 'da gude' : id === 'truco' ? 'do truco' : 'da ' + J.nome.toLowerCase()}`, sub: 'Só as partidas online deste jogo', em: '🏆', href: `/ranking?jogo=${id}`, g: 'linear-gradient(180deg,#ffd76a,#c8901c 60%,#7a5208)' }] : [];
  const opcoes = [...J.opcoes, ...rank, ...(J.semLoja ? [] : [{ t: `Loja ${id === 'gude' ? 'da gude' : id === 'truco' ? 'do truco' : 'da ' + J.nome.toLowerCase()}`, sub: 'Itens pra usar no jogo', em: '🛒', href: `/loja?jogo=${id}`, g: 'linear-gradient(180deg,#c084fc,#7e22ce 60%,#4c0d8a)' }])];
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')}
        mid={<div className="jg-tit">{J.em || '🔵'} {J.nome.toUpperCase()}</div>}
        right={<><span className="online"><i />{online.length} online</span><button className="rbtn" title="Voltar" onClick={() => router.push(id === 'truco' ? '/cacheta' : id === 'cassino' ? '/' : '/inicio')}>↩</button></>} />
      <div className="jg-ops" style={{ '--n': opcoes.length }}>
        {opcoes.map(o => (
          <button key={o.href} className="jg-op" style={{ '--g': o.g }} onClick={() => router.push(o.href)}>
            <span className="jg-brilho" />{o.arte && ARTES[o.arte] ? <span className="jg-arte">{(() => { const A = ARTES[o.arte]; return <A />; })()}</span> : <span className="jg-em">{o.em}</span>}
            <b>{o.t}</b>{o.sub && <small>{o.sub}</small>}
          </button>
        ))}
      </div>
      <div className="cj-acoes" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: '0 10px 10px' }}>
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      <style>{`
.jg-tit{font:700 clamp(20px,4.4vmin,30px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;white-space:nowrap}
.jg-ops{flex:1;min-height:0;display:grid;grid-template-columns:repeat(var(--n),minmax(0,220px));grid-template-rows:minmax(0,1fr);justify-content:center;gap:clamp(10px,2vw,22px);padding:clamp(8px,2vh,18px) clamp(12px,4vw,48px)}
.jg-op{position:relative;overflow:hidden;align-self:center;height:100%;max-height:250px;min-height:0;border-radius:22px;border:3px solid #ffffffcc;background:var(--g);box-shadow:0 6px 0 #0007,0 10px 24px #0009;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding:8px 8px 14px;cursor:pointer}
.jg-op:active{transform:translateY(4px);box-shadow:0 2px 0 #0007}
.jg-brilho{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#ffffff55,transparent 55%),repeating-linear-gradient(115deg,#ffffff10 0 12px,transparent 12px 26px);pointer-events:none}
.jg-em{position:absolute;left:0;right:0;top:12%;text-align:center;font-size:clamp(40px,9vmin,76px);filter:drop-shadow(0 6px 6px #0008);line-height:1}
.jg-arte{position:absolute;left:12%;right:12%;top:6%;bottom:30%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 8px #0009)}
.jg-arte>svg{width:100%;height:100%}
.jg-op b{position:relative;font:700 clamp(16px,3.2vmin,24px) Oswald;font-style:italic;text-shadow:0 2px 0 #0008;text-align:center;line-height:1.05}
.jg-op small{position:relative;font:500 clamp(10px,1.8vmin,12px) Rubik;opacity:.92;text-align:center}
@media (orientation:portrait){.jg-ops{grid-template-columns:1fr 1fr;grid-template-rows:none;align-content:start}.jg-op{height:auto;aspect-ratio:1}}
`}</style>
    </div>
  );
}

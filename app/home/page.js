'use client';
// HOME (aba da barra de baixo): saldo, comprar fichas, resgatar fichas, indique e ganhe,
// e os atalhos que antes ficavam no rodapé da aba Jogos (perfil, histórico, jogo responsável, admin, loja).
import { useState, useEffect } from 'react';
import { sb, pedirConta } from '../../lib/supabase-browser.js';
import { useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../../components/useAuth.js';
import { Header } from '../../components/ui.js';
import ProfileModal from '../../components/ProfileModal.js';
import Indique from '../../components/Indique.js';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: false });
  useOnline(user, profile, 'home');
  const [modal, setModal] = useState(null);
  const [motd, setMotd] = useState('');
  useEffect(() => { if (user) sb().from('app_settings').select('value').eq('key', 'motd').maybeSingle().then(({ data }) => setMotd(data ? data.value : '')); }, [user]);
  const conta = fn => () => (profile ? fn() : pedirConta());

  // BAIXAR O APP: no Android/Chrome abre o pedido de instalação; no iPhone (e quando o Chrome não deixa) mostra o passo a passo
  const [instalado, setInstalado] = useState(false), [podeInstalar, setPodeInstalar] = useState(false), [ajuda, setAjuda] = useState(null);
  useEffect(() => {
    const ver = () => {
      const st = window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone;
      setInstalado(!!st || !!window.__cjInstalar?.ok); setPodeInstalar(!!window.__cjInstalar?.ev);
    };
    ver(); window.addEventListener('cj-instalar', ver); return () => window.removeEventListener('cj-instalar', ver);
  }, []);
  async function baixarApp() {
    const ev = window.__cjInstalar?.ev;
    if (ev) { ev.prompt(); try { await ev.userChoice; } catch {} window.__cjInstalar.ev = null; setPodeInstalar(false); return; }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setAjuda(ios ? 'ios' : 'android');
  }

  const atalhos = [
    ['⚙️', 'Perfil', conta(() => setModal('perfil'))],
    ['📜', 'Histórico', () => router.push('/historico')],
    ['🛡', 'Jogo responsável', conta(() => router.push('/jogo-responsavel'))],
    ['🛒', 'Loja', () => router.push('/loja')],
  ];
  if (profile?.is_admin) atalhos.push(['🛠', 'Painel admin', () => router.push('/admin')]);

  return (
    <div className="page lounge hm">
      <Header profile={profile} onProfile={conta(() => setModal('perfil'))}
        mid={<div className="cj-logo">CASA DE <b>JOGOS</b></div>} />
      <div className="hm-hero"><b>CASA DE <i>JOGOS</i></b><small>Fichas, resgates e sua conta</small></div>
      {motd && <div className="note" style={{ fontSize: 14, color: 'var(--gold)' }}>📣 {motd}</div>}

      <div className="hm-acoes">
        {!instalado && <button className="buybtn hm-app" onClick={baixarApp}>📲 Baixar o app <small>{podeInstalar ? 'Instala na hora, grátis' : 'Ícone na tela do celular, tela cheia'}</small></button>}
        <button className="buybtn" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas <small>Pix · QR Code na hora</small></button>
        <button className="buybtn" style={{ background: 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => router.push('/resgate')}>🎁 Resgatar fichas <small>Troque suas fichas por troféus</small></button>
        <button className="buybtn" style={{ background: 'linear-gradient(180deg,#4ade80,#15803d)' }} onClick={conta(() => setModal('indique'))}>🤝 Indique e ganhe <small>50 amigos = 300 fichas</small></button>
      </div>

      <div className="hm-tit">Sua conta</div>
      <div className="hm-atalhos">
        {atalhos.map(([em, nome, fn]) => (
          <button key={nome} className="hm-at" onClick={fn}><i>{em}</i><span>{nome}</span></button>
        ))}
      </div>
      <div className="hm-ver">Casa de Jogos · v4.1</div>

      {ajuda && <div className="hm-aj" onClick={() => setAjuda(null)}><div className="hm-ajc" onClick={e => e.stopPropagation()}>
        <b>📲 Baixar o app Casa de Jogos</b>
        {ajuda === 'ios' ? <ol><li>No <b>Safari</b>, toque em <b>Compartilhar</b> ⬆️ (no iOS 26 fica no menu •••)</li><li>Escolha <b>Adicionar à Tela de Início</b></li><li>Abra o <b>Casa de Jogos</b> pelo ícone novo</li></ol>
          : <ol><li>No <b>Chrome</b>, toque nos <b>3 pontinhos ⋮</b> lá em cima</li><li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></li><li>Abra o <b>Casa de Jogos</b> pelo ícone novo</li></ol>}
        <small>Se o ícone antigo já estiver no celular, apague e instale de novo.</small>
        <button className="buybtn" onClick={() => setAjuda(null)}>Entendi</button>
      </div></div>}
      {modal === 'indique' && profile && <Indique profile={profile} onClose={() => setModal(null)} />}
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      <style>{`
.hm{overflow-y:auto}
.cj-logo{font:700 clamp(20px,4.6vmin,34px) Oswald;color:#fff;font-style:italic;letter-spacing:1px;text-shadow:0 2px 0 #000a;white-space:nowrap}
.cj-logo b{color:var(--gold)}
.hm-hero{display:flex;flex-direction:column;align-items:center;padding:12px 12px 4px}
.hm-hero b{font:700 clamp(28px,9vw,40px) Oswald;font-style:italic;color:#fff;letter-spacing:1px;text-shadow:0 3px 0 #000a;line-height:1}
.hm-hero b i{color:var(--gold)}
.hm-hero small{font:500 13px Rubik;color:#e8dcc0;opacity:.85;margin-top:4px}
.hm-acoes{display:flex;flex-direction:column;gap:10px;padding:10px 14px}
.hm-acoes .buybtn{margin:0!important;width:100%;justify-content:center}
.hm-app{background:linear-gradient(180deg,#60a5fa,#1d4ed8)!important}
.hm-aj{position:fixed;inset:0;z-index:60;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px}
.hm-ajc{background:linear-gradient(180deg,#2a241b,#14110b);border:2px solid var(--gold2);border-radius:18px;padding:18px;max-width:380px;width:100%;color:#fff;font:400 15px Rubik;display:flex;flex-direction:column;gap:10px}
.hm-ajc>b{font:700 20px Oswald;color:var(--gold)}
.hm-ajc ol{margin:0;padding-left:20px;line-height:1.5}
.hm-ajc small{opacity:.75}
.hm-ajc .buybtn{margin:0!important;width:100%;justify-content:center}
.hm-tit{font:700 18px Oswald;color:var(--gold);letter-spacing:.5px;padding:10px 16px 4px}
.hm-atalhos{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:4px 14px 10px}
.hm-at{display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#2a241b,#17130d);border:1.5px solid #ffffff22;border-radius:16px;padding:14px 12px;color:#fff;font:600 16px Rubik;text-align:left;box-shadow:0 4px 0 #0007;cursor:pointer}
.hm-at:active{transform:translateY(3px);box-shadow:0 1px 0 #0007}
.hm-at i{font-style:normal;font-size:28px;line-height:1}
.hm-ver{text-align:center;font:500 13px Oswald;color:#8b7d62;padding:6px 0 14px}
@media (orientation:portrait){.hdr .games{display:none}}
`}</style>
    </div>
  );
}

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

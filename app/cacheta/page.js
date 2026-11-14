'use client';
// Cacheta: online, torneio, contra o computador e entrar com código (antes era a tela inicial do site).
import { useState, useEffect } from 'react';
import { sb } from '../../lib/supabase-browser.js';
import { useRouter } from 'next/navigation';
import { useAuth, useOnline } from '../../components/useAuth.js';
import { Header, Card } from '../../components/ui.js';
import ProfileModal from '../../components/ProfileModal.js';
import JoinCode from '../../components/JoinCode.js';

function Art({ cards, em, big }) {
  const cls = ['c1', 'c2', 'c3'];
  return (
    <div className="art"><div className="burst" />
      {cards.map((c, i) => <Card key={i} c={{ id: i, r: c[0], s: c[1] }} cls={cards.length === 2 ? (i ? 'c3' : 'c1') : cls[i]} />)}
      <span className="em" style={big ? { fontSize: 'clamp(40px,10vmin,70px)', bottom: 0 } : undefined}>{em}</span>
    </div>
  );
}

// link de teste do Netlify (deploy-preview-N--...): abre sem login
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);

export default function Cacheta() {
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth({ required: false });
  const online = useOnline(user, profile, 'inicio');
  const [modal, setModal] = useState(null);
  const [motd, setMotd] = useState('');
  useEffect(() => { if (user) sb().from('app_settings').select('value').eq('key', 'motd').maybeSingle().then(({ data }) => setMotd(data ? data.value : '')); }, [user]);
  return (
    <div className="page lounge">
      <Header profile={profile} onProfile={() => setModal('perfil')} semVisitante
        mid={<div className="cx-tit">🃏 CACHETA</div>}
        right={<><span className="online"><i />{online.length} online</span><button className="rbtn" title="Voltar" onClick={() => router.push('/inicio')}>↩</button></>} />
      {motd && <div className="note" style={{ fontSize: 14, color: 'var(--gold)' }}>📣 {motd}</div>}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', rowGap: 8, marginTop: 10 }}>
        <button className="buybtn" style={{ marginLeft: 10, background: 'linear-gradient(180deg,#fb923c,#c2410c)' }} onClick={() => router.push('/resgate')}>🎁 Resgatar fichas</button>
        <button className="buybtn" style={{ marginLeft: 10, background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} onClick={() => router.push('/ranking?jogo=cacheta')}>🏆 Ranking <small>da semana</small></button>
        <button className="buybtn" style={{ marginLeft: 10, background: 'linear-gradient(180deg,#c084fc,#7e22ce)' }} onClick={() => router.push('/loja?jogo=cacheta')}>✨ Loja <small>baralhos e mesas</small></button>
      </div>
      <div className="modes" style={{ flex: 1, display: 'grid', gap: 'clamp(10px,2vw,22px)', alignContent: 'center', padding: '10px clamp(12px,4vw,48px)' }}>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#38b6ff,#1565d8 60%,#0a3fa8)' }} onClick={() => router.push('/lobby')}>
          <Art cards={[[0, 1], [0, 0], [0, 3]]} em="🌐" /><h3>Cacheta online</h3></button>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#43e0a0,#109c61 60%,#06703f)' }} onClick={() => router.push('/torneios')}>
          <Art cards={[[12, 2], [11, 1]]} em="🏆" big /><h3>Torneio Cacheta</h3></button>
        <a className="mode" style={{ '--g': 'linear-gradient(180deg,#ffb347,#ef6c0a 55%,#a3380a)' }} href="/offline/index.html">
          <Art cards={[[6, 1], [10, 0], [5, 2]]} em="🤖" /><h3>Contra o computador</h3></a>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#f87171,#c81e3a 55%,#7f0d22)' }} onClick={() => router.push('/jogos/truco')}>
          <Art cards={[[3, 1], [0, 0], [6, 3]]} em="♣️" /><h3>Truco</h3></button>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#ff6fd8,#d6247e 55%,#8e0f4e)' }} onClick={() => setModal('codigo')}>
          <Art cards={[[2, 3], [3, 3], [4, 3]]} em="🔑" /><h3>Entrar com código</h3></button>
        <button className="mode" style={{ '--g': 'linear-gradient(180deg,#c084fc,#7e22ce 60%,#4c0d8a)' }} onClick={() => router.push('/loja?jogo=cacheta')}>
          <Art cards={[[0, 2], [12, 2], [11, 2]]} em="🛒" /><h3>Loja da cacheta</h3></button>
      </div>
      <div className="footbar">
        <button onClick={() => setModal('perfil')} title="Perfil e configurações">⚙️</button>
        <button onClick={() => router.push('/ranking?jogo=cacheta')} title="Ranking">🏆</button>
        <button onClick={() => router.push('/historico')} title="Histórico">📜</button>
        {profile?.is_admin && <button onClick={() => router.push('/admin')} title="Painel admin">🛠</button>}
        <div className="ver">Casa de Jogos · Cacheta</div>
        <button className="shop" onClick={() => router.push('/loja')} style={{ position: 'relative' }}><i>🛒</i>Loja</button>
      </div>
      {modal === 'perfil' && profile && <ProfileModal profile={profile} onClose={() => setModal(null)} onSaved={reloadProfile} />}
      {modal === 'codigo' && <JoinCode onClose={() => setModal(null)} />}
      <style>{`.cx-tit{font:700 clamp(20px,4.4vmin,30px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px}.page .modes{grid-template-columns:repeat(5,1fr)}@media (orientation:portrait){.page .modes{grid-template-columns:1fr 1fr}}`}</style>
    </div>
  );
}

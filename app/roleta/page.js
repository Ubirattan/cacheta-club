'use client';
// ROLETA (europeia, um zero). O sorteio e o pagamento são feitos no servidor (/api/roleta).
// Fichas sem valor em dinheiro; aposta máxima por rodada em lib/roleta.js.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { criarRoleta } from '../../lib/roleta-ui.js';
import { MAX_APOSTA, conferir, pagar } from '../../lib/roleta.js';

// link de teste do Netlify: abre sem login e sorteia no próprio celular (sem fichas de verdade)
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
const sorteioTeste = async apostas => { const c = conferir(apostas); if (c.erro) throw new Error(c.erro); const numero = Math.floor(Math.random() * 37); const { volta, ganhas } = pagar(c.apostas, numero); return { numero, apostado: c.total, volta, ganhas }; };

export default function Roleta() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  const boxRef = useRef(null), uiRef = useRef(null), profRef = useRef(null);
  profRef.current = profile;
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [maior, setMaior] = useState(null);       // confirmou que tem 18 anos?

  useEffect(() => {
    setSom(soundOn());
    try { setMaior(localStorage.getItem('rl_18') === '1'); } catch { setMaior(false); }
  }, []);

  useEffect(() => {
    if (!maior || !boxRef.current) return;
    const ui = criarRoleta(boxRef.current, {
      coins: profile ? profile.coins || 0 : null,
      som: t => sfx(t === 'bola' ? 'card' : t),
      girar: apostas => (TESTE && !profRef.current ? sorteioTeste(apostas) : api('/api/roleta', { apostas })),
      onCoins: () => reloadProfile && reloadProfile(),
    });
    uiRef.current = ui;
    return () => { ui.destroy(); uiRef.current = null; };
  }, [maior]); // eslint-disable-line
  useEffect(() => { if (uiRef.current && profile) uiRef.current.setCoins(profile.coins || 0); }, [profile?.coins]); // eslint-disable-line

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>🎰 ROLETA</h2>
      <p>Jogo só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('rl_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/jogos/roleta')}>Voltar</button>
    </div></div></div>
  );

  return (
    <div className="page lounge rlp">
      <div className="rlp-top">
        <div className="rlp-logo">ROLETA</div>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Loja" onClick={() => router.push('/loja#comprar')}>💰</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/roleta')}>↩</button>
      </div>
      <div className="rlp-box" ref={boxRef} />
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Escolha o valor da ficha (1, 5, 10 ou 25) e <b>toque na mesa</b> onde quer apostar. Pode apostar em vários lugares. Depois toque em <b>GIRAR</b>.</p>
          <p>• <b>Número cheio</b> paga 35 pra 1 · <b>dúzia</b> e <b>coluna (2:1)</b> pagam 2 pra 1 · <b>vermelho/preto, par/ímpar, 1-18/19-36</b> pagam 1 pra 1.</p>
          <p>• Roleta europeia, com um zero só. Se der <b>0</b>, só ganha quem apostou no 0.</p>
          <p>• Máximo de <b>{MAX_APOSTA} fichas</b> por rodada. <b>Repetir</b> coloca a última aposta de novo.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.rlp{overflow:hidden}
.rlp-top{display:flex;align-items:center;gap:8px;padding:6px 12px 2px}
.rlp-logo{font:700 clamp(20px,5vmin,30px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;margin-right:auto}
.rlp-top .rbtn{width:40px;height:40px;font-size:17px}
.rlp-box{flex:1;min-height:0;padding:4px 10px 8px}
`}</style>
    </div>
  );
}

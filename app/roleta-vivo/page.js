'use client';
// ROLETA AO VIVO: todo mundo aposta na mesma rodada. O servidor sorteia e paga (/api/roleta-vivo);
// a tela consulta o estado a cada ~1 s e gira a roda quando a rodada fecha.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { criarRoleta } from '../../lib/roleta-ui.js';
import { MAX_APOSTA, pagar } from '../../lib/roleta.js';
import { APOSTAS_MS, GIRO_MS } from '../../lib/roleta-vivo.js';
import { criarTeste } from '../../lib/roleta-vivo-teste.js';

// link de teste do Netlify sem login: rodadas no próprio celular, fichas de mentira
const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
let teste = null;
const fx = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function RoletaVivo() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: false });
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/roleta-vivo', b);
  const chamaRef = useRef(chama); chamaRef.current = chama;
  const boxRef = useRef(null), uiRef = useRef(null), off = useRef(0), visto = useRef(null), minhaRef = useRef('');
  const [st, setSt] = useState(null), [som, setSom] = useState(true), [regras, setRegras] = useState(false), [lista, setLista] = useState(false);

  useEffect(() => { setSom(soundOn()); }, []);
  useEffect(() => {
    if (!boxRef.current) return;
    const ui = criarRoleta(boxRef.current, {
      vivo: true, coins: null,
      som: t => sfx(t === 'bola' ? 'card' : t),
      apostar: apostas => chamaRef.current({ op: 'apostar', apostas }),
      onCoins: () => reloadProfile && reloadProfile(),
    });
    uiRef.current = ui;
    return () => { ui.destroy(); uiRef.current = null; };
  }, []); // eslint-disable-line

  // consulta o servidor a cada ~1 s
  useEffect(() => {
    let vivo = true, timer = null;
    async function puxa() {
      const t0 = Date.now();
      try {
        const s = await chamaRef.current({ op: 'estado' });
        if (!vivo) return;
        const t1 = Date.now(), novo = s.agora - (t0 + t1) / 2;
        off.current = Math.abs(novo - off.current) > 1500 ? novo : off.current + (novo - off.current) * .1;
        const agora = Date.now() + off.current, r = s.rodada, ui = uiRef.current;
        if (ui) {
          ui.setFase(r.fase, Math.max(0, Math.ceil((r.start - agora) / 1000)));
          ui.setHistorico(r.fase === 'resultado' ? [r.resultado, ...s.historico] : s.historico);
          if (s.coins != null) ui.setCoins(s.coins);
          const mk = JSON.stringify(s.minha?.apostas || {});
          if (r.fase === 'apostas' && mk !== minhaRef.current) { minhaRef.current = mk; ui.setMinha(s.minha); }
          if (r.fase !== 'apostas' && visto.current !== r.id) {
            visto.current = r.id; minhaRef.current = '';
            const ap = s.minha ? Number(s.minha.valor) : 0, volta = s.minha ? pagar(s.minha.apostas, r.resultado).volta : 0;
            ui.resultado(r.resultado, volta, ap, r.fase === 'girando' ? r.fim - agora : 0).then(() => reloadProfile && reloadProfile());
          }
        }
        setSt(s);
      } catch {}
      if (vivo) timer = setTimeout(puxa, 1000);
    }
    puxa();
    return () => { vivo = false; clearTimeout(timer); };
  }, [local]); // eslint-disable-line

  return (
    <div className="page lounge rlp">
      <div className="rlp-top">
        <div className="rlp-logo">ROLETA <b>AO VIVO</b></div>
        {st && <button className="rlv-gente" onClick={() => setLista(true)}>👥 {st.jogadores} · 💰 {fx(st.total)}</button>}
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/cassino')}>↩</button>
      </div>
      <div className="rlp-box" ref={boxRef} />
      {lista && st && <Modal onClose={() => setLista(false)}><h2>Apostas da rodada</h2>
        <div className="rows" style={{ textAlign: 'left', maxHeight: '55vh', overflow: 'auto' }}>
          {!st.apostas.length && <div className="empty">Ninguém apostou ainda nessa rodada</div>}
          {st.apostas.map((a, i) => <div key={i} className="rowi"><span className="av">{a.avatar}</span><div className="grow"><b>{a.nick}</b></div>
            <span className="num">💰 {fx(a.valor)}{a.status === 'ganhou' ? <b style={{ color: '#4ade80' }}> → {fx(a.ganho)}</b> : a.status === 'perdeu' ? <span style={{ color: '#f87171' }}> ✗</span> : null}</span></div>)}
        </div>
        <button className="go" onClick={() => setLista(false)}>Fechar</button></Modal>}
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Todo mundo joga a <b>mesma rodada ao vivo</b>. Você tem <b>{APOSTAS_MS / 1000} segundos</b> pra apostar; depois a roda gira por {GIRO_MS / 1000} s.</p>
          <p>• Escolha a ficha, <b>toque na mesa</b> e depois em <b>APOSTAR</b>. Dá pra apostar mais vezes na mesma rodada até fechar. As fichas confirmadas ficam com borda dourada.</p>
          <p>• <b>Número cheio</b> paga 35 pra 1 · <b>dúzia</b> e <b>coluna</b> pagam 2 pra 1 · <b>vermelho/preto, par/ímpar, 1-18/19-36</b> pagam 1 pra 1. Roleta europeia, um zero só.</p>
          <p>• Máximo de <b>{MAX_APOSTA} fichas</b> por rodada e prêmio máximo de <b>4 mil fichas</b>.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>{local ? '🧪 MODO TESTE · fichas de mentira · ' : ''}Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.rlp{overflow:hidden}
.rlp-top{display:flex;align-items:center;gap:8px;padding:6px 12px 2px}
.rlp-logo{font:700 clamp(20px,5vmin,30px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;margin-right:auto}
.rlp-logo b{color:#ef4444;font-size:.7em;margin-left:4px}
.rlp-top .rbtn{width:40px;height:40px;font-size:17px}
.rlv-gente{border:1.5px solid #8a6a2a;background:#000a;color:#f4ead2;border-radius:16px;padding:5px 10px;font:500 14px Oswald;cursor:pointer}
.rlp-box{flex:1;min-height:0;padding:4px 10px 8px}
`}</style>
    </div>
  );
}

'use client';
// DOUBLE ao vivo: todo mundo aposta na mesma rodada em vermelho (2x), preto (2x) ou branco (14x).
// O servidor sorteia e só mostra o resultado quando as apostas fecham (/api/double).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound } from '../../lib/sfx.js';
import { FAIXA, PAGA, CORES, APOSTAS_MS, GIRO_MS, MIN_APOSTA, MAX_APOSTA, corDe, fichas } from '../../lib/double.js';
import { criarTeste } from '../../lib/double-teste.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
let teste = null;
const NOME = { vermelho: 'Vermelho', branco: 'Branco', preto: 'Preto' };
const REP = 40, BASE = FAIXA.length * 20;          // faixa repetida; a roleta fica sempre perto do meio
const ease = p => 1 - Math.pow(1 - p, 4);

export default function Double() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/double', b);
  const [st, setSt] = useState(null);
  const [coins, setCoins] = useState(null);
  const [valor, setValor] = useState(10);
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, tick] = useState(0);
  const off = useRef(0), stRef = useRef(null), faixaRef = useRef(null), boxRef = useRef(null), busy = useRef(false);
  const pos = useRef({ idx: BASE, num: -1, de: BASE, para: BASE });

  useEffect(() => { setSom(soundOn()); try { const v = Number(localStorage.getItem('db_valor')); if (v >= MIN_APOSTA && v <= MAX_APOSTA) setValor(v); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('db_valor', valor); } catch {} }, [valor]);
  useEffect(() => { if (profile) setCoins(profile.coins || 0); }, [profile?.coins]); // eslint-disable-line
  const agora = () => Date.now() + off.current;
  const avisar = t => { setAviso(t); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(''), 2400); };

  // consulta o servidor a cada ~1 s
  useEffect(() => {
    if (!profile && !TESTE) return;
    let vivo = true, timer = null, faseAnt = null;
    async function puxa() {
      const t0 = Date.now();
      try {
        const s = await chama({ op: 'estado' });
        if (!vivo) return;
        const t1 = Date.now(), novo = s.agora - (t0 + t1) / 2;
        if (!stRef.current || Math.abs(novo - off.current) > 1500) off.current = novo; else off.current += (novo - off.current) * .1;
        const f = s.rodada.fase;
        if (f !== faseAnt) {
          if (f === 'girando') sfx('turn');
          if (f === 'resultado' && faseAnt === 'girando') {
            const ganhei = s.minhas.filter(m => m.status === 'ganhou').reduce((t, m) => t + m.ganho, 0);
            if (ganhei) { sfx('win'); avisar(`Você ganhou ${fichas(ganhei)} fichas!`); } else if (s.minhas.length) sfx('lose');
            reloadProfile && reloadProfile();
          }
          faseAnt = f;
        }
        if (s.coins != null && !busy.current) setCoins(s.coins);
        stRef.current = s; setSt(s);
      } catch (e) { if (vivo) avisar(e.message || 'Sem conexão'); }
      if (vivo) timer = setTimeout(puxa, 1000);
    }
    puxa();
    return () => { vivo = false; clearTimeout(timer); };
  }, [local, !!profile]); // eslint-disable-line

  // animação da faixa e do relógio
  useEffect(() => {
    let raf, alive = true, ult = 0;
    function frame() {
      if (!alive) return; raf = requestAnimationFrame(frame);
      const s = stRef.current, el = faixaRef.current, box = boxRef.current; if (!s || !el || !box) return;
      const r = s.rodada, now = agora(), P = pos.current;
      if (r.num !== P.num && r.resultado != null) {      // rodada nova com resultado: prepara o giro a partir de onde parou
        const ini = BASE + (P.idx % FAIXA.length);
        P.de = ini; P.para = BASE + FAIXA.length * 3 + FAIXA.indexOf(r.resultado) + (FAIXA.indexOf(r.resultado) < (ini - BASE) ? FAIXA.length : 0); P.num = r.num;
      }
      let idx = P.idx;
      if (r.fase === 'girando' && P.num === r.num) idx = P.de + (P.para - P.de) * ease(Math.min(1, (now - r.start) / GIRO_MS));
      else if (r.fase === 'resultado' && P.num === r.num) idx = P.para;
      else if (r.fase === 'apostas') idx = BASE + (P.idx % FAIXA.length);
      P.idx = idx;
      const T = el.firstChild ? el.firstChild.offsetWidth + 6 : 70;
      el.style.transform = `translateX(${box.clientWidth / 2 - (idx + .5) * T}px)`;
      if (now - ult > 200) { ult = now; tick(x => x + 1); }
    }
    frame();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line

  async function apostar(cor) {
    if (busy.current) return;
    const s = stRef.current;
    if (!s || s.rodada.fase !== 'apostas') return avisar('Espere a próxima rodada');
    if (coins != null && coins < valor) return avisar('Fichas insuficientes. Compre na Loja');
    busy.current = true; sfx('coin');
    setCoins(c => c == null ? c : Math.round((c - valor) * 100) / 100);
    try {
      const r = await chama({ op: 'apostar', cor, valor });
      if (r.coins != null) setCoins(r.coins);
      const n = await chama({ op: 'estado' }); stRef.current = n; setSt(n);
      reloadProfile && reloadProfile();
    } catch (e) { sfx('err'); avisar(e.message || 'Erro'); const n = await chama({ op: 'estado' }).catch(() => null); if (n) { setCoins(n.coins); stRef.current = n; setSt(n); } }
    busy.current = false;
  }

  const r = st?.rodada, fase = r?.fase, now = agora();
  const falta = r && fase === 'apostas' ? Math.max(0, r.start - now) : 0;
  const corRes = r?.resultado != null && fase === 'resultado' ? corDe(r.resultado) : null;
  const minha = c => (st?.minhas || []).find(m => m.cor === c);
  return (
    <div className="page lounge dbp">
      <div className="db-top">
        <div className="db-logo">🔴 DOUBLE</div>
        <span className="db-saldo">💰 <b>{coins == null ? '–' : fichas(coins)}</b></span>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/cassino')}>↩</button>
      </div>
      <div className="db-hist"><small>Últimos</small>{(st?.historico || []).map((n, i) => <i key={i} className={'db-t ' + corDe(n)}>{n === 0 ? '◆' : n}</i>)}</div>
      <div className="db-roleta" ref={boxRef}>
        <div className="db-faixa" ref={faixaRef}>{Array.from({ length: FAIXA.length * REP }, (_, i) => { const n = FAIXA[i % FAIXA.length]; return <div key={i} className={'db-casa ' + corDe(n)}>{n === 0 ? <span className="db-diam">◆</span> : n}</div>; })}</div>
        <div className="db-seta" />
        {fase === 'apostas' && <div className="db-msg"><b>Girando em {(falta / 1000).toFixed(1).replace('.', ',')}s</b><div className="db-bar"><i style={{ width: `${Math.min(100, falta / APOSTAS_MS * 100)}%` }} /></div></div>}
        {corRes && <div className={'db-msg res ' + corRes}><b>Deu {NOME[corRes]} {r.resultado === 0 ? '◆' : r.resultado}!</b></div>}
        {!st && <div className="db-msg"><b>Conectando…</b></div>}
        {aviso && <div className="db-aviso">{aviso}</div>}
      </div>
      <div className="db-main">
        <div className="db-valor">
          <div className="db-row">
            <button onClick={() => setValor(v => Math.max(MIN_APOSTA, Math.floor(v / 2)))}>½</button>
            <input inputMode="numeric" value={valor} onChange={e => setValor(Math.max(0, Math.min(MAX_APOSTA, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0))))} onBlur={() => setValor(v => Math.max(MIN_APOSTA, v))} />
            <button onClick={() => setValor(v => Math.min(MAX_APOSTA, v * 2))}>2x</button>
          </div>
          <div className="db-q">{[5, 10, 50, 100].map(v => <button key={v} className={valor === v ? 'on' : ''} onClick={() => setValor(v)}>{v}</button>)}</div>
        </div>
        {CORES.map(c => {
          const t = st?.totais?.[c], m = minha(c), lista = (st?.apostas || []).filter(a => a.cor === c);
          return <div key={c} className={'db-col ' + c + (corRes === c ? ' ganhou' : corRes ? ' perdeu' : '')}>
            <button className={'db-ap ' + c} disabled={fase !== 'apostas'} onClick={() => apostar(c)}>
              <span>{NOME[c]}</span><b>{PAGA[c]}x</b>{m && <small>sua aposta: {fichas(m.valor)}</small>}
            </button>
            <div className="db-tot"><span>👥 {t?.qtd || 0}</span><span>💰 {fichas(t?.soma || 0)}</span></div>
            <div className="db-lista">{lista.slice(0, 30).map((a, i) => <div key={i} className={a.status}><span>{a.avatar} {a.nick}</span><b>{a.status === 'ganhou' ? '+' + fichas(a.ganho) : fichas(a.valor)}</b></div>)}</div>
          </div>;
        })}
      </div>
      <div className="db-rod">{TESTE && local ? '🧪 MODO TESTE · fichas de mentira · ' : ''}Proibido para menores de 18 anos · Fichas sem valor em dinheiro · Jogue por diversão</div>
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• A roleta tem 15 casas: <b>7 vermelhas</b>, <b>7 pretas</b> e <b>1 branca</b>.</p>
          <p>• Antes de girar, escolha o valor e toque na cor. Vermelho e preto pagam <b>2x</b>; o branco paga <b>14x</b>. Dá pra apostar em mais de uma cor e tocar de novo pra aumentar.</p>
          <p>• Todos jogam a mesma rodada ao vivo. Aposta de {MIN_APOSTA} a {MAX_APOSTA} fichas em cada cor.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.dbp{overflow:hidden;background:radial-gradient(ellipse at 50% 20%,#2a1020,#0b0710 70%)}
.db-top{display:flex;align-items:center;gap:8px;padding:6px 10px 2px}
.db-logo{font:700 clamp(18px,4.6vmin,28px) Oswald;color:#f43f5e;font-style:italic;letter-spacing:1px;margin-right:auto;white-space:nowrap}
.db-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #f43f5e88;border-radius:20px;padding:3px 10px}
.db-top .rbtn{width:38px;height:38px;font-size:16px}
.db-hist{display:flex;align-items:center;gap:4px;padding:2px 10px;overflow:hidden;white-space:nowrap}
.db-hist small{font:500 11px Rubik;color:#94a3b8;margin-right:4px}
.db-t{flex:none;width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font:700 11px Rubik;font-style:normal}
.db-t.vermelho,.db-casa.vermelho{background:linear-gradient(180deg,#f43f5e,#b91c1c);color:#fff}
.db-t.preto,.db-casa.preto{background:linear-gradient(180deg,#334155,#0f172a);color:#fff}
.db-t.branco,.db-casa.branco{background:linear-gradient(180deg,#fff,#e2e8f0);color:#e11d48}
.db-roleta{position:relative;height:clamp(78px,22vh,120px);margin:4px 10px;border-radius:16px;overflow:hidden;background:#0008;border:2px solid #f43f5e55;box-shadow:inset 0 0 24px #000}
.db-faixa{position:absolute;left:0;top:50%;margin-top:calc(clamp(56px,15vh,84px) / -2);display:flex;gap:6px;will-change:transform}
.db-casa{flex:none;width:clamp(56px,15vh,84px);height:clamp(56px,15vh,84px);border-radius:12px;display:grid;place-items:center;font:700 clamp(18px,5vh,28px) Oswald;box-shadow:0 3px 0 #0008}
.db-diam{font-size:1.2em;color:#e11d48}
.db-seta{position:absolute;left:50%;top:0;bottom:0;width:4px;margin-left:-2px;background:#facc15;box-shadow:0 0 10px #facc15;z-index:2}
.db-seta::before{content:'';position:absolute;left:50%;top:0;transform:translateX(-50%);border:9px solid transparent;border-top-color:#facc15}
.db-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#000a;z-index:3;color:#fff}
.db-msg b{font:700 clamp(18px,4.5vh,26px) Oswald;letter-spacing:.5px}
.db-msg.res{background:#0006}.db-msg.res.vermelho b{color:#fda4af}.db-msg.res.branco b{color:#fff}.db-msg.res.preto b{color:#cbd5e1}
.db-bar{width:min(320px,60%);height:7px;border-radius:4px;background:#334155;overflow:hidden}
.db-bar i{display:block;height:100%;background:#f43f5e}
.db-aviso{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#000d;color:#fff;font:600 15px Rubik;padding:8px 14px;border-radius:12px;border:1.5px solid #facc15;z-index:4;white-space:nowrap}
.db-main{flex:1;min-height:0;display:grid;grid-template-columns:clamp(150px,22vw,220px) repeat(3,minmax(0,1fr));gap:8px;padding:0 10px 4px}
.db-valor{display:flex;flex-direction:column;gap:5px;background:#120a14cc;border:1.5px solid #f43f5e44;border-radius:14px;padding:8px}
.db-row{display:flex;gap:4px}
.db-row button{flex:none;width:38px;height:36px;border-radius:10px;border:none;background:#1e293b;color:#fff;font:700 15px Rubik}
.db-row input{flex:1;min-width:0;height:36px;border-radius:10px;border:1.5px solid #334155;background:#020617;color:#fff;text-align:center;font:700 19px Oswald}
.db-q{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.db-q button{height:30px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;font:600 13px Rubik}
.db-q button.on{background:#e11d48;color:#fff;border-color:#fda4af}
.db-col{display:flex;flex-direction:column;gap:4px;min-height:0;border-radius:14px;padding:5px;background:#0006;border:2px solid transparent;transition:border-color .2s,opacity .2s}
.db-col.ganhou{border-color:#facc15;box-shadow:0 0 14px #facc1566}.db-col.perdeu{opacity:.55}
.db-ap{border:none;border-radius:12px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;line-height:1.05;box-shadow:0 4px 0 #0009;color:#fff}
.db-ap span{font:600 14px Rubik}.db-ap b{font:700 22px Oswald}.db-ap small{font:500 11px Rubik;opacity:.9}
.db-ap.vermelho{background:linear-gradient(180deg,#f43f5e,#b91c1c)}.db-ap.preto{background:linear-gradient(180deg,#475569,#0f172a)}.db-ap.branco{background:linear-gradient(180deg,#fff,#e2e8f0);color:#9f1239}
.db-ap:disabled{filter:grayscale(.4) brightness(.8)}
.db-ap:not(:disabled):active{transform:translateY(3px);box-shadow:0 1px 0 #0009}
.db-tot{display:flex;justify-content:space-between;font:500 12px Rubik;color:#cbd5e1;padding:0 4px}
.db-lista{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:2px}
.db-lista div{display:flex;justify-content:space-between;gap:6px;font:400 12px Rubik;color:#e2e8f0;background:#ffffff0a;border-radius:6px;padding:2px 6px}
.db-lista span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-lista .ganhou b{color:#86efac}.db-lista .perdeu{opacity:.5}
.db-rod{text-align:center;font:400 10px Rubik;color:#64748b;padding:2px 0 4px}
@media (orientation:portrait){.db-main{grid-template-columns:repeat(3,minmax(0,1fr))}.db-valor{grid-column:1/-1}}
`}</style>
    </div>
  );
}

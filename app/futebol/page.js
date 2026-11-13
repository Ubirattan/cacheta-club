'use client';
// FUTEBOL: apostas nos jogos de verdade (Brasileirão, Copa do Brasil, Libertadores, Champions…)
// com as odds da API-Football. Bilhete simples ou múltiplo. O servidor confere tudo (/api/futebol).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx } from '../../lib/sfx.js';
import { MIN_APOSTA, MAX_APOSTA, MAX_SELECOES, MAX_PREMIO, MERCADOS, rotulo, curto, oddTotal, premioDe, fichas } from '../../lib/futebol.js';
import { criarTeste } from '../../lib/futebol-teste.js';

const TESTE = typeof window !== 'undefined' && /^deploy-preview-\d+--/.test(window.location.hostname);
let teste = null;

const TZ = { timeZone: 'America/Sao_Paulo' };
const hora = t => new Date(t).toLocaleTimeString('pt-BR', { ...TZ, hour: '2-digit', minute: '2-digit' });
const diaDe = t => new Date(t).toLocaleDateString('en-CA', TZ);
function nomeDia(t) {
  const d = diaDe(t), hoje = diaDe(Date.now()), am = diaDe(Date.now() + 864e5);
  if (d === hoje) return 'Hoje';
  if (d === am) return 'Amanhã';
  const s = new Date(t).toLocaleDateString('pt-BR', { ...TZ, weekday: 'long', day: '2-digit', month: '2-digit' });
  return s[0].toUpperCase() + s.slice(1);
}
const f2 = n => Number(n).toFixed(2).replace('.', ',');
const ST = { aberta: ['Em aberto', '#fbbf24'], ganhou: ['Ganhou', '#4ade80'], perdeu: ['Perdeu', '#f87171'], devolvida: ['Devolvida', '#93c5fd'], cashout: ['Cash out', '#c084fc'] };
const FIMS = ['FT', 'AET', 'PEN'], VIVO = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];
function quando(s) {
  if (VIVO.includes(s.jogoStatus)) return s.jogoStatus === 'HT' ? 'intervalo' : s.minuto ? `${s.minuto}'` : 'ao vivo';
  if (FIMS.includes(s.jogoStatus) || (s.placar && !s.jogoStatus)) return 'encerrado';
  return `${nomeDia(s.inicio)} ${hora(s.inicio)}`;
}
const SEL_ST = { ganhou: '✅', perdeu: '❌', anulada: '↩️' };

function Escudo({ src, nome }) {
  const [ok, setOk] = useState(true);
  if (src && ok) return <img className="fb-esc" src={src} alt="" onError={() => setOk(false)} />;
  return <span className="fb-esc fb-esc-l">{(nome || '?')[0]}</span>;
}

export default function Futebol() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: !TESTE });
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/futebol', b);
  const [maior, setMaior] = useState(true);   // +18 confirmado no cadastro
  const [aba, setAba] = useState('jogos');
  const [st, setSt] = useState(null);
  const [falha, setFalha] = useState('');
  const [minhas, setMinhas] = useState(null);
  const [liga, setLiga] = useState(0);
  const [aberto, setAberto] = useState(null);           // jogo com os outros mercados à mostra
  const [bil, setBil] = useState([]);                   // [{ jogo, mercado, escolha, odd }]
  const [valor, setValor] = useState(10);
  const [coins, setCoins] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [regras, setRegras] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirma, setConfirma] = useState(null);       // id da aposta esperando o 2º toque do cash out
  const [encerrando, setEncerrando] = useState(false);
  const [bilAberto, setBilAberto] = useState(false);   // celular em pé: bilhete por cima
  const stRef = useRef(null);

  useEffect(() => { try { setMaior(true); } catch { setMaior(false); } }, []);
  useEffect(() => { if (profile) setCoins(Number(profile.coins) || 0); }, [profile?.coins]); // eslint-disable-line
  const avisar = (t, bom = false) => { setAviso({ t, bom }); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(null), 2800); };

  async function carregar() {
    try {
      const s = await Promise.race([chama({ op: 'jogos' }), new Promise((_, r) => setTimeout(() => r(new Error('demorou demais')), 15000))]);
      stRef.current = s; setSt(s); setFalha('');
      if (s.coins != null) setCoins(s.coins);
      // atualiza as odds do bilhete e tira jogo que já começou
      setBil(b => b.map(x => { const j = s.jogos.find(j => j.id === x.jogo); const o = j?.odds?.[x.mercado]?.[x.escolha]; return j && o ? { ...x, odd: o } : null; }).filter(Boolean));
      return s;
    } catch (e) { if (!stRef.current) setFalha(e.message || 'Sem conexão'); else avisar(e.message || 'Sem conexão'); }
  }
  async function cashout(a) {
    setEncerrando(true);
    try {
      const r = await chama({ op: 'cashout', id: a.id, valor: a.cashout });
      sfx('win'); avisar(`Cash out feito: +${fichas(r.ganho)} fichas`, true);
      if (r.coins != null) setCoins(r.coins);
      reloadProfile && reloadProfile();
    } catch (e) { sfx('err'); avisar(e.message || 'Erro'); }
    setConfirma(null); setEncerrando(false); carregarMinhas();
  }
  async function carregarMinhas() {
    try { const m = await chama({ op: 'minhas' }); setMinhas(m.apostas); if (m.coins != null) setCoins(m.coins); } catch (e) { avisar(e.message || 'Sem conexão'); }
  }
  // pede pro servidor buscar novidades na API sem travar a tela; se mudou algo, recarrega
  const abaRef = useRef(aba); abaRef.current = aba;
  async function atualizar() {
    if (local) return;
    try { const r = await chama({ op: 'atualizar' }); if (r.mudou) { carregar(); if (abaRef.current === 'minhas') carregarMinhas(); } } catch {}
  }
  useEffect(() => {
    if (!maior || (!profile && !TESTE)) return;
    carregar(); atualizar();
    const t = setInterval(() => { carregar(); atualizar(); if (abaRef.current === 'minhas') carregarMinhas(); }, 60000);
    return () => clearInterval(t);
  }, [maior, local, !!profile]); // eslint-disable-line
  useEffect(() => {
    if (aba !== 'minhas' || !maior) return;
    carregarMinhas();
    const t = setInterval(() => { atualizar(); carregarMinhas(); }, 20000);   // placar ao vivo e valor do cash out
    return () => clearInterval(t);
  }, [aba, maior]); // eslint-disable-line
  useEffect(() => { if (!confirma) return; const t = setTimeout(() => setConfirma(null), 5000); return () => clearTimeout(t); }, [confirma]);

  const jogos = st?.jogos || [];
  const ligas = useMemo(() => { const m = new Map(); jogos.forEach(j => m.has(j.liga) || m.set(j.liga, j.ligaNome)); return [...m]; }, [jogos]);
  const lista = liga ? jogos.filter(j => j.liga === liga) : jogos;
  const dias = useMemo(() => { const g = []; for (const j of lista) { const n = nomeDia(j.inicio); const ult = g[g.length - 1]; if (ult && ult.n === n) ult.js.push(j); else g.push({ n, js: [j] }); } return g; }, [lista]);

  const naBil = (jogo, m, e) => bil.some(x => x.jogo === jogo && x.mercado === m && x.escolha === e);
  function escolher(j, m, e) {
    const odd = j.odds?.[m]?.[e]; if (!odd) return;
    sfx('tick');
    setBil(b => {
      if (b.some(x => x.jogo === j.id && x.mercado === m && x.escolha === e)) return b.filter(x => x.jogo !== j.id);
      const sem = b.filter(x => x.jogo !== j.id);
      if (sem.length >= MAX_SELECOES) { avisar(`No máximo ${MAX_SELECOES} jogos por bilhete`); return b; }
      return [...sem, { jogo: j.id, mercado: m, escolha: e, odd }];
    });
  }
  const odd = bil.length ? oddTotal(bil.map(x => x.odd)) : 0;
  const premio = bil.length ? premioDe(valor, odd) : 0;

  async function apostar() {
    if (enviando || !bil.length) return;
    if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) return avisar(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
    setEnviando(true);
    try {
      const r = await chama({ op: 'apostar', valor, selecoes: bil });
      sfx('coin'); if (r.coins != null) setCoins(r.coins);
      avisar(`Aposta feita! Prêmio possível: ${fichas(r.premio)} fichas`, true);
      setBil([]); setBilAberto(false);
      reloadProfile && reloadProfile();
      carregar();
    } catch (e) {
      sfx('err'); avisar(e.message || 'Erro');
      if (/odds mudaram|começou|saiu de/.test(e.message || '')) carregar();
    }
    setEnviando(false);
  }

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>⚽ FUTEBOL</h2>
      <p>Apostas só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('fb_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/')}>Voltar</button>
    </div></div></div>
  );

  const J = Object.fromEntries(jogos.map(j => [j.id, j]));
  const bilhete = (
    <div className={'fb-bil' + (bilAberto ? ' aberto' : '')}>
      <div className="fb-bt"><b>🎟️ Bilhete</b><span>{!bil.length ? '' : bil.length === 1 ? 'Simples' : `Múltipla de ${bil.length}`}</span>
        {bil.length > 0 && <button className="fb-limpa" onClick={() => setBil([])}>Limpar</button>}
        <button className="fb-fecha" onClick={() => setBilAberto(false)}>✕</button></div>
      <div className="fb-sels">
        {!bil.length && <div className="fb-vazio">Toque nas odds dos jogos pra montar seu bilhete. Escolha vários jogos pra fazer uma múltipla: as odds se multiplicam.</div>}
        {bil.map(x => { const j = J[x.jogo]; if (!j) return null; return (
          <div className="fb-sel" key={x.jogo}>
            <div><small>{j.casa} x {j.fora}</small><b>{rotulo(x.mercado, x.escolha, j.casa, j.fora)}</b><small>{MERCADOS[x.mercado].nome}</small></div>
            <span className="fb-so">{f2(x.odd)}</span>
            <button onClick={() => setBil(b => b.filter(y => y.jogo !== x.jogo))}>✕</button>
          </div>); })}
      </div>
      {bil.length > 0 && <div className="fb-fim">
        <div className="fb-lin"><span>Odd total</span><b>{f2(odd)}</b></div>
        <div className="fb-val">
          <button onClick={() => setValor(v => Math.max(MIN_APOSTA, v - (v > 50 ? 10 : 5)))}>−</button>
          <input inputMode="numeric" value={valor} onChange={e => setValor(Math.min(MAX_APOSTA, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0)))} onBlur={() => setValor(v => Math.max(MIN_APOSTA, v))} />
          <button onClick={() => setValor(v => Math.min(MAX_APOSTA, v + (v >= 50 ? 10 : 5)))}>+</button>
        </div>
        <div className="fb-q">{[5, 10, 50, 100, 500, 1000].map(v => <button key={v} className={valor === v ? 'on' : ''} onClick={() => setValor(v)}>{v}</button>)}</div>
        <div className="fb-lin"><span>Prêmio possível</span><b className="fb-pr">{fichas(premio)}{premio >= MAX_PREMIO ? ' (máx.)' : ''}</b></div>
        <button className="fb-apostar" disabled={enviando} onClick={apostar}>{enviando ? 'Enviando…' : `APOSTAR ${valor} FICHAS`}</button>
      </div>}
    </div>
  );

  return (
    <div className="page lounge fbp">
      <div className="fb-top">
        <div className="fb-logo">⚽ FUTEBOL</div>
        <div className="fb-abas">
          <button className={aba === 'jogos' ? 'on' : ''} onClick={() => setAba('jogos')}>Jogos</button>
          <button className={aba === 'minhas' ? 'on' : ''} onClick={() => setAba('minhas')}>Minhas apostas{st?.abertas ? <i>{st.abertas}</i> : null}</button>
        </div>
        <span className="fb-saldo">💰 <b>{coins == null ? '–' : fichas(coins)}</b></span>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Comprar fichas" onClick={() => router.push('/loja#comprar')}>💰</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/')}>↩</button>
      </div>
      {st?.admin && (st.admin.erro || !st.admin.chave) && <div className="fb-adm">🛠 {!st.admin.chave ? 'Falta cadastrar APIFOOTBALL_KEY no Netlify.' : `Erro da API (${st.admin.erro.passo}): ${st.admin.erro.msg}`} · chamadas hoje: {st.admin.chamadasHoje}/{st.admin.limite}</div>}
      {aviso && <div className={'fb-aviso' + (aviso.bom ? ' bom' : '')}>{aviso.t}</div>}

      {aba === 'jogos' ? <div className="fb-main">
        <div className="fb-esq">
          <div className="fb-ligas">
            <button className={!liga ? 'on' : ''} onClick={() => setLiga(0)}>Todos</button>
            {ligas.map(([id, n]) => <button key={id} className={liga === id ? 'on' : ''} onClick={() => setLiga(id)}>{n}</button>)}
          </div>
          <div className="fb-lista">
            {!st && !falha && <div className="fb-vazio">Carregando os jogos…</div>}
            {!st && falha && <div className="fb-vazio">Não deu pra carregar os jogos ({falha}).<br /><button className="fb-tenta" onClick={() => { setFalha(''); carregar(); }}>Tentar de novo</button></div>}
            {st && !lista.length && <div className="fb-vazio">Nenhum jogo com odds agora. Os jogos dos próximos dias aparecem aqui assim que as casas abrem as odds.{st.admin && ' (admin: veja o aviso acima)'}</div>}
            {dias.map(d => <div key={d.n}>
              <div className="fb-dia">{d.n}</div>
              {d.js.map(j => (
                <div className="fb-jogo" key={j.id}>
                  <div className="fb-info">
                    <small>{hora(j.inicio)} · {j.ligaNome}</small>
                    <div className="fb-time"><Escudo src={j.casaLogo} nome={j.casa} /><span>{j.casa}</span></div>
                    <div className="fb-time"><Escudo src={j.foraLogo} nome={j.fora} /><span>{j.fora}</span></div>
                  </div>
                  <div className="fb-odds">
                    {['1', 'X', '2'].map(e => <button key={e} className={naBil(j.id, '1x2', e) ? 'on' : ''} onClick={() => escolher(j, '1x2', e)}><small>{e}</small>{f2(j.odds['1x2'][e])}</button>)}
                    {Object.keys(j.odds).length > 1 && <button className={'fb-mais' + (aberto === j.id ? ' on' : '')} onClick={() => setAberto(aberto === j.id ? null : j.id)}>{aberto === j.id ? '−' : '+' + (Object.keys(j.odds).length - 1)}</button>}
                  </div>
                  {aberto === j.id && <div className="fb-extra">
                    {Object.keys(MERCADOS).filter(m => m !== '1x2' && j.odds[m]).map(m => <div key={m} className="fb-merc">
                      <span>{MERCADOS[m].nome}</span>
                      <div>{MERCADOS[m].ops.map(e => <button key={e} className={naBil(j.id, m, e) ? 'on' : ''} onClick={() => escolher(j, m, e)}><small>{curto(e)}</small>{f2(j.odds[m][e])}</button>)}</div>
                    </div>)}
                  </div>}
                </div>
              ))}
            </div>)}
          </div>
        </div>
        {bilhete}
        {bil.length > 0 && !bilAberto && <button className="fb-flut" onClick={() => setBilAberto(true)}>🎟️ {bil.length} · odd {f2(odd)}</button>}
      </div> : <div className="fb-minhas">
        {!minhas && <div className="fb-vazio">Carregando…</div>}
        {minhas && !minhas.length && <div className="fb-vazio">Você ainda não fez nenhuma aposta no futebol.</div>}
        {(minhas || []).map(a => (
          <div className="fb-ap" key={a.id} style={{ '--c': ST[a.status][1] }}>
            <div className="fb-ap-t">
              <b>{a.selecoes.length === 1 ? 'Simples' : `Múltipla de ${a.selecoes.length}`}</b>
              <span>{new Date(a.em).toLocaleString('pt-BR', { ...TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <em>{ST[a.status][0]}</em>
            </div>
            {a.selecoes.map((s, i) => (
              <div className="fb-ap-s" key={i}>
                <span className="fb-ap-ic">{SEL_ST[s.status] || (VIVO.includes(s.jogoStatus) ? '⚽' : '🕒')}</span>
                <div><small>{s.casa} {s.placar ? <b>{s.placar[0]} x {s.placar[1]}</b> : 'x'} {s.fora} · <span className={VIVO.includes(s.jogoStatus) ? 'fb-vivo' : ''}>{quando(s)}</span></small>
                  <b>{rotulo(s.mercado, s.escolha, s.casa, s.fora)}{s.antecipado && <i className="fb-ant">💰 pago antecipado</i>}</b></div>
                <span className="fb-so">{f2(s.odd)}</span>
              </div>))}
            <div className="fb-ap-r"><span>Aposta <b>{a.valor}</b></span><span>Odd <b>{f2(a.odd)}</b></span>
              <span>{a.status === 'aberta' ? 'Prêmio possível' : a.status === 'perdeu' ? 'Prêmio' : 'Recebeu'} <b className="fb-pr">{fichas(a.status === 'aberta' ? a.premio : a.ganho)}</b></span></div>
            {a.status === 'aberta' && a.cashout != null && <button className={'fb-co' + (confirma === a.id ? ' sim' : '')} disabled={encerrando}
              onClick={() => confirma === a.id ? cashout(a) : setConfirma(a.id)}>
              {confirma === a.id ? `Confirmar cash out de ${f2(a.cashout)} fichas?` : `💸 Cash out ${f2(a.cashout)}`}</button>}
          </div>
        ))}
      </div>}

      {regras && <Modal onClose={() => setRegras(false)}><h2>Como apostar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Toque numa odd pra colocar o palpite no bilhete. <b>1</b> = vitória do time da casa, <b>X</b> = empate, <b>2</b> = vitória do visitante. No <b>+</b> tem dupla chance, total de gols (mais ou menos de 2,5) e ambos marcam.</p>
          <p>• <b>Simples</b>: um jogo só. <b>Múltipla</b>: até {MAX_SELECOES} jogos no mesmo bilhete, um palpite por jogo. As odds se multiplicam, mas precisa acertar todos.</p>
          <p>• Prêmio = aposta × odd total. Aposta de {MIN_APOSTA} a {MAX_APOSTA} fichas. Prêmio máximo de {fichas(MAX_PREMIO)} fichas por bilhete.</p>
          <p>• Vale o resultado dos <b>90 minutos</b> (com acréscimos). Prorrogação e pênaltis não contam.</p>
          <p>• Jogo cancelado ou adiado por mais de 2 dias é anulado: na simples a aposta volta, na múltipla aquele jogo conta como odd 1.</p>
          <p>• As apostas fecham 1 minuto antes do jogo começar. O resultado é conferido sozinho e o prêmio cai no seu saldo.</p>
          <p>• <b>Pagamento antecipado:</b> apostou na vitória de um time (1 ou 2) e ele abriu <b>2 gols de vantagem</b> no tempo normal? O palpite já conta como ganho, mesmo que o outro time reaja. Na simples o prêmio cai na hora.</p>
          <p>• <b>Cash out:</b> em Minhas apostas dá pra encerrar o bilhete antes do fim e receber o valor mostrado na hora. O valor muda com o placar e o tempo de jogo.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Jogos e odds: API-Football. Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.fbp{overflow:hidden!important;height:100dvh;background:radial-gradient(ellipse at 50% -20%,#14532d,#052e16 55%,#03170b)}
.fb-top{display:flex;align-items:center;gap:8px;padding:6px 10px 4px}
.fb-logo{font:700 clamp(18px,4.6vmin,28px) Oswald;color:#4ade80;font-style:italic;letter-spacing:1px;white-space:nowrap}
.fb-abas{display:flex;background:#0008;border-radius:20px;padding:3px;margin-right:auto;margin-left:6px}
.fb-abas button{position:relative;border:none;background:none;color:#a7c4b0;font:500 14px Rubik;padding:5px 14px;border-radius:17px;white-space:nowrap}
.fb-abas button.on{background:#16a34a;color:#fff}
.fb-abas i{font-style:normal;background:#fbbf24;color:#000;border-radius:9px;font:700 11px Rubik;padding:0 5px;margin-left:5px}
.fb-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #4ade8088;border-radius:20px;padding:3px 10px;white-space:nowrap}
.fb-top .rbtn{width:36px;height:36px;font-size:15px}
.fb-adm{margin:0 10px 4px;padding:5px 10px;border-radius:10px;background:#7f1d1d;color:#fecaca;font:500 12px Rubik}
.fb-aviso{position:fixed;left:50%;top:54px;transform:translateX(-50%);z-index:30;background:#000d;border:1px solid #f87171;border-radius:14px;padding:7px 14px;font:500 14px Rubik;color:#fff;max-width:90vw;text-align:center}
.fb-aviso.bom{border-color:#4ade80}
.fb-main{flex:1;min-height:0;display:flex;gap:8px;padding:0 8px 8px}
.fb-esq{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.fb-ligas{display:flex;gap:6px;overflow-x:auto;flex:none;scrollbar-width:none}
.fb-ligas::-webkit-scrollbar{display:none}
.fb-ligas button{flex:none;border:1px solid #ffffff22;background:#0007;color:#d1fae5;font:500 13px Rubik;border-radius:16px;padding:5px 12px}
.fb-ligas button.on{background:#fbbf24;color:#1a1300;border-color:#fbbf24}
.fb-lista{flex:1;min-height:0;overflow-y:auto;padding-right:2px}
.fb-dia{font:600 13px Oswald;letter-spacing:.5px;color:#fbbf24;text-transform:uppercase;padding:6px 4px 4px}
.fb-jogo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#0b2416e6;border:1px solid #ffffff14;border-radius:14px;padding:8px 10px;margin-bottom:6px}
.fb-info{flex:1;min-width:120px;display:flex;flex-direction:column;gap:3px}
.fb-info small{font:400 11px Rubik;color:#86b39a}
.fb-time{display:flex;align-items:center;gap:6px;font:500 14px Rubik;color:#fff;min-width:0}
.fb-time span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-esc{width:20px;height:20px;object-fit:contain;flex:none}
.fb-esc-l{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#ffffff22;font:700 11px Rubik;color:#fff}
.fb-odds{display:flex;gap:5px}
.fb-odds button,.fb-merc button{width:58px;border:1px solid #ffffff22;background:#14321f;color:#fff;font:600 15px Oswald;border-radius:10px;padding:4px 0;display:flex;flex-direction:column;align-items:center;line-height:1.1}
.fb-odds button small,.fb-merc button small{font:500 10px Rubik;color:#86b39a}
.fb-odds button.on,.fb-merc button.on{background:#fbbf24;color:#1a1300;border-color:#fde68a}
.fb-odds button.on small,.fb-merc button.on small{color:#4a3500}
.fb-odds .fb-mais{width:38px;justify-content:center;font:600 14px Rubik;color:#a7f3d0}
.fb-extra{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px 16px;border-top:1px dashed #ffffff22;padding-top:7px}
.fb-merc{display:flex;flex-direction:column;gap:4px}
.fb-merc>span{font:500 12px Rubik;color:#a7c4b0}
.fb-merc>div{display:flex;gap:5px}
.fb-bil{flex:0 0 min(34%,330px);min-height:0;display:flex;flex-direction:column;background:#0b1f14;border:1px solid #4ade8044;border-radius:16px;overflow:hidden}
.fb-bt{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#14532d;font:500 14px Rubik;color:#d1fae5}
.fb-bt span{margin-right:auto;font-size:12px;color:#a7f3d0}
.fb-limpa{border:none;background:#0006;color:#fecaca;border-radius:10px;font:500 12px Rubik;padding:3px 8px}
.fb-fecha{display:none;border:none;background:none;color:#fff;font-size:18px}
.fb-sels{flex:1;min-height:40px;overflow-y:auto;padding:6px}
.fb-sel{display:flex;align-items:center;gap:6px;background:#ffffff0d;border-radius:10px;padding:6px 8px;margin-bottom:5px}
.fb-sel>div{flex:1;min-width:0;display:flex;flex-direction:column}
.fb-sel small{font:400 11px Rubik;color:#86b39a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-sel b{font:500 13px Rubik;color:#fff}
.fb-so{font:600 15px Oswald;color:#fbbf24}
.fb-sel button{border:none;background:none;color:#f87171;font-size:15px;padding:2px}
.fb-fim{flex:none;padding:8px 10px 10px;border-top:1px solid #ffffff1a;display:flex;flex-direction:column;gap:6px}
.fb-lin{display:flex;justify-content:space-between;align-items:center;font:400 13px Rubik;color:#a7c4b0}
.fb-lin b{font:600 17px Oswald;color:#fff}
.fb-pr{color:#4ade80!important}
.fb-val{display:flex;align-items:center;gap:6px;background:#0008;border-radius:20px;padding:3px}
.fb-val button{width:32px;height:32px;flex:none;border-radius:50%;border:none;background:#14532d;color:#fff;font-size:19px}
.fb-val input{flex:1;min-width:0;text-align:center;background:none;border:none;color:#fff;font:700 19px Oswald;height:32px}
.fb-q{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
.fb-q button{border:none;border-radius:10px;background:#0008;color:#d1fae5;font:500 12px Rubik;padding:5px 0}
.fb-q button.on{background:#16a34a;color:#fff}
.fb-apostar{border:2px solid #ffffff40;border-radius:16px;background:linear-gradient(180deg,#2bb514,#1c8a0a);color:#fff;font:700 17px Rubik;padding:10px 4px;box-shadow:0 4px 0 #0007}
.fb-apostar:active{transform:translateY(3px);box-shadow:0 1px 0 #0007}
.fb-apostar:disabled{opacity:.6}
.fb-vazio{font:400 13px Rubik;color:#86b39a;text-align:center;padding:16px 10px;line-height:1.4}
.fb-flut{display:none}
.fb-tenta{margin-top:10px;border:none;border-radius:16px;background:#16a34a;color:#fff;font:600 14px Rubik;padding:8px 18px}
.fb-minhas{flex:1;min-height:0;overflow-y:auto;padding:0 10px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;align-content:start}
.fb-ap{background:#0b2416e6;border:1px solid #ffffff14;border-left:4px solid var(--c);border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:5px}
.fb-ap-t{display:flex;align-items:center;gap:8px;font:400 12px Rubik;color:#86b39a}
.fb-ap-t b{font:600 14px Rubik;color:#fff}
.fb-ap-t em{margin-left:auto;font-style:normal;font:600 12px Rubik;color:var(--c);border:1px solid var(--c);border-radius:10px;padding:1px 8px}
.fb-ap-s{display:flex;align-items:center;gap:7px}
.fb-ap-s>div{flex:1;min-width:0;display:flex;flex-direction:column}
.fb-ap-s small{font:400 11px Rubik;color:#a7c4b0}
.fb-ap-s small b{color:#fff}
.fb-ap-s>div>b{font:500 13px Rubik;color:#fff}
.fb-ap-ic{width:20px;text-align:center}
.fb-vivo{color:#f87171;font-weight:600}
.fb-ant{font-style:normal;font:600 11px Rubik;color:#fde68a;background:#78350f;border-radius:8px;padding:1px 6px;margin-left:6px;white-space:nowrap}
.fb-co{border:2px solid #c084fc88;border-radius:14px;background:linear-gradient(180deg,#7e22ce,#581c87);color:#fff;font:600 15px Rubik;padding:8px 6px}
.fb-co.sim{background:linear-gradient(180deg,#f59e0b,#b45309);border-color:#fde68a}
.fb-co:disabled{opacity:.6}
.fb-ap-r{display:flex;justify-content:space-between;gap:6px;border-top:1px dashed #ffffff22;padding-top:5px;font:400 12px Rubik;color:#86b39a}
.fb-ap-r b{font:600 14px Oswald;color:#fff}
@media (orientation:portrait){
.fb-bil{position:fixed;left:0;right:0;bottom:0;max-height:78dvh;z-index:20;border-radius:18px 18px 0 0;transform:translateY(105%);transition:transform .2s}
.fb-bil.aberto{transform:none}
.fb-fecha{display:block}
.fb-flut{display:block;position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:15;border:2px solid #fde68a;border-radius:22px;background:#fbbf24;color:#1a1300;font:700 15px Rubik;padding:9px 18px;box-shadow:0 6px 16px #000a}
.fb-logo{display:none}
.fb-top{gap:6px;padding:6px 8px 4px}
.fb-abas{margin-left:0}
.fb-abas button{padding:5px 10px;font-size:13px}
.fb-saldo{font-size:14px;padding:3px 8px}
.fb-top .rbtn{width:32px;height:32px;font-size:14px}
.fb-top .rbtn[title="Comprar fichas"]{display:none}
.fb-main{padding:0 6px 6px}
.fb-lista{padding-bottom:64px}
.fb-jogo{gap:6px;padding:7px 8px;margin-bottom:5px}
.fb-info{min-width:0;flex:1 1 110px}
.fb-time{font-size:13px}
.fb-odds{gap:4px}
.fb-odds button,.fb-merc button{width:48px;font-size:14px}
.fb-odds .fb-mais{width:32px}
.fb-minhas{grid-template-columns:1fr;padding:0 6px 10px}
}
@media (orientation:landscape) and (max-height:520px){
.fb-top{padding:3px 10px 2px}.fb-top .rbtn{width:32px;height:32px;font-size:14px}
.fb-jogo{padding:6px 8px;margin-bottom:5px}
.fb-odds button,.fb-merc button{width:52px;font-size:14px}
.fb-fim{gap:4px;padding:6px 8px 8px}
.fb-apostar{padding:7px 4px;font-size:15px}
.fb-val button{width:28px;height:28px}.fb-val input{height:28px;font-size:17px}
}
`}</style>
    </div>
  );
}

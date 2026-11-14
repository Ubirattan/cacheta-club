'use client';
// FUTEBOL: apostas nos jogos de verdade (Brasileirão, Copa do Brasil, Libertadores, Champions…)
// com as odds da API-Football. Bilhete simples ou múltiplo. O servidor confere tudo (/api/futebol).
import IconeDomino from '../../components/IconeDomino.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, contaUrl } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx } from '../../lib/sfx.js';
import { LIGAS, MIN_APOSTA, MAX_APOSTA, MAX_SELECOES, MAX_PREMIO, MERCADOS, rotulo, curto, opcoes, oddCombo, COMBO_MAX, FORA_DO_COMBO, COM_LINHA, linhaPrincipal, oddDe, todasLinhas, redundante, oddTotal, premioDe, fichas } from '../../lib/futebol.js';
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
// Minhas apostas: em aberto (esperando o jogo) e encerradas (ganhou, perdeu, cash out ou devolvida), que somem depois de 24 horas
const ABERTAS = ['aberta', 'pendente'];
const ENCERRADAS_MS = 24 * 3600e3;
const AVISOS = [
  { id: 'promo', em: '🎁', t: 'Promoções', sub: 'Ranking da cacheta e indique amigos: ganhe fichas!', btn: 'Ver promoções', href: '/promocoes', g: 'linear-gradient(135deg,#f472b6,#db2777 50%,#7e22ce)' },
  { id: 'sinuca', em: '🎱', t: 'Sinuca', sub: 'Bola 8, bola lisa e bolinho · online valendo fichas', btn: 'Jogar agora', href: '/jogos/sinuca', g: 'linear-gradient(135deg,#4ade80,#15803d 55%,#0b4d25)' },
  { id: 'pipa', em: '🪁', t: 'Pipa', sub: 'Corta, apara e manda a busca · online valendo fichas', btn: 'Jogar agora', href: '/jogos/pipa', g: 'linear-gradient(135deg,#fbbf24,#ea7a0a 55%,#9a3412)' },
  { id: 'gude', em: null, t: 'Bolinha de gude', sub: 'Triângulo, buraco e mata-mata · online valendo fichas', btn: 'Jogar agora', href: '/jogos/gude', g: 'linear-gradient(135deg,#a78bfa,#6d28d9 55%,#3b0f80)' },
  { id: 'domino', em: '🁫', t: 'Dominó', sub: 'Dominó de bar em duplas · você e o parceiro contra o computador', btn: 'Jogar agora', href: '/jogos/domino', g: 'linear-gradient(135deg,#78716c,#292524 55%,#0c0a09)' },
  { id: 'bicho', em: '🐾', t: 'Jogo do Bicho', sub: 'Sorteios às 11h, 14h, 16h, 18h e 21h · grupo, dezena, centena e milhar', btn: 'Jogar agora', href: '/bicho', g: 'linear-gradient(135deg,#facc15,#16a34a 55%,#052e16)' },
  { id: 'bingo', em: '🎟️', t: 'Bingo', sub: 'Bingo online com os amigos · 2 a 10 jogadores, até 3 cartelas', btn: 'Jogar agora', href: '/jogos/bingo', g: 'linear-gradient(135deg,#f472b6,#db2777 55%,#831843)' },
];
const ST = { aberta: ['Em aberto', '#fbbf24'], ganhou: ['Ganhou', '#4ade80'], perdeu: ['Perdeu', '#f87171'], devolvida: ['Devolvida', '#93c5fd'], cashout: ['Cash out', '#c084fc'], pendente: ['Confirmando…', '#f87171'], recusada: ['Recusada', '#94a3b8'] };
const FIMS = ['FT', 'AET', 'PEN'], VIVO = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];
function quando(s) {
  if (VIVO.includes(s.jogoStatus)) return s.jogoStatus === 'HT' ? 'intervalo' : s.minuto ? `${s.minuto}'` : 'ao vivo';
  if (FIMS.includes(s.jogoStatus) || (s.placar && !s.jogoStatus)) return 'encerrado';
  return `${nomeDia(s.inicio)} ${hora(s.inicio)}`;
}
const SEL_ST = { ganhou: '✅', perdeu: '❌', anulada: '↩️' };

const rotuloSel = (x, casa, fora) => x.mercado === 'combo' ? x.partes.map(p => rotulo(p.mercado, p.escolha, casa, fora, p.linha)).join(' + ') : rotulo(x.mercado, x.escolha, casa, fora, x.linha);
const nomeMerc = m => m === 'combo' ? '🧩 Criar aposta' : MERCADOS[m].nome;

function Escudo({ src, nome }) {
  const [ok, setOk] = useState(true);
  if (src && ok) return <img className="fb-esc" src={src} alt="" onError={() => setOk(false)} />;
  return <span className="fb-esc fb-esc-l">{(nome || '?')[0]}</span>;
}

export default function Futebol() {
  const router = useRouter();
  const { profile, reloadProfile, visitante } = useAuth({ required: false });
  const [naInicial, setNaInicial] = useState(false);   // o site abre aqui (sem botão de voltar)
  useEffect(() => { setNaInicial(location.pathname === '/'); }, []);
  const local = TESTE && !profile;
  const chama = b => local ? (teste = teste || criarTeste()).chamar(b) : api('/api/futebol', b);
  const [maior, setMaior] = useState(true);   // +18 confirmado no cadastro
  const [aba, setAba] = useState('jogos');
  const [st, setSt] = useState(null);
  const [falha, setFalha] = useState('');
  const [minhas, setMinhas] = useState(null);
  const [filtroAp, setFiltroAp] = useState('abertas');   // Minhas apostas: em aberto ou encerradas
  const [liga, setLiga] = useState(0);
  const [tempo, setTempo] = useState('todos');          // filtro: todos | hoje | 12 | 6 | 3 (horas)
  const [menuLiga, setMenuLiga] = useState(false);      // lista de campeonatos aberta
  const [aberto, setAberto] = useState(null);           // jogo com os outros mercados à mostra
  const [criar, setCriar] = useState(null);
  const [jogoAberto, setJogoAberto] = useState(null);   // página do jogo (antes do jogo)
  const [abaM, setAbaM] = useState('principais');
  const [fechados, setFechados] = useState({});          // cartões de palpite fechados
  const [todos, setTodos] = useState({});                // "Mostrar todos" abertos             // Criar aposta: { jogo, partes: [{ mercado, escolha, linha }] }
  const [bilPre, setBilPre] = useState([]);             // bilhete antes do jogo [{ jogo, mercado, escolha, odd }]
  const [bilVivo, setBilVivo] = useState([]);           // bilhete ao vivo (sempre separado)
  const [vivoSt, setVivoSt] = useState(null);           // jogos rolando agora
  const [confirmando, setConfirmando] = useState(null); // aposta ao vivo esperando: { id, fim }
  const [valor, setValor] = useState(10);
  const [coins, setCoins] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [regras, setRegras] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirma, setConfirma] = useState(null);       // id da aposta esperando o 2º toque do cash out
  const [encerrando, setEncerrando] = useState(false);
  const [bilAberto, setBilAberto] = useState(false);   // celular em pé: bilhete por cima
  const stRef = useRef(null);
  // bilhete e Criar aposta guardados enquanto o app estiver aberto (somem quando fecha o app ou o cliente apaga)
  const lido = useRef(false);
  useEffect(() => {
    try { const g = JSON.parse(sessionStorage.getItem('fb_bilhete') || 'null'); if (g) { setBilPre(g.pre || []); setBilVivo(g.vivo || []); if (g.criar) setCriar(g.criar); if (g.valor) setValor(g.valor); } } catch {}
    lido.current = true;
  }, []);
  useEffect(() => {
    if (!lido.current) return;
    try { sessionStorage.setItem('fb_bilhete', JSON.stringify({ pre: bilPre, vivo: bilVivo, criar: criar?.partes?.length ? criar : null, valor })); } catch {}
  }, [bilPre, bilVivo, criar, valor]);
  const vivoAba = aba === 'vivo';
  const bil = vivoAba ? bilVivo : bilPre, setBil = vivoAba ? setBilVivo : setBilPre;

  useEffect(() => { try { setMaior(true); } catch { setMaior(false); } }, []);
  useEffect(() => { if (profile) setCoins(Number(profile.coins) || 0); }, [profile?.coins]); // eslint-disable-line
  const avisar = (t, bom = false) => { setAviso({ t, bom }); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(null), 2800); };

  async function carregar() {
    try {
      const s = await Promise.race([chama({ op: 'jogos' }), new Promise((_, r) => setTimeout(() => r(new Error('demorou demais')), 15000))]);
      stRef.current = s; setSt(s); setFalha('');
      if (s.coins != null) setCoins(s.coins);
      // atualiza as odds do bilhete e tira jogo que já começou
      setBilPre(b => b.map(x => {
        const j = s.jogos.find(j => j.id === x.jogo);
        if (!j) return { ...x, invalido: true };                       // já começou: fica marcado até o cliente tirar
        if (x.mercado === 'combo') { const c = oddCombo(x.partes, j.odds); return c.erro ? { ...x, invalido: true } : { ...x, odd: c.odd, partes: c.partes, invalido: false }; }
        const o = oddDe(j.odds, x.mercado, x.escolha, x.linha); return o ? { ...x, odd: o, invalido: false } : { ...x, invalido: true };
      }));
      setCriar(c => c && !s.jogos.some(j => j.id === c.jogo) ? null : c);
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
  async function carregarVivo() {
    try {
      const v = await chama({ op: 'vivo' });
      setVivoSt(v); if (v.coins != null) setCoins(v.coins);
      setBilVivo(b => b.map(x => {
        const j = v.jogos.find(j => j.id === x.jogo);
        if (!j) return { ...x, invalido: true };
        const o = j.odds?.[x.mercado];
        return { ...x, odd: o?.[x.escolha] || x.odd, travado: !o?.[x.escolha], invalido: false, ...(o?.linha != null ? { linha: o.linha } : {}) };
      }));
    } catch (e) { avisar(e.message || 'Sem conexão'); }
  }
  async function carregarMinhas() {
    try { const m = await chama({ op: 'minhas' }); setMinhas(m.apostas); if (m.coins != null) setCoins(m.coins); } catch (e) { avisar(e.message || 'Sem conexão'); }
  }
  // pede pro servidor buscar novidades na API sem travar a tela; se mudou algo, recarrega
  const abaRef = useRef(aba); abaRef.current = aba;
  async function atualizar() {
    if (local || !profile) return;
    try { const r = await chama({ op: 'atualizar' }); if (r.mudou) { carregar(); if (abaRef.current === 'minhas') carregarMinhas(); } } catch {}
  }
  useEffect(() => {
    if (!maior) return;   // visitante também vê os jogos e as odds
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
  useEffect(() => {
    if (aba !== 'vivo' || !maior) return;
    carregarVivo(); atualizar();
    const t = setInterval(carregarVivo, 8000), u = setInterval(atualizar, 25000);
    return () => { clearInterval(t); clearInterval(u); };
  }, [aba, maior]); // eslint-disable-line
  useEffect(() => {
    if (aba !== 'jogos' || !maior) return;
    const f = () => chama({ op: 'vivo' }).then(v => setVivoSt(v)).catch(() => {});
    f(); const t = setInterval(f, 30000);
    return () => clearInterval(t);
  }, [aba, maior, local]); // eslint-disable-line
  useEffect(() => { if (!confirma) return; const t = setTimeout(() => setConfirma(null), 5000); return () => clearTimeout(t); }, [confirma]);

  const jogos = st?.jogos || [];
  // abas por nome (as eliminatórias de cada continente ficam juntas numa aba só)
  // filtro de horário: jogos de hoje ou que começam nas próximas 12/6/3 horas
  const porTempo = useMemo(() => {
    if (tempo === 'todos') return jogos;
    const agora = Date.now();
    // inicio vem como número (ms) do servidor e como texto no modo teste: new Date aceita os dois
    if (tempo === 'hoje') { const hoje = new Date().toDateString(); return jogos.filter(j => new Date(j.inicio).toDateString() === hoje); }
    const lim = agora + Number(tempo) * 3600000;
    return jogos.filter(j => new Date(j.inicio).getTime() <= lim);
  }, [jogos, tempo]);
  // campeonatos (com quantos jogos cada um tem no filtro de horário), em ordem alfabética
  // todos os campeonatos do site aparecem: primeiro os que têm jogo (com a quantidade), depois os sem jogo (apagados, com 0)
  const ligas = useMemo(() => {
    const m = new Map(); porTempo.forEach(j => m.set(j.ligaNome, (m.get(j.ligaNome) || 0) + 1));
    const ab = (a, b) => a[0].localeCompare(b[0], 'pt-BR');
    const com = [...m].sort(ab), sem = [...new Set(LIGAS.map(l => l.nome))].filter(n => !m.has(n)).map(n => [n, 0]).sort(ab);
    return [...com, ...sem];
  }, [porTempo]);
  const lista = liga ? porTempo.filter(j => j.ligaNome === liga) : porTempo;
  // DESTAQUES: faixa que passa sozinha em cima da lista, com os principais jogos
  // (primeiro os ao vivo, depois os próximos dos campeonatos principais)
  const destaques = useMemo(() => {
    const vs = (vivoSt?.jogos || []).slice().sort((a, b) => (b.antecipa ? 1 : 0) - (a.antecipa ? 1 : 0)).slice(0, 3).map(j => ({ ...j, aoVivo: true }));
    const prox = jogos.filter(j => j.antecipa).slice(0, 8 - vs.length);
    const mais = prox.length + vs.length < 4 ? jogos.filter(j => !j.antecipa).slice(0, 4 - prox.length - vs.length) : [];
    return [...vs, ...prox, ...mais].slice(0, 8);
  }, [vivoSt, jogos]);
  // na faixa também passam os cartões de Promoções e dos jogos (sinuca, pipa, gude e bicho)
  const faixa = useMemo(() => {
    return AVISOS.map(a => ({ aviso: a }));   // só Promoções e os jogos (sem jogos de futebol na faixa)
  }, [destaques]);
  const [dIdx, setDIdx] = useState(0);
  const dRef = useRef(null), dPausa = useRef(0);
  useEffect(() => {
    const n = faixa.length; if (n < 2) return;
    const t = setInterval(() => {
      const el = dRef.current; if (!el || Date.now() < dPausa.current) return;
      const prox = (Math.round(el.scrollLeft / (el.firstChild?.offsetWidth + 8 || 1)) + 1) % n;
      const alvo = el.children[prox]; if (alvo) el.scrollTo({ left: alvo.offsetLeft - el.offsetLeft - 8, behavior: 'smooth' });
    }, 4000);
    return () => clearInterval(t);
  }, [faixa.length]);
  const dias = useMemo(() => { const g = []; for (const j of lista) { const n = nomeDia(j.inicio); const ult = g[g.length - 1]; if (ult && ult.n === n) ult.js.push(j); else g.push({ n, js: [j] }); } return g; }, [lista]);

  const igualL = (a, b) => (a == null && b == null) || Number(a) === Number(b);
  // linha do palpite: a que veio do botão, ou a principal das odds do jogo
  const lin = (j, m, l) => l != null ? Number(l) : COM_LINHA.includes(m) ? (j.odds?.[m]?.linha != null ? Number(j.odds[m].linha) : linhaPrincipal(j.odds, m)) : null;
  const naBil = (jogo, m, e, l) => {
    const lista = criar?.jogo === jogo ? criar.partes : bil.filter(x => x.jogo === jogo);
    return lista.some(p => p.mercado === m && p.escolha === e && (l == null || !COM_LINHA.includes(m) || igualL(p.linha, l)));
  };
  function parte(j, m, e, l) {        // Criar aposta: liga/desliga um palpite (um de cada tipo)
    sfx('tick');
    const linha = lin(j, m, l);
    setCriar(c => {
      const tem = c.partes.find(p => p.mercado === m);
      const resto = c.partes.filter(p => p.mercado !== m);
      if (tem && tem.escolha === e && igualL(tem.linha ?? null, linha)) return { ...c, partes: resto };
      if (!tem && c.partes.length >= COMBO_MAX) { avisar(`No máximo ${COMBO_MAX} palpites`); return c; }
      return { ...c, partes: [...resto, { mercado: m, escolha: e, ...(linha != null ? { linha } : {}) }] };
    });
  }
  // no Criar aposta: esse palpite fica travado? (outro do mesmo tipo já escolhido, ou não combina com os escolhidos)
  function travado(j, m, e, l) {
    if (criar?.jogo !== j.id || !criar.partes.length) return false;
    const linha = lin(j, m, l);
    const mesmo = criar.partes.find(p => p.mercado === m);
    if (mesmo) return !(mesmo.escolha === e && igualL(mesmo.linha ?? null, linha));
    const nova = { mercado: m, escolha: e, ...(linha != null ? { linha } : {}) };
    const c = oddCombo([...criar.partes, nova], j.odds);
    return (!!c.erro && /impossível/.test(c.erro)) || redundante(criar.partes, nova, j.odds);
  }
  const impossivel = travado;
  function abrirCriar(j) { setJogoAberto(j.id); setCriar({ jogo: j.id, partes: [] }); }
  function porCombo(j) {
    const c = oddCombo(criar.partes, j.odds);
    if (c.erro) return avisar(c.erro);
    setBil(b => { const sem = b.filter(x => x.jogo !== j.id); if (sem.length >= MAX_SELECOES) { avisar(`No máximo ${MAX_SELECOES} jogos por bilhete`); return b; } return [...sem, { jogo: j.id, casa: j.casa, fora: j.fora, mercado: 'combo', escolha: 'combo', odd: c.odd, partes: c.partes }]; });
    sfx('coin'); setCriar(null); avisar('Criar aposta no bilhete', true);
  }
  function escolher(j, m, e, l) {
    const linha = lin(j, m, l);
    const odd = vivoAba ? j.odds?.[m]?.[e] : oddDe(j.odds, m, e, linha); if (!odd) return;
    sfx('tick');
    setBil(b => {
      if (b.some(x => x.jogo === j.id && x.mercado === m && x.escolha === e && igualL(x.linha ?? null, linha))) return b.filter(x => x.jogo !== j.id);
      const sem = b.filter(x => x.jogo !== j.id);
      if (sem.length >= MAX_SELECOES) { avisar(`No máximo ${MAX_SELECOES} jogos por bilhete`); return b; }
      return [...sem, { jogo: j.id, casa: j.casa, fora: j.fora, mercado: m, escolha: e, odd, ...(linha != null ? { linha } : {}) }];
    });
  }
  const odd = bil.length ? oddTotal(bil.map(x => x.odd)) : 0;
  const premio = bil.length ? premioDe(valor, odd) : 0;

  async function apostar() {
    if (enviando || !bil.length) return;
    if (!(valor >= MIN_APOSTA && valor <= MAX_APOSTA)) return avisar(`Aposte de ${MIN_APOSTA} a ${MAX_APOSTA} fichas`);
    setEnviando(true);
    try {
      if (bil.some(x => x.invalido)) throw new Error('Tire do bilhete os jogos marcados com ⛔');
      if (vivoAba && bil.some(x => x.travado)) throw new Error('Tem palpite travado 🔒 no bilhete');
      const r = await chama({ op: 'apostar', valor, selecoes: bil, vivo: vivoAba });
      sfx('coin'); if (r.coins != null) setCoins(r.coins);
      if (r.pendente) { setConfirmando({ id: r.id, fim: Date.now() + r.espera }); esperarConfirmacao(r.id, r.espera); }
      else avisar(`Aposta feita! Prêmio possível: ${fichas(r.premio)} fichas`, true);
      setBil([]); setBilAberto(false);
      reloadProfile && reloadProfile();
      carregar();
    } catch (e) {
      sfx('err'); avisar(e.message || 'Erro');
      if (/odds mudaram|começou|saiu de/.test(e.message || '')) carregar();
    }
    setEnviando(false);
  }

  // aposta ao vivo: espera 7 s e pergunta se foi aceita
  async function esperarConfirmacao(id, espera) {
    await new Promise(r => setTimeout(r, espera + 300));
    for (let i = 0; i < 6; i++) {
      try {
        const r = await chama({ op: 'confirmar', id });
        if (r.espera) { await new Promise(rr => setTimeout(rr, r.espera + 300)); continue; }
        if (r.coins != null) setCoins(r.coins);
        if (r.status === 'recusada') { sfx('err'); avisar(`Aposta recusada: ${r.motivo || 'o jogo mudou'}. As fichas voltaram.`); }
        else { sfx('win'); avisar('Aposta ao vivo confirmada! ✅', true); }
        setConfirmando(null); reloadProfile && reloadProfile(); carregarVivo(); return;
      } catch { await new Promise(rr => setTimeout(rr, 1500)); }
    }
    setConfirmando(null); avisar('Confira em Minhas apostas');
  }
  const [, tique] = useState(0);
  useEffect(() => { if (!confirmando) return; const t = setInterval(() => tique(x => x + 1), 250); return () => clearInterval(t); }, [confirmando]);

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>⚽ FUTEBOL</h2>
      <p>Apostas só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('fb_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/')}>Voltar</button>
    </div></div></div>
  );

  function abrirJogo(j) { setJogoAberto(j.id); setAbaM('principais'); setTodos({}); }
  function fecharJogo() { setJogoAberto(null); setCriar(c => c?.partes?.length ? c : null); }   // Criar aposta começado fica guardado
  const GRUPOS = [['principais', 'Principais', ['1x2', 'ht', 'dnb', 'dc', 'gols', 'ambos', 'ambosMais']], ['gols', 'Gols', ['gols', 'ambos', 'ambosMais', 'primeiro', 'placar']],
    ['handicap', 'Handicap', ['handicap']], ['tempos', 'Tempos', ['ht', 'htft']], ['escanteios', 'Escanteios', ['escanteios']], ['cartoes', 'Cartões', ['cartoes']],
    ['todos', 'Todos', ['1x2', 'dnb', 'dc', 'gols', 'ambos', 'ambosMais', 'ht', 'htft', 'primeiro', 'handicap', 'placar', 'escanteios', 'cartoes']]];
  const nl = l => String(l).replace('.', ',');
  const sn = l => (l > 0 ? '+' : '') + nl(l);
  const curtoNome = n => n.length > 12 ? n.slice(0, 11) + '.' : n;
  function nomeOp(j, m, e, l) {
    if (m === '1x2' || m === 'ht') return e;
    if (m === 'dc') return ({ '1X': '1 ou empate', '12': '1 ou 2', X2: '2 ou empate' })[e];
    if (m === 'dnb') return curtoNome(e === 'casa' ? j.casa : j.fora);
    if (m === 'htft') return e.replace('/', ' / ');
    if (m === 'ambos' || m === 'ambosMais') return e === 'sim' ? 'Sim' : 'Não';
    if (m === 'primeiro') return e === 'casa' ? curtoNome(j.casa) : e === 'fora' ? curtoNome(j.fora) : 'Sem gol';
    if (m === 'placar') return e.replace(':', ' x ');
    if (m === 'handicap') return e === 'casa' ? `${curtoNome(j.casa)} ${sn(l)}` : `${curtoNome(j.fora)} ${sn(-l)}`;
    return `${e === 'mais' ? 'Mais' : 'Menos'} de ${nl(l)}`;
  }
  function botao(j, m, e, l, odd) {
    const trav = travado(j, m, e, l), on = naBil(j.id, m, e, l);
    return <button key={e + ':' + l} className={'fb-op' + (on ? ' on' : '')} disabled={trav || !odd}
      onClick={() => criar?.jogo === j.id ? parte(j, m, e, l) : escolher(j, m, e, l)}>
      <span>{nomeOp(j, m, e, l)}</span><b>{trav || !odd ? '🔒' : f2(odd)}</b></button>;
  }
  function paginaJogo(j) {
    const ca = criar?.jogo === j.id;
    const tem = m => !!j.odds[m] && !(ca && FORA_DO_COMBO.includes(m));
    const grupos = GRUPOS.filter(g => g[2].some(tem));
    const g = grupos.find(x => x[0] === abaM) || grupos[0];
    const combo = ca && criar.partes.length >= 2 ? oddCombo(criar.partes, j.odds) : null;
    const xAnt = j.antecipa && !ca && bil.find(y => y.jogo === j.id && y.mercado === '1x2' && y.escolha !== 'X');
    return <div className="fb-lista fb-pag">
      <div className="fb-jh">
        <button className="fb-volta" onClick={fecharJogo} aria-label="Voltar para os jogos">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          <span>Jogos</span>
        </button>
        <small>{j.ligaNome} · {nomeDia(j.inicio)} · {hora(j.inicio)}{j.antecipa && <i className="fb-selo">💰 2 gols</i>}</small>
        <div className="fb-jt">
          <div><Escudo src={j.casaLogo} nome={j.casa} /><span>{j.casa}</span></div>
          <b>x</b>
          <div><Escudo src={j.foraLogo} nome={j.fora} /><span>{j.fora}</span></div>
        </div>
      </div>
      <div className="fb-mtabs">
        <div className="fb-mtab-l">{grupos.map(x => <button key={x[0]} className={g?.[0] === x[0] ? 'on' : ''} onClick={() => setAbaM(x[0])}>{x[1]}</button>)}</div>
        <button className={'fb-sw' + (ca ? ' on' : '')} onClick={() => setCriar(ca ? null : { jogo: j.id, partes: [] })}><span>CRIAR<br />APOSTA</span><i /></button>
      </div>
      {ca && <div className="fb-caviso"><i>CA</i><span>Combine palpites do mesmo jogo! Com o <b>Criar aposta</b> ligado, junte de 2 a 6 palpites deste jogo. Os que não combinam ou não mudam nada (como “1” junto com “1 ou empate”) ficam com 🔒.</span></div>}
      {xAnt && <div className="fb-antaviso">💰 <b>Pagamento antecipado:</b> se o {xAnt.escolha === '1' ? j.casa : j.fora} abrir <b>2 gols de vantagem</b>, você já ganha, mesmo que o outro time reaja.</div>}
      {g && g[2].filter(tem).map(m => {
        const fechado = fechados[m], comL = COM_LINHA.includes(m), ls = comL ? todasLinhas(j.odds, m) : [];
        const lp = comL ? linhaPrincipal(j.odds, m) : null;
        const linhasVer = comL ? (todos[m] ? ls : ls.filter(([l]) => l === lp)) : [];
        const ops = opcoes(m, j.odds);
        return <div className="fb-mc" key={m}>
          <div className="fb-mc-t" onClick={() => setFechados(f => ({ ...f, [m]: !f[m] }))}>
            <b>{MERCADOS[m].nome}</b>
            <span className="fb-tags"><i className="t-co" title="Tem cash out">$</i>{!FORA_DO_COMBO.includes(m) && <i className="t-ca" title="Entra no Criar aposta">CA</i>}</span>
            <em>{fechado ? '⌄' : '⌃'}</em>
          </div>
          {!fechado && <div className="fb-mc-c">
            {comL ? linhasVer.map(([l, par]) => <div key={l} className="fb-ops c2">{ops.map(e => botao(j, m, e, l, par[e]))}</div>)
              : <div className={'fb-ops c' + (m === 'placar' || m === 'htft' ? 3 : ops.length)}>{ops.map(e => botao(j, m, e, null, j.odds[m][e]))}</div>}
            {comL && ls.length > 1 && <button className="fb-todos" onClick={() => setTodos(t => ({ ...t, [m]: !t[m] }))}>{todos[m] ? 'MOSTRAR MENOS ⌃' : `MOSTRAR TODOS (${ls.length}) ⌄`}</button>}
          </div>}
        </div>;
      })}
      {ca && <div className="fb-cbar-esp" />}
      {ca && <div className={'fb-cbar' + (bil.length > 0 && !bilAberto ? ' sobe' : '')}>
        <span>🧩 {criar.partes.length} {criar.partes.length === 1 ? 'palpite' : 'palpites'}{combo?.erro ? <em>{combo.erro}</em> : combo ? <b> · odd {f2(combo.odd)}</b> : <em> · escolha pelo menos 2</em>}</span>
        <button disabled={!combo || !!combo.erro} onClick={() => porCombo(j)}>Pôr no bilhete</button>
      </div>}
    </div>;
  }
  function destaque() {
    if (!faixa.length) return null;
    return <div className="fb-dest">
      <div className="fb-dest-faixa" ref={dRef} onPointerDown={() => { dPausa.current = Date.now() + 9000; }}
        onScroll={e => { const el = e.currentTarget, w = (el.firstChild?.offsetWidth || 1) + 8; setDIdx(Math.min(faixa.length - 1, Math.round(el.scrollLeft / w))); }}>
        {faixa.map(j => {
          if (j.aviso) { const a = j.aviso; return <div key={'a' + a.id} className="fb-dcard fb-daviso" style={{ '--g': a.g }}
            onClick={() => a.href ? router.push(a.href) : setRegras(true)}>
            <span className="fb-daem">{a.id === 'domino' ? <IconeDomino size={58} /> : a.em || <i className="fb-gude" />}</span>
            <div className="fb-datx"><b>{a.t}</b><small>{a.sub}</small><u>{a.btn} ›</u></div>
          </div>; }
          const o = j.aoVivo ? j.odds?.['1x2'] : j.odds?.['1x2'];
          return <div key={(j.aoVivo ? 'v' : 'p') + j.id} className={'fb-dcard' + (j.aoVivo ? ' vivo' : '')}>
            <div className="fb-dtopo" onClick={() => j.aoVivo ? setAba('vivo') : abrirJogo(j)}>
              {j.aoVivo ? <span className="fb-dmin"><span className="fb-ponto" />{j.status === 'HT' ? 'Intervalo' : `${j.minuto || 0}'`}</span>
                : <span className="fb-dhora">{nomeDia(j.inicio)} · {hora(j.inicio)}</span>}
              <span className="fb-dliga">{j.ligaNome}</span>
              {j.antecipa && !j.aoVivo && <i className="fb-dselo">💰 2 GOLS</i>}
            </div>
            <div className="fb-dtimes" onClick={() => j.aoVivo ? setAba('vivo') : abrirJogo(j)}>
              <div><Escudo src={j.casaLogo} nome={j.casa} /><span>{j.casa}</span>{j.aoVivo && <b>{j.placar?.[0] ?? 0}</b>}</div>
              <div><Escudo src={j.foraLogo} nome={j.fora} /><span>{j.fora}</span>{j.aoVivo && <b>{j.placar?.[1] ?? 0}</b>}</div>
            </div>
            <div className="fb-dodds">
              {['1', 'X', '2'].map(e => !o?.[e]
                ? <button key={e} disabled><small>{e}</small>🔒</button>
                : <button key={e} className={!j.aoVivo && naBil(j.id, '1x2', e) ? 'on' : ''} onClick={() => j.aoVivo ? setAba('vivo') : escolher(j, '1x2', e)}><small>{e}</small>{f2(o[e])}</button>)}
            </div>
          </div>;
        })}
      </div>
      {faixa.length > 1 && <div className="fb-dpontos">{faixa.map((_, i) => <i key={i} className={i === dIdx ? 'on' : ''} />)}</div>}
    </div>;
  }
  function listaVivo() {
    const vs = vivoSt?.jogos || [];
    return <div className="fb-lista">
      {!vivoSt && <div className="fb-vazio">Carregando os jogos ao vivo…</div>}
      {vivoSt && !vs.length && <div className="fb-vazio">Nenhum jogo rolando agora nos nossos campeonatos. Os jogos aparecem aqui assim que começam.</div>}
      {vs.map(j => (
        <div className="fb-jogo vivo" key={j.id}>
          <div className="fb-info" onClick={() => setAberto(aberto === j.id ? null : j.id)}>
            <small><span className="fb-ponto" /> <b className="fb-min">{j.status === 'HT' ? 'Intervalo' : `${j.minuto || 0}'`}</b> · {j.ligaNome}</small>
            <div className="fb-time"><Escudo src={j.casaLogo} nome={j.casa} /><span>{j.casa}</span><b className="fb-gol">{j.placar[0]}</b></div>
            <div className="fb-time"><Escudo src={j.foraLogo} nome={j.fora} /><span>{j.fora}</span><b className="fb-gol">{j.placar[1]}</b></div>
          </div>
          {!j.odds ? <div className="fb-trava">{(j.status === '2H' && Number(j.minuto) >= 90) || ['ET', 'BT', 'P'].includes(j.status) ? '⏱ Apostas encerradas (90\'+)' : j.status === 'HT' ? '⏸ Intervalo · apostas voltam no 2º tempo' : '🔒 Apostas travadas no momento'}</div> : <div className="fb-odds">
            {j.odds['1x2'] ? ['1', 'X', '2'].map(e => <button key={e} className={naBil(j.id, '1x2', e) ? 'on' : ''} onClick={() => escolher(j, '1x2', e)}><small>{e}</small>{f2(j.odds['1x2'][e])}</button>) : <span className="fb-trava">🔒 Resultado travado</span>}
            {Object.keys(j.odds).length > 1 && <button className={'fb-mais' + (aberto === j.id ? ' on' : '')} onClick={() => setAberto(aberto === j.id ? null : j.id)}>{aberto === j.id ? '−' : '+' + (Object.keys(j.odds).length - (j.odds['1x2'] ? 1 : 0))}</button>}
          </div>}
          {aberto === j.id && j.odds && <div className="fb-extra">
            {['gols', 'ambos', 'proximo', 'escanteios', 'cartoes'].filter(m => j.odds[m]).map(m => <div key={m} className="fb-merc">
              <span>{MERCADOS[m].nome}{j.odds[m].linha != null && m === 'gols' ? ` (${String(j.odds[m].linha).replace('.', ',')})` : ''}</span>
              <div>{MERCADOS[m].ops.map(e => <button key={e} className={naBil(j.id, m, e) ? 'on' : ''} onClick={() => escolher(j, m, e)}><small>{curto(e, j.odds[m].linha ?? null, m)}</small>{f2(j.odds[m][e])}</button>)}</div>
            </div>)}
          </div>}
        </div>
      ))}
    </div>;
  }
  const J = Object.fromEntries((vivoAba ? vivoSt?.jogos || [] : jogos).map(j => [j.id, j]));
  const bilhete = (
    <div className={'fb-bil' + (bilAberto ? ' aberto' : '')}>
      <div className="fb-bt"><b>{vivoAba ? '🔴 Bilhete ao vivo' : '🎟️ Bilhete'}</b><span>{!bil.length ? '' : bil.length === 1 ? 'Simples' : `Múltipla de ${bil.length}`}</span>
        {bil.length > 0 && <button className="fb-limpa" onClick={() => setBil([])}>Limpar</button>}
        <button className="fb-fecha" onClick={() => setBilAberto(false)}>✕</button></div>
      <div className="fb-sels">
        {!bil.length && <div className="fb-vazio">{vivoAba ? 'Toque nas odds dos jogos rolando. A aposta ao vivo leva 7 segundos pra ser confirmada e fica num bilhete separado.' : 'Toque nas odds dos jogos pra montar seu bilhete. Escolha vários jogos pra fazer uma múltipla: as odds se multiplicam.'}</div>}
        {bil.map(x => { const j = J[x.jogo] || { casa: x.casa || '?', fora: x.fora || '?' }; return (
          <div className={'fb-sel' + (x.invalido ? ' inv' : '')} key={x.jogo}>
            <div><small>{j.casa} x {j.fora}</small><b>{rotuloSel(x, j.casa, j.fora)}</b>
              {x.invalido ? <small className="fb-inv">⛔ {vivoAba ? 'Jogo acabou' : 'Jogo já começou'}: tire do bilhete</small>
                : <small>{nomeMerc(x.mercado)}{j.antecipa && x.mercado === '1x2' && x.escolha !== 'X' && ' · 💰 pagamento antecipado'}</small>}</div>
            <span className="fb-so">{x.invalido ? '⛔' : x.travado ? '🔒' : f2(x.odd)}</span>
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
          <button className={'fb-tvivo' + (aba === 'vivo' ? ' on' : '')} onClick={() => setAba('vivo')}><span className="fb-ponto" />Ao vivo{st?.aoVivo ? <i>{st.aoVivo}</i> : null}</button>
          <button className={aba === 'minhas' ? 'on' : ''} onClick={() => setAba('minhas')}>Minhas{st?.abertas ? <i>{st.abertas}</i> : null}</button>
        </div>
        <button className={'fb-sair' + (naInicial ? ' ini' : '')} title={naInicial ? 'Outros jogos' : 'Voltar'} aria-label="Outros jogos da Casa de Jogos" onClick={() => router.push('/inicio')}>
          {naInicial ? <span style={{ fontSize: 20 }}>🎮</span> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>}
        </button>
      </div>
      <div className="fb-conta">
        {visitante && <><a className="vis-btn cad" href={contaUrl('criar')}>📝 Cadastrar</a>
          <a className="vis-btn ent" href={contaUrl('entrar')}>🔑 Entrar</a></>}
        {(!visitante || local) && <button className="fb-saldo" title="Comprar fichas" onClick={() => router.push('/loja#comprar')}>💰 <b>{coins == null ? '–' : fichas(coins)}</b><i>+</i></button>}
      </div>
      {st?.admin && (st.admin.erro || !st.admin.chave) && <div className="fb-adm">🛠 {!st.admin.chave ? 'Falta cadastrar APIFOOTBALL_KEY no Netlify.' : `Erro da API (${st.admin.erro.passo}): ${st.admin.erro.msg}`} · chamadas hoje: {st.admin.chamadasHoje}/{st.admin.limite}</div>}
      {aviso && <div className={'fb-aviso' + (aviso.bom ? ' bom' : '')}>{aviso.t}</div>}
      {confirmando && <div className="fb-conf"><div className="fb-conf-c"><span className="fb-ponto" /> Confirmando sua aposta ao vivo… <b>{Math.max(0, Math.ceil((confirmando.fim - Date.now()) / 1000))}</b><small>Se sair gol ou a odd cair nesse tempo, a aposta é recusada e as fichas voltam.</small></div></div>}

      {aba !== 'minhas' ? <div className="fb-main">
        <div className="fb-esq">{vivoAba ? listaVivo() : jogoAberto && J[jogoAberto] ? paginaJogo(J[jogoAberto]) : <>
          {criar?.partes?.length > 0 && J[criar.jogo] && (() => { const cj = J[criar.jogo], c = criar.partes.length >= 2 ? oddCombo(criar.partes, cj.odds) : null; return (
            <button className="fb-cpend" onClick={() => abrirJogo(cj)}>
              <span>🧩 <b>Criar aposta em andamento</b><small>{cj.casa} x {cj.fora} · {criar.partes.length} {criar.partes.length === 1 ? 'palpite' : 'palpites'}{c && !c.erro ? ` · odd ${f2(c.odd)}` : ''}</small></span>
              <em>Continuar ›</em>
            </button>); })()}
          <div className="fb-filtros">
            <button className={'fb-campbtn' + (liga ? ' on' : '')} onClick={() => setMenuLiga(v => !v)}>
              🏆 <span>{liga || 'Todos os campeonatos'}</span> <i>{menuLiga ? '▴' : '▾'}</i></button>
            <div className="fb-ligas">
              {[['todos', 'Todos'], ['hoje', 'Hoje'], ['12', '12 horas'], ['6', '6 horas'], ['3', '3 horas']].map(([v, t]) =>
                <button key={v} className={tempo === v ? 'on' : ''} onClick={() => setTempo(v)}>{v === 'todos' ? t : v === 'hoje' ? '📅 ' + t : '⏱ ' + t}</button>)}
            </div>
            {menuLiga && <>
              <div className="fb-campfundo" onClick={() => setMenuLiga(false)} />
              <div className="fb-campmenu">
                <button className={!liga ? 'on' : ''} onClick={() => { setLiga(0); setMenuLiga(false); }}><span>Todos os campeonatos</span><i>{porTempo.length}</i></button>
                {ligas.map(([n, q]) => <button key={n} className={(liga === n ? 'on' : '') + (q ? '' : ' zero')} disabled={!q && liga !== n} onClick={() => { setLiga(n); setMenuLiga(false); }}><span>{n}</span><i>{q}</i></button>)}
              </div>
            </>}
          </div>
          <div className="fb-lista">
            {destaque()}
            {!st && !falha && <div className="fb-vazio">Carregando os jogos…</div>}
            {!st && falha && <div className="fb-vazio">Não deu pra carregar os jogos ({falha}).<br /><button className="fb-tenta" onClick={() => { setFalha(''); carregar(); }}>Tentar de novo</button></div>}
            {st && !lista.length && (liga || tempo !== 'todos') && jogos.length > 0 && <div className="fb-vazio">Nenhum jogo nesse filtro.<br /><button className="fb-tenta" onClick={() => { setLiga(0); setTempo('todos'); }}>Ver todos os jogos</button></div>}
            {st && !jogos.length && <div className="fb-vazio">Nenhum jogo com odds agora. Os jogos dos próximos dias aparecem aqui assim que as casas abrem as odds.{st.admin && ' (admin: veja o aviso acima)'}</div>}
            {dias.map(d => <div key={d.n}>
              <div className="fb-dia">{d.n}</div>
              {d.js.map(j => (
                <div className="fb-jogo" key={j.id}>
                  <div className="fb-info" onClick={() => abrirJogo(j)} title="Ver todos os palpites">
                    <small>{hora(j.inicio)} · {j.ligaNome}{j.antecipa && <i className="fb-selo" title="Pagamento antecipado">💰 2 gols</i>}</small>
                    <div className="fb-time"><Escudo src={j.casaLogo} nome={j.casa} /><span>{j.casa}</span></div>
                    <div className="fb-time"><Escudo src={j.foraLogo} nome={j.fora} /><span>{j.fora}</span></div>
                  </div>
                  <div className="fb-odds">
                    {['1', 'X', '2'].map(e => <button key={e} className={naBil(j.id, '1x2', e) ? 'on' : ''} onClick={() => escolher(j, '1x2', e)}><small>{e}</small>{f2(j.odds['1x2'][e])}</button>)}
                    {Object.keys(j.odds).filter(k => k !== 'linhas').length > 1 && <button className="fb-mais" onClick={() => abrirJogo(j)}>{'+' + (Object.keys(j.odds).filter(k => k !== 'linhas').length - 1)}</button>}
                  </div>
                  {j.antecipa && (() => { const x = bil.find(y => y.jogo === j.id && y.mercado === '1x2' && y.escolha !== 'X'); return x && <div className="fb-antaviso">💰 <b>Pagamento antecipado:</b> se o {x.escolha === '1' ? j.casa : j.fora} abrir <b>2 gols de vantagem</b>, você já ganha, mesmo que o outro time reaja.</div>; })()}
                </div>
              ))}
            </div>)}
          </div>
        </>}</div>
        {bilhete}
        {bil.length > 0 && !bilAberto && <button className="fb-flut" onClick={() => setBilAberto(true)}>🎟️ {bil.length} {bil.length === 1 ? 'palpite' : 'palpites'} · odd {f2(odd)} <span style={{ float: 'right' }}>⌃</span></button>}
      </div> : <div className="fb-minhas">
        {(() => {
          const ab = (minhas || []).filter(a => ABERTAS.includes(a.status));
          const enc = (minhas || []).filter(a => !ABERTAS.includes(a.status) && Date.now() - (a.fim || a.em) < ENCERRADAS_MS);
          return <div className="fb-apfil">
            <button className={filtroAp === 'abertas' ? 'on' : ''} onClick={() => setFiltroAp('abertas')}>Em aberto{ab.length ? <i>{ab.length}</i> : null}</button>
            <button className={filtroAp === 'encerradas' ? 'on' : ''} onClick={() => setFiltroAp('encerradas')}>Encerradas{enc.length ? <i>{enc.length}</i> : null}</button>
          </div>;
        })()}
        {!minhas && <div className="fb-vazio">Carregando…</div>}
        {minhas && !(minhas || []).filter(a => filtroAp === 'abertas' ? ABERTAS.includes(a.status) : !ABERTAS.includes(a.status) && Date.now() - (a.fim || a.em) < ENCERRADAS_MS).length &&
          <div className="fb-vazio">{filtroAp === 'abertas' ? 'Nenhuma aposta em aberto.' : 'Nenhuma aposta encerrada nas últimas 24 horas.'}</div>}
        {(minhas || []).filter(a => filtroAp === 'abertas' ? ABERTAS.includes(a.status) : !ABERTAS.includes(a.status) && Date.now() - (a.fim || a.em) < ENCERRADAS_MS).map(a => (
          <div className="fb-ap" key={a.id} style={{ '--c': ST[a.status][1] }}>
            <div className="fb-ap-t">
              <b>{a.vivo && <span className="fb-tagv">🔴 Ao vivo</span>}{a.selecoes.length === 1 ? 'Simples' : `Múltipla de ${a.selecoes.length}`}</b>
              <span>{new Date(a.em).toLocaleString('pt-BR', { ...TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <em>{ST[a.status][0]}</em>
            </div>
            {a.selecoes.map((s, i) => (
              <div className="fb-ap-s" key={i}>
                <span className="fb-ap-ic">{SEL_ST[s.status] || (VIVO.includes(s.jogoStatus) ? '⚽' : '🕒')}</span>
                <div><small>{s.casa} {s.placar ? <b>{s.placar[0]} x {s.placar[1]}</b> : 'x'} {s.fora} · <span className={VIVO.includes(s.jogoStatus) ? 'fb-vivo' : ''}>{quando(s)}</span></small>
                  <b>{s.mercado === 'combo' && '🧩 '}{rotuloSel(s, s.casa, s.fora)}{s.total != null && <i className="fb-tot"> · deu {s.total}</i>}{s.antecipado && <i className="fb-ant">💰 pago antecipado</i>}</b></div>
                <span className="fb-so">{f2(s.odd)}</span>
              </div>))}
            {a.status === 'recusada' && <div className="fb-motivo">{a.motivo || 'O jogo mudou durante a confirmação'}. As fichas voltaram.</div>}
            <div className="fb-ap-r"><span>Aposta <b>{a.valor}</b></span><span>Odd <b>{f2(a.odd)}</b></span>
              <span>{['aberta', 'pendente'].includes(a.status) ? 'Prêmio possível' : a.status === 'perdeu' ? 'Prêmio' : a.status === 'recusada' ? 'Devolvido' : 'Recebeu'} <b className="fb-pr">{fichas(['aberta', 'pendente'].includes(a.status) ? a.premio : a.ganho)}</b></span></div>
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
          <p>• <b>1º tempo</b>: vale o placar do intervalo (paga já no intervalo). <b>Quem marca primeiro</b>: o time do 1º gol nos 90 minutos; "Sem gol" ganha no 0 x 0. <b>Handicap</b>: soma ou tira gols do time (ex.: Flamengo −1,5 precisa ganhar por 2 ou mais). <b>Placar exato</b>: o placar dos 90 minutos.</p>
          <p>• <b>🔴 Ao vivo</b>: aposte com o jogo rolando, com as odds do momento. A aposta leva <b>7 segundos</b> pra ser confirmada: se sair gol, a odd cair ou o mercado travar 🔒 nesse tempo, ela é recusada e as fichas voltam. Não aceita depois dos 85 minutos. Aposta ao vivo fica num bilhete separado e <b>não tem pagamento antecipado</b>. <b>Próximo gol</b>: o time que marcar o próximo gol depois da sua aposta.</p>
          <p>• <b>🧩 Criar aposta</b>: abra o jogo, ligue a chave <b>Criar aposta</b> e junte de 2 a 6 palpites do mesmo jogo num só (um de cada tipo; placar exato fica só nos palpites normais). Palpites que não combinam com os já escolhidos ficam apagados. A odd é calculada pra todos acontecerem juntos, por isso é menor que multiplicar. Ganha só se todos acertarem; se um for anulado, o combo inteiro é anulado. Pode entrar numa múltipla com outros jogos.</p>
          <p>• <b>Escanteios</b> e <b>cartões</b>: total dos dois times no jogo. Nos cartões, amarelo e vermelho contam 1 cada. Jogo com prorrogação anula esses palpites. Esses palpites não têm cash out depois que o jogo começa.</p>
          <p>• Jogo cancelado ou adiado por mais de 2 dias é anulado: na simples a aposta volta, na múltipla aquele jogo conta como odd 1.</p>
          <p>• As apostas fecham 1 minuto antes do jogo começar. O resultado é conferido sozinho e o prêmio cai no seu saldo.</p>
          <p>• <b>Pagamento antecipado:</b> nos jogos com o selo <b>💰 2 gols</b>, apostou na vitória de um time (1 ou 2) e ele abriu <b>2 gols de vantagem</b> no tempo normal? O palpite já conta como ganho, mesmo que o outro time reaja. Na simples o prêmio cai na hora. Não vale no Brasileirão B e na Sul-Americana.</p>
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
.fb-pag{padding-bottom:70px}
.fb-jh{background:linear-gradient(180deg,#14532d,#0b2416);border:1px solid #ffffff1a;border-radius:16px;padding:8px 10px 12px;margin-bottom:8px;text-align:center;position:relative}
.fb-volta{position:absolute;left:8px;top:6px;display:flex;align-items:center;gap:4px;border:1px solid #ffffff33;background:linear-gradient(180deg,#22c55e,#15803d);color:#fff;font:600 13px Rubik;border-radius:18px;padding:5px 12px 5px 7px;box-shadow:0 3px 0 #0006}
.fb-volta svg{flex:none}
.fb-volta:active{transform:translateY(2px);box-shadow:0 1px 0 #0006}
.fb-cpend{display:flex;align-items:center;gap:8px;width:100%;flex:none;border:1px solid #c084fc;border-radius:14px;background:linear-gradient(90deg,#7e22ce,#581c87);color:#fff;padding:8px 12px;text-align:left;animation:fbpulse 1.6s infinite}
.fb-cpend span{flex:1;min-width:0;font:500 13px Rubik}.fb-cpend small{display:block;font:400 12px Rubik;color:#e9d5ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-cpend em{font-style:normal;font:700 13px Rubik;color:#fde68a;flex:none}
.fb-sel.inv{border:1px solid #ef4444;background:#7f1d1d55}
.fb-inv{color:#fca5a5!important;font-weight:600}
.fb-jh small{display:block;font:400 12px Rubik;color:#a7c4b0;padding:4px 70px 0}
.fb-jt{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:8px}
.fb-jt>div{display:flex;flex-direction:column;align-items:center;gap:5px;font:600 15px Rubik;color:#fff;min-width:0}
.fb-jt>div span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-jt .fb-esc{width:46px;height:46px;font-size:20px}
.fb-jt>b{font:600 16px Rubik;color:#86b39a}
.fb-mtabs{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:6px;background:#062915;padding:4px 0 6px;margin-bottom:6px}
.fb-mtab-l{flex:1;min-width:0;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.fb-mtab-l::-webkit-scrollbar{display:none}
.fb-mtab-l button{flex:none;border:none;background:#0007;color:#a7c4b0;font:500 13px Rubik;border-radius:12px;padding:6px 11px}
.fb-mtab-l button.on{background:#16a34a;color:#fff}
.fb-sw{flex:none;display:flex;align-items:center;gap:6px;border:none;border-radius:14px;padding:4px 6px 4px 9px;background:linear-gradient(90deg,#a855f7,#6b21a8);color:#fff;animation:fbpulse 1.6s infinite}
.fb-sw span{font:800 9px Rubik;line-height:1.05;text-align:left;font-style:italic}
.fb-sw i{position:relative;width:34px;height:20px;border-radius:10px;background:#0006}
.fb-sw i::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#e9d5ff;transition:left .15s}
.fb-sw.on{animation:none}.fb-sw.on i{background:#fbbf24}.fb-sw.on i::after{left:16px;background:#fff}
.fb-caviso{display:flex;gap:8px;align-items:center;background:#2e1065;border:1px solid #c084fc66;border-radius:12px;padding:8px 10px;margin-bottom:8px;font:400 12px Rubik;color:#f3e8ff;line-height:1.35}
.fb-caviso>i,.t-ca{font-style:normal;font:800 10px Rubik;background:#a855f7;color:#fff;border-radius:6px;padding:2px 5px}
.fb-caviso>i{font-size:12px;padding:4px 7px}
.fb-mc{background:#0b2416e6;border:1px solid #ffffff14;border-radius:14px;margin-bottom:7px;overflow:hidden}
.fb-mc-t{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer}
.fb-mc-t b{font:500 14px Rubik;color:#fff;margin-right:auto}
.fb-tags{display:flex;gap:4px}
.t-co{font-style:normal;font:800 11px Rubik;background:#16a34a;color:#fff;border-radius:6px;padding:1px 6px}
.fb-mc-t em{font-style:normal;color:#86b39a;width:14px;text-align:center}
.fb-mc-c{padding:0 9px 9px;display:flex;flex-direction:column;gap:5px}
.fb-ops{display:grid;gap:5px}.fb-ops.c2{grid-template-columns:1fr 1fr}.fb-ops.c3{grid-template-columns:1fr 1fr 1fr}
.fb-op{display:flex;align-items:center;justify-content:space-between;gap:6px;border:1px solid #ffffff1a;background:#14321f;color:#d1fae5;border-radius:10px;padding:9px 10px;min-width:0}
.fb-op span{font:400 13px Rubik;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.fb-op b{font:600 15px Oswald;color:#fbbf24;flex:none}
.fb-op.on{background:#fbbf24;border-color:#fde68a}.fb-op.on span,.fb-op.on b{color:#1a1300}
.fb-op:disabled{opacity:.45}.fb-op:disabled b{color:#94a3b8}
.fb-todos{border:none;background:none;color:#a7f3d0;font:600 12px Rubik;letter-spacing:.5px;padding:6px}
.fb-cbar{position:sticky;bottom:0;z-index:4;display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#7e22ce,#581c87);border:1px solid #c084fc;border-radius:14px;padding:8px 10px;margin-top:6px;box-shadow:0 -6px 18px #000a;color:#fff;font:500 14px Rubik}
.fb-cbar span{flex:1;min-width:0}.fb-cbar em{font-style:normal;font-size:12px;color:#fca5a5;display:block}
.fb-cbar button{flex:none;border:none;border-radius:12px;background:#fbbf24;color:#1a1300;font:700 14px Rubik;padding:9px 12px}
.fb-cbar button:disabled{opacity:.5}
.fb-cbar-esp{display:none}
.fb-tvivo{display:inline-flex;align-items:center;gap:5px}
.fb-ponto{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 0 #ef4444;animation:fbvivo 1.2s infinite;vertical-align:middle}
@keyframes fbvivo{0%{box-shadow:0 0 0 0 #ef4444cc}70%{box-shadow:0 0 0 6px #ef444400}100%{box-shadow:0 0 0 0 #ef444400}}
.fb-jogo.vivo{border-color:#ef444466}
.fb-min{color:#f87171;font-weight:700}
.fb-gol{margin-left:auto;font:700 18px Oswald;color:#fff;padding:0 6px}
.fb-trava{font:500 12px Rubik;color:#fca5a5;align-self:center}
.fb-tagv{font:600 11px Rubik;color:#fca5a5;margin-right:6px}
.fb-motivo{font:400 12px Rubik;color:#cbd5e1;background:#0006;border-radius:8px;padding:4px 8px}
.fb-conf{position:fixed;inset:0;z-index:40;background:#000a;display:flex;align-items:center;justify-content:center;padding:20px}
.fb-conf-c{background:#1f0a0a;border:2px solid #ef4444;border-radius:18px;padding:18px 20px;max-width:340px;text-align:center;font:500 16px Rubik;color:#fff;display:flex;flex-direction:column;align-items:center;gap:8px}
.fb-conf-c b{font:700 44px Oswald;color:#fbbf24}
.fb-conf-c small{font:400 12px Rubik;color:#fca5a5}
.fb-abas i{font-style:normal;background:#fbbf24;color:#000;border-radius:9px;font:700 11px Rubik;padding:0 5px;margin-left:5px}
.fb-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #4ade8088;border-radius:20px;padding:3px 10px;white-space:nowrap}
.fb-top .rbtn{width:36px;height:36px;font-size:15px}
.fb-sair{flex:none;margin-left:auto;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;border:2px solid #fff;background:linear-gradient(180deg,#facc15,#d97706);color:#1a1206;box-shadow:0 3px 8px #0008;cursor:pointer}
.fb-sair:active{transform:scale(.94)}
.fb-conta{display:flex;gap:8px;padding:2px 10px 6px;align-items:center}
.fb-conta .vis-btn{flex:1;text-align:center;font-size:17px;padding:9px 12px}
.fb-conta .fb-saldo{margin-left:auto;display:flex;align-items:center;gap:6px;font:700 18px Oswald;padding:6px 6px 6px 14px;cursor:pointer}
.fb-conta .fb-saldo i{font-style:normal;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#22c55e;color:#fff;font:700 18px Rubik}
.fb-daviso{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-color:#ffffffaa!important;background:repeating-linear-gradient(120deg,#ffffff12 0 14px,transparent 14px 34px),var(--g)!important}
.fb-daem{font-size:54px;line-height:1;filter:drop-shadow(0 4px 4px #0008);flex:none}
.fb-gude{display:block;width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff 0 14%,#93c5fd 22%,#2563eb 58%,#0b2a6b);box-shadow:2px 4px 8px rgba(0,0,0,.5)}
.fb-datx{display:flex;flex-direction:column;gap:4px;min-width:0}
.fb-datx b{font:700 clamp(20px,5.4vw,24px) Oswald;font-style:italic;text-transform:uppercase;text-shadow:0 2px 0 #0006;line-height:1}
.fb-datx small{font:500 13px Rubik;opacity:.95;line-height:1.25}
.fb-datx u{text-decoration:none;align-self:flex-start;background:#fff;color:#111;font:700 13px Rubik;border-radius:10px;padding:4px 10px;margin-top:2px}
.fb-adm{margin:0 10px 4px;padding:5px 10px;border-radius:10px;background:#7f1d1d;color:#fecaca;font:500 12px Rubik}
.fb-aviso{position:fixed;left:50%;top:54px;transform:translateX(-50%);z-index:30;background:#000d;border:1px solid #f87171;border-radius:14px;padding:7px 14px;font:500 14px Rubik;color:#fff;max-width:90vw;text-align:center}
.fb-aviso.bom{border-color:#4ade80}
.fb-main{flex:1;min-height:0;display:flex;gap:8px;padding:0 8px 8px}
.fb-esq{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.fb-filtros{position:relative;display:flex;align-items:center;gap:6px;flex:none;min-width:0}
.fb-campbtn{flex:none;display:flex;align-items:center;gap:5px;max-width:46%;border:1px solid #fbbf2488;background:#0009;color:#fff;font:600 13px Rubik;border-radius:16px;padding:5px 11px;cursor:pointer}
.fb-campbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-campbtn i{font-style:normal;color:#fbbf24}
.fb-campbtn.on{background:#fbbf24;color:#1a1300;border-color:#fbbf24}.fb-campbtn.on i{color:#1a1300}
.fb-campfundo{position:fixed;inset:0;z-index:24}
.fb-campmenu{position:absolute;left:0;top:calc(100% + 4px);z-index:25;width:min(340px,92vw);max-height:min(60vh,360px);overflow-y:auto;background:#0b2416;border:1px solid #fbbf2488;border-radius:14px;padding:6px;box-shadow:0 12px 30px #000c;display:flex;flex-direction:column;gap:2px}
.fb-campmenu button{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;background:transparent;color:#e5f5ea;font:500 14px Rubik;text-align:left;border-radius:10px;padding:8px 10px;cursor:pointer}
.fb-campmenu button:active{background:#ffffff14}
.fb-campmenu button.on{background:#fbbf24;color:#1a1300}
.fb-campmenu i{font-style:normal;font:600 12px Rubik;background:#ffffff1a;border-radius:9px;padding:1px 7px;flex:none}
.fb-campmenu button.on i{background:#0002}
.fb-campmenu button.zero{opacity:.38}
.fb-ligas{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none}
.fb-ligas::-webkit-scrollbar{display:none}
.fb-ligas button{flex:none;border:1px solid #ffffff22;background:#0007;color:#d1fae5;font:500 13px Rubik;border-radius:16px;padding:5px 12px}
.fb-ligas button.on{background:#fbbf24;color:#1a1300;border-color:#fbbf24}
.fb-lista{flex:1;min-height:0;overflow-y:auto;padding-right:2px}
.fb-dest{margin:2px 0 8px}
.fb-dest-faixa{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0 8px;scroll-padding:0 8px}
.fb-dest-faixa::-webkit-scrollbar{display:none}
.fb-dcard{flex:none;width:min(88%,380px);scroll-snap-align:start;border-radius:16px;overflow:hidden;position:relative;color:#fff;border:2px solid #fbbf2466;
  background:repeating-linear-gradient(120deg,#ffffff0d 0 14px,transparent 14px 34px),linear-gradient(135deg,#16a34a,#065f2c 55%,#033d1c);box-shadow:0 6px 16px #0008}
.fb-dcard.vivo{border-color:#ef444499;background:repeating-linear-gradient(120deg,#ffffff0d 0 14px,transparent 14px 34px),linear-gradient(135deg,#dc2626,#7f1d1d 60%,#3b0a0a)}
.fb-dcard::after{content:'';position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#ffffff22,transparent 70%);pointer-events:none}
.fb-dtopo{display:flex;align-items:center;gap:6px;padding:8px 10px 2px;font:500 11px Rubik;cursor:pointer;min-width:0}
.fb-dmin{display:flex;align-items:center;gap:5px;background:#fff;color:#dc2626;font:700 12px Oswald;border-radius:10px;padding:1px 8px}
.fb-dhora{background:#0006;border-radius:10px;padding:1px 8px;font:600 11px Rubik;white-space:nowrap;text-transform:capitalize}
.fb-dliga{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
.fb-dselo{font-style:normal;background:#fbbf24;color:#1a1300;font:700 10px Rubik;border-radius:8px;padding:1px 6px;flex:none}
.fb-dtimes{padding:4px 12px 6px;display:flex;flex-direction:column;gap:3px;cursor:pointer}
.fb-dtimes div{display:flex;align-items:center;gap:8px;font:700 clamp(15px,4vw,18px) Oswald;font-style:italic;text-transform:uppercase;text-shadow:0 2px 0 #0006;min-width:0}
.fb-dtimes span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-dtimes b{font:700 20px Oswald;font-style:normal}
.fb-dtimes .fb-esc{width:24px;height:24px}
.fb-dodds{display:flex;gap:6px;padding:6px 8px 8px;background:#0005}
.fb-dodds button{flex:1;display:flex;align-items:center;justify-content:space-between;gap:4px;border:1px solid #ffffff2a;background:#fff;color:#111;font:700 15px Oswald;border-radius:10px;padding:5px 9px}
.fb-dodds button small{font:600 11px Rubik;color:#64748b}
.fb-dodds button.on{background:#fbbf24;border-color:#fde68a}
.fb-dodds button:disabled{opacity:.55}
.fb-dpontos{display:flex;justify-content:center;gap:5px;margin-top:6px}
.fb-dpontos i{width:6px;height:6px;border-radius:3px;background:#ffffff40;transition:width .2s}
.fb-dpontos i.on{width:16px;background:#fbbf24}
.fb-dia{font:600 13px Oswald;letter-spacing:.5px;color:#fbbf24;text-transform:uppercase;padding:6px 4px 4px}
.fb-jogo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#0b2416e6;border:1px solid #ffffff14;border-radius:14px;padding:8px 10px;margin-bottom:6px}
.fb-info{flex:1;min-width:120px;display:flex;flex-direction:column;gap:3px}
.fb-info{cursor:pointer}
.fb-selo{font-style:normal;font:600 10px Rubik;color:#fde68a;background:#78350f;border-radius:7px;padding:0 5px;margin-left:6px}
.fb-antaviso{flex-basis:100%;background:linear-gradient(90deg,#78350f,#451a03);border:1px solid #f59e0b88;border-radius:10px;padding:6px 9px;font:400 12px Rubik;color:#fde68a;line-height:1.35}
.fb-antaviso b{color:#fff}
.fb-info:active{opacity:.7}
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
.fb-odds button:disabled,.fb-merc button:disabled{opacity:.25}
.fb-odds .fb-mais{width:38px;justify-content:center;font:600 14px Rubik;color:#a7f3d0}
.fb-extra{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px 16px;border-top:1px dashed #ffffff22;padding-top:7px}
.fb-merc{display:flex;flex-direction:column;gap:4px}
.fb-merc>span{font:500 12px Rubik;color:#a7c4b0}
.fb-merc>div{display:flex;gap:5px}
.fb-merc>div.fb-grade{display:grid;grid-template-columns:repeat(4,auto);gap:5px}
.fb-merc{max-width:100%}
.fb-modo{flex-basis:100%;display:flex;gap:4px;background:#0008;border-radius:16px;padding:3px;width:max-content}
.fb-modo button{border:none;background:none;color:#a7c4b0;font:500 13px Rubik;padding:4px 12px;border-radius:13px}
.fb-modo button.on{background:#7e22ce;color:#fff}
.fb-modo .fb-cria{position:relative;color:#fff;background:linear-gradient(90deg,#a855f7,#7e22ce);box-shadow:0 0 0 0 #c084fc;animation:fbpulse 1.6s infinite;font-weight:600}
.fb-modo .fb-cria.on{animation:none;box-shadow:0 0 0 2px #f0abfc}
.fb-cria i{font-style:normal;font:700 9px Rubik;background:#fbbf24;color:#1a1300;border-radius:6px;padding:1px 4px;margin-left:5px;vertical-align:middle}
@keyframes fbpulse{0%{box-shadow:0 0 0 0 #c084fcaa}70%{box-shadow:0 0 0 8px #c084fc00}100%{box-shadow:0 0 0 0 #c084fc00}}
.fb-novs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:none}
.fb-novs button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;border:1px solid #ffffff22;border-radius:12px;padding:6px 8px;color:#fff;min-width:0}
.fb-novs button:nth-child(1){background:linear-gradient(135deg,#7e22ce,#3b0764)}
.fb-novs button:nth-child(2){background:linear-gradient(135deg,#b45309,#78350f)}
.fb-novs button:nth-child(3){background:linear-gradient(135deg,#0e7490,#164e63)}
.fb-novs b{font:600 13px Rubik;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fb-novs small{font:400 11px Rubik;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fb-criar{flex-basis:100%;display:flex;flex-direction:column;gap:5px;background:#3b0764aa;border:1px solid #c084fc66;border-radius:12px;padding:7px 9px}
.fb-criar span{font:500 13px Rubik;color:#f3e8ff}
.fb-criar em{font-style:normal;font:500 12px Rubik;color:#fca5a5}
.fb-criar button{border:none;border-radius:12px;background:linear-gradient(180deg,#a855f7,#7e22ce);color:#fff;font:600 14px Rubik;padding:8px}
.fb-criar button:disabled{opacity:.5}
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
.fb-apfil{grid-column:1/-1;display:flex;gap:8px;padding:2px 0 4px;position:sticky;top:0;z-index:3;background:linear-gradient(180deg,#0b3d24 70%,transparent)}
.fb-apfil button{flex:1;border:1.5px solid #ffffff2a;background:#0008;color:#d1fae5;border-radius:14px;padding:10px 6px;font:700 16px Oswald;position:relative}
.fb-apfil button.on{background:linear-gradient(180deg,#facc15,#d97706);color:#1a1206;border-color:#fde68a}
.fb-apfil i{font-style:normal;margin-left:6px;background:#ef4444;color:#fff;border-radius:10px;font:700 12px Rubik;padding:1px 7px}
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
.fb-tot{font-style:normal;font-weight:400;color:#a7c4b0}
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
.fb-flut{display:block;position:fixed;left:8px;right:8px;bottom:8px;z-index:15;border:none;border-radius:14px;background:linear-gradient(90deg,#ea580c,#f97316);color:#fff;font:700 16px Rubik;padding:12px 16px;text-align:left;box-shadow:0 6px 16px #000a}
.fb-cbar{position:fixed;left:8px;right:8px;bottom:8px;margin:0;z-index:16}
.fb-cbar.sobe{bottom:66px}
.fb-cbar-esp{display:block;height:130px}
.fb-logo{display:none}
.fb-top{gap:6px;padding:6px 8px 4px}
.fb-abas{margin-left:0;min-width:0;flex:0 1 auto;overflow-x:auto;scrollbar-width:none}
.fb-sair{width:38px;height:38px}
.fb-sair.ini{display:none}
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
.fb-novs b{font-size:12px}.fb-novs small{font-size:10px}.fb-novs button{padding:5px 6px}
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

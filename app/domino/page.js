'use client';
// DOMINÓ DE BAR EM DUPLAS contra o computador. Cada partida custa 1 ficha (cobrada no servidor: /api/treino).
// Regras e computador em lib/domino.js. Você (embaixo) joga com o parceiro (em cima) contra a dupla dos lados.
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, Seg, toast } from '../../components/ui.js';
import { fmt } from '../../lib/modes.js';
import { api, pedirConta } from '../../lib/supabase-browser.js';
import { sfx } from '../../lib/sfx.js';
import { novaPartida, agir, precisa, seguir, jogadaBot, lados, META, NOME_BATIDA } from '../../lib/domino.js';
import { Pedra, montar, uDaMao, RegrasDomino, DOMINO_CSS } from '../../components/Domino.js';

const BOTS = [['Tião', '🤠'], ['Dona Cida', '🦉'], ['Juca', '🐯'], ['Nena', '🦊'], ['Bento', '🐺'], ['Zé', '🎩'], ['Biu', '🧔'], ['Lurdes', '👵']];
export default function Domino() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth({ required: false });
  const [nivel, setNivel] = useState('medio');
  const [M, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ver, setVer] = useState(0);
  const [msg, setMsg] = useState('');
  const [grito, setGrito] = useState(null);
  const [sel, setSel] = useState(null);
  const [regras, setRegras] = useState(false);
  const [mesa, setMesa] = useState({ w: 0, h: 0 });
  const mesaRef = useRef(null), tRef = useRef(null);
  const bump = () => setVer(v => v + 1);
  const nome = (G, pi) => pi === 0 ? 'Você' : G.players[pi].name;
  const dNome = d => d === 0 ? 'Vocês' : 'Eles';

  const gritar = useCallback((pi, t, ms = 1200) => { setGrito({ pi, t }); clearTimeout(gritar._t); gritar._t = setTimeout(() => setGrito(null), ms); }, []);

  const jogar = useCallback((G, pi, mv) => {
    const r = agir(G, pi, mv);
    if (!r.ok) { if (pi === 0) { sfx('err'); toast(r.err); } return false; }
    const ev = r.ev;
    setSel(null);
    if (ev.type === 'passou') { gritar(pi, 'Passo!'); setMsg(`<b>${nome(G, pi)}</b> ${pi === 0 ? 'passou' : 'passou'} (sem pedra)`); sfx('turn'); }
    if (ev.type === 'jogou') { sfx('card'); setMsg(''); }
    if (ev.type === 'mao') {
      sfx('card');
      if (ev.tipo !== 'trancou') gritar(ev.pi, ev.tipo === 'simples' ? 'Bati!' : NOME_BATIDA[ev.tipo] + '!', 2200);
      setMsg(ev.tipo === 'trancou'
        ? (ev.dupla < 0 ? `Trancou! Empate nos pontos (${ev.somas[0]} x ${ev.somas[1]}): ninguém marca` : `Trancou! <b>${dNome(ev.dupla)}</b> com menos pontos na mão (${ev.somas[0]} x ${ev.somas[1]}) <b>+1</b>`)
        : `<b>${nome(G, ev.pi)}</b> bateu: <b>${NOME_BATIDA[ev.tipo]}</b> · <b>${dNome(ev.dupla)} +${ev.pts}</b>`);
      setTimeout(() => sfx(ev.dupla === 0 ? 'coin' : ev.dupla < 0 ? 'turn' : 'lose'), 300);
      if (G.over) setTimeout(() => sfx(G.over.dupla === 0 ? 'win' : 'lose'), 1100);
    }
    bump();
    return true;
  }, [gritar]);

  // computador, seu "passo" automático e a próxima mão
  useEffect(() => {
    clearTimeout(tRef.current);
    if (!M || M === 'semfichas') return;
    const nd = precisa(M);
    if (nd.kind === 'fim') return;
    if (nd.kind === 'mao') { tRef.current = setTimeout(() => { seguir(M); setMsg(''); sfx('card'); bump(); }, 3200); return; }
    if (nd.pi === 0) {
      if (nd.kind === 'passar') tRef.current = setTimeout(() => jogar(M, 0, { type: 'passar' }), 1100);
      else sfx('turn');
      return;
    }
    tRef.current = setTimeout(() => jogar(M, nd.pi, jogadaBot(M, nd.pi, nivel)), 850);
    return () => clearTimeout(tRef.current);
  }, [M, ver, jogar, nivel]);

  // tamanho da mesa pra montar a cobrinha
  useLayoutEffect(() => {
    const el = mesaRef.current; if (!el) return;
    const medir = () => setMesa({ w: el.clientWidth, h: el.clientHeight });
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, [M && M !== 'semfichas']);

  async function comecar() {
    if (busy) return;
    if (!profile) return pedirConta();
    if ((profile.coins || 0) < 1) return setM('semfichas');
    setBusy(true);
    try { await api('/api/treino', { jogo: 'domino' }); reloadProfile && reloadProfile(); }
    catch (e) { setBusy(false); if (/fichas/i.test(e.message)) return setM('semfichas'); return toast(e.message); }
    setBusy(false);
    const pool = BOTS.slice().sort(() => Math.random() - .5);
    const G = novaPartida([{ name: profile.nickname || 'Você', avatar: profile.avatar || '😎' }, ...[0, 1, 2].map(i => ({ name: pool[i][0], avatar: pool[i][1], bot: true }))]);
    setMsg(''); setGrito(null); setSel(null); setM(G); bump(); sfx('card');
  }

  const Regras = () => <RegrasDomino onClose={() => setRegras(false)} />;

  /* ------------------------- MENU ------------------------- */
  if (!M || M === 'semfichas') return (
    <div className="page lounge dm-menu">
      <div className="hdr"><button className="rbtn" onClick={() => (window.history.length > 1 ? router.back() : router.push('/jogos/domino'))}>↩</button>
        <div className="dm-logo">DOMINÓ <small>em duplas</small></div>
        <a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a></div>
      <div className="dm-box">
        <h2>🤖 Contra o computador</h2>
        <div className="dm-demo"><Pedra a={6} b={6} u={22} /><Pedra a={6} b={3} deitada u={22} /><Pedra a={3} b={1} deitada u={22} /></div>
        <Seg label="Computador" value={nivel} onChange={setNivel} options={[['facil', 'Fácil'], ['medio', 'Esperto']]} />
        <button className="go" disabled={busy} onClick={comecar}>{busy ? 'Começando…' : '▶ Jogar · 1 ficha'}</button>
        <button className="sec" onClick={() => setRegras(true)}>📖 Regras do dominó</button>
        <p className="hint" style={{ textAlign: 'center' }}>Você e o parceiro contra o computador, até {META} pontos. Cada partida custa 1 ficha.</p>
      </div>
      {regras && <Regras />}
      {M === 'semfichas' && <Modal onClose={() => setM(null)}><h2>Sem fichas</h2>
        <p>Cada partida contra o computador custa 1 ficha. Compre fichas pra jogar.</p>
        <button className="go" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas com Pix</button>
        <button className="sec" onClick={() => setM(null)}>Fechar</button></Modal>}
      <style>{DOMINO_CSS}</style>
    </div>
  );

  /* ------------------------- MESA ------------------------- */
  const G = M, nd = precisa(G), eu = G.players[0];
  const minhaVez = nd.kind === 'jogar' && nd.pi === 0;
  const { u, itens } = montar(G.linha, mesa.w, mesa.h);
  const uMao = uDaMao();
  function tocar(p) {
    if (!minhaVez) return;
    const ls = lados(G, p);
    if (!ls.length) { sfx('err'); return toast(G.obrigaSena && !G.pontas ? 'Comece com a carroça de 6' : 'Essa pedra não encaixa'); }
    if (ls.length === 1) return jogar(G, 0, { type: 'jogar', id: p.id, lado: ls[0] });
    setSel(sel === p.id ? null : p.id);
  }
  const LUG = { 1: 'dir', 2: 'cima', 3: 'esq' };

  return (
    <div className="page lounge dm">
      <div className="dm-top">
        <div className="dm-placar">
          <div className={G.placar[0] >= META - 1 ? 'hot' : ''}><small>NÓS</small><b>{G.placar[0]}</b></div><i>x</i>
          <div className={G.placar[1] >= META - 1 ? 'hot' : ''}><small>ELES</small><b>{G.placar[1]}</b></div>
        </div>
        <div className="dm-info">Até <b>{META}</b> · mão {G.mao}{G.pontas && <> · pontas <b>{G.pontas[0]}</b> e <b>{G.pontas[1]}</b></>}</div>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Sair" onClick={() => { if (G.fase === 'fim' || confirm('Sair da partida?')) setM(null); }}>↩</button>
      </div>

      <div className="dm-feltro">
        {[1, 2, 3].map(i => { const p = G.players[i]; return (
          <div key={i} className={`dm-lugar ${LUG[i]} ${nd.pi === i && nd.kind !== 'mao' ? 'vez' : ''}`}>
            <div className="dm-av">{p.avatar}</div>
            <div className="dm-np"><b>{p.name}</b><small>{i === 2 ? 'parceiro' : 'adversário'} · {p.mao.length}</small></div>
            {G.fase !== 'jogo' && G.resultado?.tipo === 'trancou'
              ? <div className="dm-aberta">{p.mao.map(x => <Pedra key={x.id} a={x.a} b={x.b} u={11} />)}</div>
              : <div className="dm-costas">{p.mao.map(x => <i key={x.id} />)}</div>}
            {grito && grito.pi === i && <div className="dm-grito">{grito.t}</div>}
          </div>); })}
        <div className="dm-mesa" ref={mesaRef}>
          {!G.linha.length && <div className="dm-vazio">{G.obrigaSena ? 'Quem tem a carroça de 6 começa' : `${nome(G, G.vez)} começa`}</div>}
          {itens.map((p, k) => <Pedra key={p.id} a={p.a} b={p.b} deitada={p.deitada} u={u} cls={k === itens.length - 1 || k === 0 ? 'ponta' : ''} style={{ left: p.left, top: p.top }} />)}
        </div>
        {grito && grito.pi === 0 && <div className="dm-grito eu">{grito.t}</div>}
      </div>

      <div id="msg" className="dm-msg" dangerouslySetInnerHTML={{ __html: msg || (minhaVez ? (sel ? 'Escolha a <b>ponta</b>' : 'Sua vez: <b>toque numa pedra</b>') : nd.kind === 'passar' && nd.pi === 0 ? 'Você não tem pedra: <b>passou</b>' : nd.kind === 'jogar' || nd.kind === 'passar' ? `Vez de <b>${nome(G, nd.pi)}</b>` : '&nbsp;') }} />

      <div className="dm-minha">
        <div className={`dm-eu ${minhaVez ? 'vez' : ''}`}><span>{eu.avatar}</span></div>
        <div className="dm-mao">
          {eu.mao.map(p => { const pode = minhaVez && lados(G, p).length > 0; return (
            <Pedra key={p.id} a={p.a} b={p.b} u={uMao} cls={`${pode ? 'pode' : minhaVez ? 'nao' : ''} ${sel === p.id ? 'sel' : ''}`} onClick={() => tocar(p)} />); })}
        </div>
        {sel != null && minhaVez && <div className="dm-lados">
          <button onClick={() => jogar(G, 0, { type: 'jogar', id: sel, lado: 'L' })}>◀ Ponta {G.pontas[0]}</button>
          <button onClick={() => jogar(G, 0, { type: 'jogar', id: sel, lado: 'R' })}>Ponta {G.pontas[1]} ▶</button>
        </div>}
      </div>

      {regras && <Regras />}
      {G.fase === 'fim' && <Modal><h2>{G.over.dupla === 0 ? '🏆 Vitória!' : 'Não foi dessa vez'}</h2>
        <div className="prize">{G.placar[0]} x {G.placar[1]}</div>
        <p>{G.over.dupla === 0 ? 'Você e seu parceiro ganharam a partida!' : 'A dupla adversária ganhou a partida.'}</p>
        <button className="go" disabled={busy} onClick={comecar}>Jogar de novo · 1 ficha</button>
        <button className="sec" onClick={() => setM(null)}>Voltar ao menu</button></Modal>}
      <style>{DOMINO_CSS}</style>
    </div>
  );
}

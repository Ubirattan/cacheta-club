'use client';
// BOLINHA DE GUDE contra o computador: Triângulo, Buraco e Mata-mata.
// Cada partida custa 1 ficha; ganhou leva 2, empate devolve. O servidor confere toda tecada.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal, Seg, toast } from '../../components/ui.js';
import { GudeField, Hud, Regras, recado, GUDE_CSS } from '../../components/Gude.js';
import { api } from '../../lib/supabase-browser.js';
import { fmt } from '../../lib/modes.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../lib/sfx.js';
import { MODOS, NIVEIS } from '../../lib/gude.js';

const COST = 1, PRIZE = 2;

export default function Gude() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth();
  const [mode, setMode] = useState('triangulo');
  const [level, setLevel] = useState('medio');
  const [game, setGame] = useState(null);      // { id, version, init }
  const [S, setS] = useState(null);            // mesa como está na tela
  const [msg, setMsg] = useState('');
  const [rules, setRules] = useState(false);
  const [semFichas, setSemFichas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [som, setSom] = useState(true);
  const viewRef = useRef(null), pend = useRef(false), firstRef = useRef(0), gameRef = useRef(null), prizeRef = useRef(0);
  gameRef.current = game;

  useEffect(() => {
    setSom(soundOn());
    try { const m = localStorage.getItem('gd_mode'), l = localStorage.getItem('gd_level'); if (MODOS[m]) setMode(m); if (NIVEIS.some(x => x[0] === l)) setLevel(l); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('gd_mode', mode); localStorage.setItem('gd_level', level); } catch {} }, [mode, level]);

  async function start() {
    if (!profile || busy) return;
    unlockAudio();   // liga o som aqui, no toque do botão (criar no meio da tecada travava alguns celulares)
    if ((profile.coins || 0) < COST) return setSemFichas(true);
    setBusy(true);
    try {
      const first = firstRef.current; firstRef.current = 1 - first;    // alterna quem começa
      const r = await api('/api/gude', { op: 'start', mode, level, first });
      prizeRef.current = r.prize || 0;
      const init = r.shots.length ? { state: r.shots[0].pre, shots: r.shots, final: r.state } : { state: r.state };
      setGame({ id: r.id, version: r.version, init, mode, bot: r.state.players[1] });
      setMsg(r.shots.length ? `${r.state.players[1].name} começa` : 'Sua vez: arraste da sua bolinha pra trás e solte');
      reloadProfile();
    } catch (e) { if (/fichas/i.test(e.message)) setSemFichas(true); else toast(e.message); }
    finally { setBusy(false); }
  }

  async function onShoot(v) {
    const g = gameRef.current; if (!g) return;
    pend.current = true; setMsg('Rolando…');
    try {
      const r = await api('/api/gude', { op: 'shot', id: g.id, version: g.version, ...v });
      const vw = viewRef.current;
      if (vw) { vw.push(r.shots.slice(1)); vw.setFinal(r.state); }
      prizeRef.current = r.prize || 0;
      setGame(x => x && x.id === g.id ? { ...x, version: r.version } : x);
      if (r.state.over) setTimeout(reloadProfile, 600);
    } catch (e) {
      sfx('err'); toast(e.message);
      try { const r = await api('/api/gude', { op: 'state', id: g.id }); viewRef.current?.reset(r.state); setGame(x => x && { ...x, version: r.version }); } catch {}
    } finally { pend.current = false; }
  }

  function onSettle(e, st) {
    const t = recado(e, st, 0);
    if (t) setMsg(t);
    if (st.over) setTimeout(() => sfx(st.over.winner === 0 ? 'win' : st.over.winner < 0 ? 'turn' : 'lose'), 400);
    else if (st.turn === 0 && !e.again) sfx('turn');
  }

  async function sair() {
    if (S && !S.over && !confirm('Sair da partida? Você perde a ficha que apostou.')) return;
    if (S && !S.over) api('/api/gude', { op: 'quit' }).catch(() => {});
    setGame(null); setS(null);
  }

  /* ------------------------- MENU ------------------------- */
  if (!game) return (
    <div className="page lounge gd-menu">
      <div className="hdr"><a className="coins" href="/loja#comprar"><i>💰</i><span>{fmt(profile?.coins)}</span></a>
        <div className="gd-logo">BOLINHA DE GUDE</div>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/')}>↩</button></div>
      <div className="gd-box">
        <div className="gd-art"><i className="mb a" /><i className="mb b" /><i className="mb c" /><i className="mb w" /></div>
        <div className="gd-modes">
          {Object.entries(MODOS).map(([k, m]) => (
            <button key={k} className={`gd-mode ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}><i>{m.icon}</i><b>{m.name}</b><small>{m.desc}</small></button>))}
        </div>
        <Seg label="Computador" value={level} onChange={setLevel} options={NIVEIS} />
        <div className="gd-btns">
          <button className="go" disabled={!profile || busy} onClick={start}>{busy ? 'Começando…' : `🤖 Jogar · ${COST} ficha`}</button>
          <button className="go" style={{ background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)' }} onClick={() => router.push('/lobby?jogo=gude')}>🌐 Online 1x1</button>
        </div>
        <button className="sec" onClick={() => setRules(true)}>📖 Como jogar {MODOS[mode].name}</button>
        <p className="gd-cost">Contra o computador: cada partida custa <b>{COST} ficha</b>. Ganhou, leva <b>{PRIZE}</b>. Empate devolve a ficha.</p>
      </div>
      {rules && <Regras mode={mode} onClose={() => setRules(false)} />}
      {semFichas && <Modal onClose={() => setSemFichas(false)}><h2>Sem fichas</h2>
        <p>Cada partida contra o computador custa {COST} ficha. Compre fichas pra jogar.</p>
        <button className="go" onClick={() => router.push('/loja#comprar')}>💰 Comprar fichas com Pix</button>
        <button className="sec" onClick={() => setSemFichas(false)}>Fechar</button></Modal>}
      <style>{GUDE_CSS}</style>
    </div>
  );

  /* ------------------------- JOGO ------------------------- */
  const over = S && S.over && !(viewRef.current && viewRef.current.busy()) ? S.over : null;
  return (
    <div className="page lounge gd">
      <Hud S={S} me={0} right={<>
        <button className="rbtn" title="Regras" onClick={() => setRules(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Voltar" onClick={sair}>↩</button></>} />
      <GudeField init={game.init} me={0} viewRef={viewRef} canPlay={() => !pend.current}
        onShoot={onShoot} onSettle={onSettle} onChange={st => setS({ ...st })} />
      <div id="msg" dangerouslySetInnerHTML={{ __html: msg || '&nbsp;' }} />
      {rules && <Regras mode={game.mode} onClose={() => setRules(false)} />}
      {over && <Modal><h2>{over.winner === 0 ? '🏆 Você ganhou!' : over.winner < 0 ? 'Empate!' : `${S.players[1].name} ganhou`}</h2>
        <div className="prize">{S.players[0].score} x {S.players[1].score}</div>
        <p>{over.winner === 0 ? `+${prizeRef.current || PRIZE} fichas pra você. Boa tecada!` : over.winner < 0 ? 'A ficha voltou pro seu saldo.' : 'Quase! Tenta de novo.'}</p>
        <button className="go" disabled={busy} onClick={start}>Jogar de novo · {COST} ficha</button>
        <button className="sec" onClick={() => { setGame(null); setS(null); }}>Voltar ao menu</button></Modal>}
      <style>{GUDE_CSS}</style>
    </div>
  );
}

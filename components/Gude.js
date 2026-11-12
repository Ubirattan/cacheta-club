'use client';
// Peças da tela da gude usadas contra o computador e no online: mesa, placar, regras e recados.
import { useEffect, useRef } from 'react';
import { Modal } from './ui.js';
import { createView } from '../lib/gude-view.js';
import { MODOS, BUL_SEQ, MATA_PTS, left, target } from '../lib/gude.js';

// mesa: cria o desenho quando `init` muda (partida nova). Os callbacks podem mudar à vontade.
export function GudeField({ init, me, viewRef, canPlay, onShoot, onSettle, onChange }) {
  const boxRef = useRef(null), cvRef = useRef(null), cb = useRef({});
  cb.current = { canPlay, onShoot, onSettle, onChange };
  useEffect(() => {
    if (!init) return;
    const v = createView({
      canvas: cvRef.current, box: boxRef.current, state: init.state, me,
      canPlay: () => (cb.current.canPlay ? cb.current.canPlay() : true),
      onShoot: x => cb.current.onShoot && cb.current.onShoot(x),
      onSettle: (e, S) => cb.current.onSettle && cb.current.onSettle(e, S),
      onChange: S => cb.current.onChange && cb.current.onChange(S),
    });
    if (init.shots && init.shots.length) v.push(init.shots);
    if (init.final) v.setFinal(init.final);
    viewRef.current = v; cb.current.onChange && cb.current.onChange(v.state);
    return () => { v.destroy(); if (viewRef.current === v) viewRef.current = null; };
  }, [init, me]); // eslint-disable-line
  return <div className="gd-field" ref={boxRef}><canvas ref={cvRef} /></div>;
}

const nome = (S, i, me) => i === me ? 'Você' : (S.players[i]?.name || 'Adversário');

// o que aparece no placar de cada jogador
export function progresso(S, i) {
  if (!S) return '';
  const p = S.players[i];
  if (S.mode === 'bulica') { const t = target(S, i); return t === 'matador' ? '💀 matador' : `buraco ${t + 1} · ${p.step}/${BUL_SEQ.length}`; }
  if (S.mode === 'matamata') return `faz ${MATA_PTS} e ganha`;
  return 'bolinhas';
}

export function Hud({ S, me, extra, right, clock }) {
  if (!S) return null;
  const pill = i => {
    const p = S.players[i], on = S.turn === i && !S.over;
    return (
      <div className={`gd-pill ${on ? 'on' : ''}`}>
        <span className="av">{p.avatar || (i === 0 ? '😎' : '🤖')}</span>
        <div><b>{nome(S, i, me)}</b><small>{on ? (clock != null ? `na vez · ${clock}s` : 'na vez') : progresso(S, i)}</small></div>
        <strong>{S.mode === 'bulica' && p.step >= BUL_SEQ.length ? '💀' : p.score}</strong>
      </div>
    );
  };
  return (
    <div className="gd-top">
      {pill(me === 1 ? 1 : 0)}
      <div className="gd-left">{S.mode === 'triangulo' ? <>restam <b>{left(S)}</b></> : <>{MODOS[S.mode].icon} <b>{MODOS[S.mode].name}</b></>}{extra}</div>
      {pill(me === 1 ? 0 : 1)}
      {right}
    </div>
  );
}

// recado depois de cada tecada
export function recado(e, S, me) {
  const who = nome(S, e.pi, me), eu = e.pi === me, outro = nome(S, 1 - e.pi, me);
  const vez = S.over ? '' : S.turn === me ? ' Sua vez!' : ` Vez de ${nome(S, S.turn, me)}.`;
  if (S.over) return '';
  if (S.mode === 'triangulo') {
    if (e.stuck) return `${eu ? 'Sua bolinha ficou' : `A bolinha de ${who} ficou`} dentro do triângulo: volta pra linha.${vez}`;
    if (e.got.length) return `${who} ${eu ? 'tirou' : 'tirou'} ${e.got.length}! ${e.again ? 'Joga de novo.' : ''}`;
    return eu ? `Não tirou nenhuma.${vez}` : `${who} errou!${vez}`;
  }
  if (S.mode === 'bulica') {
    if (e.matador) return `${who} ${eu ? 'virou' : 'virou'} MATADOR 💀! Agora é acertar a bolinha de ${eu ? outro : 'você'}.`;
    if (e.hole != null) return `${who} ${eu ? 'acertou' : 'acertou'} o buraco ${e.hole + 1}! Joga de novo.`;
    if (e.hit) return `${who} bateu na bolinha de ${eu ? outro : 'você'}.${vez}`;
    return eu ? `Errou.${vez}` : `${who} errou!${vez}`;
  }
  if (e.kill) return `${who} acertou! ${S.players[0].score} x ${S.players[1].score}.${vez}`;
  return eu ? `Não acertou.${vez}` : `${who} errou!${vez}`;
}

export function Regras({ mode, onClose }) {
  return (
    <Modal onClose={onClose}><h2>Como jogar · {MODOS[mode]?.name}</h2>
      <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
        <p>• Na sua vez, encoste na sua bolinha, <b>arraste pra trás</b> como um estilingue e solte. Os pontinhos mostram até onde ela vai se não bater em nada.</p>
        {mode === 'triangulo' && <>
          <p>• No chão tem um <b>triângulo</b> com 10 bolinhas. Bolinha que sair do triângulo é sua. <b>Tirou alguma, joga de novo.</b> Não tirou, passa a vez.</p>
          <p>• Na próxima vez você teca de onde parou. Se a sua bolinha parar <b>dentro do triângulo</b>, volta pra linha e você perde a vez.</p>
          <p>• Quando acabarem as bolinhas, ganha quem tirou mais.</p></>}
        {mode === 'bulica' && <>
          <p>• Tem <b>3 buraquinhos</b>. Acerte na ordem <b>1 → 2 → 3 → 2 → 1</b>. O buraco da vez pisca.</p>
          <p>• Pra cair, a bolinha tem que chegar <b>devagar</b>: forte demais ela pula o buraco. Acertou, joga de novo.</p>
          <p>• Fez o caminho todo, vira <b>MATADOR 💀</b>: aí é só acertar a bolinha do adversário pra ganhar.</p></>}
        {mode === 'matamata' && <>
          <p>• Só as duas bolinhas, uma de cada lado. <b>Acertou a bolinha do outro, ganha 1 ponto</b> e as duas voltam pro lugar.</p>
          <p>• Errou, a bolinha fica onde parou e passa a vez. Chegar perto ajuda, mas deixa você na mira!</p>
          <p>• Quem fizer <b>{MATA_PTS} pontos</b> ganha.</p></>}
      </div>
      <button className="go" onClick={onClose}>Entendi</button>
    </Modal>
  );
}

export const GUDE_CSS = `
.gd-menu .hdr{align-items:center}
.gd-logo{font:700 clamp(22px,5.4vmin,38px) Oswald;color:var(--gold);font-style:italic;letter-spacing:1px;text-align:center}
.gd-logo small{font:500 14px Oswald;color:var(--mut);font-style:normal;margin-left:4px}
.gd-box{margin:auto;width:min(560px,94vw);background:linear-gradient(180deg,#2a2218,#15110b);border:2px solid var(--gold2);border-radius:20px;padding:12px 16px;text-align:center}
.gd-box h2{margin:0 0 6px;font:700 20px Oswald;color:var(--gold);text-transform:uppercase;font-style:italic}
.gd-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 8px}
.gd-mode{background:#0c0a07;border:2px solid #4a3a22;border-radius:14px;padding:8px 6px;color:#eadfca;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
.gd-mode i{font-style:normal;font-size:24px}.gd-mode b{font:600 16px Oswald}.gd-mode small{font:400 11px Rubik,sans-serif;color:var(--mut);line-height:1.2}
.gd-mode.on{border-color:var(--gold);box-shadow:0 0 0 2px #000,0 0 14px rgba(242,201,76,.45);background:#1d160b}
.gd-btns{display:flex;gap:8px}.gd-btns .go,.gd-btns .sec{margin:6px 0 0}
.gd-art{display:flex;justify-content:center;gap:10px;margin-bottom:4px}
.mb{width:26px;height:26px;border-radius:50%;display:inline-block;box-shadow:3px 4px 6px rgba(0,0,0,.5),inset -3px -4px 6px rgba(0,0,0,.35)}
.mb.a{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#93c5fd 20%,#2563eb 55%,#0b2a6b)}
.mb.b{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#fca5a5 20%,#dc2626 55%,#5c0a0a)}
.mb.c{background:radial-gradient(circle at 32% 30%,#fff 0 12%,#86efac 20%,#16a34a 55%,#0a3d1c)}
.mb.w{width:32px;height:32px;background:radial-gradient(circle at 32% 30%,#fff 0 25%,#e2e8f0 50%,#94a3b8)}
.gd{overflow:hidden}
.gd-top{display:flex;align-items:center;gap:clamp(6px,1.6vw,14px);padding:8px 12px 6px}
.gd-pill{display:flex;align-items:center;gap:8px;background:#0c0a07;border:2px solid var(--gold2);border-radius:30px;padding:3px 14px 3px 4px;min-width:0}
.gd-pill.on{border-color:var(--gold);box-shadow:0 0 0 2px #000,0 0 14px rgba(242,201,76,.55)}
.gd-pill .av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 40% 30%,#0f7a48,#064a2b);flex:none}
.gd-pill div{display:flex;flex-direction:column;line-height:1.05;min-width:0}
.gd-pill b{font:500 15px Oswald;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gd-pill small{font:500 11px Oswald;color:var(--mut);white-space:nowrap}
.gd-pill.on small{color:var(--gold)}
.gd-pill strong{font:700 26px Oswald;color:var(--gold);margin-left:4px}
.gd-left{font:500 14px Oswald;color:var(--mut);background:#000a;border:1.5px solid var(--gold2);border-radius:20px;padding:5px 12px;white-space:nowrap}
.gd-left b{color:#fff;font-size:17px}
.gd-top .rbtn:first-of-type{margin-left:auto}
.gd-top .rbtn{width:42px;height:42px;font-size:18px}
.gd-field{flex:1;min-height:0;position:relative;margin:0 8px}
.gd-field canvas{position:absolute;inset:0;display:block;touch-action:none;border-radius:14px}
.gd-cost{font:500 13px Oswald;color:var(--mut);margin-top:6px}
.gd-cost b{color:var(--gold)}
`;

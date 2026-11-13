'use client';
// Sala online da SINUCA (1 contra 1): espera, convite, chat e a partida em tempo real.
// O servidor faz cada tacada (lib/sinuca-service.js) e manda a mesa de antes + a velocidade;
// os dois celulares refazem a jogada com a mesma física e depois encaixam na mesa final do servidor.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sb, api } from '../../../../lib/supabase-browser.js';
import { useAuth, useOnline } from '../../../../components/useAuth.js';
import { Header, Modal, toast } from '../../../../components/ui.js';
import Chat from '../../../../components/Chat.js';
import { sendInvite } from '../../../../components/Convites.js';
import { RAIL, corBola, toc, bola, mesa, Regras, SINUCA_CSS } from '../../../../components/Sinuca.js';
import { modeName, isSinucaMode, fmt } from '../../../../lib/modes.js';
import { premioOnline } from '../../../../lib/taxa.js';
import { sfx, soundOn, setSound, unlockAudio } from '../../../../lib/sfx.js';
import { W, H, R, BOLINHO_JOGOS, aplicaTacada, stepSinuca, escolhe, podeEscolher, arrumaBola, colocaBranca, podeColocar, branca, alvos, grupoDe, primeiraBola, ateTabela } from '../../../../lib/sinuca.js';

const clone = x => JSON.parse(JSON.stringify(x));
const NOME_G = { lisas: 'lisas', listradas: 'listradas', verm: 'vermelhas', amar: 'amarelas' };

/* ======================= a mesa (canvas + toques) ======================= */
function Mesa({ srv, me, onShot, onMonta, onMsg, onView }) {
  const cvRef = useRef(null), boxRef = useRef(null), barRef = useRef(null);
  const st = useRef({ S: null, anim: null, shown: { m: null, n: -1 }, ang: 0, forca: 0, pend: false, final: null });
  const props = useRef({}); props.current = { onShot, onMonta, onMsg, onView, me, srv };

  // chegou mesa do servidor
  useEffect(() => {
    if (!srv) return;
    const T = st.current, L = srv.last || {};
    if (T.shown.m !== srv.matchId) {   // partida nova
      T.S = clone(srv); T.anim = null; T.shown = { m: srv.matchId, n: srv.shots }; T.pend = false;
      const b = T.S.balls[T.S.sel]; if (b) T.ang = Math.atan2(H / 2 - b.y, (me === 1 && T.S.modo === 'lisa' ? W * .25 : W * .75) - b.x);
      props.current.onView(T.S); return;
    }
    if (L.t === 'shot' && L.n > T.shown.n) {
      T.final = clone(srv);
      if (L.n === T.shown.n + 1 && T.S) {   // refaz a tacada na tela
        const A = clone(T.S); A.events = [];
        A.balls = L.pre.balls.map(b => ({ ...b, vx: 0, vy: 0 })); A.sel = L.sel; A.naMao = false; A.phase = 'aim';
        if (aplicaTacada(A, L.vx, L.vy)) { T.anim = A; T.shown.n = L.n; T.pend = false; return; }
      }
      T.S = T.final; T.final = null; T.anim = null; T.shown.n = L.n; T.pend = false; props.current.onView(T.S); return;
    }
    if (T.anim) { T.final = clone(srv); return; }
    // arrumação da bola lisa: mantém as suas bolas onde você deixou até confirmar
    const minhaArrumacao = T.S && T.S.phase === 'monta' && srv.phase === 'monta' && !srv.montaOk[me];
    if (!minhaArrumacao) { T.S = clone(srv); T.pend = false; props.current.onView(T.S); }
    else { T.S.montaOk = srv.montaOk; props.current.onView(T.S); }
  }, [srv, me]);

  useEffect(() => {
    const box = boxRef.current, cv = cvRef.current, bar = barRef.current, c = cv.getContext('2d');
    let alive = true, raf, acc = 0, last = performance.now(), view = { s: 1, ox: 0, oy: 0, dpr: 1 };
    let puxando = false, arrastaBranca = false, mirando = null, arrasta = -1, y0 = 0;
    const T = st.current;
    function fit() {
      const r = box.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const s = Math.min(r.width / (W + RAIL * 2 + 10), r.height / (H + RAIL * 2 + 10));
      view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr };
    }
    fit(); const ro = new ResizeObserver(fit); ro.observe(box);
    const toMesa = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - view.ox) / view.s, (e.clientY - r.top - view.oy) / view.s]; };
    const minhaVez = () => { const S = T.S, me = props.current.me; return S && !T.anim && !T.pend && S.phase === 'aim' && S.turn === me && !S.over; };
    const nome = p => (p === props.current.me ? 'Você' : (T.S.players[p] || {}).name || 'Adversário');

    function eventos(A) {
      const me = props.current.me, msg = props.current.onMsg;
      for (const e of A.events) {
        if (e.type === 'bate') toc(e.v);
        if (e.type === 'tabela') toc(.5, true);
        if (e.type === 'taco') toc(e.forca * 8);
        if (e.type === 'caiu') toc(6, true);
        if (e.type === 'grupos') msg(e.p === me ? `Você é das ${NOME_G[e.g].toUpperCase()}` : `${nome(e.p)} é das ${NOME_G[e.g].toUpperCase()}`);
        if (e.type === 'falta') { msg(e.semMao ? `${e.motivo}: passou a vez` : `Falta de ${nome(e.p)}: ${e.motivo}. ${e.p === me ? 'O adversário joga com a bola na mão' : 'Bola na mão: arraste a branca pra onde quiser'}`); sfx('err'); }
        if (e.type === 'perdeu') msg(e.quem === me ? 'Caiu bola sua!' : `${nome(e.quem)} matou bola dele mesmo`);
        if (e.type === 'vez') msg(e.p === me ? 'Sua vez' : `Vez de ${nome(e.p)}`);
        if (e.type === 'boa') { msg(e.p === me ? 'Boa! Joga de novo' : `${nome(e.p)} encaçapou e joga de novo`); if (e.p === me) sfx('coin'); }
        if (e.type === 'jogo') { msg(`Jogo ${e.jogo}: ${e.winner === me ? 'você ganhou' : nome(e.winner) + ' ganhou'} (${e.why})`); sfx(e.winner === me ? 'coin' : 'err'); }
      }
      A.events.length = 0;
    }

    function draw(now) {
      const { s, ox, oy, dpr } = view, S = T.anim || T.S, me = props.current.me;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      if (!S) return;
      c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      mesa(c);
      const cb = S.balls[S.sel];
      if (S.phase === 'monta') {
        const meuLado = me === 0 ? 0 : W / 2;
        c.fillStyle = `rgba(255,255,255,${.06 + Math.sin(now / 300) * .03})`; c.fillRect(meuLado, 0, W / 2, H);
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '600 22px Oswald, sans-serif'; c.textAlign = 'center';
        c.fillText(me === 0 ? 'SEU LADO' : 'LADO DELE', W / 4, H / 2); c.fillText(me === 0 ? 'LADO DELE' : 'SEU LADO', W * .75, H / 2);
      }
      const vez = minhaVez();
      if (vez && S.naMao && cb && !cb.in) { c.strokeStyle = `rgba(255,255,255,${.5 + Math.sin(now / 200) * .3})`; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.arc(cb.x, cb.y, R * 2.2, 0, 7); c.stroke(); c.setLineDash([]); }
      if (vez && cb && !cb.in) {
        const ang = T.ang, hit = primeiraBola(S, ang), meus = alvos(S, me);
        const fim = hit ? [hit.gx, hit.gy] : (() => { const p = ateTabela(S, ang); return [p.x, p.y]; })();
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cb.x, cb.y); c.lineTo(fim[0], fim[1]); c.stroke();
        c.beginPath(); c.arc(fim[0], fim[1], R, 0, 7); c.stroke();
        if (hit) {
          const nx = hit.b.x - hit.gx, ny = hit.b.y - hit.gy, d = Math.hypot(nx, ny) || 1, bom = meus.includes(hit.b);
          c.strokeStyle = bom ? 'rgba(255,255,255,.85)' : 'rgba(239,68,68,.9)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(hit.b.x, hit.b.y); c.lineTo(hit.b.x + nx / d * 130, hit.b.y + ny / d * 130); c.stroke();
          if (!bom) { c.beginPath(); c.moveTo(hit.b.x - 7, hit.b.y - 7); c.lineTo(hit.b.x + 7, hit.b.y + 7); c.moveTo(hit.b.x + 7, hit.b.y - 7); c.lineTo(hit.b.x - 7, hit.b.y + 7); c.stroke(); }
        }
      }
      for (const b of S.balls) if (!b.in) bola(c, b);
      if (S.modo === 'lisa' && S.phase === 'aim' && cb && !cb.in && !T.anim) {
        if (vez) S.balls.forEach((b, i) => { if (i !== S.sel && podeEscolher(S, i)) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, R + 4, 0, 7); c.stroke(); } });
        c.strokeStyle = `rgba(255,255,255,${.7 + Math.sin(now / 160) * .3})`; c.lineWidth = 2.5; c.beginPath(); c.arc(cb.x, cb.y, R + 5, 0, 7); c.stroke();
      }
      if (vez && cb && !cb.in) {   // taco
        const pux = 14 + T.forca * 120, dx = Math.cos(T.ang), dy = Math.sin(T.ang), Lt = 420;
        const x1 = cb.x - dx * (R + pux), y1 = cb.y - dy * (R + pux), x2 = x1 - dx * Lt, y2 = y1 - dy * Lt;
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 9; c.beginPath(); c.moveTo(x1 + 4, y1 + 5); c.lineTo(x2 + 4, y2 + 5); c.stroke();
        const gr = c.createLinearGradient(x1, y1, x2, y2); gr.addColorStop(0, '#f1e6c8'); gr.addColorStop(.03, '#f1e6c8'); gr.addColorStop(.035, '#1e3a8a'); gr.addColorStop(.06, '#1e3a8a'); gr.addColorStop(.065, '#d9b26f'); gr.addColorStop(.6, '#a8692e'); gr.addColorStop(.62, '#111'); gr.addColorStop(1, '#3a1d0a');
        c.strokeStyle = gr; c.lineWidth = 7; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      const pin = bar.querySelector('i'); if (pin) pin.style.height = (T.forca * 100) + '%';
    }

    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      acc = Math.min(acc + (now - last), 100); last = now;
      try {
        while (T.anim && acc >= 1000 / 60) {
          acc -= 1000 / 60; stepSinuca(T.anim); eventos(T.anim);
          if (T.anim.phase !== 'rolling') {   // parou: encaixa na mesa do servidor
            T.anim = null; if (T.final) { T.S = T.final; T.final = null; }
            const b = T.S.balls[T.S.sel]; if (b && !b.in && T.S.turn === props.current.me) { /* mantém a mira */ }
            props.current.onView(T.S);
          }
        }
        if (!T.anim) acc = 0;
        draw(now);
      } catch (e) { console.error('sinuca', e); }
    }

    function down(e) {
      const S = T.S, me = props.current.me; if (!S || T.anim) return;
      const [x, y] = toMesa(e);
      if (S.phase === 'monta' && !S.montaOk[me]) {
        arrasta = S.balls.findIndex(b => grupoDe(b.n) === S.grupos[me] && Math.hypot(x - b.x, y - b.y) < R * 2.4);
        if (arrasta >= 0) try { cv.setPointerCapture(e.pointerId); } catch {}
        return;
      }
      if (!minhaVez()) return;
      const cb = branca(S);
      try { cv.setPointerCapture(e.pointerId); } catch {}
      if (S.naMao && Math.hypot(x - cb.x, y - cb.y) < R * 3) { arrastaBranca = true; return; }
      if (S.modo === 'lisa') {
        const i = S.balls.findIndex((b, k) => k !== S.sel && podeEscolher(S, k) && Math.hypot(x - b.x, y - b.y) < R * 2.2);
        if (i >= 0) { escolhe(S, i); toc(.3); return; }
      }
      mirando = { a: Math.atan2(y - cb.y, x - cb.x), t: performance.now(), x: e.clientX, y: e.clientY, moveu: false };
    }
    function move(e) {
      const S = T.S, me = props.current.me; if (!S) return;
      const [x, y] = toMesa(e);
      if (arrasta >= 0) { arrumaBola(S, arrasta, x, y, me); return; }
      if (!minhaVez()) return;
      const cb = branca(S);
      if (arrastaBranca) { if (podeColocar(S, x, y)) colocaBranca(S, x, y); return; }
      if (mirando) {
        const a = Math.atan2(y - cb.y, x - cb.x); let d = a - mirando.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        if (Math.hypot(e.clientX - mirando.x, e.clientY - mirando.y) > 6) mirando.moveu = true;
        if (mirando.moveu) { T.ang += d * .45; mirando.a = a; }
      }
    }
    const up = e => {
      if (mirando && !mirando.moveu && performance.now() - mirando.t < 350 && e && e.clientX != null && T.S) { const [x, y] = toMesa(e), cb = branca(T.S); T.ang = Math.atan2(y - cb.y, x - cb.x); }
      arrastaBranca = false; mirando = null; arrasta = -1;
    };
    function bDown(e) { if (!minhaVez()) return; puxando = true; y0 = e.clientY; try { bar.setPointerCapture(e.pointerId); } catch {} e.stopPropagation(); }
    function bMove(e) { if (!puxando) return; T.forca = Math.max(0, Math.min(1, (e.clientY - y0) / (bar.clientHeight * .85))); }
    function bUp() {
      if (!puxando) return; puxando = false;
      const S = T.S, f = T.forca; T.forca = 0;
      if (f > .03 && minhaVez()) {
        const cb = branca(S); T.pend = true;
        props.current.onShot({ ang: T.ang, forca: f, sel: S.sel, place: S.naMao ? [cb.x, cb.y] : null }).catch(() => { T.pend = false; });
      }
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    bar.addEventListener('pointerdown', bDown); bar.addEventListener('pointermove', bMove); bar.addEventListener('pointerup', bUp); bar.addEventListener('pointercancel', bUp);
    raf = requestAnimationFrame(loop);
    // botão PRONTO da arrumação
    st.current.pronto = () => {
      const S = T.S, me = props.current.me; if (!S || S.phase !== 'monta') return;
      props.current.onMonta(S.balls.filter(b => grupoDe(b.n) === S.grupos[me]).map(b => [b.x, b.y]));
    };
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      bar.removeEventListener('pointerdown', bDown); bar.removeEventListener('pointermove', bMove); bar.removeEventListener('pointerup', bUp); bar.removeEventListener('pointercancel', bUp);
    };
  }, []);

  const arrumando = srv && srv.phase === 'monta' && !srv.montaOk[me];
  return (
    <div className="sn-area">
      <div className="sn-bar" ref={barRef} style={arrumando ? { display: 'none' } : null}><i /><span>FORÇA</span></div>
      {arrumando && <button className="sn-comeca" onClick={() => st.current.pronto && st.current.pronto()}>✓<b>PRONTO</b></button>}
      <div className="sn-mesa" ref={boxRef}><canvas ref={cvRef} /></div>
    </div>
  );
}

/* ======================= a página da sala ======================= */
export default function SinucaSala() {
  const { id } = useParams();
  const router = useRouter();
  const { user, profile, reloadProfile } = useAuth();
  const online = useOnline(user, profile, 'sala');
  const [room, setRoom] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [srv, setSrv] = useState(null);
  const [V, setV] = useState(null);                 // mesa como está na tela (pro placar)
  const [msgs, setMsgs] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rules, setRules] = useState(false);
  const [pass, setPass] = useState(''), [joinErr, setJoinErr] = useState('');
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(null);
  const [som, setSom] = useState(true);
  const verRef = useRef(0), chatRef = useRef(false), tickBusy = useRef(false);
  chatRef.current = chatOpen;

  const isMember = !!user && players.some(p => p.user_id === user.id);
  const myIdx = srv && user ? srv.players.findIndex(p => p.uid === user.id) : -1;

  const showGame = useCallback((st, v) => {
    if (!st || st.game !== 'sinuca') return;
    if (v != null && v < verRef.current && srv && st.matchId === srv.matchId) return;
    verRef.current = v || verRef.current; setSrv(st);
  }, [srv]);
  const showRef = useRef(showGame); showRef.current = showGame;

  const loadRoom = useCallback(async () => { const { data } = await sb().from('rooms').select('*').eq('id', id).maybeSingle(); setRoom(data || null); }, [id]);
  const loadPlayers = useCallback(async () => { const { data } = await sb().from('room_players').select('*').eq('room_id', id).order('seat'); setPlayers(data || []); }, [id]);
  const loadGame = useCallback(async () => { const { data } = await sb().from('games').select('state,version').eq('room_id', id).maybeSingle(); if (data) showRef.current(data.state, data.version); }, [id]);
  const loadMsgs = useCallback(async () => { const { data } = await sb().from('messages').select('*').eq('room_id', id).order('id', { ascending: false }).limit(60); setMsgs((data || []).reverse()); }, [id]);

  useEffect(() => {
    if (!user) return;
    setSom(soundOn()); loadRoom(); loadPlayers();
    const ch = sb().channel('sinuca-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, p => { if (p.eventType === 'DELETE') setRoom(null); else setRoom(p.new); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players' }, p => { if ((p.new && p.new.room_id === id) || (p.old && (p.old.room_id === id || !p.old.room_id))) loadPlayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${id}` }, p => { if (p.new && p.new.state) showRef.current(p.new.state, p.new.version); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` }, p => {
        setMsgs(m => [...m.slice(-80), p.new]);
        if (p.new.user_id !== user.id) { if (!chatRef.current) setUnread(u => u + 1); sfx('msg'); }
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') { loadGame(); loadMsgs(); } });
    return () => { sb().removeChannel(ch); };
  }, [user, id, loadRoom, loadPlayers, loadGame, loadMsgs]);
  useEffect(() => { if (isMember) { loadGame(); loadMsgs(); } }, [isMember, loadGame, loadMsgs]);
  useEffect(() => { if (room && !isSinucaMode(room.mode)) router.replace('/sala/' + id); }, [room, id, router]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!srv || !isMember || room?.status !== 'playing' || srv.over) return;
    if (srv.deadline && now > srv.deadline + 1500 && !tickBusy.current) {
      tickBusy.current = true; api(`/api/rooms/${id}/tick`).catch(() => {}).finally(() => setTimeout(() => { tickBusy.current = false; }, 1500));
    }
  }, [now, srv, isMember, room, id]);
  useEffect(() => {
    if (!isMember) return;
    const p = () => { if (document.visibilityState === 'visible') api(`/api/rooms/${id}/ping`).catch(() => {}); };
    p(); const t = setInterval(p, 120000); document.addEventListener('visibilitychange', p);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', p); };
  }, [isMember, id]);
  // tempo acabou / começou: avisos
  useEffect(() => {
    if (!srv || myIdx < 0) return; const L = srv.last || {};
    if (L.t === 'timeout') setMsg(L.pi === myIdx ? 'Seu tempo acabou: passou a vez' : `Tempo de ${srv.players[L.pi]?.name} acabou. Sua vez!`);
    if (L.t === 'comecou') setMsg(srv.turn === myIdx ? 'Começou! Você joga primeiro' : `Começou! ${srv.players[srv.turn]?.name} joga primeiro`);
    if (L.t === 'start') setMsg(srv.phase === 'monta' ? 'Arrume as suas 5 bolas no seu lado e toque em PRONTO' : srv.turn === myIdx ? 'Você começa!' : `${srv.players[srv.turn]?.name} começa`);
  }, [srv?.last?.t, srv?.last?.n, srv?.matchId]); // eslint-disable-line

  async function onShot(a) {
    try { const r = await api(`/api/rooms/${id}/action`, { type: 'shot', ...a }); if (r && r.state) showRef.current(r.state, r.version); }
    catch (e) { sfx('err'); toast(e.message); loadGame(); throw e; }
  }
  async function onMonta(pos) {
    try { const r = await api(`/api/rooms/${id}/action`, { type: 'monta', pos }); if (r && r.state) showRef.current(r.state, r.version); setMsg('Pronto! Esperando o adversário arrumar as bolas…'); }
    catch (e) { sfx('err'); toast(e.message); }
  }
  async function join() { setJoinErr(''); try { await api(`/api/rooms/${id}/join`, { password: pass }); loadPlayers(); } catch (e) { setJoinErr(e.message); } }
  async function leave(force) {
    if (!force && room?.status === 'playing' && myIdx >= 0 && !srv?.over && !confirm('Sair agora? Você perde a partida e a entrada.')) return;
    try { await api(`/api/rooms/${id}/leave`); } catch {}
    router.push('/lobby?jogo=sinuca');
  }
  async function ready(v) { try { await api(`/api/rooms/${id}/ready`, { ready: v }); } catch (e) { toast(e.message); } }

  const overShown = srv && srv.over && srv.result?.matchOver && V && V.phase === 'over';
  const endRef = useRef(null);
  useEffect(() => {
    if (!overShown || endRef.current === srv.matchId) return;
    endRef.current = srv.matchId; reloadProfile();
    sfx(srv.result.champion === myIdx ? 'win' : 'lose');
  }, [overShown]); // eslint-disable-line

  /* ---------------- telas ---------------- */
  if (room === undefined || !user) return <div className="page lounge"><div className="center-box">Carregando…</div></div>;
  if (room === null) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 26px Oswald', color: 'var(--gold)' }}>Sala não existe mais</h2>
      <p>Todo mundo saiu e a sala foi fechada.</p><button className="go" onClick={() => router.push('/lobby?jogo=sinuca')}>Ver salas</button></div></div></div>
  );
  if (!isMember) return (
    <div className="page lounge"><Header profile={profile} right={<button className="rbtn" onClick={() => router.push('/lobby?jogo=sinuca')}>↩</button>} />
      <div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
        <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>{room.is_private ? '🔒 ' : ''}{room.name}</h2>
        <p>{modeName(room.mode)} · 1 contra 1 · {room.entry ? `Entrada 💰 ${fmt(room.entry)}` : 'Grátis'}</p>
        {room.status === 'playing' ? <p>Essa mesa está jogando agora. Assim que a partida acabar, dá pra sentar.</p> : <>
          {room.is_private && <input className="field" placeholder="Senha da sala" value={pass} onChange={e => setPass(e.target.value)} />}
          {joinErr && <div className="err">{joinErr}</div>}
          <button className="go" onClick={() => { unlockAudio(); join(); }}>Sentar na mesa</button></>}
        <button className="sec" onClick={() => router.push('/lobby?jogo=sinuca')}>Voltar às salas</button>
      </div></div></div>
  );

  const inGame = srv && myIdx >= 0 && (room.status === 'playing' || (srv.result?.matchOver && dismissed !== srv.matchId));
  const link = typeof location !== 'undefined' ? `${location.origin}/sala/${id}` : '';

  /* ---------- SALA DE ESPERA ---------- */
  if (!inGame) {
    const me = players.find(p => p.user_id === user.id);
    const seats = [0, 1].map(i => players.find(p => p.seat === i));
    const convite = `Bora jogar sinuca (${modeName(room.mode).replace('Sinuca · ', '')}) no Cacheta Club! 🎱 Entra na minha mesa: ${link}${room.is_private ? ' (peça a senha)' : ''}`;
    const inRoom = new Set(players.map(p => p.user_id));
    const free = online.filter(o => o.uid !== user.id && !inRoom.has(o.uid) && o.where !== 'sala');
    const base = { roomId: id, roomName: room.name, entry: room.entry, isPrivate: room.is_private, fromNick: profile?.nickname, fromAvatar: profile?.avatar };
    const inv = (to, who) => { const e = sendInvite({ ...base, to }); toast(e || (to === 'all' ? `Convite enviado para ${free.length} jogador${free.length === 1 ? '' : 'es'} online` : `Convite enviado para ${who}`)); };
    return (
      <div className="page lounge">
        <Header profile={profile} right={<button className="rbtn" onClick={() => leave(true)} title="Sair da sala">↩</button>} />
        <div className="wait">
          <div className="panel">
            <h3>{room.is_private ? '🔒 ' : ''}{room.name}</h3>
            <div className="meta"><span>{modeName(room.mode)}</span><span>1 contra 1</span>
              <span>{room.entry ? `Entrada 💰 ${fmt(room.entry)} · quem ganha leva ${fmt(premioOnline(room.entry))}` : 'Grátis'}</span><span>⏱ {room.turn_seconds} s</span><span>Código <b style={{ color: 'var(--gold)' }}>{room.code}</b></span></div>
            <div className="invite"><input readOnly value={link} onFocus={e => e.target.select()} />
              <button className="pillbtn" onClick={async () => { try { await navigator.clipboard.writeText(convite); toast('Convite copiado'); } catch { toast('Copie o link acima'); } }}>Copiar convite</button></div>
            <div className="invite" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="pillbtn" style={{ background: 'linear-gradient(180deg,#25d366,#128c4a)', textDecoration: 'none' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(convite)}`}>📲 Convidar no WhatsApp</a>
              <button className="pillbtn" style={{ background: 'linear-gradient(180deg,#ffd76a,#c8901c)', color: '#3a2300' }} disabled={!free.length} onClick={() => inv('all')}>📣 Convidar todos online ({free.length})</button>
            </div>
            <div className="seatsgrid">
              {seats.map((p, i) => p
                ? <div key={i} className={`wseat ${p.ready ? 'rdy' : ''}`}><div className="av">{p.avatar}</div><b>{p.nickname}{p.user_id === room.host ? ' 👑' : ''}</b><small className={p.ready ? '' : 'no'}>{p.ready ? '✓ Pronto' : 'Aguardando'}</small></div>
                : <div key={i} className="wseat free">Lugar vago</div>)}
            </div>
            <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>{players.length < 2 ? 'Esperando o adversário. Mande o convite!' : 'A partida começa sozinha quando os dois estiverem prontos.'}</p>
            <button className="go" style={me?.ready ? { background: 'linear-gradient(180deg,#5a5578,#34304f)' } : undefined} onClick={() => { unlockAudio(); ready(!me?.ready); }}>{me?.ready ? 'Cancelar pronto' : '✓ Estou pronto'}</button>
            <button className="sec" onClick={() => setRules(true)}>📖 Como jogar</button>
            <button className="sec" onClick={() => leave(true)}>Sair da sala</button>
          </div>
          <Chat roomId={id} user={user} profile={profile} msgs={msgs} />
        </div>
        {rules && <Regras onClose={() => setRules(false)} />}
      </div>
    );
  }

  /* ---------- MESA ---------- */
  const S = V || srv, res = srv.result;
  const clock = srv.deadline && !srv.over ? Math.max(0, Math.ceil((srv.deadline - now) / 1000)) : null;
  const caidas = S.balls.filter(b => b.in && b.n).map(b => b.n);
  const fila = p => {
    if (S.modo === 'bolinho') return <div className="sn-fila">{Array.from({ length: BOLINHO_JOGOS }, (_, k) => <span key={k} className={k < S.placar[p] ? 'ganho' : 'vazio'} />)}</div>;
    const g = S.grupos[p];
    const nums = g === 'lisas' ? [1, 2, 3, 4, 5, 6, 7] : g === 'listradas' ? [9, 10, 11, 12, 13, 14, 15] : g === 'verm' ? [101, 102, 103, 104, 105] : g === 'amar' ? [201, 202, 203, 204, 205] : [];
    return <div className="sn-fila">{g ? nums.map(n => <span key={n} className={caidas.includes(n) ? 'foi' : ''} style={{ background: n > 8 && n < 100 ? `linear-gradient(#f8f6ee 22%, ${corBola(n)} 22% 78%, #f8f6ee 78%)` : corBola(n) }} />)
      : Array.from({ length: 7 }, (_, k) => <span key={k} className="vazio" />)}</div>;
  };
  const jog = p => {
    const P = srv.players[p] || {}, vez = S.turn === p && S.phase === 'aim';
    return (
      <div className={`sn-pl ${vez ? 'vez' : ''} ${p !== myIdx ? 'dir' : ''}`}>
        <span className="av">{P.avatar || '🙂'}</span>
        <div><b>{p === myIdx ? 'Você' : P.name}{S.modo === 'bolinho' ? <small> · {S.placar[p]} jogos</small> : S.grupos[p] ? <small> · {NOME_G[S.grupos[p]]}</small> : null}{vez && clock != null && clock <= srv.cfg.turn ? <small> · ⏱ {clock}s</small> : null}</b>{fila(p)}</div>
      </div>
    );
  };
  const outro = 1 - myIdx;
  return (
    <div className="page sn">
      <div className="sn-top">
        <button className="rbtn" title="Sair" onClick={() => leave(false)}>↩</button>
        {jog(myIdx)}<div className="sn-vs">{S.modo === 'bolinho' ? <>JOGO<br />{Math.min(S.jogo + 1, BOLINHO_JOGOS)}/{BOLINHO_JOGOS}</> : srv.cfg.entry ? <>💰<br />{fmt(srv.prize)}</> : 'VS'}</div>{jog(outro)}
        <button className="rbtn" title="Chat" style={{ position: 'relative' }} onClick={() => { setChatOpen(true); setUnread(0); }}>💬{unread > 0 && <i className="dot">{unread}</i>}</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); if (!som) unlockAudio(); }}>{som ? '🔊' : '🔇'}</button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <Mesa srv={srv} me={myIdx} onShot={onShot} onMonta={onMonta} onMsg={setMsg} onView={st => setV({ ...st })} />
        <div className="sn-msg">{msg || (S.phase === 'monta' ? (S.montaOk && S.montaOk[myIdx] ? 'Esperando o adversário arrumar as bolas…' : 'Arrume as suas bolas no seu lado e toque em PRONTO') : S.turn === myIdx ? 'Sua vez' : `Vez de ${srv.players[S.turn]?.name}…`)}</div>
      </div>
      {chatOpen && <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
        <Chat roomId={id} user={user} profile={profile} msgs={msgs} onClose={() => setChatOpen(false)} /></div>}
      {rules && <Regras onClose={() => setRules(false)} />}
      {overShown && <Modal><h2>{res.champion === myIdx ? '🏆 Você ganhou!' : `${srv.players[res.champion]?.name} ganhou`}</h2>
        <p>{res.forfeit ? 'O adversário saiu da mesa. ' : ''}{res.champion === myIdx ? (srv.cfg.entry ? `Você levou ${fmt(srv.prize)} fichas!` : 'Boa tacada!') : 'Quase! Pede revanche.'}</p>
        <button className="go" onClick={() => { setDismissed(srv.matchId); setMsg(''); }}>🔁 Revanche</button>
        <button className="sec" onClick={() => leave(true)}>Sair da sala</button></Modal>}
      <style>{SINUCA_CSS + '.rbtn .dot{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font:700 11px Rubik;border-radius:10px;padding:1px 5px;font-style:normal}.sn .sn-msg{top:4px}'}</style>
    </div>
  );
}

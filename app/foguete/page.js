'use client';
// FOGUETINHO ao vivo: o multiplicador sobe enquanto o foguete voa; saque antes de ele explodir.
// O servidor sorteia, guarda segredo de onde explode e confere o horário de cada saque (/api/foguete).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/useAuth.js';
import { Modal } from '../../components/ui.js';
import { api } from '../../lib/supabase-browser.js';
import { sfx, soundOn, setSound, audioCtx } from '../../lib/sfx.js';
import { multEm, ganhoDe, MIN_APOSTA, MAX_APOSTA, MAX_MULT, K } from '../../lib/foguete.js';

const fx = m => m.toFixed(2) + 'x';
const corHist = m => m < 2 ? '#38bdf8' : m < 10 ? '#a78bfa' : '#f472b6';

function estouro() {
  if (!soundOn()) return;
  try {
    const AC = audioCtx() || new (window.AudioContext || window.webkitAudioContext)();
    const b = AC.createBuffer(1, AC.sampleRate * .6, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = .7;
    s.buffer = b; s.connect(f).connect(g).connect(AC.destination); s.start();
  } catch {}
}

export default function Foguete() {
  const router = useRouter();
  const { profile, reloadProfile } = useAuth();
  const [maior, setMaior] = useState(null);
  const [st, setSt] = useState(null);
  const [som, setSom] = useState(true);
  const [regras, setRegras] = useState(false);
  const [aviso, setAviso] = useState('');
  const [coins, setCoins] = useState(null);
  const [, force] = useState(0);
  const off = useRef(0), stRef = useRef(null), cvRef = useRef(null), boxRef = useRef(null);
  const [bets, setBets] = useState({ 1: { valor: 10, auto: false, autoV: 2, fila: false }, 2: { valor: 10, auto: false, autoV: 2, fila: false } });
  const betsRef = useRef(bets); betsRef.current = bets;
  const busy = useRef({});

  useEffect(() => { setSom(soundOn()); try { setMaior(localStorage.getItem('fg_18') === '1'); } catch { setMaior(false); } }, []);
  useEffect(() => { if (profile) setCoins(profile.coins || 0); }, [profile?.coins]); // eslint-disable-line

  const agora = () => Date.now() + off.current;
  const avisar = t => { setAviso(t); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(''), 2200); };

  // consulta o servidor: rápido enquanto voa, mais devagar no resto
  useEffect(() => {
    if (!maior || !profile) return;
    let vivo = true, timer = null, faseAnt = null;
    async function puxa() {
      const t0 = Date.now();
      try {
        const s = await api('/api/foguete', { op: 'estado' });
        const t1 = Date.now();
        if (!vivo) return;
        const novo = s.agora - (t0 + t1) / 2;
        off.current = stRef.current ? off.current * .7 + novo * .3 : novo;
        const f = s.rodada.fase;
        if (f !== faseAnt) {
          if (f === 'voando') sfx('turn');
          if (f === 'explodiu' && faseAnt === 'voando') { estouro(); try { navigator.vibrate && navigator.vibrate(120); } catch {} }
          if (f === 'explodiu' && s.minhas.some(m => m.status === 'sacou')) reloadProfile && reloadProfile();
          if (f === 'apostas') filaAposta(s);
          faseAnt = f;
        }
        stRef.current = s; setSt(s);
      } catch (e) { if (vivo) avisar(e.message || 'Sem conexão'); }
      if (vivo) timer = setTimeout(puxa, stRef.current?.rodada.fase === 'voando' ? 450 : 1000);
    }
    puxa();
    return () => { vivo = false; clearTimeout(timer); };
  }, [maior, !!profile]); // eslint-disable-line

  async function acao(slot, op, extra = {}) {
    if (busy.current[slot]) return; busy.current[slot] = true;
    try {
      const r = await api('/api/foguete', { op, slot, ...extra });
      if (r.coins != null) setCoins(r.coins);
      if (op === 'sacar') { sfx('win'); avisar(`Sacou em ${fx(r.mult)}: +${r.ganho} fichas`); }
      if (op === 'apostar') sfx('coin');
      const s = await api('/api/foguete', { op: 'estado' }); stRef.current = s; setSt(s);
      reloadProfile && reloadProfile();
    } catch (e) { sfx('err'); avisar(e.message || 'Erro'); }
    busy.current[slot] = false;
  }
  function filaAposta(s) {
    for (const slot of [1, 2]) {
      const b = betsRef.current[slot];
      if (!b.fila) continue;
      setBets(o => ({ ...o, [slot]: { ...o[slot], fila: false } }));
      if (!s.minhas.some(m => m.slot === slot && m.status !== 'cancelada')) acao(slot, 'apostar', { valor: b.valor, auto: b.auto ? b.autoV : null });
    }
  }

  // desenho do voo
  useEffect(() => {
    if (!maior) return;
    let raf, alive = true, parts = [], boom = null, ultimoTick = 0;
    const stars = Array.from({ length: 70 }, () => [Math.random(), Math.random(), Math.random() * 1.5 + .3]);
    function draw() {
      if (!alive) return; raf = requestAnimationFrame(draw);
      const cv = cvRef.current, box = boxRef.current; if (!cv || !box) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = box.clientWidth, H = box.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = stRef.current, now = agora();
      const fase = s?.rodada.fase;
      let el = 0, m = 1;
      if (fase === 'voando') { el = Math.max(0, now - s.rodada.start); m = multEm(el); }
      if (fase === 'explodiu') { m = s.rodada.crash; el = Math.log(m) / K * 1000; }
      // céu
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#1d0f3d');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const rot = fase === 'voando' ? now / 9000 : 0;
      c.save(); c.translate(0, H); c.globalAlpha = .07;
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 * (i / 16) - rot % (Math.PI / 16); c.fillStyle = i % 2 ? '#fff' : '#7c3aed'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, Math.hypot(W, H), a - .05, a); c.fill(); }
      c.restore(); c.globalAlpha = 1;
      const sp = fase === 'voando' ? el / 40 : 0;
      for (const [x, y, r] of stars) { c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(((x * W - sp * r) % W + W) % W, (y * H + sp * r * .5) % H, r, 0, 6.3); c.fill(); }
      // curva e foguete
      const pad = 24, x0 = pad, y0 = H - pad;
      const tMax = Math.max(8000, el * 1.15), mMax = Math.max(2, m * 1.2);
      const px = t => x0 + (t / tMax) * (W - pad * 2 - 40), py = mm => y0 - ((mm - 1) / (mMax - 1)) * (H - pad * 2 - 50);
      if (fase === 'voando' || fase === 'explodiu') {
        c.beginPath(); c.moveTo(x0, y0);
        for (let i = 1; i <= 40; i++) { const t = el * i / 40; c.lineTo(px(t), py(multEm(t))); }
        const ex = px(el), ey = py(m);
        c.lineTo(ex, y0); c.closePath();
        const gf = c.createLinearGradient(0, ey, 0, y0); gf.addColorStop(0, 'rgba(251,146,60,.45)'); gf.addColorStop(1, 'rgba(251,146,60,0)');
        c.fillStyle = gf; c.fill();
        c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i <= 40; i++) { const t = el * i / 40; c.lineTo(px(t), py(multEm(t))); }
        c.strokeStyle = '#fb923c'; c.lineWidth = 4; c.stroke();
        if (fase === 'voando') {
          boom = null;
          const t2 = Math.max(0, el - 300), ang = Math.atan2(py(multEm(el)) - py(multEm(t2)), px(el) - px(t2));
          c.save(); c.translate(ex, ey); c.rotate(ang);
          const fl = 10 + Math.random() * 8;
          c.fillStyle = '#facc15'; c.beginPath(); c.moveTo(-14, -5); c.lineTo(-14 - fl, 0); c.lineTo(-14, 5); c.fill();
          c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(-14, -3); c.lineTo(-14 - fl * .6, 0); c.lineTo(-14, 3); c.fill();
          c.fillStyle = '#e5e7eb'; c.beginPath(); c.moveTo(18, 0); c.quadraticCurveTo(8, -9, -14, -7); c.lineTo(-14, 7); c.quadraticCurveTo(8, 9, 18, 0); c.fill();
          c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(-8, -7); c.lineTo(-16, -14); c.lineTo(-14, -6); c.fill(); c.beginPath(); c.moveTo(-8, 7); c.lineTo(-16, 14); c.lineTo(-14, 6); c.fill();
          c.beginPath(); c.moveTo(18, 0); c.quadraticCurveTo(14, -4, 10, -4.5); c.lineTo(10, 4.5); c.quadraticCurveTo(14, 4, 18, 0); c.fill();
          c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(2, 0, 3.4, 0, 6.3); c.fill();
          c.restore();
          if (now - ultimoTick > 1000 && el > 500) { ultimoTick = now; }
        } else {
          if (!boom || boom.num !== s.rodada.num) {
            boom = { num: s.rodada.num }; parts = Array.from({ length: 40 }, () => { const a = Math.random() * 6.3, v = 1 + Math.random() * 4; return { x: ex, y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1 }; });
          }
          for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .05; p.l *= .96; c.fillStyle = `rgba(${p.l > .5 ? '250,204,21' : '239,68,68'},${p.l})`; c.beginPath(); c.arc(p.x, p.y, 3 * p.l + 1, 0, 6.3); c.fill(); }
        }
      }
      // texto central
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (!s) { c.fillStyle = '#fff'; c.font = '600 20px Oswald'; c.fillText('Conectando…', W / 2, H / 2); return; }
      if (fase === 'apostas') {
        const falta = Math.max(0, s.rodada.start - now);
        c.fillStyle = '#fff'; c.font = `700 ${Math.min(44, W / 9)}px Oswald`; c.fillText('FAÇAM SUAS APOSTAS', W / 2, H / 2 - 18);
        c.fillStyle = '#334155'; c.fillRect(W / 2 - 110, H / 2 + 14, 220, 8);
        c.fillStyle = '#fb923c'; c.fillRect(W / 2 - 110, H / 2 + 14, 220 * Math.min(1, falta / 7000), 8);
        c.fillStyle = '#cbd5e1'; c.font = '500 14px Rubik'; c.fillText(`Decola em ${(falta / 1000).toFixed(1)}s`, W / 2, H / 2 + 38);
      } else {
        const big = Math.min(90, W / 5);
        c.font = `700 ${big}px Oswald`; c.fillStyle = fase === 'explodiu' ? '#ef4444' : '#fff';
        c.shadowColor = '#000a'; c.shadowBlur = 12; c.fillText(fx(m), W / 2, H / 2); c.shadowBlur = 0;
        if (fase === 'explodiu') { c.font = `600 ${big * .3}px Oswald`; c.fillText('💥 EXPLODIU', W / 2, H / 2 - big * .75); }
      }
    }
    draw();
    const re = setInterval(() => force(x => x + 1), 120);     // atualiza o valor do botão SACAR
    return () => { alive = false; cancelAnimationFrame(raf); clearInterval(re); };
  }, [maior]); // eslint-disable-line

  if (maior === false) return (
    <div className="page lounge"><div className="center-box"><div className="authcard" style={{ textAlign: 'center' }}>
      <h2 style={{ font: '700 28px Oswald', fontStyle: 'italic', color: 'var(--gold)', margin: 0 }}>🚀 FOGUETINHO</h2>
      <p>Jogo só para <b>maiores de 18 anos</b>.</p>
      <p style={{ fontSize: 13, color: 'var(--mut)' }}>As fichas da Casa de Jogos são para diversão: <b>não valem dinheiro</b> e não podem ser trocadas por dinheiro.</p>
      <button className="go" onClick={() => { try { localStorage.setItem('fg_18', '1'); } catch {} setMaior(true); }}>Tenho 18 anos ou mais</button>
      <button className="sec" onClick={() => router.push('/jogos/foguete')}>Voltar</button>
    </div></div></div>
  );

  const fase = st?.rodada.fase;
  const mAgora = fase === 'voando' ? multEm(agora() - st.rodada.start) : fase === 'explodiu' ? st.rodada.crash : 1;
  const setB = (slot, k, v) => setBets(o => ({ ...o, [slot]: { ...o[slot], [k]: v } }));

  function painel(slot) {
    const b = bets[slot], minha = st?.minhas.find(m => m.slot === slot && m.status !== 'cancelada');
    let btn;
    if (minha && minha.status === 'aberta' && fase === 'apostas') btn = <button className="fg-btn red" onClick={() => acao(slot, 'cancelar')}>CANCELAR<small>{minha.valor} fichas</small></button>;
    else if (minha && minha.status === 'aberta' && fase === 'voando') {
      const autoOk = minha.auto && mAgora >= minha.auto;
      btn = autoOk ? <button className="fg-btn ok" disabled>SACOU {fx(minha.auto)}<small>+{ganhoDe(minha.valor, minha.auto)} fichas</small></button>
        : <button className="fg-btn orange" onClick={() => acao(slot, 'sacar')}>SACAR<small>{ganhoDe(minha.valor, mAgora)} fichas</small></button>;
    } else if (minha && minha.status === 'sacou') btn = <button className="fg-btn ok" disabled>SACOU {fx(minha.mult)}<small>+{minha.ganho} fichas</small></button>;
    else if (b.fila) btn = <button className="fg-btn red" onClick={() => setB(slot, 'fila', false)}>CANCELAR<small>esperando a próxima rodada</small></button>;
    else if (fase === 'apostas') btn = <button className="fg-btn green" onClick={() => acao(slot, 'apostar', { valor: b.valor, auto: b.auto ? b.autoV : null })}>APOSTAR<small>{b.valor} fichas</small></button>;
    else btn = <button className="fg-btn green" onClick={() => setB(slot, 'fila', true)}>APOSTAR<small>na próxima rodada</small></button>;
    const trava = !!minha && minha.status !== 'perdeu' || b.fila;
    return (
      <div className="fg-painel" key={slot}>
        <div className="fg-val">
          <div className="fg-row">
            <button disabled={trava} onClick={() => setB(slot, 'valor', Math.max(MIN_APOSTA, b.valor - (b.valor > 10 ? 5 : 1)))}>−</button>
            <input disabled={trava} inputMode="numeric" value={b.valor} onChange={e => setB(slot, 'valor', Math.max(0, Math.min(MAX_APOSTA, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0))))} onBlur={() => setB(slot, 'valor', Math.max(MIN_APOSTA, b.valor))} />
            <button disabled={trava} onClick={() => setB(slot, 'valor', Math.min(MAX_APOSTA, b.valor + (b.valor >= 10 ? 5 : 1)))}>+</button>
          </div>
          <div className="fg-q">{[10, 20, 50, 100].map(v => <button key={v} disabled={trava} onClick={() => setB(slot, 'valor', v)}>{v}</button>)}</div>
          <label className="fg-auto"><input type="checkbox" disabled={trava} checked={b.auto} onChange={e => setB(slot, 'auto', e.target.checked)} /> Saque auto
            <input disabled={trava || !b.auto} inputMode="decimal" value={b.autoV} onChange={e => setB(slot, 'autoV', e.target.value.replace(',', '.'))} onBlur={() => setB(slot, 'autoV', Math.max(1.01, Math.min(MAX_MULT, Number(b.autoV) || 2)).toFixed(2))} />x</label>
        </div>
        {btn}
      </div>
    );
  }

  return (
    <div className="page lounge fgp">
      <div className="fg-top">
        <div className="fg-logo">🚀 FOGUETINHO</div>
        <span className="fg-saldo">💰 <b>{coins == null ? '–' : coins.toLocaleString('pt-BR')}</b></span>
        <button className="rbtn" title="Regras" onClick={() => setRegras(true)}>📖</button>
        <button className="rbtn" title="Som" onClick={() => { setSound(!som); setSom(!som); }}>{som ? '🔊' : '🔇'}</button>
        <button className="rbtn" title="Comprar fichas" onClick={() => router.push('/loja#comprar')}>💰</button>
        <button className="rbtn" title="Voltar" onClick={() => router.push('/jogos/foguete')}>↩</button>
      </div>
      <div className="fg-hist">{(st?.historico || []).map((m, i) => <i key={i} style={{ color: corHist(m) }}>{fx(m)}</i>)}</div>
      <div className="fg-main">
        <div className="fg-ceu" ref={boxRef}><canvas ref={cvRef} />{aviso && <div className="fg-aviso">{aviso}</div>}
          <div className="fg-qtd">👥 {st?.total || 0}</div></div>
        <div className="fg-lado">
          <div className="fg-paineis">{painel(1)}{painel(2)}</div>
          <div className="fg-lista">
            <div className="fg-lt"><b>Apostas da rodada</b><span>{st?.total || 0}</span></div>
            {(st?.apostas || []).map((a, i) => (
              <div key={i} className={'fg-li' + (a.mult ? ' win' : a.perdeu ? ' lost' : '')}>
                <span>{a.avatar} {a.nick}</span><span>{a.valor}</span><span>{a.mult ? fx(a.mult) : ''}</span><span>{a.mult ? '+' + a.ganho : ''}</span>
              </div>))}
            {st && !st.apostas.length && <div className="fg-vazio">Ninguém apostou nessa rodada ainda</div>}
          </div>
        </div>
      </div>
      <div className="fg-rod">Proibido para menores de 18 anos · Fichas sem valor em dinheiro · Jogue por diversão</div>
      {regras && <Modal onClose={() => setRegras(false)}><h2>Como jogar</h2>
        <div style={{ textAlign: 'left', fontSize: 14, lineHeight: 1.45, color: '#eadfca' }}>
          <p>• Antes de decolar, escolha quantas fichas quer apostar e toque em <b>APOSTAR</b>. Dá pra fazer <b>duas apostas</b> na mesma rodada.</p>
          <p>• O foguete sobe e o multiplicador cresce. Toque em <b>SACAR</b> pra receber a aposta vezes o multiplicador daquele momento.</p>
          <p>• Se o foguete <b>explodir</b> antes de você sacar, perde a aposta.</p>
          <p>• <b>Saque auto</b>: saca sozinho quando chegar no valor escolhido.</p>
          <p>• Todos jogam a mesma rodada ao vivo. Aposta de {MIN_APOSTA} a {MAX_APOSTA} fichas. O foguete vai até {MAX_MULT}x.</p>
          <p style={{ fontSize: 12, color: 'var(--mut)' }}>Proibido para menores de 18 anos. Fichas sem valor em dinheiro. Jogue por diversão.</p>
        </div>
        <button className="go" onClick={() => setRegras(false)}>Entendi</button></Modal>}
      <style>{`
.fgp{overflow:hidden;background:#080b1f}
.fg-top{display:flex;align-items:center;gap:8px;padding:6px 10px 2px}
.fg-logo{font:700 clamp(18px,4.6vmin,28px) Oswald;color:#fb923c;font-style:italic;letter-spacing:1px;margin-right:auto;white-space:nowrap}
.fg-saldo{font:600 15px Oswald;color:#fff;background:#0007;border:1px solid #fb923c88;border-radius:20px;padding:3px 10px}
.fg-top .rbtn{width:38px;height:38px;font-size:16px}
.fg-hist{display:flex;gap:6px;overflow:hidden;padding:2px 10px 4px;white-space:nowrap}
.fg-hist i{font:600 12px Oswald;font-style:normal;background:#0008;border-radius:10px;padding:1px 7px}
.fg-main{flex:1;min-height:0;display:flex;gap:8px;padding:0 8px 4px}
.fg-ceu{position:relative;flex:1.3;min-width:0;border-radius:14px;overflow:hidden;border:1px solid #ffffff22}
.fg-ceu canvas{position:absolute;inset:0;width:100%;height:100%}
.fg-aviso{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#000c;border:1px solid #fb923c;border-radius:14px;padding:5px 12px;font:500 14px Oswald;color:#fff;white-space:nowrap;z-index:2}
.fg-qtd{position:absolute;right:8px;bottom:6px;font:500 12px Rubik;color:#cbd5e1;background:#0008;border-radius:10px;padding:1px 8px}
.fg-lado{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;min-height:0}
.fg-paineis{display:flex;gap:6px}
.fg-painel{flex:1;min-width:0;background:#141a3a;border:1px solid #ffffff1c;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:6px}
.fg-val{display:flex;flex-direction:column;gap:4px}
.fg-row{display:flex;align-items:center;gap:4px}
.fg-row button{width:30px;height:30px;border-radius:50%;border:none;background:#2a3366;color:#fff;font-size:18px}
.fg-row input{flex:1;min-width:0;text-align:center;background:#0b1030;border:1px solid #ffffff22;border-radius:8px;color:#fff;font:600 16px Oswald;height:30px}
.fg-q{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}
.fg-q button{border:none;border-radius:6px;background:#22295a;color:#cbd5e1;font:500 12px Rubik;padding:3px 0}
.fg-auto{display:flex;align-items:center;gap:4px;font:500 11px Rubik;color:#cbd5e1}
.fg-auto input[inputmode]{width:46px;background:#0b1030;border:1px solid #ffffff22;border-radius:6px;color:#fff;text-align:center;font:500 12px Rubik;height:22px}
.fg-btn{border:none;border-radius:12px;color:#fff;font:700 clamp(15px,3.4vmin,20px) Oswald;padding:8px 4px;display:flex;flex-direction:column;align-items:center;line-height:1.1;box-shadow:0 4px 0 #0007}
.fg-btn small{font:500 12px Rubik;opacity:.95}
.fg-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #0007}
.fg-btn.green{background:linear-gradient(180deg,#22c55e,#15803d)}
.fg-btn.orange{background:linear-gradient(180deg,#fb923c,#c2410c)}
.fg-btn.red{background:linear-gradient(180deg,#ef4444,#991b1b)}
.fg-btn.ok{background:linear-gradient(180deg,#0ea5e9,#0369a1)}
.fg-lista{flex:1;min-height:0;overflow:auto;background:#0e1330;border:1px solid #ffffff1c;border-radius:12px;padding:4px 6px}
.fg-lt{display:flex;justify-content:space-between;font:500 12px Rubik;color:#94a3b8;padding:2px 0 4px}
.fg-li{display:grid;grid-template-columns:1fr 46px 50px 50px;gap:4px;font:500 12px Rubik;color:#e2e8f0;padding:3px 4px;border-radius:6px}
.fg-li span:not(:first-child){text-align:right}
.fg-li span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fg-li.win{background:#16a34a33;color:#86efac}
.fg-li.lost{opacity:.5}
.fg-vazio{font:500 12px Rubik;color:#64748b;text-align:center;padding:10px}
.fg-rod{font:400 10px Rubik;color:#64748b;text-align:center;padding:0 0 4px}
@media (orientation:portrait){.fg-main{flex-direction:column}.fg-ceu{flex:none;height:38vh}.fg-lado{flex:1}}
`}</style>
    </div>
  );
}

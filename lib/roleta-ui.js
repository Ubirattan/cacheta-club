// Tela da ROLETA (sem React): roda girando no canvas + mesa de apostas + fichas.
// Usada pela página /roleta (sorteio no servidor) e pela página de teste (sorteio de mentira).
//
//   const ui = criarRoleta(div, { coins, girar: async apostas => ({ numero, volta, coins }), onCoins, som })
//   ui.setCoins(n); ui.destroy();
// Ao vivo (opts.vivo): o botão vira APOSTAR (opts.apostar) e a página manda a fase e o número:
//   ui.setFase(fase, segundos), ui.setMinha(apostas), ui.resultado(numero, volta, apostado, msRestante), ui.setHistorico(lista)
import { RODA, cor, APOSTAS, MAX_APOSTA, FICHAS, conferir } from './roleta.js';

const SEG = Math.PI * 2 / 37;
const COR = { vermelho: '#c81e1e', preto: '#15171c', verde: '#0f8a43' };
const CHIP = { 1: ['#f8fafc', '#94a3b8', '#111'], 5: ['#dc2626', '#fca5a5', '#fff'], 10: ['#2563eb', '#93c5fd', '#fff'], 25: ['#16a34a', '#86efac', '#fff'], 100: ['#111827', '#facc15', '#facc15'] };

export function criarRoleta(root, opts = {}) {
  const som = opts.som || (() => {});
  let coins = opts.coins ?? null, ficha = 5, apostas = {}, ultima = null, historico = [], girando = false, alive = true;
  let hist = [];   // pilha pra desfazer
  const vivo = !!opts.vivo;
  let firmes = {}, fechado = false, enviando = false, faseAtual = null;   // ao vivo: apostas já confirmadas nesta rodada

  root.innerHTML = `
  <div class="rl">
    <div class="rl-roda"><canvas></canvas><div class="rl-res"></div></div>
    <div class="rl-lado">
      <div class="rl-info">
        <span class="rl-saldo">💰 <b>–</b></span>
        <span class="rl-tot">Aposta <b>0</b>/${MAX_APOSTA}</span>${vivo ? '<span class="rl-tempo"></span>' : ''}
        <span class="rl-hist"></span>
      </div>
      <div class="rl-mesa"></div>
      <div class="rl-ctl">
        <div class="rl-chips">${FICHAS.map(f => `<button class="rl-chip c${f}" data-f="${f}">${f}</button>`).join('')}</div>
        <button class="rl-b" data-a="desfazer" title="Desfazer">↶</button>
        <button class="rl-b" data-a="limpar">Limpar</button>
        <button class="rl-b" data-a="repetir">Repetir</button>
        <button class="rl-gira" data-a="girar">${vivo ? 'APOSTAR' : 'GIRAR'}</button>
      </div>
      <div class="rl-aviso">Proibido para menores de 18 anos · Fichas sem valor em dinheiro · Jogue por diversão</div>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  const cv = $('.rl-roda canvas'), c = cv.getContext('2d'), mesa = $('.rl-mesa');

  /* ---------- mesa ---------- */
  const cell = (k, txt, cls, style) => `<div class="rl-c ${cls || ''}" data-k="${k}" style="${style || ''}"><span>${txt}</span><i class="rl-f"></i></div>`;
  let h = cell('n0', '0', 'z verde', 'grid-row:1/4;grid-column:1');
  for (let col = 0; col < 12; col++) for (let row = 0; row < 3; row++) {
    const n = col * 3 + (3 - row);
    h += cell('n' + n, n, cor(n), `grid-row:${row + 1};grid-column:${col + 2}`);
  }
  for (let row = 0; row < 3; row++) h += cell('c' + (3 - row), '2:1', 'out', `grid-row:${row + 1};grid-column:14`);
  for (let d = 1; d <= 3; d++) h += cell('d' + d, `${d}ª 12`, 'out', `grid-row:4;grid-column:${(d - 1) * 4 + 2}/span 4`);
  [['baixo', '1-18'], ['par', 'PAR'], ['vermelho', '<em class="lo v"></em>'], ['preto', '<em class="lo p"></em>'], ['impar', 'ÍMPAR'], ['alto', '19-36']]
    .forEach(([k, t], i) => { h += cell(k, t, 'out', `grid-row:5;grid-column:${i * 2 + 2}/span 2`); });
  mesa.innerHTML = h;

  const soma = o => Object.values(o).reduce((a, b) => a + b, 0);
  function render() {
    const tot = soma(apostas), ft = soma(firmes);
    $('.rl-tot b').textContent = tot + ft;
    $('.rl-saldo b').textContent = coins == null ? '–' : coins.toLocaleString('pt-BR');
    mesa.querySelectorAll('.rl-c').forEach(el => {
      const v = (apostas[el.dataset.k] || 0) + (firmes[el.dataset.k] || 0), f = el.querySelector('.rl-f');
      f.textContent = v || ''; f.className = 'rl-f' + (v ? ' on c' + (v >= 100 ? 100 : v >= 25 ? 25 : v >= 10 ? 10 : v >= 5 ? 5 : 1) : '') + (firmes[el.dataset.k] && !apostas[el.dataset.k] ? ' firme' : '');
    });
    root.querySelectorAll('.rl-chip').forEach(b => b.classList.toggle('on', Number(b.dataset.f) === ficha));
    const trava = girando || fechado || enviando;
    root.querySelector('[data-a=girar]').disabled = trava || !tot;
    root.querySelector('[data-a=repetir]').disabled = trava || !ultima;
    root.querySelector('[data-a=limpar]').disabled = trava || !tot;
    root.querySelector('[data-a=desfazer]').disabled = trava || !hist.length;
    mesa.classList.toggle('travada', trava);
    $('.rl-hist').innerHTML = historico.slice(0, 10).map(n => `<i class="${cor(n)}">${n}</i>`).join('');
  }
  const aviso = t => { const r = $('.rl-res'); r.innerHTML = `<div class="rl-msg">${t}</div>`; r.className = 'rl-res show'; clearTimeout(aviso.t); aviso.t = setTimeout(() => { r.className = 'rl-res'; }, 1800); };

  function por(k) {
    if (girando || fechado || enviando) return;
    const tot = soma(apostas) + soma(firmes);
    let f = Math.min(ficha, MAX_APOSTA - tot);
    if (coins != null) f = Math.min(f, coins - soma(apostas));
    if (f <= 0) { som('err'); aviso(coins != null && coins - tot <= 0 ? 'Sem fichas pra apostar mais' : `Máximo ${MAX_APOSTA} fichas por rodada`); return; }
    hist.push({ ...apostas }); apostas[k] = (apostas[k] || 0) + f; som('tick'); render();
  }
  mesa.addEventListener('click', e => { const el = e.target.closest('.rl-c'); if (el) por(el.dataset.k); });
  root.querySelector('.rl-ctl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.f) { ficha = Number(b.dataset.f); render(); return; }
    const a = b.dataset.a;
    if (a === 'limpar') { hist.push({ ...apostas }); apostas = {}; }
    if (a === 'desfazer' && hist.length) apostas = hist.pop();
    if (a === 'repetir' && ultima) {
      const tot = Object.values(ultima).reduce((x, y) => x + y, 0);
      if (coins != null && tot > coins) { som('err'); aviso('Sem fichas pra repetir essa aposta'); return; }
      hist.push({ ...apostas }); apostas = { ...ultima };
    }
    if (a === 'girar') return vivo ? apostarVivo() : girar();
    render();
  });

  // ao vivo: manda as fichas da mesa pra rodada atual (dá pra apostar mais de uma vez até fechar)
  async function apostarVivo() {
    const ok = conferir(apostas);
    if (ok.erro) { aviso(ok.erro); return; }
    enviando = true; render();
    try {
      const r = await opts.apostar({ ...ok.apostas });
      firmes = r.minha?.apostas || { ...firmes, ...ok.apostas }; apostas = {}; hist = [];
      if (r.coins != null) coins = r.coins;
      opts.onCoins && opts.onCoins(coins); som('coin'); aviso('Aposta feita! Boa sorte');
    } catch (e) { som('err'); aviso(e.message || 'Erro'); }
    enviando = false; render();
  }

  async function girar() {
    const ok = conferir(apostas);
    if (ok.erro) { aviso(ok.erro); return; }
    girando = true; mesa.querySelectorAll('.win').forEach(x => x.classList.remove('win'));
    if (coins != null) coins -= ok.total;
    render(); som('turn');
    let r;
    try { r = await opts.girar({ ...ok.apostas }); }
    catch (e) { if (coins != null) coins += ok.total; girando = false; render(); aviso(e.message || 'Erro'); som('err'); return; }
    await anima(r.numero);
    if (!alive) return;
    girando = false; ultima = { ...ok.apostas }; apostas = {}; hist = [];
    historico.unshift(r.numero);
    coins = r.coins ?? (coins != null ? coins + r.volta : null);
    opts.onCoins && opts.onCoins(coins);
    for (const k of Object.keys(APOSTAS)) if (APOSTAS[k].ganha(r.numero)) mesa.querySelector(`[data-k="${k}"]`)?.classList.add('win');
    const res = $('.rl-res'), lucro = r.volta - ok.total;
    res.innerHTML = `<div class="rl-num ${cor(r.numero)}">${r.numero}</div><div class="rl-msg">${r.volta ? `Ganhou <b>${r.volta}</b> ficha${r.volta > 1 ? 's' : ''}${lucro > 0 ? ` (lucro ${lucro})` : ''}` : 'Não foi dessa vez'}</div>`;
    res.className = 'rl-res show big'; clearTimeout(aviso.t); aviso.t = setTimeout(() => { res.className = 'rl-res'; }, 3200);
    som(r.volta ? (lucro > 0 ? 'win' : 'coin') : 'lose');
    render();
  }

  /* ---------- roda ---------- */
  let wA = Math.random() * 6.28, bA = 0, bR = .81, preso = null, anim = null, last = performance.now(), size = 300, dpr = 1;
  function fit() {
    const r = cv.parentElement.getBoundingClientRect();
    size = Math.max(120, Math.min(r.width, r.height)); dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + 'px'; cv.style.height = size + 'px';
  }
  fit(); const ro = new ResizeObserver(fit); ro.observe(cv.parentElement);

  function anima(numero, D = 10000) {
    return new Promise(res => {
      const i = RODA.indexOf(numero), w0 = wA, wT = (D / 10000) * 4 * Math.PI * 2 + Math.random();
      const wf = w0 + wT, alvo = wf + i * SEG - Math.PI / 2;
      let b0 = preso != null ? wA + preso * SEG - Math.PI / 2 : bA;
      const voltas = Math.max(2, Math.round(13 * D / 10000)), base = alvo - voltas * Math.PI * 2;                // a bolinha corre ao contrário
      let tr = ((b0 - base) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const total = -(voltas * Math.PI * 2 + (Math.PI * 2 - tr) % (Math.PI * 2));
      preso = null;
      anim = { t0: performance.now(), D, w0, wT, b0, total, i, res, lastSeg: -1 };
    });
  }
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function tick(now) {
    if (!alive) return;
    requestAnimationFrame(tick);
    const dt = Math.min(50, now - last); last = now;
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.D);
      wA = anim.w0 + anim.wT * easeOut(t);
      bA = anim.b0 + anim.total * (1 - Math.pow(1 - t, 2.4));
      if (t < .6) bR = .81;
      else if (t < .88) { const u = (t - .6) / .28; bR = .81 - .15 * u + Math.abs(Math.sin(u * 9)) * .05 * (1 - u); }
      else bR = .66;
      const sg = Math.floor(((bA - wA) % (Math.PI * 2) + Math.PI * 2) / SEG);
      if (t > .55 && sg !== anim.lastSeg && t < .95) { anim.lastSeg = sg; if (Math.random() < .5) som('bola'); }
      if (t >= 1) { preso = anim.i; const r = anim.res; anim = null; r(); }
    } else wA += dt * .00025;                                                 // parada, gira devagarinho
    if (preso != null) { bA = wA + preso * SEG - Math.PI / 2; bR = .66; }
    draw();
  }

  function draw() {
    const R = size / 2 * .96;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size, size); c.translate(size / 2, size / 2);
    // sombra e aro de madeira
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(4, 6, R, 0, 7); c.fill();
    const wood = c.createRadialGradient(-R * .3, -R * .3, R * .2, 0, 0, R);
    wood.addColorStop(0, '#9a5b2a'); wood.addColorStop(.7, '#6b3a17'); wood.addColorStop(1, '#3e1f0a');
    c.fillStyle = wood; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.strokeStyle = '#d4a24c'; c.lineWidth = R * .015; c.beginPath(); c.arc(0, 0, R * .985, 0, 7); c.stroke();
    // pista da bolinha
    const pista = c.createRadialGradient(0, 0, R * .74, 0, 0, R * .88);
    pista.addColorStop(0, '#2a1a0e'); pista.addColorStop(.5, '#5a3418'); pista.addColorStop(1, '#2a1709');
    c.fillStyle = pista; c.beginPath(); c.arc(0, 0, R * .88, 0, 7); c.fill();
    // casas com os números (giram com a roda)
    c.save(); c.rotate(wA);
    for (let i = 0; i < 37; i++) {
      const n = RODA[i], a0 = i * SEG - Math.PI / 2 - SEG / 2;
      c.fillStyle = COR[cor(n)]; c.beginPath(); c.arc(0, 0, R * .76, a0, a0 + SEG); c.arc(0, 0, R * .56, a0 + SEG, a0, true); c.closePath(); c.fill();
      c.strokeStyle = '#d4a24c'; c.lineWidth = Math.max(1, R * .006); c.stroke();
      c.save(); c.rotate(i * SEG); c.fillStyle = '#fff'; c.font = `700 ${Math.max(8, R * .075)}px Oswald, Rubik, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n), 0, -R * .695); c.restore();
    }
    // fundo das casas (onde a bolinha cai)
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(0, 0, R * .64, 0, 7); c.arc(0, 0, R * .56, 0, 7, true); c.fill('evenodd');
    // cone do meio, de metal, com a cruzeta
    const cone = c.createRadialGradient(-R * .12, -R * .14, R * .02, 0, 0, R * .56);
    cone.addColorStop(0, '#f6e7b8'); cone.addColorStop(.35, '#b8862f'); cone.addColorStop(.75, '#6b4a17'); cone.addColorStop(1, '#3b2a0c');
    c.fillStyle = cone; c.beginPath(); c.arc(0, 0, R * .56, 0, 7); c.fill();
    c.strokeStyle = '#e8c56a'; c.lineCap = 'round';
    for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.lineWidth = R * .035; c.beginPath(); c.moveTo(0, -R * .08); c.lineTo(0, -R * .36); c.stroke(); c.fillStyle = '#f3dc95'; c.beginPath(); c.arc(0, -R * .38, R * .04, 0, 7); c.fill(); }
    c.fillStyle = '#f3dc95'; c.beginPath(); c.arc(0, 0, R * .09, 0, 7); c.fill();
    c.restore();
    // brilho em cima
    const gl = c.createLinearGradient(0, -R, 0, R); gl.addColorStop(0, 'rgba(255,255,255,.14)'); gl.addColorStop(.5, 'rgba(255,255,255,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, R * .88, 0, 7); c.fill();
    // bolinha
    const bx = Math.cos(bA) * R * bR, by = Math.sin(bA) * R * bR, br = Math.max(3.5, R * .032);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(bx + br * .4, by + br * .5, br, 0, 7); c.fill();
    const bg = c.createRadialGradient(bx - br * .4, by - br * .4, br * .1, bx, by, br);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.6, '#e5e7eb'); bg.addColorStop(1, '#9ca3af');
    c.fillStyle = bg; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill();
  }

  const style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
  render(); requestAnimationFrame(tick);
  return {
    setCoins(n) { if (!girando) { coins = n; render(); } },
    // ---- ao vivo ----
    setFase(f, seg) {
      const t = $('.rl-tempo');
      if (f === 'apostas' && faseAtual && faseAtual !== 'apostas') {     // rodada nova
        if (soma(firmes)) ultima = { ...firmes };
        firmes = {}; mesa.querySelectorAll('.win').forEach(x => x.classList.remove('win'));
      }
      faseAtual = f; fechado = f !== 'apostas';
      if (t) { t.textContent = f === 'apostas' ? `⏱ Apostas: ${seg}s` : f === 'girando' ? '🎡 Girando…' : '⏳ Próxima rodada'; t.className = 'rl-tempo' + (f === 'apostas' && seg <= 5 ? ' fim' : ''); }
      if (fechado && soma(apostas)) { apostas = {}; hist = []; }     // fichas que não foram apostadas voltam pra mão
      render();
    },
    setMinha(m) { if (!enviando) { firmes = m?.apostas ? { ...m.apostas } : {}; render(); } },
    setHistorico(l) { historico = (l || []).slice(); render(); },
    async resultado(numero, volta, apostado, resto = 10000) {
      if (girando) return;
      girando = true; render();
      if (resto > 1200) await anima(numero, Math.min(10000, resto)); else { preso = RODA.indexOf(numero); }
      if (!alive) return;
      girando = false;
      for (const k of Object.keys(APOSTAS)) if (APOSTAS[k].ganha(numero)) mesa.querySelector(`[data-k="${k}"]`)?.classList.add('win');
      const res = $('.rl-res'), lucro = volta - apostado;
      res.innerHTML = `<div class="rl-num ${cor(numero)}">${numero}</div>` + (apostado ? `<div class="rl-msg">${volta ? `Ganhou <b>${volta}</b> ficha${volta > 1 ? 's' : ''}${lucro > 0 ? ` (lucro ${lucro})` : ''}` : 'Não foi dessa vez'}</div>` : '');
      res.className = 'rl-res show big'; clearTimeout(aviso.t); aviso.t = setTimeout(() => { res.className = 'rl-res'; }, 4200);
      if (apostado) som(volta ? (lucro > 0 ? 'win' : 'coin') : 'lose');
      opts.onCoins && opts.onCoins(coins);
      render();
    },
    destroy() { alive = false; ro.disconnect(); root.innerHTML = ''; },
  };
}

const CSS = `
.rl{display:flex;gap:clamp(8px,2vw,18px);height:100%;width:100%;align-items:stretch;user-select:none;-webkit-user-select:none;font-family:Rubik,system-ui,sans-serif;color:#f4ead2}
.rl-roda{flex:0 0 42%;max-width:46vh;min-width:150px;position:relative;display:flex;align-items:center;justify-content:center}
.rl-roda{max-width:none;flex-basis:min(42%,calc(100% - 300px))}
.rl-res{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .25s}
.rl-res.show{opacity:1}
.rl-num{width:clamp(54px,12vmin,88px);height:clamp(54px,12vmin,88px);border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 clamp(26px,6vmin,44px) Oswald,sans-serif;color:#fff;border:3px solid #f2c94c;box-shadow:0 0 0 3px #000,0 8px 24px rgba(0,0,0,.6);animation:rlpop .35s}
.rl-num.vermelho{background:#c81e1e}.rl-num.preto{background:#15171c}.rl-num.verde{background:#0f8a43}
.rl-msg{margin-top:8px;background:rgba(0,0,0,.78);border:1.5px solid #c8a24a;border-radius:16px;padding:5px 12px;font:500 clamp(13px,2.8vmin,17px) Oswald,sans-serif;text-align:center}
.rl-msg b{color:#f2c94c}
@keyframes rlpop{from{transform:scale(.4)}to{transform:scale(1)}}
.rl-lado{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;justify-content:center}
.rl-info{display:flex;align-items:center;gap:8px;font:500 clamp(12px,2.6vmin,16px) Oswald,sans-serif;flex-wrap:wrap}
.rl-info>span:not(.rl-hist){background:#000a;border:1.5px solid #8a6a2a;border-radius:16px;padding:3px 10px;white-space:nowrap}
.rl-info b{color:#f2c94c}
.rl-hist{display:flex;gap:3px;margin-left:auto;overflow:hidden}
.rl-hist i{font:600 11px Oswald;font-style:normal;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;border:1px solid #c8a24a}
.rl-hist i:first-child{width:24px;height:24px;font-size:13px;box-shadow:0 0 6px #f2c94c}
.rl-hist i.vermelho{background:#c81e1e}.rl-hist i.preto{background:#15171c}.rl-hist i.verde{background:#0f8a43}
.rl-mesa{display:grid;grid-template-columns:1.15fr repeat(12,1fr) 1.15fr;grid-template-rows:repeat(3,1fr) .85fr .85fr;gap:2px;background:#0b3d22;padding:4px;border-radius:10px;border:3px solid #6b4a17;box-shadow:inset 0 0 20px rgba(0,0,0,.6);height:clamp(150px,52vh,300px)}
.rl-mesa.travada{opacity:.85;pointer-events:none}
.rl-c{position:relative;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.55);border-radius:3px;cursor:pointer;font:600 clamp(10px,2.6vmin,16px) Oswald,sans-serif;color:#fff;background:#0f6b3a;min-width:0}
.rl-c.vermelho{background:#b91c1c}.rl-c.preto{background:#1a1c22}.rl-c.verde{background:#0f8a43}
.rl-c.out{background:#0f5c32;font-size:clamp(9px,2.2vmin,14px)}
.rl-c:active{filter:brightness(1.35)}
.rl-c.win{animation:rlwin .5s 4 alternate;box-shadow:0 0 0 2px #f2c94c,0 0 14px #f2c94c;z-index:1}
@keyframes rlwin{to{filter:brightness(1.7)}}
.rl-c .lo{display:inline-block;width:14px;height:14px;transform:rotate(45deg);border:1px solid #fff}
.lo.v{background:#c81e1e}.lo.p{background:#111}
.rl-f{position:absolute;display:none;width:clamp(18px,4.4vmin,26px);height:clamp(18px,4.4vmin,26px);border-radius:50%;font:700 clamp(9px,2vmin,12px) Oswald;font-style:normal;align-items:center;justify-content:center;border:2px dashed rgba(255,255,255,.85);box-shadow:0 2px 4px rgba(0,0,0,.6);z-index:2;pointer-events:none}
.rl-f.on{display:flex}
.rl-f.c1,.rl-chip.c1{background:#f8fafc;color:#111}.rl-f.c5,.rl-chip.c5{background:#dc2626;color:#fff}
.rl-f.c10,.rl-chip.c10{background:#2563eb;color:#fff}.rl-f.c25,.rl-chip.c25{background:#16a34a;color:#fff}.rl-f.c100,.rl-chip.c100{background:#111827;color:#facc15}
.rl-ctl{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rl-chips{display:flex;gap:5px}
.rl-chip{width:clamp(34px,7.5vmin,44px);height:clamp(34px,7.5vmin,44px);border-radius:50%;border:3px dashed rgba(255,255,255,.9);font:700 clamp(12px,2.8vmin,15px) Oswald;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.5);transition:transform .1s}
.rl-chip.on{transform:translateY(-4px) scale(1.08);box-shadow:0 0 0 3px #f2c94c,0 5px 10px rgba(0,0,0,.6)}
.rl-b{background:#1d1a14;color:#f4ead2;border:1.5px solid #8a6a2a;border-radius:18px;padding:0 12px;height:clamp(32px,7vmin,40px);font:500 clamp(12px,2.7vmin,15px) Oswald;cursor:pointer}
.rl-b:disabled,.rl-gira:disabled{opacity:.4;cursor:default}
.rl-gira{margin-left:auto;background:linear-gradient(180deg,#ffd76a,#c8901c);color:#3a2300;border:0;border-radius:22px;padding:0 22px;height:clamp(36px,8vmin,46px);font:700 clamp(15px,3.4vmin,20px) Oswald;letter-spacing:1px;cursor:pointer;box-shadow:0 3px 0 #7a5410}
.rl-f.firme{border-style:solid;box-shadow:0 0 0 2px #f2c94c,0 2px 4px rgba(0,0,0,.6)}
.rl-tempo{background:#000a;border:1.5px solid #f2c94c;border-radius:16px;padding:3px 10px;white-space:nowrap;color:#f2c94c}
.rl-tempo.fim{border-color:#ef4444;color:#fca5a5;animation:rlwin .5s infinite alternate}
.rl-aviso{font:400 10px Rubik,sans-serif;color:#a89a7c;text-align:center}
`;

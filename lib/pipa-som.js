'use client';
// Sons do jogo da pipa, sintetizados (sem arquivo de áudio):
//  • vento: chiado que sobe e desce com a força do vento
//  • linha cantando: zumbido agudo quando a sua linha está cruzada com outra (mais forte puxando)
//  • linha correndo: chiado curto enquanto descarrega
//  • gritos ("Réééélo!", "Aparou!"...): áudio gravado em public/pipa-voz/ (se não tiver, só aparece escrito)
import { audioCtx, soundOn } from './sfx.js';

// frases que já têm gravação em public/pipa-voz/
export const GRAVADAS = ['helou', 'helou-busca', 'manda-busca', 'coloca-outra', 'bora', 'tomou-relo', 'parei'];

export function createSom() {
  const AC = audioCtx();
  let ok = !!AC && soundOn(), nodes = [];
  let vento, ventoF, canto, cantoO, cantoO2, corre;
  if (ok) {
    try {
      const n = AC.sampleRate * 2, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
      let last = 0; for (let i = 0; i < n; i++) { last = last * .97 + (Math.random() * 2 - 1) * .03; d[i] = last * 6; }   // ruído grave (vento)
      const src = AC.createBufferSource(); src.buffer = b; src.loop = true;
      ventoF = AC.createBiquadFilter(); ventoF.type = 'bandpass'; ventoF.frequency.value = 400; ventoF.Q.value = .7;
      vento = AC.createGain(); vento.gain.value = 0;
      src.connect(ventoF).connect(vento).connect(AC.destination); src.start();
      // linha cantando: duas ondas desafinadas
      cantoO = AC.createOscillator(); cantoO.type = 'sawtooth'; cantoO.frequency.value = 520;
      cantoO2 = AC.createOscillator(); cantoO2.type = 'triangle'; cantoO2.frequency.value = 527;
      const cf = AC.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1100; cf.Q.value = 3;
      canto = AC.createGain(); canto.gain.value = 0;
      cantoO.connect(cf); cantoO2.connect(cf); cf.connect(canto).connect(AC.destination); cantoO.start(); cantoO2.start();
      // linha correndo (descarregando): ruído agudo
      const b2 = AC.createBuffer(1, AC.sampleRate, AC.sampleRate), d2 = b2.getChannelData(0);
      for (let i = 0; i < d2.length; i++) d2[i] = Math.random() * 2 - 1;
      const s2 = AC.createBufferSource(); s2.buffer = b2; s2.loop = true;
      const f2 = AC.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 3500;
      corre = AC.createGain(); corre.gain.value = 0;
      s2.connect(f2).connect(corre).connect(AC.destination); s2.start();
      nodes = [src, cantoO, cantoO2, s2];
    } catch { ok = false; }
  }
  const alvo = (g, v) => { try { g.gain.setTargetAtTime(v, AC.currentTime, .08); } catch {} };

  // estado: { vento (-1..1), cruzando (bool), forte (bool), solta (bool) }
  function update({ vento: w = 0, cruzando = false, forte = false, solta = false }) {
    if (!ok) return;
    if (!soundOn()) { alvo(vento, 0); alvo(canto, 0); alvo(corre, 0); return; }
    const f = Math.min(1, Math.abs(w));
    alvo(vento, .02 + f * .04);
    try { ventoF.frequency.setTargetAtTime(300 + f * 500, AC.currentTime, .3); } catch {}
    alvo(canto, cruzando ? (forte ? .05 : .022) : 0);
    try { const hz = forte ? 640 : 520; cantoO.frequency.setTargetAtTime(hz, AC.currentTime, .05); cantoO2.frequency.setTargetAtTime(hz * 1.013, AC.currentTime, .05); } catch {}
    alvo(corre, solta ? .018 : 0);
  }
  // gritos: áudio gravado (public/pipa-voz/<chave>.mp3). A voz do celular (Google) ficou ruim e foi desligada:
  // enquanto não tiver a gravação, o grito só aparece escrito na tela.
  // O computador usa a mesma gravação, mais grave (tocada mais devagar), pra parecer outro menino.
  const CHAVES = [
    [/medros/, 'medroso'], [/tomou/, 'tomou-relo'], [/parei/, 'parei'], [/hel.*busca/, 'helou-busca'], [/busca/, 'manda-busca'], [/descarreg/, 'descarrega-vem'],
    [/vem,? vem/, 'vem-vem'], [/rel/, 'relo'], [/hel/, 'helou'], [/aparou/, 'aparou'], [/bora/, 'bora'],
    [/alto/, 'coloca-alto'], [/outra/, 'coloca-outra'], [/foi/, 'ja-foi'], [/parei/, 'parei'],
  ];
  const limpa = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(.)\1+/g, '$1');
  const chave = t => { const l = limpa(t); const c = CHAVES.find(([re]) => re.test(l)); return c ? c[1] : null; };
  const falta = new Set(), tocando = [];
  // as gravações são baixadas no começo da partida e tocadas pelo mesmo áudio do jogo (Web Audio),
  // que já foi liberado no toque do botão JOGAR — assim o celular não bloqueia o som no meio do jogo
  const buf = {};
  if (AC) for (const k of GRAVADAS) {
    fetch('/pipa-voz/' + k + '.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => new Promise((ok, no) => AC.decodeAudioData(b, ok, no)))
      .then(d => { buf[k] = d; }).catch(() => {});
  }
  const tem = texto => { const k = chave(texto); return !!k && GRAVADAS.includes(k); };
  function grito(texto, { voz: quem = 'eu' } = {}) {
    if (!soundOn()) return;
    const k = chave(texto); if (!k || falta.has(k) || !GRAVADAS.includes(k)) return;
    tocando.forEach(a => { try { a.stop ? a.stop() : a.pause(); } catch {} }); tocando.length = 0;
    try {
      if (AC && buf[k]) {
        if (AC.state === 'suspended') AC.resume().catch(() => {});
        const src = AC.createBufferSource(), g = AC.createGain();
        src.buffer = buf[k]; src.playbackRate.value = quem === 'eu' ? 1 : .82; g.gain.value = 1.4;
        src.connect(g).connect(AC.destination); src.start(); tocando.push(src);
        return;
      }
      const a = new Audio('/pipa-voz/' + k + '.mp3'); a.volume = 1;
      if (quem !== 'eu') { a.playbackRate = .82; a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false; }
      a.onerror = () => falta.add(k);
      tocando.push(a); a.play().catch(() => {});
    } catch {}
  }
  function stop() {
    nodes.forEach(n => { try { n.stop(); } catch {} });
    tocando.forEach(a => { try { a.pause(); } catch {} });
    ok = false;
  }
  return { update, grito, tem, stop };
}

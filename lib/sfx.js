'use client';
// Sons sintetizados (sem arquivos de áudio)
let AC = null;
// Um só AudioContext pro site todo. Em alguns celulares Android criar o AudioContext
// trava a tela por vários segundos; por isso ele é criado num toque de botão (ex.: "Jogar")
// e os sons do meio da jogada só usam um que já existe.
export function unlockAudio() {
  if (typeof window === 'undefined' || !soundOn()) return null;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume().catch(() => {});
  } catch { AC = null; }
  return AC;
}
export const audioCtx = () => AC;
export function soundOn() { try { return localStorage.getItem('cc_sound') !== '0'; } catch { return true; } }
export function setSound(on) { try { localStorage.setItem('cc_sound', on ? '1' : '0'); } catch {} }
export function sfx(t) {
  if (typeof window === 'undefined' || !soundOn()) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const now = AC.currentTime;
    if (t === 'card') {
      const b = AC.createBuffer(1, AC.sampleRate * .07, AC.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
      f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = .5;
      s.buffer = b; s.connect(f).connect(g).connect(AC.destination); s.start();
      return;
    }
    const notes = { tick: [[1046, .05]], win: [[523, .12], [659, .12], [784, .12], [1046, .3]], lose: [[392, .15], [330, .15], [262, .35]], turn: [[660, .07], [880, .1]], err: [[200, .12]], coin: [[1318, .06], [1760, .12]], msg: [[880, .05]] }[t] || [];
    let at = now;
    for (const [f, d] of notes) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = t === 'err' ? 'square' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.18, at); g.gain.exponentialRampToValueAtTime(.001, at + d);
      o.connect(g).connect(AC.destination); o.start(at); o.stop(at + d + .02); at += d * .85;
    }
  } catch {}
}

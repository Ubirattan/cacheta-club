'use client';
// Sons do jogo da pipa, sintetizados (sem arquivo de áudio):
//  • vento: chiado que sobe e desce com a força do vento
//  • linha cantando: zumbido agudo quando a sua linha está cruzada com outra (mais forte puxando)
//  • linha correndo: chiado curto enquanto descarrega
//  • gritos ("Vaaai!", "Aparou!"): voz do próprio celular (speechSynthesis), em português
import { audioCtx, soundOn } from './sfx.js';

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
    alvo(vento, .05 + f * .1);
    try { ventoF.frequency.setTargetAtTime(300 + f * 500, AC.currentTime, .3); } catch {}
    alvo(canto, cruzando ? (forte ? .05 : .022) : 0);
    try { const hz = forte ? 640 : 520; cantoO.frequency.setTargetAtTime(hz, AC.currentTime, .05); cantoO2.frequency.setTargetAtTime(hz * 1.013, AC.currentTime, .05); } catch {}
    alvo(corre, solta ? .035 : 0);
  }
  function grito(texto) {
    if (!soundOn()) return;
    try {
      const sp = window.speechSynthesis; if (!sp) return;
      sp.cancel();
      const u = new SpeechSynthesisUtterance(texto); u.lang = 'pt-BR'; u.rate = texto.length > 8 ? .9 : 1.15; u.pitch = 1.3; u.volume = 1;
      sp.speak(u);
    } catch {}
  }
  function stop() {
    nodes.forEach(n => { try { n.stop(); } catch {} });
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
    ok = false;
  }
  return { update, grito, stop };
}

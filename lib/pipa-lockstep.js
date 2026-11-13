'use client';
// Pipa online: os dois celulares rodam a MESMA partida (mesma semente, mesma física determinística)
// e trocam só os toques (lockstep). Cada "vez" (VEZ quadros) usa os toques dos dois jogadores;
// o seu toque vale ATRASO vezes depois (dá tempo de chegar no outro celular).
// Os toques vão pelo canal ao vivo do Supabase (broadcast). Cada mensagem repete os últimos toques,
// então se uma se perder, a próxima cobre; parado esperando, reenvia de tempos em tempos.
import { newPipa, stepPipa } from './pipa.js';

export const VEZ = 4, ATRASO = 6;   // 4 quadros por vez (15 por segundo); toque vale 6 vezes depois (~0,4 s)
const q = v => Math.round(v * 10) / 10;
const pack = c => [c.x | 0, q(c.y || 0), c.solta ? 1 : 0, c.puxa ? 1 : 0];
const unpack = a => (a ? { x: a[0], y: a[1], solta: !!a[2], puxa: !!a[3] } : null);

export function createLockstep({ seed, me, names, enviar, agora = () => Date.now() }) {
  const G = newPipa({ pipas: 2, seed, humanos: [0, 1], names });
  const toques = new Map();            // vez -> [toque0, toque1]
  const meus = [];                     // últimos [vez, toque] que eu mandei
  let vez = 0, quadro = 0, enviadoAte = -1, travadoDesde = null, ultReenvio = 0;
  for (let t = 0; t < ATRASO; t++) toques.set(t, [[0, 0, 0, 0], [0, 0, 0, 0]]);
  const guarda = (t, p, c) => { const v = toques.get(t) || [null, null]; v[p] = c; toques.set(t, v); };

  function recebe(m) {   // chegou mensagem do outro celular
    if (!m || m.p === me || !Array.isArray(m.c)) return;
    for (const [t, c] of m.c) if (t >= vez && Array.isArray(c)) guarda(t, m.p, c);
  }
  // um quadro de física, se já tiver os toques dos dois pra vez atual
  function quadroUm(ctlAtual) {
    if (G.over) return false;
    if (enviadoAte < vez) {   // começo da vez: o meu toque de agora vale daqui a ATRASO vezes
      const c = pack(ctlAtual), alvo = vez + ATRASO;
      guarda(alvo, me, c); meus.push([alvo, c]); if (meus.length > 8) meus.shift();
      enviar({ p: me, c: meus.slice(-5) }); enviadoAte = vez;
    }
    const v = toques.get(vez);
    if (!v || !v[0] || !v[1]) {
      const t = agora(); if (travadoDesde == null) travadoDesde = t;
      if (t - ultReenvio > 250) { ultReenvio = t; enviar({ p: me, c: meus.slice(-5) }); }
      return false;
    }
    travadoDesde = null;
    stepPipa(G, { ctls: [unpack(v[0]), unpack(v[1])] });
    if (++quadro >= VEZ) { quadro = 0; toques.delete(vez - 3); vez++; }
    return true;
  }
  // resumo da partida pra conferir no servidor (os dois têm que dar igual)
  const resumo = () => JSON.stringify([G.score, G.round, G.t, G.cortou, G.aparou]);
  return { G, recebe, quadroUm, resumo, travado: () => (travadoDesde == null ? 0 : agora() - travadoDesde), vez: () => vez };
}

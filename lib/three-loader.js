'use client';
// Three.js vindo do CDN só quando um jogo 3D abre (gude e pipa); o resto do site continua leve.
/* ---------------- carregar o Three.js ---------------- */
let threeP = null;
export function loadThree() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem janela'));
  if (window.THREE && window.THREE.WebGLRenderer) return Promise.resolve(window.THREE);
  if (!threeP) threeP = new Promise((ok, fail) => {
    const srcs = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
    const tryNext = i => {
      if (i >= srcs.length) { threeP = null; fail(new Error('O 3D não carregou')); return; }
      const s = document.createElement('script'); s.src = srcs[i]; s.async = true;
      const t = setTimeout(() => { s.onload = s.onerror = null; s.remove(); tryNext(i + 1); }, 12000);
      s.onload = () => { clearTimeout(t); window.THREE && window.THREE.WebGLRenderer ? ok(window.THREE) : tryNext(i + 1); };
      s.onerror = () => { clearTimeout(t); s.remove(); tryNext(i + 1); };
      document.head.appendChild(s);
    };
    tryNext(0);
  });
  return threeP;
}
let glOk = null;   // testa uma vez só (cada teste abre um contexto WebGL)
export function webglOk() {
  if (glOk != null) return glOk;
  try {
    const c = document.createElement('canvas'), gl = window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'));
    glOk = !!gl;
    try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
  } catch { glOk = false; }
  return glOk;
}

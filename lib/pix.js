// Chave Pix do jogador: e-mail, CPF ou celular. Devolve a chave limpa ou lança erro com a mensagem.
export const PIX_TIPOS = [['cpf', 'CPF'], ['email', 'E-mail'], ['celular', 'Celular']];
function cpfOk(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i);
    if ((s * 10 % 11) % 10 !== +d[n]) return false;
  }
  return true;
}
export function normPix(tipo, chave) {
  const v = String(chave || '').trim();
  if (!v) throw new Error('Informe sua chave Pix');
  if (tipo === 'email') {
    const e = v.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 77) throw new Error('Chave Pix: e-mail inválido');
    return { tipo, chave: e };
  }
  if (tipo === 'cpf') {
    const d = v.replace(/\D/g, '');
    if (!cpfOk(d)) throw new Error('Chave Pix: CPF inválido');
    return { tipo, chave: d };
  }
  if (tipo === 'celular') {
    let d = v.replace(/\D/g, '');
    if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
    if (!/^[1-9]{2}9\d{8}$/.test(d)) throw new Error('Chave Pix: celular inválido (use DDD + número, ex.: 11 91234-5678)');
    return { tipo, chave: '+55' + d };
  }
  throw new Error('Escolha o tipo da chave Pix');
}
export function fmtPix(tipo, chave) {
  if (!chave) return '';
  if (tipo === 'cpf') return chave.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (tipo === 'celular') return chave.replace(/^\+55(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  return chave;
}

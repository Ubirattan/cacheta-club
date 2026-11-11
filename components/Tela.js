'use client';
// Celular: só horizontal + botão de tela cheia. Roda depois da página carregar.
import { useEffect } from 'react';
import { TELA_JS } from '../lib/tela.js';
export default function Tela() {
  useEffect(() => { if (!document.getElementById('ccland')) new Function(TELA_JS)(); }, []);
  return null;
}

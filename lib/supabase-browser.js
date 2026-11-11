'use client';
// Cliente do Supabase no navegador (chave pública) + chamadas para a nossa API.
import { createClient } from '@supabase/supabase-js';

let client = null;
export function sb() {
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
export async function api(path, body) {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Erro de conexão');
  return out;
}

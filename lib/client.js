'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}

export function usePoll(path, ms = 0) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(async () => {
    try {
      setData(await api(path));
      setErr(null);
    } catch (e) {
      setErr(e.message);
    }
  }, [path]);
  useEffect(() => {
    load();
    if (!ms) return;
    const t = setInterval(load, ms);
    return () => clearInterval(t);
  }, [load, ms]);
  return { data, err, reload: load, setData };
}

export function fileToDataUrl(file, max = 1200, q = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => reject(new Error('That photo could not be opened'));
    img.src = url;
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
}

export function waLink(phone, text) {
  const p = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

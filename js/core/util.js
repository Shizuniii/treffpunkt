/* Allgemeine Helfer ohne DOM. */

export const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function clone(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}
export const rid = (n = 10) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map(x => a[x % a.length]).join('');
};
export const PALETTE = [
  '#0F7B5A',
  '#2563EB',
  '#C2410C',
  '#7C3AED',
  '#0E7490',
  '#B45309',
  '#BE185D',
  '#4D7C0F',
  '#1D4ED8',
  '#9F1239',
];
export const colorFor = uid => {
  let h = 0;
  for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
export const initials = n =>
  (
    String(n || '')
      .trim()
      .split(/\s+/)
      .map(w => (w.match(/[\p{L}\p{N}]/u) || [''])[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('') || '?'
  ).toUpperCase();
/** wie Firestore setDoc(..., {merge:true}): Unter-Objekte zusammenführen, Listen/Werte ersetzen */
export function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}
export const cmpVer = (a, b) => {
  const x = String(a).split('.').map(Number),
    y = String(b || '0')
      .split('.')
      .map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};

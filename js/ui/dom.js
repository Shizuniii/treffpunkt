/* Kleine DOM-Helfer: Toasts, Kopieren, Links. */
import { FORCED_DEMO } from '../app/state.js';
import { icsFor } from '../core/calexport.js';
import { esc } from '../core/util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export let toastT;
export function toast(msg, action) {
  const r = $('#toast-root');
  r.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button data-act="${action.act}">${esc(action.label)}</button>` : ''}</div>`;
  clearTimeout(toastT);
  toastT = setTimeout(() => (r.innerHTML = ''), action ? 5000 : 2800);
}
/** Adresse der App ohne #… (im erzwungenen Demo-Modus mit ?demo, damit Demo-Links in der Demo bleiben). */
export const baseUrl = () => `${location.origin}${location.pathname}${FORCED_DEMO ? '?demo' : ''}`;
export const voteLink = ids => `${baseUrl()}#/p/${[].concat(ids).join(',')}`;
export async function copyText(t, okMsg = 'Kopiert') {
  try {
    await navigator.clipboard.writeText(t);
    toast(okMsg);
  } catch {
    toast('Bitte den Text markieren und kopieren');
  }
}
export const timeAgo = t => {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = new Date(t);
  return `am ${d.getDate()}.${d.getMonth() + 1}.`;
};
export const waLink = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export function downloadIcs(p) {
  const blob = new Blob([icsFor(p, voteLink(p.id))], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(p.title || 'treffen').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
export const sheetHead = title =>
  `<div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><h2 id="sheet-title" style="min-width:0">${title}</h2><button class="btn sm ghost" data-act="close-sheet" style="flex:none">Schließen</button></div>`;
export const msgBlock = text =>
  `<div class="linkbox msg">${esc(text)}</div><div class="row"><button class="btn sm primary" data-act="copy" data-v="${esc(text)}">Text kopieren</button><a class="btn sm" href="${esc(waLink(text))}" target="_blank" rel="noopener">WhatsApp</a></div>`;

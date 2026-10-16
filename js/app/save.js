/* Automatisches Speichern der eigenen Antwort und Rückgängig. */
import { closedForMe } from './access.js';
import { B, S } from './state.js';
import { isStale } from '../core/poll.js';
import { clone } from '../core/util.js';
import { $, toast } from '../ui/dom.js';
import { unlock } from '../ui/fun.js';
import { render } from '../ui/render.js';

export let saveT = null,
  saving = false,
  saveAgain = false,
  saveCtx = null;
export function scheduleSave(immediate) {
  if (!S.my || !S.poll) return;
  saveCtx = { pid: S.route.id, my: S.my, title: S.poll.title || '' };
  if (!S.my.name.trim()) {
    clearTimeout(saveT);
    saveT = null;
    setSave('noname');
    return;
  }
  setSave('pending');
  clearTimeout(saveT);
  saveT = setTimeout(doSave, immediate ? 0 : 700);
}
export function cancelPendingSave() {
  clearTimeout(saveT);
  saveT = null;
}
/** Wartet, bis alles gespeichert ist (z. B. vor dem Anmelden mit einem Konto). */
export async function settleSave(maxMs = 5000) {
  flushSave();
  const t0 = Date.now();
  while ((saving || saveT) && Date.now() - t0 < maxMs) await new Promise(r => setTimeout(r, 50));
}
export function flushSave() {
  if (saveT) {
    clearTimeout(saveT);
    saveT = null;
    doSave();
  }
}
export async function doSave() {
  saveT = null;
  if (saving) {
    saveAgain = true;
    return;
  }
  const ctx = saveCtx;
  if (!ctx) return;
  saving = true;
  setSave('saving');
  try {
    const data = clone({
      ...ctx.my,
      v: 2,
      name: ctx.my.name.trim().slice(0, 40),
      note: (ctx.my.note || '').slice(0, 300),
      updatedAt: Date.now(),
    });
    delete data.uid;
    // Ohne Netz: Firebase merkt sich die Änderung auf dem Gerät und schickt sie später – nicht darauf warten.
    const offline = isOffline();
    const write = B.saveMine(ctx.pid, data);
    if (offline) write.catch(e => console.warn(e));
    else await write;
    const wasStale = !!S.poll && S.my === ctx.my && isStale(S.poll, ctx.my, B.uid());
    ctx.my.updatedAt = data.updatedAt;
    if (ctx === saveCtx) setSave(offline ? 'offline' : 'saved');
    if (wasStale) render(); // Hinweis „Neu seit deiner letzten Antwort“ ausblenden
    // privates Verzeichnis „meine Events“ pflegen (für Übernehmen & Startseite)
    const m = S.member || { polls: {} },
      mp = (m.polls || {})[ctx.pid];
    if (!mp || m.name !== data.name || mp.t !== ctx.title) {
      const patch = { name: data.name, polls: { [ctx.pid]: { t: ctx.title, at: Date.now() } }, updatedAt: Date.now() };
      const member = B.saveMember(patch).catch(e => console.warn(e));
      if (!offline) await member;
      S.member = { ...m, name: data.name, polls: { ...(m.polls || {}), ...patch.polls } };
    }
  } catch (e) {
    console.error(e);
    if (ctx === saveCtx) setSave(closedForMe(S.poll) ? 'closed' : 'error');
  }
  saving = false;
  if (saveAgain) {
    saveAgain = false;
    doSave();
  }
}
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
/** Wieder online: warten, bis Firebase alles Gemerkte verschickt hat. */
export async function backOnline() {
  if (S.save !== 'offline') return;
  try {
    await B.waitForPendingWrites();
  } catch (e) {
    console.warn(e);
  }
  if (S.save === 'offline') setSave('saved');
}
export const SAVE_TXT = {
  idle: '',
  pending: 'Wird gespeichert …',
  saving: 'Speichert …',
  saved: '✓ Gespeichert',
  error: 'Speichern fehlgeschlagen. Prüfe deine Verbindung.',
  noname: 'Gib oben deinen Namen ein, damit gespeichert wird.',
  offline: '✓ Auf dem Gerät gespeichert – wird gesendet, sobald du wieder Netz hast.',
  closed: 'Die Abstimmung ist geschlossen.',
};
export function setSave(s) {
  S.save = s;
  const el = $('#savestate');
  if (el) el.textContent = SAVE_TXT[s] || '';
}
/* ---------- Rückgängig ---------- */
export function pushUndo() {
  S.undo.push(JSON.stringify({ days: S.my.days, rules: S.my.rules, base: S.my.base, favs: S.my.favs || [] }));
  if (S.undo.length > 30) S.undo.shift();
}
export function undo() {
  const last = S.undo.pop();
  if (!last || !S.my) return;
  Object.assign(S.my, JSON.parse(last));
  scheduleSave();
  render();
  toast('Rückgängig gemacht');
  if (++S.undoCount >= 5) unlock('ctrlz');
}

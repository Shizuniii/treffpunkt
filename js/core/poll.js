/* Regeln eines Events: welche Tage zur Wahl stehen, Teilnehmerliste, Frist, veraltete Antworten. Rein, ohne DOM. */
import { daysOfMonths, monthsBetween, parseYmd, wdIdx } from './dates.js';
import { clone } from './util.js';

export const allowedWd = (p, ds) =>
  !p || !Array.isArray(p.weekdays) || !p.weekdays.length || p.weekdays.includes(wdIdx(ds));
export const pollClosed = p => !!(p && (p.closed || (p.closesAt && Date.now() >= p.closesAt)));
export const maybeLimit = p => (p && Number.isFinite(p.maybeLimit) ? Math.max(0, p.maybeLimit) : 4);
/* Tage-Modell: gewählte Monate − ausgeschlossene Tage + von Teilnehmern hinzugefügte Zeiträume (Wochentage separat) */
const exclCache = new WeakMap();
export const exclSet = p => {
  if (!p) return new Set();
  let x = exclCache.get(p);
  if (!x) {
    x = new Set(Array.isArray(p.excluded) ? p.excluded : []);
    exclCache.set(p, x);
  }
  return x;
};
export const addedList = p =>
  Object.entries((p && p.added) || {})
    .map(([uid, a]) => ({ uid, ...(a || {}) }))
    .filter(a => a.from && a.to);
export const addedOk = p => addedList(p).filter(a => a.ok && !a.declined);
export function pollMonths(p) {
  const set = new Set((p && p.months) || []);
  for (const a of addedOk(p)) monthsBetween(a.from, a.to).forEach(k => set.add(k));
  return [...set].sort();
}
export const inPoll = (p, ds) =>
  !!p &&
  ((p.months || []).includes(ds.slice(0, 7)) || addedOk(p).some(a => ds >= a.from && ds <= a.to)) &&
  !exclSet(p).has(ds);
export const pollDays = p => daysOfMonths(pollMonths(p)).filter(ds => inPoll(p, ds) && allowedWd(p, ds));
/* Teilnehmerliste */
export const isRestricted = p => !!(p && p.restricted);
export const isParticipant = (p, uid) =>
  !isRestricted(p) || !!(uid && p.participants && p.participants[uid] && p.participants[uid].on === true);
export const partList = p =>
  Object.entries((p && p.participants) || {})
    .filter(([, x]) => x && x.on === true)
    .map(([uid, x]) => ({ uid, name: x.name || '' }));
/* Seit der letzten Antwort neu dazugekommen? (neue Runde, neue Tage, Zeitraum-Vorschläge anderer) */
export function changeTimeFor(p, uid) {
  let t = Math.max((p && p.reopenedAt) || 0, (p && p.expandedAt) || 0);
  for (const a of addedOk(p)) if (a.uid !== uid) t = Math.max(t, a.at || 0);
  return t;
}
export const isStale = (p, r, uid) => !!r && !!r.updatedAt && r.updatedAt < changeTimeFor(p, uid || r.uid);
export const countsAsDone = (p, r) => !!r && !!r.done && !isStale(p, r);
export function normResp(r) {
  r = r ? clone(r) : {};
  const out = {
    v: 2,
    name: typeof r.name === 'string' ? r.name : '',
    base: r.base === 'all' ? 'all' : 'none',
    days: r.days && typeof r.days === 'object' && !Array.isArray(r.days) ? r.days : {},
    rules: Array.isArray(r.rules) ? r.rules.filter(x => x && Array.isArray(x.wd)) : [],
    done: !!r.done,
    note: typeof r.note === 'string' ? r.note : '',
    updatedAt: r.updatedAt || 0,
  };
  if (r.uid) out.uid = r.uid;
  if (typeof r.emoji === 'string' && r.emoji) out.emoji = r.emoji;
  if (typeof r.pass === 'string' && r.pass) out.pass = r.pass;
  if (r.cancel && typeof r.cancel === 'object') out.cancel = r.cancel;
  out.favs = Array.isArray(r.favs)
    ? r.favs.filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(0, 3)
    : [];
  return out;
}
export const isEmptyResp = r => !r || (!Object.keys(r.days || {}).length && !(r.rules || []).length);
/* ---------- Absage-Regel & Absagen ---------- */
export const groupSize = p => (isRestricted(p) ? partList(p).length : p.expected || 0);
export const startOf = f => {
  const d = parseYmd(f.date);
  d.setMinutes(f.s || 0);
  return d.getTime();
};
/** Zeitraum ins Formular übernehmen: neue Monate nur innerhalb des Zeitraums, bestehende Monate im Zeitraum wieder einschließen. */
export function addRangeToForm(f, from, to) {
  const ex = new Set(f.excluded);
  for (const k of monthsBetween(from, to)) {
    if (!f.months.includes(k)) {
      f.months.push(k);
      for (const ds of daysOfMonths([k])) if (ds < from || ds > to) ex.add(ds);
    }
    for (const ds of daysOfMonths([k])) if (ds >= from && ds <= to) ex.delete(ds);
  }
  f.excluded = [...ex].sort();
}

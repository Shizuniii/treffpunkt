/* Vorlagen für neue Events und „Nochmal mit neuem Zeitraum“ (rein, ohne DOM).
   Eine Vorlage speichert Einstellungen, aber keine festen Daten: Monate und Frist werden relativ zu „heute“ gesetzt. */
import { addDays, daysOfMonths, monthKey, parseYmd, toYmd } from './dates.js';
import { maybeLimit } from './poll.js';
import { clone } from './util.js';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Eingebaute Vorlagen. months = wie viele Monate zur Wahl stehen, deadlineDays = Frist in Tagen ab heute. */
export const BUILTIN_TEMPLATES = [
  {
    id: 'b-spiele',
    icon: '🎲',
    name: 'Spieleabend',
    title: 'Spieleabend',
    weekdays: [4, 5, 6],
    months: 2,
    deadlineDays: 7,
    maybeLimit: 3,
  },
  {
    id: 'b-kino',
    icon: '🎬',
    name: 'Kino / Essen',
    title: 'Kino',
    weekdays: ALL_DAYS,
    months: 1,
    deadlineDays: 5,
    maybeLimit: 2,
  },
  {
    id: 'b-ausflug',
    icon: '🥾',
    name: 'Ausflug',
    title: 'Ausflug',
    weekdays: [5, 6],
    months: 2,
    deadlineDays: 10,
    maybeLimit: 3,
  },
  {
    id: 'b-urlaub',
    icon: '🏖️',
    name: 'Gruppenurlaub',
    title: 'Gruppenurlaub',
    weekdays: ALL_DAYS,
    months: 4,
    deadlineDays: 21,
    maybeLimit: 6,
  },
];

/** Die nächsten n Monate ab heute. Bleiben im aktuellen Monat weniger als 7 Tage, geht es im nächsten los. */
export function nextMonths(today, n) {
  const d = parseYmd(today);
  const left = daysOfMonths([today.slice(0, 7)]).filter(x => x >= today).length;
  const start = left < 7 ? 1 : 0;
  return Array.from({ length: Math.max(1, n) }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() + start + i, 1);
    return monthKey(m.getFullYear(), m.getMonth() + 1);
  });
}

/** Vorlage aus einem bestehenden Event: alle Einstellungen, Monate nur als Anzahl, Frist als Abstand in Tagen. */
export function templateFromPoll(p, name) {
  const created = p.createdAt || Date.now();
  return {
    name: String(name || p.title || 'Vorlage').slice(0, 40),
    title: p.title || '',
    description: p.description || '',
    weekdays: Array.isArray(p.weekdays) && p.weekdays.length ? [...p.weekdays] : ALL_DAYS,
    months: Math.max(1, (p.months || []).length),
    deadlineDays: p.closesAt ? Math.max(1, Math.round((p.closesAt - created) / 864e5)) : null,
    maybeLimit: maybeLimit(p),
    expected: p.expected || null,
    addMode: p.addMode || 'auto',
    cancelRule: p.cancelRule !== false,
    restricted: !!p.restricted,
    participants: clone(p.participants || {}),
  };
}

/** Formular-Daten (wie pollToForm) aus einer Vorlage – mit Monaten und Frist ab heute. */
export function formFromTemplate(t, today) {
  const dl = t.deadlineDays ? toYmd(addDays(parseYmd(today), t.deadlineDays)) : '';
  return {
    id: null,
    title: t.title || '',
    description: t.description || '',
    months: nextMonths(today, t.months || 1),
    weekdays: Array.isArray(t.weekdays) && t.weekdays.length ? [...t.weekdays] : ALL_DAYS,
    expected: t.expected || '',
    maybeLimit: t.maybeLimit ?? 4,
    cancelRule: t.cancelRule !== false,
    excluded: [],
    restricted: !!t.restricted,
    participants: clone(t.participants || {}),
    addMode: t.addMode || 'auto',
    rangeFrom: '',
    rangeTo: '',
    openExcl: false,
    openPeople: false,
    dlOn: !!dl,
    dlDate: dl,
    dlTime: '',
  };
}

/** „Nochmal mit neuem Zeitraum“: gleiche Einstellungen und Teilnehmer, neue Monate und Frist ab heute. */
export const reuseForm = (p, today) => ({ ...formFromTemplate(templateFromPoll(p), today), from: p.title || '' });

/* Feiertage (berechnet) und Schulferien NRW (Tabelle). Rein, ohne DOM. */
import { addDays, toYmd } from './dates.js';

export function easter(y) {
  // Gauß / Anonymous Gregorian
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const _hol = {};
export function holidaysOf(y) {
  if (_hol[y]) return _hol[y];
  const e = easter(y),
    map = {};
  const add = (dt, name, legal = true, emoji = '') => {
    map[toYmd(dt)] = { name, legal, emoji };
  };
  add(new Date(y, 0, 1), 'Neujahr', true, '🥳');
  add(new Date(y, 1, 14), 'Valentinstag', false, '💘');
  add(addDays(e, -48), 'Rosenmontag', false, '🎭');
  add(addDays(e, -2), 'Karfreitag');
  add(e, 'Ostersonntag', false, '🐣');
  add(addDays(e, 1), 'Ostermontag', true, '🐣');
  add(new Date(y, 4, 1), 'Tag der Arbeit');
  add(addDays(e, 39), 'Christi Himmelfahrt');
  add(addDays(e, 50), 'Pfingstmontag');
  add(addDays(e, 60), 'Fronleichnam');
  add(new Date(y, 9, 3), 'Tag der Deutschen Einheit');
  add(new Date(y, 9, 31), 'Halloween', false, '🎃');
  add(new Date(y, 10, 1), 'Allerheiligen');
  add(new Date(y, 10, 11), 'Karnevalsbeginn (11.11.)', false, '🎭');
  add(new Date(y, 11, 6), 'Nikolaus', false, '🎅');
  add(new Date(y, 11, 24), 'Heiligabend', false, '🎄');
  add(new Date(y, 11, 25), '1. Weihnachtstag', true, '🎄');
  add(new Date(y, 11, 26), '2. Weihnachtstag');
  add(new Date(y, 11, 31), 'Silvester', false, '🎆');
  return (_hol[y] = map);
}
export const holiday = s => holidaysOf(+s.slice(0, 4))[s] || null;
// Schulferien NRW (offizielle Termine, erster bis letzter Ferientag)
/* Schulferien NRW laut Ferienordnung des Ministeriums für Schule und Bildung NRW (Stand: Schuljahr 2029/30).
   Neue Jahre einfach unten anhängen – der Wartungs-Check auf GitHub erinnert rechtzeitig daran. */
export const FERIEN = [
  ['2026-03-30', '2026-04-11', 'Osterferien'],
  ['2026-05-26', '2026-05-26', 'Pfingstferien'],
  ['2026-07-20', '2026-09-01', 'Sommerferien'],
  ['2026-10-17', '2026-10-31', 'Herbstferien'],
  ['2026-12-23', '2027-01-06', 'Weihnachtsferien'],
  ['2027-03-22', '2027-04-03', 'Osterferien'],
  ['2027-05-18', '2027-05-18', 'Pfingstferien'],
  ['2027-07-19', '2027-08-31', 'Sommerferien'],
  ['2027-10-23', '2027-11-06', 'Herbstferien'],
  ['2027-12-24', '2028-01-08', 'Weihnachtsferien'],
  ['2028-04-10', '2028-04-22', 'Osterferien'],
  ['2028-07-10', '2028-08-22', 'Sommerferien'],
  ['2028-10-23', '2028-11-04', 'Herbstferien'],
  ['2028-12-21', '2029-01-05', 'Weihnachtsferien'],
  ['2029-03-26', '2029-04-07', 'Osterferien'],
  ['2029-05-22', '2029-05-22', 'Pfingstferien'],
  ['2029-07-02', '2029-08-14', 'Sommerferien'],
  ['2029-10-15', '2029-10-27', 'Herbstferien'],
  ['2029-12-20', '2030-01-04', 'Weihnachtsferien'],
  ['2030-04-15', '2030-04-27', 'Osterferien'],
  ['2030-06-24', '2030-08-06', 'Sommerferien'],
];
/** Bis wann die Ferientabelle reicht. Ein Test schlägt Alarm, wenn das weniger als ein Jahr entfernt ist. */
export const FERIEN_UNTIL = FERIEN[FERIEN.length - 1][1];
export const ferien = s => {
  const f = FERIEN.find(([a, b]) => s >= a && s <= b);
  return f ? f[2] : null;
};

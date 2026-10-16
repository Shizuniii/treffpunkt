/* Datum & Zeit (rein, ohne DOM). Tage als Text "YYYY-MM-DD", Uhrzeiten als Minuten (0–1440). */

export const pad = n => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parseYmd = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const toYmd = dt => ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
export const addDays = (dt, n) => {
  const x = new Date(dt);
  x.setDate(x.getDate() + n);
  return x;
};
export const wdIdx = s => (parseYmd(s).getDay() + 6) % 7; // 0 = Montag
export const WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
export const MONTHS_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const minStr = m => (m >= 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
export const minShort = m =>
  m >= 1440 ? '24' : m % 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : String(Math.floor(m / 60));
export const strMin = s => {
  if (!s) return null;
  const [h, mi] = s.split(':').map(Number);
  return isNaN(h) ? null : h * 60 + (mi || 0);
};
export const fmtDate = (s, long) => {
  const d = parseYmd(s);
  return `${(long ? WD_LONG : WD_SHORT)[wdIdx(s)]}, ${d.getDate()}. ${(long ? MONTHS : MONTHS_S)[d.getMonth()]}${long ? ' ' + d.getFullYear() : ''}`;
};
export const durStr = min => {
  const h = Math.floor(min / 60),
    m = min % 60;
  return h && m ? `${h} Std. ${m} Min.` : h ? `${h} Std.` : `${m} Min.`;
};
export const monthKey = (y, m) => `${y}-${pad(m)}`;
export const monthLabel = k => {
  const [y, m] = k.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const monthsLabel = ms => [...(ms || [])].sort().map(monthLabel).join(', ') || 'Keine Monate gewählt';
export function daysOfMonths(ms) {
  const out = [];
  for (const k of [...(ms || [])].sort()) {
    const [y, m] = k.split('-').map(Number);
    const n = new Date(y, m, 0).getDate();
    for (let d = 1; d <= n; d++) out.push(ymd(y, m, d));
  }
  return out;
}
export function deadlineText(ms, long) {
  const d = new Date(ms);
  let day = d,
    time;
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    day = addDays(d, -1);
    time = '24:00';
  } else time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${fmtDate(toYmd(day), long)}, ${time} Uhr`;
}
export function remainText(ms) {
  const m = Math.floor((ms - Date.now()) / 60000);
  if (m <= 0) return 'abgelaufen';
  if (m < 60) return `noch ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 48) return `noch ${h} Std.`;
  return `noch ${Math.floor(h / 24)} Tage`;
}
export function monthsBetween(a, b) {
  const out = [];
  let [y, m] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  while ((y < y2 || (y === y2 && m <= m2)) && out.length < 36) {
    out.push(monthKey(y, m));
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
export const rangeText = (a, b) => {
  const x = parseYmd(a),
    y = parseYmd(b);
  return a === b
    ? `${x.getDate()}. ${MONTHS_S[x.getMonth()]} ${x.getFullYear()}`
    : `${x.getDate()}. ${MONTHS_S[x.getMonth()]}${x.getFullYear() !== y.getFullYear() ? ' ' + x.getFullYear() : ''} – ${y.getDate()}. ${MONTHS_S[y.getMonth()]} ${y.getFullYear()}`;
};
/* ---------- Frist verlängern & Freischaltungen (Organisator) ---------- */
export const endOfDayPlus = n => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n + 1);
  return d.getTime();
};
export function deadlineFrom(dateStr, timeStr) {
  const d = parseYmd(dateStr);
  if (timeStr) {
    const m = strMin(timeStr);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
}
export function isoWeek(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - y0) / 864e5 + 1) / 7);
}

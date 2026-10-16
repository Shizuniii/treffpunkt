/* Kalender-Export (Google-Kalender-Link, .ics-Datei). Rein, ohne DOM. */
import { addDays, pad, parseYmd, toYmd } from './dates.js';

export function finalTimes(f) {
  const d = f.date.replaceAll('-', ''),
    next = toYmd(addDays(parseYmd(f.date), 1)).replaceAll('-', '');
  const t = m => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
  const allDay = f.s === 0 && f.e >= 1440;
  return { d, next, allDay, start: `${d}T${t(f.s)}`, end: f.e >= 1440 ? `${next}T000000` : `${d}T${t(f.e)}` };
}
export function gcalUrl(p, link) {
  const f = finalTimes(p.final);
  const dates = f.allDay ? `${f.d}/${f.next}` : `${f.start}/${f.end}`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: p.title || 'Treffen',
    dates,
    ctz: 'Europe/Berlin',
    details: `${p.description ? p.description + '\n\n' : ''}${link || ''}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
/** Text für .ics maskieren (Komma, Semikolon, Zeilenumbrüche). */
export const icsText = s =>
  String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
const stampOf = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

/** Ein Kalender-Eintrag. e = { uid, date: 'YYYY-MM-DD', s, e (Minuten), title, description } */
function vevent(e, now) {
  const f = finalTimes({ date: e.date, s: e.s, e: e.e });
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}@treffpunkt`,
    `DTSTAMP:${stampOf(now)}`,
    ...(f.allDay
      ? [`DTSTART;VALUE=DATE:${f.d}`, `DTEND;VALUE=DATE:${f.next}`]
      : [`DTSTART:${f.start}`, `DTEND:${f.end}`]),
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(e.description)}`,
    'END:VEVENT',
  ];
}
const wrap = (lines, extra = []) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Treffpunkt//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...extra,
    ...lines,
    'END:VCALENDAR',
  ].join('\r\n');

export function icsFor(p, link) {
  const f = p.final;
  return wrap(
    vevent(
      {
        uid: `${p.id}-${f.date.replaceAll('-', '')}`,
        date: f.date,
        s: f.s,
        e: f.e,
        title: p.title || 'Treffen',
        description: (p.description ? p.description + '\n' : '') + (link || ''),
      },
      Date.now()
    )
  );
}

/** Abo-Kalender mit mehreren Einträgen (für „Kalender-Abo“). now fest übergeben, damit die Datei nur bei Änderungen anders ist. */
export const icsFeed = (entries, { name = 'Treffpunkt', now = 0 } = {}) =>
  wrap(
    entries.flatMap(e => vevent(e, now)),
    [`X-WR-CALNAME:${icsText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  );

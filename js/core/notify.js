/* Benachrichtigungen planen (rein, ohne DOM und ohne Netz): Wer bekommt wann welche Nachricht?
   Genutzt vom Versand-Skript tools/notify.js (läuft geplant alle 15 Minuten über GitHub Actions, in der Praxis oft seltener) und in den Tests.

   Jede Nachricht hat einen festen Schlüssel (z. B. „final|<event>|<datum>|<von>|<bis>“). Was schon verschickt
   wurde, steht im Versand-Protokoll – so kommt nichts doppelt, und wer sich später anmeldet, bekommt keine
   alten Nachrichten nachgeliefert. */
import { ivText } from './availability.js';
import { deadlineText, fmtDate, rangeText } from './dates.js';
import {
  addedList,
  addedOk,
  countsAsDone,
  groupSize,
  isParticipant,
  isRestricted,
  normResp,
  pollClosed,
  startOf,
} from './poll.js';

/** Was man sich melden lassen kann. who: 'all' = alle, 'admin' = nur Organisatoren. def = vorausgewählt. */
export const NOTIFY_TYPES = [
  {
    id: 'new',
    icon: '🆕',
    label: 'Neues Event',
    desc: 'Wenn es etwas Neues zum Abstimmen gibt.',
    who: 'all',
    def: true,
  },
  {
    id: 'deadline',
    icon: '⏰',
    label: 'Frist läuft ab',
    desc: '24 Stunden vor Ende – nur wenn du noch nicht fertig bist.',
    who: 'all',
    def: true,
  },
  {
    id: 'final',
    icon: '📅',
    label: 'Termin steht',
    desc: 'Sobald der Termin festgelegt oder geändert wird.',
    who: 'all',
    def: true,
  },
  {
    id: 'changes',
    icon: '🔄',
    label: 'Neue Tage oder neue Runde',
    desc: 'Wenn du nochmal nachschauen solltest.',
    who: 'all',
    def: true,
  },
  {
    id: 'before',
    icon: '🔔',
    label: 'Am Tag vorher',
    desc: 'Kurze Erinnerung vor dem Treffen.',
    who: 'all',
    def: true,
  },
  {
    id: 'o-votes',
    icon: '🗳️',
    label: 'Jemand ist fertig',
    desc: 'Und wenn alle abgestimmt haben.',
    who: 'admin',
    def: true,
  },
  {
    id: 'o-requests',
    icon: '🙋',
    label: 'Anfragen & Vorschläge',
    desc: 'Teilnahme-Anfragen und neue Zeiträume.',
    who: 'admin',
    def: true,
  },
  { id: 'o-cancel', icon: '🍹', label: 'Absagen', desc: 'Wenn jemand für den Termin absagt.', who: 'admin', def: true },
];
export const defaultTypes = admin =>
  Object.fromEntries(NOTIFY_TYPES.filter(t => admin || t.who !== 'admin').map(t => [t.id, t.def]));

/** Hat jemand überhaupt einen Weg, Nachrichten zu bekommen? */
export const hasChannel = n => !!n && (!!(n.discord && n.discord.id) || (Array.isArray(n.push) && n.push.length > 0));

const H = 3600e3;

/**
 * Plant alle fälligen Nachrichten.
 *   polls:     [{ id, …event }]
 *   responses: { [pid]: [antwort mit uid] }      requests: { [pid]: [{ uid, name, at }] }
 *   subs:      [{ uid, types, admin }]  – Personen mit mindestens einem Kanal
 *   sent:      Set mit schon verschickten Schlüsseln
 *   now, site: Zeitpunkt (ms) und Adresse der App (mit / am Ende)
 * Ergebnis: [{ key, type, pid, title, body, url, to: [uid] }] – auch mit leerem „to“, damit der Schlüssel als erledigt gilt.
 */
export function planNotifications({
  polls,
  responses = {},
  requests = {},
  subs = [],
  sent = new Set(),
  now,
  site = '',
}) {
  const out = [];
  const add = (key, type, pid, title, body, url, recips) => {
    if (sent.has(key)) return;
    out.push({ key, type, pid, title, body, url, to: recips.filter(s => s.types && s.types[type]).map(s => s.uid) });
  };
  for (const p of polls) {
    const T = p.title || 'Event';
    const voteUrl = `${site}#/p/${p.id}`,
      resUrl = `${site}#/r/${p.id}`;
    const named = (responses[p.id] || []).map(normResp).filter(r => r.name);
    const answered = new Set(named.map(r => r.uid));
    const eligible = s => !isRestricted(p) || isParticipant(p, s.uid);
    const involved = subs.filter(s => answered.has(s.uid) || (isRestricted(p) && isParticipant(p, s.uid)));
    const isDone = uid => named.some(r => r.uid === uid && countsAsDone(p, r));
    const admins = subs.filter(s => s.admin);

    // Für alle
    if ((p.createdAt || 0) > now - 3 * 24 * H && !pollClosed(p))
      add(
        `new|${p.id}`,
        'new',
        p.id,
        `Neues Event: ${T}`,
        `Trag ein, wann du kannst${p.closesAt ? ` – bis ${deadlineText(p.closesAt, true)}` : ''}.`,
        voteUrl,
        subs.filter(s => !s.admin && eligible(s) && !answered.has(s.uid))
      );
    if (p.final) {
      const f = p.final;
      add(
        `final|${p.id}|${f.date}|${f.s}|${f.e}`,
        'final',
        p.id,
        `${T}: Der Termin steht!`,
        `${fmtDate(f.date, true)}, ${ivText([f.s, f.e])}.`,
        voteUrl,
        involved
      );
      const start = startOf(f);
      if (start > now && start - now <= 30 * H) {
        const cancelled = uid => named.some(r => r.uid === uid && r.cancel && r.cancel.date === f.date);
        add(
          `before|${p.id}|${f.date}`,
          'before',
          p.id,
          `Bald: ${T}`,
          `${fmtDate(f.date, true)}, ${ivText([f.s, f.e])}. Bis dann! 👋`,
          voteUrl,
          involved.filter(s => !cancelled(s.uid))
        );
      }
    }
    if (p.reopenedAt)
      add(
        `reopen|${p.id}|${p.reopenedAt}`,
        'changes',
        p.id,
        `${T}: Neue Runde`,
        `Bitte prüf nochmal, wann du kannst${p.reopenNote ? ` (${p.reopenNote})` : ''}.`,
        voteUrl,
        involved
      );
    if (p.expandedAt)
      add(
        `expand|${p.id}|${p.expandedAt}`,
        'changes',
        p.id,
        `${T}: Neue Tage`,
        'Schau, ob du an den neuen Tagen kannst.',
        voteUrl,
        involved
      );
    for (const a of addedOk(p))
      add(
        `added|${p.id}|${a.uid}|${a.at || 0}`,
        'changes',
        p.id,
        `${T}: Neuer Zeitraum`,
        `${a.name || 'Jemand'} kann im bisherigen Zeitraum nicht. Neu dazu: ${rangeText(a.from, a.to)}.`,
        voteUrl,
        involved.filter(s => s.uid !== a.uid)
      );
    if (p.closesAt && !p.closed && p.closesAt > now && p.closesAt - now <= 24 * H)
      add(
        `deadline|${p.id}|${p.closesAt}`,
        'deadline',
        p.id,
        `${T}: Frist läuft ab`,
        `Du bist noch nicht fertig. Abstimmen geht bis ${deadlineText(p.closesAt, true)}.`,
        voteUrl,
        subs.filter(s => eligible(s) && !isDone(s.uid))
      );

    // Für Organisatoren
    const round = p.reopenedAt || 0;
    const doneN = named.filter(r => countsAsDone(p, r)).length,
      exp = groupSize(p);
    for (const r of named)
      if (countsAsDone(p, r))
        add(
          `done|${p.id}|${r.uid}|${round}`,
          'o-votes',
          p.id,
          `${T}: ${r.name} ist fertig`,
          `${doneN}${exp ? ` von ${exp}` : ''} haben abgestimmt.`,
          resUrl,
          admins.filter(a => a.uid !== r.uid)
        );
    if (exp && doneN >= exp)
      add(
        `alldone|${p.id}|${round}`,
        'o-votes',
        p.id,
        `${T}: Alle haben abgestimmt 🎉`,
        'Zeit, den Termin festzulegen.',
        resUrl,
        admins
      );
    for (const q of requests[p.id] || [])
      add(
        `req|${p.id}|${q.uid}|${q.at || 0}`,
        'o-requests',
        p.id,
        `${T}: ${q.name || 'Jemand'} möchte mitmachen`,
        'Teilnahme-Anfrage – in der Auswertung zulassen oder ablehnen.',
        resUrl,
        admins
      );
    for (const a of addedList(p).filter(a => !a.ok && !a.declined))
      add(
        `prop|${p.id}|${a.uid}|${a.at || 0}`,
        'o-requests',
        p.id,
        `${T}: Neuer Zeitraum vorgeschlagen`,
        `${a.name || 'Jemand'}: ${rangeText(a.from, a.to)}.`,
        resUrl,
        admins
      );
    if (p.final)
      for (const r of named)
        if (r.cancel && r.cancel.date === p.final.date)
          add(
            `cancel|${p.id}|${r.uid}|${r.cancel.at || 0}`,
            'o-cancel',
            p.id,
            `${T}: ${r.name} sagt ab`,
            r.cancel.reason === 'sick'
              ? 'Krank / Notfall.'
              : r.cancel.owes
                ? 'Zu spät – laut Absage-Regel gibt’s Drinks 🍹'
                : 'Rechtzeitig abgesagt.',
            resUrl,
            admins
          );
  }
  return out;
}

/** Text einer Nachricht für Discord (Markdown). */
export const discordText = m => `**${m.title}**\n${m.body}\n${m.url}`;

/**
 * Einträge für das Kalender-Abo einer Person: festgelegte Termine, bei denen sie dabei ist (ohne eigene Absage),
 * auf Wunsch auch Abstimmungsfristen, solange sie noch nicht fertig ist.
 */
export function calendarEntries({ uid, polls, responses = {}, withDeadlines = false, site = '' }) {
  const out = [];
  for (const p of polls) {
    const named = (responses[p.id] || []).map(normResp).filter(r => r.name);
    const mine = named.find(r => r.uid === uid);
    const listed = isRestricted(p) && isParticipant(p, uid);
    if (p.final && (mine || listed) && !(mine && mine.cancel && mine.cancel.date === p.final.date))
      out.push({
        uid: `${p.id}-${p.final.date.replaceAll('-', '')}`,
        date: p.final.date,
        s: p.final.s,
        e: p.final.e,
        title: p.title || 'Treffen',
        description: `${p.description ? p.description + '\n' : ''}${site}#/p/${p.id}`,
      });
    if (
      withDeadlines &&
      !p.final &&
      p.closesAt &&
      !pollClosed(p) &&
      (!isRestricted(p) || listed) &&
      !(mine && countsAsDone(p, mine))
    ) {
      const d = new Date(p.closesAt - 1); // Frist „bis 24 Uhr“ gehört zum Vortag
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({
        uid: `${p.id}-frist`,
        date: ds,
        s: 0,
        e: 1440,
        title: `Abstimmen bis heute: ${p.title || 'Event'}`,
        description: `${site}#/p/${p.id}`,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

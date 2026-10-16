/* Organisator-Übersicht und Event-Formular. */
import { B, DEMO, S, TODAY } from '../app/state.js';
import { ivText } from '../core/availability.js';
import {
  MONTHS,
  WD_LONG,
  WD_SHORT,
  addDays,
  deadlineText,
  fmtDate,
  isoWeek,
  monthKey,
  monthsLabel,
  pad,
  parseYmd,
  remainText,
  toYmd,
  ymd,
} from '../core/dates.js';
import { addedList, isRestricted, maybeLimit, partList, pollClosed, pollMonths } from '../core/poll.js';
import { clone, esc } from '../core/util.js';
import { LOAD_TXT } from './fun.js';
import { quickstartRow } from './organizers.js';
import { homeCardSimple, isArchived, viewToggle } from './overview.js';
import { footer, topbar } from './render.js';

/* ---------- Organisator: Übersicht ---------- */
export function statusPill(p) {
  if (p.closed) return `<span class="pill bad">Geschlossen</span>`;
  if (pollClosed(p)) return `<span class="pill bad">Frist abgelaufen</span>`;
  return `<span class="pill ok">Offen</span>`;
}
export function viewHome() {
  let h = `<div class="wrap">${topbar(DEMO ? '' : `<span class="small muted">${esc(B.email())}</span><button class="btn sm ghost" data-act="signout">Abmelden</button>`)}`;
  if (S.loadErr) h += `<div class="banner bad">${esc(S.loadErr)}</div>`;
  h += `<div class="row between"><div class="hero"><span class="eyebrow">Deine Abstimmungen</span><h1>Wann können alle?</h1></div>
        <div class="row">${viewToggle()}${S.editPoll ? '' : `<button class="btn primary" data-act="new-poll">+ Neues Event</button>`}</div></div>`;
  if (S.editPoll && !S.editPoll.id) h += pollForm();
  const card = p =>
    S.editPoll && S.editPoll.id === p.id ? pollForm() : S.ownerView === 'simple' ? homeCardSimple(p) : pollCard(p);
  if (S.polls === null) h += `<div class="empty">${LOAD_TXT}</div>`;
  else if (!S.polls.length && !S.editPoll)
    h += `<div class="card empty"><h2>Noch kein Event</h2><p>Lege eins an, wähle die Monate und schick den Link an deine Freunde. Für mehrere Events im selben Zeitraum legst du einfach mehrere an und teilst sie mit einem Link.</p><button class="btn primary" data-act="new-poll">+ Neues Event</button></div>`;
  else if (S.ownerView === 'simple') {
    // Laufende Events oben, Erledigtes eingeklappt darunter
    const old = S.polls.filter(isArchived);
    for (const p of S.polls.filter(p => !isArchived(p))) h += card(p);
    if (old.length)
      h += `<details class="adv"><summary><span>Erledigt</span><span class="small muted">${old.length} ${old.length === 1 ? 'Event' : 'Events'}</span></summary><div class="stack">${old.map(card).join('')}</div></details>`;
  } else for (const p of S.polls) h += card(p);
  h += `<div class="row small" style="justify-content:center;gap:16px"><button class="linkbtn" data-act="admins-open">👥 Organisatoren</button></div>`;
  return h + footer() + `</div>`;
}
export function pollCard(p) {
  const n = S.counts[p.id];
  const info = [];
  if (n != null) info.push(`${n} ${n === 1 ? 'Antwort' : 'Antworten'}`);
  if (p.expected) info.push(`erwartet: ${p.expected}`);
  if (p.closesAt && !p.closed)
    info.push(
      pollClosed(p)
        ? `Frist war ${deadlineText(p.closesAt)}`
        : `Frist: ${deadlineText(p.closesAt)} (${remainText(p.closesAt)})`
    );
  if (Array.isArray(p.weekdays) && p.weekdays.length && p.weekdays.length < 7)
    info.push('nur ' + p.weekdays.map(i => WD_SHORT[i]).join(', '));
  if (isRestricted(p)) info.push(`Teilnehmerliste: ${partList(p).length}`);
  const pend = addedList(p).filter(a => !a.ok && !a.declined).length,
    rq = S.reqCounts[p.id] || 0;
  if (rq) info.push(`🔔 ${rq} ${rq === 1 ? 'Teilnahme-Anfrage' : 'Teilnahme-Anfragen'}`);
  if (pend) info.push(`📅 ${pend} ${pend === 1 ? 'Zeitraum-Vorschlag' : 'Zeitraum-Vorschläge'}`);
  return `<div class="card">
    <div class="row between" style="align-items:flex-start"><div class="stack" style="gap:4px"><h2>${esc(p.title || 'Ohne Titel')}</h2>
      <span class="small muted">${esc(monthsLabel(pollMonths(p)))}</span></div>${statusPill(p)}</div>
    ${p.final ? `<div class="banner ok" style="padding:8px 12px"><span>Termin steht: <b>${fmtDate(p.final.date, true)}</b>, ${ivText([p.final.s, p.final.e])}</span></div>` : ''}
    <div class="small muted">${esc(info.join(' · '))}</div>
    <div class="row">
      <a class="btn primary sm" href="#/r/${p.id}">Ergebnisse</a>
      <button class="btn sm" data-act="share" data-id="${p.id}">Link teilen</button>
      <a class="btn sm" href="#/p/${p.id}">Selbst eintragen</a>
      <button class="btn sm" data-act="edit-poll" data-id="${p.id}">Bearbeiten</button>
      <button class="btn sm ghost" data-act="reuse-poll" data-id="${p.id}">Nochmal mit neuem Zeitraum</button>
      <button class="btn sm ghost" data-act="tpl-save-open" data-id="${p.id}">Als Vorlage speichern</button>
      ${pollClosed(p) && !p.closed ? '' : `<button class="btn sm ghost" data-act="toggle-closed" data-id="${p.id}">${p.closed ? 'Wieder öffnen' : 'Schließen'}</button>`}
    </div></div>`;
}
export function pollToForm(p, asCopy) {
  let dlOn = false,
    dlDate = '',
    dlTime = '';
  if (p && p.closesAt) {
    dlOn = true;
    const d = new Date(p.closesAt);
    if (d.getHours() === 0 && d.getMinutes() === 0) {
      dlDate = toYmd(addDays(d, -1));
    } else {
      dlDate = toYmd(d);
      dlTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return {
    id: asCopy || !p ? null : p.id,
    title: p ? (asCopy ? `${p.title} (Kopie)` : p.title || '') : '',
    description: (p && p.description) || '',
    months: [...((p && p.months) || [])],
    weekdays: p && Array.isArray(p.weekdays) && p.weekdays.length ? [...p.weekdays] : [0, 1, 2, 3, 4, 5, 6],
    expected: (p && p.expected) || '',
    maybeLimit: p ? maybeLimit(p) : 4,
    cancelRule: p ? p.cancelRule !== false : true,
    excluded: [...((p && p.excluded) || [])],
    restricted: !!(p && p.restricted),
    participants: clone((p && p.participants) || {}),
    addMode: (p && p.addMode) || 'auto',
    rangeFrom: '',
    rangeTo: '',
    openExcl: false,
    openPeople: false,
    dlOn: asCopy ? false : dlOn,
    dlDate: asCopy ? '' : dlDate,
    dlTime: asCopy ? '' : dlTime,
  };
}
export function pollForm() {
  const e = S.editPoll;
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push(monthKey(d.getFullYear(), d.getMonth() + 1));
  }
  for (const k of e.months) if (!opts.includes(k)) opts.push(k);
  const byYear = {};
  opts.sort().forEach(k => (byYear[k.slice(0, 4)] ||= []).push(k));
  return `<div class="card" id="pollform"><h2>${e.id ? 'Event bearbeiten' : 'Neues Event'}${e.from ? ` <span class="muted small" style="font-weight:500">wie „${esc(e.from)}“</span>` : ''}</h2>
    ${e.id ? '' : quickstartRow()}
    <label class="field">Titel<input type="text" id="pf-title" maxlength="80" placeholder="z. B. Spieleabend, Bowling, Geburtstag" value="${esc(e.title)}"></label>
    <label class="field">Beschreibung <span class="muted small" style="font-weight:400">(optional)</span><textarea id="pf-desc" maxlength="500" placeholder="Worum geht es? Wo trefft ihr euch?">${esc(e.description)}</textarea></label>
    <div class="stack"><span style="font-weight:600;font-size:.9rem">Monate, in denen abgestimmt werden kann</span>
      ${Object.entries(byYear)
        .map(
          ([y, ks]) =>
            `<div class="stack" style="gap:6px"><span class="eyebrow">${y}</span><div class="mgrid">${ks.map(k => `<button class="chip ${e.months.includes(k) ? 'on' : ''}" data-act="pf-month" data-v="${k}" aria-pressed="${e.months.includes(k)}">${MONTHS[+k.slice(5) - 1]}</button>`).join('')}</div></div>`
        )
        .join('')}
      <div class="stack" style="gap:6px"><span class="small" style="font-weight:600">… oder einen genauen Zeitraum hinzufügen</span>
        <div class="timebar"><label>von<input type="date" id="pf-range-from" value="${esc(e.rangeFrom)}" min="${TODAY}"></label><label>bis<input type="date" id="pf-range-to" value="${esc(e.rangeTo)}" min="${TODAY}"></label><button class="btn sm" data-act="pf-range-add">Hinzufügen</button></div></div>
    </div>
    ${
      e.months.length
        ? `<details class="adv" data-key="openExcl" ${e.openExcl ? 'open' : ''}><summary><span>Tage &amp; Wochen ausschließen</span><span class="small muted">${exclCount(e)} ausgeschlossen</span></summary>
      <div class="stack"><p class="small muted">Tippe Tage an, die gar nicht zur Wahl stehen sollen. „KW“ schaltet die ganze Woche um, ein Wochentag alle diese Tage im Monat.</p>
      ${[...e.months]
        .sort()
        .map(k => exclGrid(k, new Set(e.excluded)))
        .join('')}
      ${exclCount(e) ? `<div><button class="btn sm ghost" data-act="ex-clear">Alle wieder einschließen</button></div>` : ''}</div></details>`
        : ''
    }
    <div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Welche Wochentage kommen infrage?</span>
      <div class="chips">${WD_SHORT.map((w, i) => `<button class="chip ${e.weekdays.includes(i) ? 'on' : ''}" data-act="pf-wd" data-v="${i}" aria-pressed="${e.weekdays.includes(i)}">${w}</button>`).join('')}</div>
      <span class="small muted">Nicht gewählte Wochentage sind für deine Freunde ausgegraut.</span></div>
    ${peopleSection(e)}
    <div class="stack" style="gap:8px"><label class="check"><input type="checkbox" id="pf-dl-on" ${e.dlOn ? 'checked' : ''}> Abstimmungsfrist festlegen</label>
      ${
        e.dlOn
          ? `<div class="timebar"><label>bis<input type="date" id="pf-dl-date" value="${esc(e.dlDate)}" min="${TODAY}"></label><label>um<input type="time" id="pf-dl-time" value="${esc(e.dlTime)}"></label></div>
      <span class="small muted">Ohne Uhrzeit endet die Frist um 24 Uhr. Danach ist die Abstimmung automatisch geschlossen. Verlängern kannst du jederzeit in der Auswertung.</span>`
          : ''
      }</div>
    <div class="row" style="gap:24px;align-items:flex-start">
      ${
        e.restricted
          ? `<div class="stack" style="gap:4px;max-width:240px"><span style="font-weight:600;font-size:.9rem">Wie viele stimmen ab?</span><span class="small muted">${partOn(e)} laut Teilnehmerliste</span></div>`
          : `<label class="field" style="max-width:240px">Wie viele stimmen ab? <span class="muted small" style="font-weight:400">inkl. dir, optional</span><input type="number" id="pf-expected" min="1" max="200" inputmode="numeric" value="${e.expected || ''}" placeholder="z. B. 6"></label>`
      }
    </div>
    <details class="adv" data-key="openMore" ${e.openMore ? 'open' : ''}><summary><span>Weitere Einstellungen</span><span class="small muted">Vielleicht-Limit, neue Zeiträume, Absage-Regel</span></summary><div class="stack">
      <div class="stack" style="gap:5px"><span style="font-weight:600;font-size:.9rem">„Vielleicht“-Tage pro Person</span>
        <div class="row"><div class="stepper"><button data-act="pf-maybe" data-v="-1" aria-label="weniger">−</button><span>${e.maybeLimit}</span><button data-act="pf-maybe" data-v="1" aria-label="mehr">+</button></div><span class="small muted">${e.maybeLimit ? 'höchstens so viele' : 'aus'}</span></div></div>
    
    <div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Wenn jemand an keinem der Tage kann</span>
      <div class="seg full three" role="group" aria-label="Neue Zeiträume"><button data-act="pf-addmode" data-v="auto" class="${e.addMode === 'auto' ? 'on' : ''}">Zeitraum direkt hinzufügen</button><button data-act="pf-addmode" data-v="ask" class="${e.addMode === 'ask' ? 'on' : ''}">Erst ich bestätige</button><button data-act="pf-addmode" data-v="off" class="${e.addMode === 'off' ? 'on' : ''}">Nicht erlauben</button></div>
      <span class="small muted">${e.addMode === 'off' ? 'Teilnehmer können keine neuen Zeiträume vorschlagen.' : 'Teilnehmer können angeben, wann sie als Nächstes können. Alle anderen sehen dann einen Hinweis und können für die neuen Tage abstimmen.'}</span></div>
    <div class="stack" style="gap:4px"><label class="check"><input type="checkbox" id="pf-cancel" ${e.cancelRule ? 'checked' : ''}> 🍻 Absage-Regel anzeigen</label>
      <span class="small muted">Wer beim festgelegten Termin nicht spätestens 1 Woche vorher absagt (außer z. B. bei Krankheit), schuldet jedem aus der Gruppe einen Drink.</span></div>
    </div></details>
    <p class="small muted">Mit der Anzahl erkennt die Auswertung, ob alle abgestimmt haben. Monate kannst du später ändern, bisherige Antworten bleiben erhalten.</p>
    <div class="row"><button class="btn primary" data-act="pf-save">${e.id ? 'Speichern' : 'Erstellen'}</button><button class="btn ghost" data-act="pf-cancel">Abbrechen</button></div></div>`;
}
/* ---------- Zeitraum, Teilnehmer, neue Runde ---------- */
export const exclCount = f => new Set(f.excluded.filter(ds => f.months.includes(ds.slice(0, 7)))).size;
export const partOn = f => Object.values(f.participants || {}).filter(x => x && x.on).length;
export function exclGrid(k, ex) {
  const [y, m] = k.split('-').map(Number),
    n = new Date(y, m, 0).getDate(),
    lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(ymd(y, m, d));
  while (cells.length % 7) cells.push(null);
  let rows = '';
  for (let i = 0; i < cells.length; i += 7) {
    const wk = cells.slice(i, i + 7),
      real = wk.filter(Boolean),
      kw = isoWeek(parseYmd(real[0]));
    rows +=
      `<button class="kw" data-act="ex-week" data-v="${real.join(',')}" aria-label="Kalenderwoche ${kw} umschalten">KW ${kw}</button>` +
      wk
        .map(ds =>
          ds
            ? `<button class="cell ${ex.has(ds) ? 'ex' : 'inc'}" data-act="ex-day" data-d="${ds}" ${ds < TODAY ? 'disabled' : ''} aria-pressed="${!ex.has(ds)}" aria-label="${fmtDate(ds, true)}: ${ex.has(ds) ? 'ausgeschlossen' : 'zur Auswahl'}"><span class="dn">${+ds.slice(8)}</span></button>`
            : '<div class="cell blank" aria-hidden="true"></div>'
        )
        .join('');
  }
  return `<section class="month"><h3>${MONTHS[m - 1]} ${y}</h3><div class="xgrid"><span></span>${WD_SHORT.map((w, i) => `<button class="xwk" data-act="ex-wd" data-m="${k}" data-v="${i}" aria-label="Alle ${WD_LONG[i]}e im ${MONTHS[m - 1]} umschalten">${w}</button>`).join('')}${rows}</div></section>`;
}
export function peopleSection(e) {
  const known = [...(S.people || [])];
  const me = B && B.uid();
  if (me && !known.some(x => x.uid === me)) known.unshift({ uid: me, name: 'Du (Organisator)', emoji: '' });
  for (const [uid, x] of Object.entries(e.participants || {}))
    if (!known.some(k => k.uid === uid)) known.push({ uid, name: x.name || 'Unbekannt', emoji: '' });
  known.sort((a, b) => (a.uid === me ? -1 : b.uid === me ? 1 : a.name.localeCompare(b.name)));
  return `<details class="adv" data-key="openPeople" ${e.openPeople ? 'open' : ''}><summary><span>Wer darf abstimmen?</span><span class="small muted">${e.restricted ? `${partOn(e)} ausgewählt` : 'alle mit dem Link'}</span></summary>
    <div class="stack"><div class="seg full" role="group" aria-label="Wer darf abstimmen"><button data-act="pf-restr" data-v="0" class="${e.restricted ? '' : 'on'}">Alle mit dem Link</button><button data-act="pf-restr" data-v="1" class="${e.restricted ? 'on' : ''}">Nur ausgewählte Personen</button></div>
    ${
      e.restricted
        ? `<span class="small muted">Tippe an, wer dabei ist. Die Liste kommt aus allen bisherigen Antworten in deinen Events.${S.people === null ? ' Lädt …' : ''}</span>
      <div class="chips">${known.map(x => `<button class="chip ${e.participants[x.uid] && e.participants[x.uid].on ? 'on' : ''}" data-act="pf-person" data-id="${esc(x.uid)}" data-v="${esc(x.name)}" aria-pressed="${!!(e.participants[x.uid] && e.participants[x.uid].on)}">${x.emoji ? esc(x.emoji) + ' ' : ''}${esc(x.name)}</button>`).join('')}</div>
      <span class="small muted">Neue Leute? Schick ihnen einfach den Link. Dort können sie eine Teilnahme anfragen, die du in der Auswertung mit einem Tippen zulässt. Alle anderen können nicht mit abstimmen.</span>`
        : ''
    }</div></details>`;
}

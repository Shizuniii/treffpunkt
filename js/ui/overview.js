/* Einfacher Überblick für Organisatoren: das Wichtigste auf einen Blick, Details auf Wunsch.
   „Einfach“ / „Ausführlich“ gilt für Startseite und Auswertung gleichermaßen (gespeichert auf diesem Gerät). */
import { S, TODAY } from '../app/state.js';
import { ivText } from '../core/availability.js';
import {
  MONTHS_S,
  WD_SHORT,
  deadlineText,
  fmtDate,
  minStr,
  monthsLabel,
  parseYmd,
  remainText,
  wdIdx,
} from '../core/dates.js';
import { holiday } from '../core/holidays.js';
import { addedList, countsAsDone, groupSize, isRestricted, partList, pollClosed, pollMonths } from '../core/poll.js';
import { esc } from '../core/util.js';
import { statusPill } from './home.js';
import { pendingCard, personName } from './results.js';

/** Umschalter „Einfach | Ausführlich“. */
export const viewToggle = () =>
  `<div class="seg" role="group" aria-label="Ansicht"><button data-act="owner-view" data-v="simple" class="${S.ownerView === 'simple' ? 'on' : ''}" aria-pressed="${S.ownerView === 'simple'}">Einfach</button><button data-act="owner-view" data-v="details" class="${S.ownerView === 'details' ? 'on' : ''}" aria-pressed="${S.ownerView === 'details'}">Ausführlich</button></div>`;

const timeText = (s, e) => (e - s >= 1440 ? 'ganztägig' : `${minStr(s)}–${minStr(e)}`);
const names = (list, max = 4) =>
  list.length > max
    ? `${list.slice(0, max).map(esc).join(', ')} und ${list.length - max} weitere`
    : list.map(esc).join(', ');
/** Ist das Event erledigt (Termin vorbei oder geschlossen ohne Termin)? Dann kommt es nach unten. */
export const isArchived = p => (p.final ? p.final.date < TODAY : pollClosed(p) && !!p.closed);

function progress(done, exp) {
  if (!exp) return `<span class="small muted">${done} ${done === 1 ? 'Person ist' : 'Personen sind'} fertig</span>`;
  const pct = Math.min(100, Math.round((done / exp) * 100));
  return `<div class="ov-prog"><div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div><span class="small"><b>${done} von ${exp}</b> fertig</span></div>`;
}
function stateChip(p) {
  if (p.final) return `<span class="pill ok">Termin steht</span>`;
  if (pollClosed(p)) return statusPill(p);
  if (p.closesAt)
    return `<span class="pill warn" title="Frist ${esc(deadlineText(p.closesAt))}">${esc(remainText(p.closesAt))}</span>`;
  return `<span class="pill ok">Offen</span>`;
}

/* ---------- Startseite: eine Karte pro Event ---------- */
export function homeCardSimple(p) {
  const sm = S.summaries[p.id],
    closed = pollClosed(p);
  const rq = S.reqCounts[p.id] || 0,
    pend = addedList(p).filter(a => !a.ok && !a.declined).length;
  let main;
  if (p.final) main = `📅 <b>${fmtDate(p.final.date, true)}</b>, ${esc(ivText([p.final.s, p.final.e]))}`;
  else if (sm && sm.best)
    main = `Bester Tag bisher: <b>${fmtDate(sm.best.ds, true)}</b>, ${timeText(sm.best.s, sm.best.e)} · ${sm.best.k} ${sm.best.k === 1 ? 'kann' : 'können'}${sm.best.n > sm.best.k ? ` (von ${sm.best.n})` : ' (alle bisher)'}`;
  else main = sm ? `<span class="muted">Noch kein gemeinsamer Tag</span>` : `<span class="muted">Lädt …</span>`;
  const waiting = [
    rq ? `${rq} ${rq === 1 ? 'Anfrage' : 'Anfragen'}` : '',
    pend ? `${pend} ${pend === 1 ? 'Vorschlag' : 'Vorschläge'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const more = S.moreOpen === p.id;
  return `<div class="card ov-card">
    <div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div class="stack" style="gap:2px;min-width:0"><h2>${esc(p.title || 'Ohne Titel')}</h2>
      <span class="small muted">${esc(monthsLabel(pollMonths(p)))}</span></div>${stateChip(p)}</div>
    ${sm ? progress(sm.done, sm.expected) : ''}
    <div class="ov-main">${main}</div>
    ${sm && sm.missing.length && !closed && !p.final ? `<div class="small muted">Fehlt noch: ${names(sm.missing)}</div>` : ''}
    ${waiting ? `<a class="ov-wait" href="#/r/${p.id}">🔔 ${waiting} – wartet auf dich</a>` : ''}
    <div class="row"><a class="btn primary sm" href="#/r/${p.id}">Auswertung</a><button class="btn sm" data-act="share" data-id="${p.id}">Link teilen</button>
      <button class="btn sm ghost" data-act="more" data-id="${p.id}" aria-expanded="${more}">${more ? 'Weniger' : 'Mehr …'}</button></div>
    ${
      more
        ? `<div class="row ov-more"><a class="btn sm" href="#/p/${p.id}">Selbst eintragen</a><button class="btn sm" data-act="edit-poll" data-id="${p.id}">Bearbeiten</button>
      <button class="btn sm" data-act="reuse-poll" data-id="${p.id}">Nochmal mit neuem Zeitraum</button><button class="btn sm" data-act="tpl-save-open" data-id="${p.id}">Als Vorlage speichern</button>
      ${pollClosed(p) && !p.closed ? '' : `<button class="btn sm ghost" data-act="toggle-closed" data-id="${p.id}">${p.closed ? 'Wieder öffnen' : 'Abstimmung schließen'}</button>`}</div>`
        : ''
    }</div>`;
}

/* ---------- Auswertung: das Wichtigste ---------- */
function dayRowSimple(d, R, i) {
  const dt = parseYmd(d.ds),
    hol = holiday(d.ds),
    t = d.main;
  const without = R.resps
    .filter(r => !t.who.includes(r.uid) && !d.maybeIn.some(x => x.r.uid === r.uid))
    .map(r => r.name);
  return `<button class="dayrow" data-act="open-day" data-d="${d.ds}">
    <span class="date"><span>${WD_SHORT[wdIdx(d.ds)]}</span><b>${dt.getDate()}</b><span>${MONTHS_S[dt.getMonth()]}</span>${i === 0 ? '<span class="mvp">Top</span>' : ''}</span>
    <span class="info"><span class="t">${timeText(t.s, t.e)}</span>
      <span class="w">${without.length ? `Ohne: ${names(without, 3)}` : 'Alle können 🎉'}${d.maybeIn.length ? ` · ${d.maybeIn.length} vielleicht` : ''}</span>
      ${hol ? `<span class="w" style="color:var(--holiday)">${esc(hol.name)}</span>` : ''}</span>
    <span class="score">${t.k}<small>/${R.n}</small></span></button>`;
}

export function resultsSimple(p, R) {
  const exp = groupSize(p),
    closed = pollClosed(p);
  const doneN = R.all.filter(r => countsAsDone(p, r)).length;
  const missing = isRestricted(p)
    ? partList(p)
        .filter(x => !S.responses.some(r => r.uid === x.uid && countsAsDone(p, r)))
        .map(x => personName(x.uid, x.name))
    : R.all.filter(r => !countsAsDone(p, r)).map(r => r.name);
  let h = `<div class="card ov-status"><div class="row between" style="align-items:center">${progress(doneN, exp)}${stateChip(p)}</div>
    ${p.closesAt && !closed ? `<span class="small muted">Abstimmen bis ${deadlineText(p.closesAt, true)}</span>` : ''}
    ${missing.length && !closed && !p.final ? `<div class="small">Fehlt noch: <b>${names(missing, 6)}</b></div>` : ''}
    ${exp && doneN >= exp ? `<div class="small" style="font-weight:600;color:var(--accent)">Alle haben abgestimmt 🎉</div>` : ''}
    <div class="row">${!closed && !p.final ? `<button class="btn sm" data-act="remind">Erinnerung schicken</button>` : ''}<button class="btn sm" data-act="share" data-id="${p.id}">Link teilen</button>${closed || p.closesAt ? `<button class="btn sm" data-act="extend-open">${closed ? 'Wieder öffnen' : 'Frist verlängern'}</button>` : ''}</div></div>`;
  h += pendingCard(p);
  if (p.final) {
    const cancels = S.responses.filter(r => r.cancel && r.name && r.cancel.date === p.final.date);
    h += `<div class="card final-card"><span class="eyebrow" style="color:var(--accent)">Der Termin steht</span><h2>${fmtDate(p.final.date, true)}</h2><p>${esc(ivText([p.final.s, p.final.e]))}</p>
      ${cancels.length ? `<div class="small">Abgesagt: <b>${cancels.map(r => esc(r.name) + (r.cancel.owes ? ' 🍹' : '')).join(', ')}</b></div>` : `<div class="small muted">Noch keine Absagen.</div>`}
      <div class="row"><button class="btn sm primary" data-act="share-result">Termin an die Gruppe</button></div></div>`;
  } else if (!R.all.length) {
    h += `<div class="card empty"><h2>Noch keine Antworten</h2><p>Schick den Link an deine Freunde. Neue Antworten erscheinen hier sofort.</p></div>`;
  } else {
    h += `<div class="card"><div class="stack" style="gap:2px"><h2>Die besten Tage</h2><p class="small muted">Tippe einen Tag an, um Uhrzeiten zu sehen und ihn als Termin festzulegen.</p></div>
      ${
        R.ranked.length
          ? `<div class="top">${R.ranked
              .slice(0, 3)
              .map((d, i) => dayRowSimple(d, R, i))
              .join('')}</div>`
          : `<div class="empty">Noch kein Tag, an dem mindestens zwei können.</div>`
      }
      <div class="row"><button class="btn sm" data-act="share-result">Zwischenstand an die Gruppe</button></div></div>`;
  }
  h += `<div class="row ov-foot"><button class="btn ghost" data-act="owner-view" data-v="details">Alle Details anzeigen →</button></div>`;
  return h;
}

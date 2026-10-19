/* Auswertung für den Organisator – und zum Nur-Ansehen für Teilnehmer, wenn der Organisator es erlaubt. */
import { B, S, TODAY, isOwner } from '../app/state.js';
import { effective, isAllDay, ivLabel, ivText } from '../core/availability.js';
import {
  MONTHS_S,
  WD_SHORT,
  deadlineText,
  durStr,
  fmtDate,
  minStr,
  monthsLabel,
  parseYmd,
  rangeText,
  remainText,
  wdIdx,
} from '../core/dates.js';
import { ferien, holiday } from '../core/holidays.js';
import {
  addedList,
  addedOk,
  allowedWd,
  canSeeOthers,
  countsAsDone,
  inPoll,
  isRestricted,
  isStale,
  partList,
  pollClosed,
  pollMonths,
  shareMode,
  viewerList,
} from '../core/poll.js';
import { computeResultsFor } from '../core/results.js';
import { colorFor, esc, initials } from '../core/util.js';
import { dayDecor, monthGrid } from './calendar.js';
import { sheetHead, timeAgo, voteLink } from './dom.js';
import { activeExts } from './extend.js';
import { LOAD_TXT } from './fun.js';
import { statusPill } from './home.js';
import { resultsSimple, viewToggle } from './overview.js';
import { topbar } from './render.js';
import { textBlock } from './sheets.js';
import { ruleText } from './vote.js';

/* ---------- Auswertung ---------- */
/** Ausgewählte Personen im aktuellen Event (leer = alle). */
export const picked = () => (S.pick && S.poll && S.pick.id === S.poll.id ? S.pick.uids : []);
/**
 * people: true = Personen-Auswahl berücksichtigen. Nur die ausführliche Auswertung tut das –
 * Würfeln, Nachricht an die Gruppe, Tagesdetails und der einfache Überblick zählen immer alle.
 */
export function computeResults({ people = false } = {}) {
  return computeResultsFor({
    poll: S.poll,
    responses: S.responses,
    filters: S.filters,
    today: TODAY,
    myUid: B && B.uid(),
    people: people ? picked() : [],
  });
}
export const nameOf = (R, uid) => (R.resps.find(r => r.uid === uid) || {}).name || '?';
const selNames = R => R.sel.map(uid => nameOf(R, uid));
export function viewResults() {
  // ro = nur ansehen: Teilnehmer, denen der Organisator die Auswertung freigegeben hat (kein Bearbeiten).
  const p = S.poll,
    ro = !isOwner(),
    simple = !ro && S.ownerView === 'simple';
  const back = ro
    ? `<a class="btn sm ghost" href="#/p/${esc((p && p.id) || S.route.id)}">← Zur Abstimmung</a>`
    : `<a class="btn sm ghost" href="#/">← Übersicht</a>`;
  let h = `<div class="wrap${simple ? '' : ' wide'}">${topbar(back)}`;
  if (S.loadErr) return h + `<div class="banner bad">${esc(S.loadErr)}</div></div>`;
  if (p === undefined) return h + `<div class="empty">${LOAD_TXT}</div></div>`;
  if (p === null) return h + `<div class="card empty"><h2>Event nicht gefunden</h2></div></div>`;
  const R = computeResults({ people: !simple });
  const hero = `<div class="hero"><span class="eyebrow">${esc(monthsLabel(pollMonths(p)))} · ${ro ? 'Auswahl der anderen' : 'Auswertung live'}</span><h1>${esc(p.title || 'Event')}</h1></div>`;
  // Einfach: nur das Wichtigste (js/ui/overview.js). Ausführlich: alles wie bisher.
  if (simple)
    return (
      h +
      `<div class="row between" style="align-items:flex-end">${hero}${viewToggle()}</div>` +
      resultsSimple(p, R) +
      `</div>`
    );
  const parts = isRestricted(p) ? partList(p) : [];
  const doneN = R.all.filter(r => countsAsDone(p, r)).length,
    exp = isRestricted(p) ? parts.length : p.expected || 0,
    closed = pollClosed(p);
  const complete = exp > 0 && doneN >= exp;
  const missing = parts
    .filter(x => !S.responses.some(r => r.uid === x.uid && countsAsDone(p, r)))
    .map(x => personName(x.uid, x.name));
  h += ro
    ? `<div class="row between">${hero}</div><p class="small muted">Nur zum Ansehen – der Organisator hat für dieses Event freigegeben, dass du siehst, wann die anderen können.</p>`
    : `<div class="row between">${hero}
     <div class="row">${viewToggle()}<button class="btn sm" data-act="share" data-id="${p.id}">Link teilen</button><button class="btn sm" data-act="message">Nachricht an die Gruppe</button><a class="btn sm" href="#/p/${p.id}">Selbst eintragen</a></div></div>`;
  const cancels = S.responses.filter(r => r.cancel && r.name && p.final && r.cancel.date === p.final.date);
  if (!ro) h += pendingCard(p);
  if (p.final)
    h += ro
      ? `<div class="banner ok"><span>Termin festgelegt: <b>${fmtDate(p.final.date, true)}</b>, ${ivText([p.final.s, p.final.e])}.</span></div>`
      : `<div class="banner ok"><span>Termin festgelegt: <b>${fmtDate(p.final.date, true)}</b>, ${ivText([p.final.s, p.final.e])}. Deine Freunde sehen ihn mit Kalender-Button.${cancels.length ? `<br><span class="small">Abgesagt: ${cancels.map(r => `${esc(r.name)}${r.cancel.owes ? ` (schuldet ${r.cancel.drinks ? r.cancel.drinks + ' ' : ''}🍹)` : r.cancel.reason === 'sick' ? ' (krank)' : ''}`).join(', ')}</span>` : ''}</span><button class="btn sm" data-act="unfinal">Aufheben</button></div>`;
  const nExt = activeExts(p).length + (S.passes || []).filter(x => x.until > Date.now()).length;
  const pct = exp ? Math.min(100, Math.round((doneN / exp) * 100)) : 0;
  const sm = shareMode(p),
    viewers = viewerList(p);
  h += `<div class="card"><div class="row between" style="align-items:flex-end">
      <div class="row" style="gap:28px"><div class="stat"><b>${doneN}${exp ? `<span class="muted" style="font-size:1rem"> / ${exp}</span>` : ''}</b><span class="small muted">fertig abgestimmt</span></div>
      <div class="stat"><b>${R.all.length - doneN}</b><span class="small muted">tragen noch ein</span></div></div>
      <div class="row">${p.closesAt ? `<span class="small muted">${closed && !p.closed ? 'Frist war' : 'Frist:'} ${deadlineText(p.closesAt)}${closed ? '' : ` · ${remainText(p.closesAt)}`}</span>` : ''}${closed ? statusPill(p) : `<span class="pill ok">● Live</span>`}</div></div>
      ${exp ? `<div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>` : ''}
      ${
        complete
          ? `<div class="banner ok">Full Party! Alle ${exp} haben abgestimmt 🎉 Das Ergebnis ist vollständig.</div>`
          : closed
            ? `<div class="banner info">Die Abstimmung ist beendet${exp ? ` (${doneN} von ${exp} haben abgestimmt)` : ''}. Das Ergebnis ändert sich nicht mehr.</div>`
            : `<div class="banner warn">Noch nicht vollständig${exp ? `: ${Math.max(0, exp - doneN)} ${exp - doneN === 1 ? 'Antwort fehlt' : 'Antworten fehlen'}` : ''}. Die Ergebnisse können sich noch ändern.${exp || ro ? '' : ' (Lege unter „Bearbeiten“ fest, wie viele abstimmen sollen.)'}</div>`
      }
      ${missing.length && !closed ? `<div class="small">Noch nicht fertig: <b>${esc(missing.join(', '))}</b></div>` : ''}
      ${
        addedOk(p).length && !ro
          ? `<div class="small muted">Von Teilnehmern hinzugefügt: ${addedOk(p)
              .map(
                a =>
                  `${esc(a.name || '?')}: ${rangeText(a.from, a.to)} <button class="linkbtn" data-act="add-no" data-id="${esc(a.uid)}">entfernen</button>`
              )
              .join(' · ')}</div>`
          : ''
      }
      ${p.reopenedAt ? `<div class="small muted">Neue Runde seit ${timeAgo(p.reopenedAt)}${p.reopenNote ? ` · ${esc(p.reopenNote)}` : ''}. Antworten von davor zählen erst wieder, wenn die Person neu bestätigt.</div>` : ''}
      ${
        ro
          ? ''
          : `${sm !== 'none' ? `<div class="small share-line">👀 Antworten sehen auch: <b>${sm === 'all' ? 'alle, die abgestimmt haben' : esc(viewers.map(x => personName(x.uid, x.name)).join(', ') || 'niemand')}</b> <span class="muted">(ändern unter „Bearbeiten“)</span></div>` : ''}
      <div class="row"><button class="btn sm" data-act="extend-open">${closed ? 'Wieder öffnen / verlängern' : 'Frist & nachträglich öffnen'}</button>${p.final || closed ? `<button class="btn sm" data-act="reopen-open">Neu eröffnen</button>` : ''}${nExt ? `<span class="small muted">${nExt} ${nExt === 1 ? 'Freischaltung' : 'Freischaltungen'} aktiv</span>` : ''}</div>`
      }
    </div>`;
  if (!R.all.length)
    return (
      h +
      (ro
        ? `<div class="card empty"><h2>Noch keine Antworten</h2><p>Sobald jemand abstimmt, erscheint es hier.</p></div></div>`
        : `<div class="card empty"><h2>Noch keine Antworten</h2><p>Schick den Link an deine Freunde. Neue Antworten erscheinen hier sofort.</p><button class="btn primary" data-act="share" data-id="${p.id}">Link teilen</button></div></div>`)
    );
  const one = R.sel.length === 1 ? R.resps[0] : null;
  h += `<div class="card"><div class="filters">
     ${pickRow(R)}
     <div class="row"><span style="font-weight:600">Mindestens</span><div class="stepper"><button data-act="f-people" data-v="-1" aria-label="weniger">−</button><span>${R.minP}</span><button data-act="f-people" data-v="1" aria-label="mehr">+</button></div><span>von ${R.n} ${R.n === 1 ? 'Person' : 'Personen'}</span></div>
     <div class="row"><span style="font-weight:600">gemeinsam mind.</span><div class="stepper"><button data-act="f-hours" data-v="-1" aria-label="weniger">−</button><span>${S.filters.minHours}</span><button data-act="f-hours" data-v="1" aria-label="mehr">+</button></div><span>Std.</span></div>
     <label class="check small"><input type="checkbox" id="f-maybe" ${S.filters.inclMaybe ? 'checked' : ''}> „Vielleicht“ mitzählen</label>
     ${R.resps.some(r => (r.favs || []).length) ? `<div class="row"><span style="font-weight:600">Sortieren nach</span><div class="seg" role="group" aria-label="Sortierung"><button data-act="f-sort" data-v="0" class="${S.filters.sortFav ? '' : 'on'}">Verfügbarkeit</button><button data-act="f-sort" data-v="1" class="${S.filters.sortFav ? 'on' : ''}">⭐ Favoriten</button></div></div>` : ''}
     <label class="check small"><input type="checkbox" id="f-done" ${S.filters.onlyDone ? 'checked' : ''} ${R.sel.length ? 'disabled title="Gilt nicht, solange Personen ausgewählt sind"' : ''}> nur fertige Antworten</label></div></div>`;
  if (R.sel.length)
    h += `<div class="banner info pick-banner" role="status"><span>${one ? 'Du siehst nur, was' : 'Du siehst nur, wann'} <b>${esc(selNames(R).join(', '))}</b> ${one ? 'eingetragen hat' : 'zusammen können'}. ${ro ? 'Tagesdetails zählen weiter alle.' : 'Tagesdetails und „Nachricht an die Gruppe“ zählen weiter alle.'}</span><button class="btn sm" data-act="pick-clear">Alle anzeigen</button></div>`;
  const bestScore = R.ranked.length ? R.ranked[0].score : 0;
  const list = S.showAllDays ? R.ranked : R.ranked.slice(0, 8);
  const ties = R.ranked.length
    ? R.ranked.filter(d => d.score === R.ranked[0].score && d.maybeIn.length === R.ranked[0].maybeIn.length)
    : [];
  const bestTitle = one
    ? `Tage, an denen ${esc(one.name)} kann`
    : R.sel.length
      ? 'Beste Tage für die Auswahl'
      : 'Beste Tage';
  const tapHint = ro
    ? 'Tippe auf einen Tag, um alle Personen an diesem Tag zu sehen.'
    : 'Tippe auf einen Tag, um alle Personen an diesem Tag zu sehen und ihn als Termin festzulegen.';
  h += `<div class="res-grid"><div class="card"><div class="row between"><h2>${bestTitle}</h2><div class="row"><span class="small muted">${R.ranked.length} passende Tage</span>${ties.length >= 2 && !R.sel.length && !ro ? `<button class="btn sm" data-act="dice" title="${ties.length} Tage sind gleich gut">🎲 Auswürfeln</button>` : ''}</div></div>
     ${
       R.ranked.length
         ? `<div class="top">${list.map((d, i) => dayRow(d, R, i === 0 && !one)).join('')}</div>
        ${R.ranked.length > 8 ? `<button class="btn sm ghost" data-act="toggle-all">${S.showAllDays ? 'Weniger anzeigen' : `Alle ${R.ranked.length} anzeigen`}</button>` : ''}`
         : `<div class="empty">${one ? `${esc(one.name)} hat noch keinen passenden Tag eingetragen.` : 'Kein Tag erfüllt die Filter. Senke die Mindestanzahl oder Stunden.'}</div>`
     }</div>`;
  const holLegend = `<span><i class="sw" style="background:var(--holiday);border-radius:50%;width:8px;height:8px;border:0"></i>Feiertag</span><span><i class="sw" style="background:var(--ferien);height:4px;border:0"></i>Schulferien</span>`;
  h += one
    ? `<div class="card"><div class="stack" style="gap:4px"><h2>Kalender von ${esc(one.name)}</h2><p class="small muted">So hat ${esc(one.name)} eingetragen. ${tapHint}</p></div>
     <div class="legend"><span><i class="sw" style="background:var(--accent);border-color:var(--accent)"></i>Ganzer Tag</span><span><i class="sw" style="background:var(--accent-soft);border-color:var(--accent)"></i>Mit Uhrzeit</span><span><i class="sw maybe"></i>Vielleicht</span><span><i class="sw" style="background:var(--accent-mid);border:1px dashed var(--accent-mid)"></i>Automatisch (Wiederholung)</span><span><i class="sw" style="background:var(--surface-2)"></i>Kann nicht</span>${holLegend}</div>
     <div class="months">${pollMonths(p)
       .map(k => monthGrid(k, ds => personCell(ds, R, one)))
       .join('')}</div></div></div>`
    : `<div class="card"><div class="stack" style="gap:4px"><h2>${R.sel.length ? 'Kalender der Auswahl' : 'Kalender'}</h2><p class="small muted">Je dunkler, desto mehr können gleichzeitig. „4+1“ = 4 sicher, 1 vielleicht. ${tapHint}</p></div>
     <div class="legend"><span><i class="sw" style="background:color-mix(in srgb,var(--accent) 25%,var(--surface))"></i>wenige</span><span><i class="sw" style="background:var(--accent)"></i>${R.sel.length ? 'alle Ausgewählten' : 'alle'}</span><span><i class="sw" style="box-shadow:inset 0 0 0 2px var(--fg)"></i>bester Tag</span><span><i class="sw maybe"></i>nur vielleicht</span>${holLegend}</div>
     <div class="months">${pollMonths(p)
       .map(k => monthGrid(k, ds => heatCell(ds, R, bestScore)))
       .join('')}</div></div></div>`;
  h += `<div class="card"><div class="row between"><h2>Teilnehmer</h2>${isRestricted(p) && !ro ? `<span class="small muted">Teilnehmerliste aktiv · ${parts.length} Personen</span>` : ''}</div><div class="people">${[
    ...R.all,
  ]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(r => (ro ? personRowView(r) : personRow(r)))
    .join('')}</div>
    ${R.outsiders.length && !ro ? `<div class="stack" style="gap:6px"><span class="small muted">Nicht auf der Teilnehmerliste (zählen nicht mit):</span>${R.outsiders.map(r => `<div class="rule"><span>${r.emoji ? esc(r.emoji) + ' ' : ''}${esc(r.name)}</span><button class="btn sm" data-act="part-add" data-id="${esc(r.uid)}" data-v="${esc(r.name)}">Zur Liste hinzufügen</button></div>`).join('')}</div>` : ''}</div>`;
  return h + `</div>`;
}
/** Teilnehmer-Zeile zum Nur-Ansehen: Name, Status, Wiederholungen, Favoriten – keine Notizen an den Organisator. */
export function personRowView(r) {
  const isMe = B && r.uid === B.uid();
  const rules = r.rules
    .map(x => {
      const t = ruleText(x);
      return `${x.kind === 'no' ? 'nicht' : 'kann'} ${t.days} ${t.time}${x.label ? ` (${x.label})` : ''}`;
    })
    .join(' · ');
  const stale = isStale(S.poll, r);
  const status = [stale ? 'muss Neues noch prüfen' : r.done ? 'Fertig' : 'Trägt noch ein', timeAgo(r.updatedAt)]
    .filter(Boolean)
    .join(' · ');
  return `<div class="person"><div class="row" style="flex-wrap:nowrap;min-width:0;flex:1 1 240px"><span class="avatar" style="background:${r.emoji ? 'var(--surface-2)' : colorFor(r.uid)}">${r.emoji ? esc(r.emoji) : esc(initials(r.name))}</span>
     <div class="stack" style="gap:1px"><span style="font-weight:600">${esc(r.name)}${isMe ? ' <span class="muted small">(du)</span>' : ''}</span>
     <span class="small muted">${esc(status)}</span>
     ${rules ? `<span class="small muted">${esc(rules)}</span>` : ''}
     ${(r.favs || []).length ? `<span class="favline">⭐ ${r.favs.map((ds, i) => `#${i + 1} ${fmtDate(ds)}`).join(' · ')}</span>` : ''}</div></div>
     <div class="row" style="justify-content:flex-end"><span class="pill ${countsAsDone(S.poll, r) ? 'ok' : 'warn'}">${countsAsDone(S.poll, r) ? '✓' : stale ? '↻' : '…'}</span>
     <button class="btn sm" data-act="pick-only" data-id="${esc(r.uid)}" aria-label="Kalender von ${esc(r.name)} ansehen">📅 Ansehen</button></div></div>`;
}
/** Teilnehmer, die (noch) nicht ansehen dürfen: Hinweis statt Auswertung. */
export function viewNoAccess() {
  const p = S.poll,
    id = (p && p.id) || S.route.id;
  const voteFirst = p && shareMode(p) === 'all' && !S.answered && !S.viewDenied;
  return `<div class="wrap">${topbar(`<a class="btn sm ghost" href="#/p/${esc(id)}">← Zur Abstimmung</a>`)}
    <div class="card empty"><h2>${voteFirst ? 'Erst selbst abstimmen' : 'Nur für Organisatoren'}</h2>
    <p>${voteFirst ? 'Sobald du eingetragen hast, wann du kannst, siehst du hier, wann die anderen können.' : 'Die Antworten der anderen kann bei diesem Event nur der Organisator sehen.'}</p>
    <a class="btn primary" href="#/p/${esc(id)}">Zur Abstimmung</a></div></div>`;
}
/** Status für Nicht-Organisatoren auf der Auswertungs-Seite: 'loading' | 'ok' | 'no'. */
export function viewerState() {
  if (S.poll === undefined || S.answered === undefined) return 'loading';
  if (!S.poll || S.viewDenied) return 'no';
  return canSeeOthers(S.poll, B && B.uid(), S.answered) ? 'ok' : 'no';
}
export function dayRow(d, R, mvp) {
  const t = d.main,
    dt = parseYmd(d.ds),
    hol = holiday(d.ds),
    fer = ferien(d.ds);
  const missing = R.resps
    .filter(r => !t.who.includes(r.uid) && !d.maybeIn.some(x => x.r.uid === r.uid))
    .map(r => r.name);
  const top = d.tiers[0];
  const extra = top && top.k > t.k ? ` · ${top.k} Pers. nur ${minStr(top.s)}–${minStr(top.e)}` : '';
  const fin = S.poll.final && S.poll.final.date === d.ds;
  const sel = (R.sel || []).length;
  const allCan = sel === 1 ? `${nameOf(R, R.sel[0])} kann` : sel ? 'Alle Ausgewählten können ✓' : 'Alle können 🎉';
  return `<button class="dayrow" data-act="open-day" data-d="${d.ds}" ${fin ? 'style="border-color:var(--accent);border-width:2px"' : ''}>
     <span class="date"><span>${WD_SHORT[wdIdx(d.ds)]}</span><b>${dt.getDate()}</b><span>${MONTHS_S[dt.getMonth()]}</span>${mvp ? '<span class="mvp">MVP</span>' : ''}</span>
     <span class="info"><span class="t">${fin ? '★ ' : ''}${t.len >= 1440 ? 'Ganztägig' : `${minStr(t.s)}–${minStr(t.e)}`} <span class="muted small">(${t.len >= 1440 ? '24 Std.' : durStr(t.len)})</span></span>
       ${d.maybeIn.length ? `<span class="mb">+ vielleicht: ${esc(d.maybeIn.map(x => x.r.name).join(', '))}</span>` : ''}
       ${d.fav.length ? `<span class="favline">⭐ Top 3 von ${esc(d.fav.map(x => `${x.r.name} (#${x.rank})`).join(', '))}</span>` : ''}
       <span class="w">${missing.length ? `Ohne: ${esc(missing.join(', '))}` : esc(allCan)}${esc(extra)}</span>
       ${hol || fer ? `<span class="w" style="color:var(--holiday)">${esc([hol && hol.name, fer].filter(Boolean).join(' · '))}</span>` : ''}</span>
     <span class="score">${sel === 1 ? '✓' : `${t.k}${d.maybeIn.length ? `<small>+${d.maybeIn.length}</small>` : ''}<small>/${R.n}</small>`}</span></button>`;
}
/** Auswahl „Personen ansehen“: Chips für alle, die geantwortet haben. */
export function pickRow(R) {
  if (R.all.length < 2) return '';
  const people = [...R.all].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const chip = r => {
    const on = R.sel.includes(r.uid);
    return `<button class="chip${on ? ' on' : ''}" data-act="pick" data-id="${esc(r.uid)}" aria-pressed="${on}">${r.emoji ? esc(r.emoji) + ' ' : ''}${esc(r.name)}</button>`;
  };
  return `<div class="stack pick-row" style="gap:6px;flex:1 1 100%"><span style="font-weight:600">Personen ansehen <span class="small muted" style="font-weight:400">· eine oder mehrere antippen</span></span>
    <div class="chips" role="group" aria-label="Personen ansehen"><button class="chip${R.sel.length ? '' : ' on'}" data-act="pick-clear" aria-pressed="${!R.sel.length}">Alle</button>${people.map(chip).join('')}</div></div>`;
}
/** Kalender-Feld für genau eine Person – sieht aus wie beim Abstimmen. */
export function personCell(ds, R, r) {
  const d = R.days.find(x => x.ds === ds),
    dec = dayDecor(ds);
  if (ds < TODAY || !d)
    return `<button class="cell${dec.cls}${allowedWd(S.poll, ds) && inPoll(S.poll, ds) ? '' : ' off'}" disabled aria-label="${esc(fmtDate(ds, true))}"><span class="dn">${+ds.slice(8)}</span>${dec.extra}</button>`;
  const eff = effective(r, ds);
  let cls = 'cell' + dec.cls,
    lab = '';
  if (!eff.iv.length) cls += eff.explicit ? ' st-no' : '';
  else if (eff.maybe) {
    cls += ' st-maybe';
    lab = isAllDay(eff.iv) ? '?' : ivLabel(eff.iv) + '?';
  } else if (isAllDay(eff.iv)) cls += ' st-all';
  else {
    cls += ' st-part';
    lab = ivLabel(eff.iv);
  }
  if (!eff.explicit && eff.iv.length) cls += ' auto';
  if (S.poll.final && S.poll.final.date === ds) cls += ' fin';
  const fr = (r.favs || []).indexOf(ds);
  const state = eff.iv.length
    ? eff.iv.map(ivText).join(', ') + (eff.maybe ? ' (vielleicht)' : '') + (eff.explicit ? '' : ' (automatisch)')
    : eff.explicit
      ? 'kann nicht'
      : 'nichts eingetragen';
  const aria = `${fmtDate(ds, true)}: ${r.name} ${state}${fr >= 0 && fr < 3 ? ` · Top ${fr + 1}` : ''}${dec.title ? ' · ' + dec.title : ''}`;
  return `<button class="${cls}" data-act="open-day" data-d="${ds}" title="${esc(aria)}" aria-label="${esc(aria)}"><span class="dn">${+ds.slice(8)}</span>${lab ? `<span class="tl">${esc(lab)}</span>` : ''}${fr >= 0 && fr < 3 ? `<i class="favb">★${fr + 1}</i>` : ''}${dec.extra}</button>`;
}
export function heatCell(ds, R, bestScore) {
  const d = R.days.find(x => x.ds === ds),
    dec = dayDecor(ds),
    past = ds < TODAY;
  if (past || !d)
    return `<button class="cell${dec.cls}${allowedWd(S.poll, ds) && inPoll(S.poll, ds) ? '' : ' off'}" disabled aria-label="${esc(fmtDate(ds, true))}"><span class="dn">${+ds.slice(8)}</span>${dec.extra}</button>`;
  const k = d.score,
    p = R.n ? Math.round((k / R.n) * 100) : 0,
    mb = d.maybeIn.length;
  // Tage, an denen alle können: kräftig mit heller Schrift. Sonst abgestuft – so hell, dass die Schrift immer gut lesbar bleibt.
  const all = k > 0 && k >= R.n;
  const pp = !k ? 0 : all ? 92 : 18 + Math.round(p * 0.36);
  const fin = S.poll.final && S.poll.final.date === ds;
  const cls = `cell heat${dec.cls}${all ? ' hi' : ''}${k && k === bestScore ? ' best' : ''}${!k && d.maybeAny ? ' mb' : ''}${fin ? ' fin' : ''}`;
  const lab = k ? `${k}${mb ? '+' + mb : ''}` : d.maybeAny ? `+${d.maybeAny}?` : '';
  const aria = `${fmtDate(ds, true)}: ${k} von ${R.n} Personen${mb ? `, ${mb} vielleicht` : ''}${fin ? ' · festgelegter Termin' : ''}${dec.title ? ' · ' + dec.title : ''}`;
  return `<button class="${cls}" style="--p:${pp}" data-act="open-day" data-d="${ds}" title="${esc(aria)}${d.fav.length ? ` · ${d.fav.length}× Top 3` : ''}" aria-label="${esc(aria)}${d.fav.length ? ` · ${d.fav.length}× Top 3` : ''}"><span class="dn">${+ds.slice(8)}</span>${lab ? `<span class="tl">${lab}</span>` : ''}${d.fav.length ? `<i class="favb">★${d.fav.length}</i>` : ''}${dec.extra}</button>`;
}
export function personRow(r) {
  const c = S.confirmDel === r.uid;
  const rules = r.rules
    .map(x => {
      const t = ruleText(x);
      return `${x.kind === 'no' ? 'nicht' : 'kann'} ${t.days} ${t.time}${x.label ? ` (${x.label})` : ''}`;
    })
    .join(' · ');
  const mb = Object.entries(r.days).filter(([ds, d]) => d.m && !d.n && ds >= TODAY).length;
  const isMe = B && r.uid === B.uid();
  const x = S.poll && S.poll.extensions && S.poll.extensions[r.uid],
    extOn = x && x.until > Date.now();
  const cx = r.cancel && S.poll && S.poll.final && r.cancel.date === S.poll.final.date ? r.cancel : null,
    stale = isStale(S.poll, r);
  const status = [
    stale ? 'muss Neues noch prüfen' : r.done ? 'Fertig' : 'Trägt noch ein',
    timeAgo(r.updatedAt),
    r.base === 'all' ? 'kann meistens' : '',
    mb ? `${mb}× vielleicht` : '',
    extOn ? `freigeschaltet bis ${deadlineText(x.until)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `<div class="person"><div class="row" style="flex-wrap:nowrap;min-width:0;flex:1 1 240px"><span class="avatar" style="background:${r.emoji ? 'var(--surface-2)' : colorFor(r.uid)}">${r.emoji ? esc(r.emoji) : esc(initials(r.name))}</span>
     <div class="stack" style="gap:1px"><span style="font-weight:600">${esc(r.name)}${isMe ? ' <span class="muted small">(du)</span>' : ''}</span>
     <span class="small muted">${esc(status)}</span>
     ${cx ? `<span class="small" style="color:${cx.owes ? 'var(--maybe)' : 'var(--muted)'};font-weight:600">Abgesagt${cx.reason === 'sick' ? ' (krank / Notfall)' : cx.reason === 'early' ? ' (rechtzeitig)' : ''}${cx.owes ? ` · schuldet ${cx.drinks ? cx.drinks + ' Drinks' : 'jedem einen Drink'} 🍹` : ''}${cx.note ? ` · „${esc(cx.note)}“` : ''}</span>` : ''}
     ${rules ? `<span class="small muted">${esc(rules)}</span>` : ''}${r.note ? `<span class="small">„${esc(r.note)}“</span>` : ''}
     ${(r.favs || []).length ? `<span class="favline">⭐ ${r.favs.map((ds, i) => `#${i + 1} ${fmtDate(ds)}`).join(' · ')}</span>` : ''}</div></div>
     <div class="row" style="justify-content:flex-end"><span class="pill ${countsAsDone(S.poll, r) ? 'ok' : 'warn'}">${countsAsDone(S.poll, r) ? '✓' : stale ? '↻' : '…'}</span>
     ${
       c
         ? `<button class="btn sm danger" data-act="del-resp" data-id="${esc(r.uid)}">Wirklich löschen</button><button class="btn sm ghost" data-act="del-cancel">Nein</button>`
         : `<button class="btn sm" data-act="pick-only" data-id="${esc(r.uid)}" aria-label="Kalender von ${esc(r.name)} ansehen">📅 Ansehen</button><button class="btn sm" data-act="person-open" data-id="${esc(r.uid)}">${extOn ? 'Freigeschaltet ✓' : 'Ändern erlauben'}</button><button class="btn sm ghost" data-act="del-ask" data-id="${esc(r.uid)}" aria-label="Antwort löschen">Löschen</button>`
     }</div></div>`;
}
export function resultText(p) {
  if (p.final)
    return `${p.title}: Der Termin steht! ${fmtDate(p.final.date, true)}, ${ivText([p.final.s, p.final.e])}.\n${voteLink(p.id)}`;
  const R = computeResults();
  const top = R.ranked.slice(0, 3);
  if (!top.length)
    return `${p.title}: Noch kein gemeinsamer Termin gefunden. Tragt bitte ein, wann ihr könnt:\n${voteLink(p.id)}`;
  return (
    `${p.title} – die besten Termine bisher:\n` +
    top
      .map(
        (d, i) =>
          `${i + 1}. ${fmtDate(d.ds)}: ${d.main.len >= 1440 ? 'ganztägig' : `${minStr(d.main.s)}–${minStr(d.main.e)}`} (${d.score} von ${R.n})`
      )
      .join('\n') +
    `\n\nWer noch nicht abgestimmt hat: ${voteLink(p.id)}`
  );
}
export function remindText(p) {
  return `Kleine Erinnerung: Bitte tragt bei „${p.title}“ ein, wann ihr könnt${p.closesAt && !pollClosed(p) ? ` – abstimmen geht bis ${deadlineText(p.closesAt, true)}` : ''}. Dauert nur 1 Minute:\n${voteLink(p.id)}`;
}
/** Ein Fenster für alle Nachrichten an die Gruppe: Erinnerung oder Zwischenstand/Termin. */
export function sheetMessage() {
  const p = S.poll,
    kind = S.sheet.kind || 'remind';
  const notDone = S.responses.filter(r => r.name && !countsAsDone(p, r)).map(r => r.name);
  const info =
    kind === 'remind'
      ? `Für eure Gruppe.${notDone.length ? ` Noch nicht fertig: <b>${esc(notDone.join(', '))}</b>.` : ''}`
      : 'Kurze Zusammenfassung für eure Gruppe. Einzelne Antworten werden nicht verraten.';
  return `${sheetHead('Nachricht an die Gruppe')}
    <div class="seg full" role="group" aria-label="Art der Nachricht"><button data-act="msg-kind" data-v="remind" class="${kind === 'remind' ? 'on' : ''}">Erinnerung</button><button data-act="msg-kind" data-v="status" class="${kind === 'status' ? 'on' : ''}">${p.final ? 'Termin' : 'Zwischenstand'}</button></div>
    <p class="small muted">${info}</p>${textBlock(kind === 'remind' ? remindText(p) : resultText(p))}`;
}
export const personName = (uid, fallback) =>
  ((S.people || []).find(x => x.uid === uid) || S.responses.find(r => r.uid === uid) || {}).name ||
  fallback ||
  'Unbekannt';
export function pendingCard(p) {
  const pend = addedList(p).filter(a => !a.ok && !a.declined),
    reqs = S.requests || [];
  if (!pend.length && !reqs.length) return '';
  return `<div class="card offer"><h2>Wartet auf dich</h2>
    ${reqs.map(q => `<div class="rule" style="flex-wrap:wrap"><div class="stack" style="gap:1px"><b>${esc(q.name)} möchte mitmachen</b><span class="small muted">Teilnahme-Anfrage · ${timeAgo(q.at)}</span></div><div class="row" style="flex-wrap:nowrap"><button class="btn sm primary" data-act="rq-ok" data-id="${esc(q.uid)}">Zulassen</button><button class="btn sm ghost" data-act="rq-no" data-id="${esc(q.uid)}">Ablehnen</button></div></div>`).join('')}
    ${pend.map(a => `<div class="rule" style="flex-wrap:wrap"><div class="stack" style="gap:1px"><b>${esc(a.name || 'Jemand')} schlägt ${rangeText(a.from, a.to)} vor</b><span class="small muted">kann im bisherigen Zeitraum nicht · ${timeAgo(a.at)}</span></div><div class="row" style="flex-wrap:nowrap"><button class="btn sm primary" data-act="add-ok" data-id="${esc(a.uid)}">Hinzufügen</button><button class="btn sm ghost" data-act="add-no" data-id="${esc(a.uid)}">Ablehnen</button></div></div>`).join('')}</div>`;
}

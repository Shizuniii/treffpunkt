/* Abstimmungsseite für Teilnehmer. */
import { amParticipant, closedForMe, myExt, myPass, votable } from '../app/access.js';
import { SAVE_TXT } from '../app/save.js';
import { B, S, TODAY, isOwner, lsGet } from '../app/state.js';
import { anyChannel } from '../app/notify.js';
import { feat } from '../app/prefs.js';
import { effective, isAllDay, ivLabel, ivText, ruleRange } from '../core/availability.js';
import { gcalUrl } from '../core/calexport.js';
import { WD_SHORT, deadlineText, fmtDate, monthsLabel, rangeText, remainText } from '../core/dates.js';
import {
  addedOk,
  allowedWd,
  canSeeOthers,
  inPoll,
  isEmptyResp,
  isRestricted,
  isStale,
  maybeLimit,
  pollClosed,
  pollDays,
  pollMonths,
  shareMode,
  startOf,
} from '../core/poll.js';
import { esc } from '../core/util.js';
import { dayDecor, monthGrid } from './calendar.js';
import { accountLine } from './account.js';
import { $, voteLink } from './dom.js';
import { EMOJIS, LOAD_TXT } from './fun.js';
import { footer, topbar } from './render.js';

/* ---------- Abstimmen ---------- */
/** Hinweis, wenn der Organisator anderen erlaubt, die Antworten zu sehen – plus Knopf für alle, die es dürfen. */
export function shareNote(p, me) {
  const mode = shareMode(p);
  if (mode === 'none' || isOwner()) return '';
  const can = canSeeOthers(p, B && B.uid(), !!me.updatedAt);
  const text =
    mode === 'all'
      ? 'Bei diesem Event sehen alle, die abgestimmt haben, wann die anderen können – also auch deine Tage.'
      : can
        ? 'Der Organisator hat dir erlaubt zu sehen, wann die anderen können. Ein paar ausgewählte Personen sehen auch deine Tage.'
        : 'Bei diesem Event sehen ein paar vom Organisator ausgewählte Personen, wann die anderen können – also auch deine Tage.';
  return `<div class="banner info share-note"><span>👀 ${text}${mode === 'all' && !can ? ' Sobald du etwas eingetragen hast, siehst du es auch.' : ''}</span>${can ? `<a class="btn sm" href="#/r/${esc(p.id)}">Auswahl der anderen ansehen</a>` : ''}</div>`;
}
export function viewVote() {
  const p = S.poll,
    me = S.my;
  const right = isOwner() && p ? `<a class="btn sm" href="#/r/${p.id}">Ergebnisse →</a>` : '';
  let h = `<div class="wrap voting">${topbar(right)}`;
  if (S.loadErr) return h + `<div class="banner bad">${esc(S.loadErr)}</div></div>`;
  if (p === undefined || !me) return h + `${eventTabs()}<div class="empty">${LOAD_TXT}</div></div>`;
  if (p === null)
    return (
      h +
      `${eventTabs()}<div class="card empty"><h2>404 – Event nicht gefunden</h2><p>Dieses Event ist wohl in den Backrooms verschwunden. Der Link ist vielleicht unvollständig, frag nach einem neuen.</p></div></div>`
    );
  if (!amParticipant(p)) return h + eventTabs() + gateCard(p) + footer() + `</div>`;
  syncModes();
  const closed = closedForMe(p),
    lim = maybeLimit(p),
    ext = myExt(p),
    pass = myPass();
  const stale = isStale(p, me, B && B.uid()),
    isDone = me.done && !stale,
    addMode = p.addMode || 'auto';
  h += eventTabs();
  h += `<div class="hero"><span class="eyebrow">${esc(monthsLabel(pollMonths(p)))}</span><h1>${esc(p.title || 'Abstimmung')}</h1>${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
     ${p.closesAt && !pollClosed(p) ? `<div class="row small" style="gap:8px"><span>Abstimmen bis <b>${deadlineText(p.closesAt, true)}</b></span><span class="pill warn" id="countdown">${remainText(p.closesAt)}</span></div>` : ''}</div>`;
  if (p.final) h += finalCard(p);
  if (closed)
    h += `<div class="banner warn">${p.closed ? 'Diese Abstimmung ist geschlossen.' : 'Die Frist ist abgelaufen.'} Du kannst deine Angaben nicht mehr ändern. Musst du doch noch etwas ändern? Frag den Organisator, er kann dich freischalten.</div>`;
  else if (pollClosed(p) && (ext || pass))
    h += `<div class="banner ok"><span>Für dich ist die Abstimmung nochmal offen, bis <b>${deadlineText(Math.max(ext ? ext.until : 0, pass ? pass.until : 0), true)}</b>.${ext && ext.ask ? ' Der Organisator bittet dich, deine Auswahl nochmal zu prüfen 🙏' : ''}</span></div>`;
  else if (pollClosed(p) && isOwner())
    h += `<div class="banner info">Für alle anderen ist die Abstimmung zu. Als Organisator kannst du trotzdem ändern.</div>`;
  else if (ext && ext.ask)
    h += `<div class="banner ok"><span>Der Organisator bittet dich, deine Auswahl nochmal zu prüfen 🙏 (Zeit bis ${deadlineText(ext.until, true)})</span></div>`;
  h += shareNote(p, me);
  const news = closed ? [] : newsFor(p, me);
  if (news.length)
    h += `<div class="card offer"><b>Neu seit deiner letzten Antwort</b><ul class="news">${news.map(x => `<li>${x}</li>`).join('')}</ul>
    <span class="small">Schau, ob du an den neuen Tagen kannst, und bestätige dann deine Antwort.</span><div><button class="btn sm primary" data-act="news-ok">Passt so, Antwort bestätigen</button></div></div>`;
  else if (isRestricted(p) && !closed && !me.updatedAt)
    h += `<div class="banner ok"><span>Du stehst auf der Teilnehmerliste. Leg los! 🎮</span></div>`;
  if (isDone && !closed) {
    const next = S.route.ids.find(
      id => id !== S.route.id && !(S.myAll[id] && S.myAll[id].done) && S.pollsById[id] && !pollClosed(S.pollsById[id])
    );
    h += `<div class="card done-card"><b>GG! Deine Antwort ist da 🎉</b><span class="small">Du kannst jederzeit über denselben Link zurückkommen und etwas ändern. Änderungen werden automatisch gespeichert.</span>${anyChannel() ? `<span class="small"><button class="linkbtn" data-act="notify-open">🔔 Benachrichtigen, wenn der Termin steht</button></span>` : ''}
      ${next ? `<div><a class="btn primary sm" href="#/p/${S.route.ids.join(',')}/${next}">Weiter zu „${esc(S.pollsById[next].title)}“ →</a></div>` : ''}</div>`;
  }
  if (!closed) h += copyOffer();
  h += `<div class="card" data-help="name"><label class="field" for="v-name">Dein Name<input type="text" id="v-name" maxlength="40" autocomplete="given-name" placeholder="Name oder Gamertag" value="${esc(me.name)}" ${closed ? 'disabled' : ''}></label>
     ${
       feat('avatar')
         ? `<div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Dein Avatar <span class="muted small" style="font-weight:400">(optional)</span></span>
       <div class="emojis" role="group" aria-label="Avatar wählen">${EMOJIS.map(x => `<button class="emo-btn ${me.emoji === x ? 'on' : ''}" data-act="emoji" data-v="${x}" ${closed ? 'disabled' : ''} aria-pressed="${me.emoji === x}" aria-label="Avatar ${x}">${x}</button>`).join('')}</div></div>`
         : ''
     }
     ${accountLine()}</div>`;

  if (feat('rules'))
    h += `<div class="card" data-help="rules"><div class="stack" style="gap:4px"><h2>Was gilt normalerweise?</h2>
     <p class="small muted">Für alle Tage, die du unten nicht einzeln anklickst.</p></div>
     <div class="seg full" role="group" aria-label="Grundeinstellung">
       <button data-act="base" data-v="none" class="${me.base !== 'all' ? 'on' : ''}" ${closed ? 'disabled' : ''}>Ich kann meistens nicht</button>
       <button data-act="base" data-v="all" class="${me.base === 'all' ? 'on' : ''}" ${closed ? 'disabled' : ''}>Ich kann meistens</button></div>
     <div class="stack" style="gap:4px;margin-top:4px"><h3>Wiederholungen</h3><p class="small muted">Feste Termine jede Woche, z. B. „Freitags 17–21 Uhr Verein“ oder „Sonntags kann ich immer“.</p></div>
     ${me.rules.map(r => ruleRow(r, closed)).join('')}
     ${S.ruleForm ? ruleForm() : closed ? '' : `<div><button class="btn sm" data-act="rule-new">+ Wiederholung hinzufügen</button></div>`}
  </div>`;

  const hasCands = !closed && S.copyCands && S.copyCands.length;
  h += `<div class="card"><div class="row between" style="align-items:flex-start"><div class="stack" style="gap:4px"><h2>Deine Tage</h2>
     <p class="small muted">${closed ? '' : S.favMode ? 'Tippe bis zu 3 Tage an, an denen du am liebsten kannst. Die Reihenfolge änderst du unten mit ↑ ↓.' : S.selMode ? 'Tippe auf mehrere Tage oder auf einen Wochentag (z. B. „Sa“) und wähle unten, was für alle gelten soll.' : `Tippe die Tage an, an denen du kannst. Nochmal tippen nimmt es zurück.${feat('time') ? ' Für Uhrzeiten unten „Uhrzeit“ wählen.' : ''} Am PC kannst du auch über mehrere Tage ziehen.`}</p></div>
     ${hasCands ? `<button class="btn sm" data-act="copy-open" data-help="copy">Aus anderem Event übernehmen</button>` : ''}</div>
     <div class="mysum" id="mysum">${mySummary()}</div>
     ${!closed && addMode !== 'off' ? `<div class="row small" style="gap:6px" data-help="propose"><span class="muted">Du kannst an keinem dieser Tage?</span><button class="linkbtn" data-act="propose-open">Neuen Zeitraum vorschlagen</button></div>` : ''}
     ${!closed && !lsGet('tp-opts-seen') ? `<div class="row small" style="gap:6px"><span class="muted">Mehr Möglichkeiten wie Vielleicht, Top 3 oder Wiederholungen?</span><button class="linkbtn" data-act="features-open">⚙️ Optionen</button></div>` : ''}
     ${!closed && feat('favs') && !S.favMode && !validFavs().length ? `<div class="row small" style="gap:6px"><span class="muted">Hast du Lieblingstage?</span><button class="linkbtn" data-act="selmode" data-v="fav">⭐ Deine Top 3 wählen</button></div>` : ''}
     ${legendVote(p)}
     <div class="months">${pollMonths(p)
       .map(k => monthGrid(k, voteCell, S.selMode && !closed))
       .join('')}</div></div>`;
  if (!closed)
    h += `<div class="card" data-help="done">${feat('note') ? `<label class="field" for="v-note">Anmerkung <span class="muted small" style="font-weight:400">(optional)</span><textarea id="v-note" maxlength="300" placeholder="z. B. Im November bin ich evtl. 1 Woche weg">${esc(me.note || '')}</textarea></label>` : ''}
     ${p.cancelRule !== false ? drinkRule() : ''}
     <div class="row"><button class="btn primary" data-act="done">${isDone ? 'GG, aktualisiert ✓' : 'Fertig, abschicken'}</button><span class="small muted">Gespeichert wird sowieso automatisch. „Fertig“ zeigt dem Organisator, dass du vollständig bist.</span></div></div>`;
  h += footer(`<span>Nur der Organisator sieht alle Antworten. Andere sehen deine Angaben nicht.</span>`);
  if (!closed) h += dock();
  return h + `</div>`;
}
export function eventTabs() {
  const ids = S.route.ids;
  if (ids.length < 2) return '';
  return `<div class="stack" style="gap:6px"><span class="small muted">Dieser Link enthält ${ids.length} Events. Stimme für jedes einzeln ab:</span><div class="tabs" role="tablist" data-help="tabs">${ids
    .map(id => {
      const p = S.pollsById[id];
      const r = id === S.route.id ? S.my : S.myAll[id];
      const st = r && r.done ? '✓' : r && !isEmptyResp(r) ? '…' : '';
      return `<a role="tab" class="tab ${id === S.route.id ? 'on' : ''}" aria-selected="${id === S.route.id}" href="#/p/${ids.join(',')}/${id}">${esc(p ? p.title || 'Event' : '…')}${st ? `<span class="tst ${st === '✓' ? 'ok' : ''}">${st}</span>` : ''}</a>`;
    })
    .join('')}</div></div>`;
}
export function finalCard(p) {
  const me = S.my,
    c = me && me.cancel && me.cancel.date === p.final.date ? me.cancel : null;
  let cx = '';
  if (me && me.updatedAt) {
    if (c)
      cx = `<div class="banner ${c.owes ? 'warn' : 'info'}"><span>Du hast abgesagt${c.reason === 'sick' ? ' (krank / Notfall)' : ''}.${c.owes ? ` Laut Absage-Regel gibst du beim Treffen jedem einen Drink aus 🍹${c.drinks ? ` (${c.drinks} Drinks)` : ''}.` : ''}</span><button class="btn sm" data-act="uncancel">Doch dabei</button></div>`;
    else if (startOf(p.final) > Date.now())
      cx = `<div><button class="btn sm ghost" data-act="cancel-open">Ich muss absagen</button></div>`;
  }
  return `<div class="card final-card" data-help="final"><span class="eyebrow" style="color:var(--accent)">Der Termin steht</span><h2>${fmtDate(p.final.date, true)}</h2><p>${ivText([p.final.s, p.final.e])}${p.final.note ? ` · ${esc(p.final.note)}` : ''}</p>
    <div class="row"><a class="btn primary sm" href="${esc(gcalUrl(p, voteLink(p.id)))}" target="_blank" rel="noopener">In Google Kalender</a><button class="btn sm" data-act="ics" data-id="${p.id}">Kalenderdatei (.ics)</button></div>
    ${p.cancelRule !== false ? drinkRule() : ''}${cx}</div>`;
}
export function copyOffer() {
  const c = S.copyCands;
  if (!c || !c.length || S.copyDismissed || !isEmptyResp(S.my)) return '';
  return `<div class="card offer"><div class="stack" style="gap:4px"><b>Schon bei einem anderen Event eingetragen?</b><span class="small">Für denselben Zeitraum hast du woanders schon angegeben, wann du kannst. Willst du das hier übernehmen? Danach kannst du alles noch anpassen.</span></div>
    ${copyList()}<div><button class="btn sm ghost" data-act="copy-dismiss">Nein danke, neu eintragen</button></div></div>`;
}
export const candText = x =>
  [
    x.nDays ? `${x.nDays} ${x.nDays === 1 ? 'Tag' : 'Tage'} im selben Zeitraum` : '',
    x.nRules ? `${x.nRules} ${x.nRules === 1 ? 'Wiederholung' : 'Wiederholungen'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
export const copyList = () =>
  S.copyCands
    .map(
      x =>
        `<div class="rule"><div class="stack" style="gap:1px"><b>${esc(x.title)}</b><span class="small muted">${candText(x)}</span></div><button class="btn sm primary" data-act="copy-from" data-id="${esc(x.pid)}">Übernehmen</button></div>`
    )
    .join('');
export function mySummary() {
  const p = S.poll,
    me = S.my;
  if (!p || !me) return '';
  let all = 0,
    part = 0,
    mb = 0;
  for (const ds of pollDays(p)) {
    if (ds < TODAY) continue;
    const ef = effective(me, ds);
    if (!ef.iv.length) continue;
    if (ef.maybe) mb++;
    else if (isAllDay(ef.iv)) all++;
    else part++;
  }
  const lim = maybeLimit(p);
  if (!all && !part && !mb) return 'Noch keine Tage eingetragen. Die Lobby wartet auf dich 👀';
  const f = validFavs();
  return `Du kannst an ${all + part} ${all + part === 1 ? 'Tag' : 'Tagen'}${part ? ` (davon ${part} mit Uhrzeit)` : ''}${lim && feat('maybe') ? ` · ${mb} von ${lim} Vielleicht` : ''}${f.length ? `<br><span class="favline">⭐ ${f.map((ds, i) => `#${i + 1} ${fmtDate(ds)}`).join(' · ')}</span>` : ''}`;
}
export function legendVote(p) {
  const lim = maybeLimit(p),
    wd = Array.isArray(p.weekdays) && p.weekdays.length && p.weekdays.length < 7;
  return `<div class="legend"><span><i class="sw" style="background:var(--accent);border-color:var(--accent)"></i>Ganzer Tag</span>
    ${feat('time') ? `<span><i class="sw" style="background:var(--accent-soft);border-color:var(--accent)"></i>Mit Uhrzeit</span>` : ''}
    ${lim && feat('maybe') ? `<span><i class="sw maybe"></i>Vielleicht</span>` : ''}
    ${feat('rules') ? `<span><i class="sw" style="background:var(--accent-mid);border:1px dashed var(--accent-mid)"></i>Automatisch (Wiederholung)</span>` : ''}
    ${feat('tools') ? `<span><i class="sw" style="background:var(--surface-2)"></i>Kann nicht</span>` : ''}
    ${wd || (p.excluded || []).length || addedOk(p).length ? `<span><i class="sw" style="background:repeating-linear-gradient(135deg,transparent 0 3px,var(--line) 3px 5px)"></i>Nicht zur Auswahl</span>` : ''}
    ${
      feat('cal')
        ? `<span><i class="sw" style="background:var(--holiday);border-radius:50%;width:8px;height:8px;border:0"></i>Feiertag</span>
    <span><i class="sw" style="background:var(--ferien);height:4px;border:0"></i>Schulferien NRW</span>`
        : ''
    }</div>`;
}
export function voteCell(ds) {
  const me = S.my,
    ok = votable(ds),
    off = !allowedWd(S.poll, ds) || !inPoll(S.poll, ds);
  const eff = effective(me, ds),
    dec = dayDecor(ds);
  let cls = 'cell' + dec.cls + (off ? ' off' : ''),
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
  if (S.sel.has(ds)) cls += ' sel';
  const fr = (me.favs || []).indexOf(ds);
  const state = eff.iv.length ? eff.iv.map(ivText).join(', ') + (eff.maybe ? ' (vielleicht)' : '') : 'kann nicht';
  const aria = `${fmtDate(ds, true)}: ${off ? 'nicht zur Auswahl' : state}${eff.explicit || !eff.iv.length ? '' : ' (automatisch)'}${dec.title ? ' · ' + dec.title : ''}${S.sel.has(ds) ? ' · ausgewählt' : ''}${fr >= 0 ? ` · Top ${fr + 1}` : ''}`;
  return `<button class="${cls}" data-act="day" data-d="${ds}" ${ok ? '' : 'disabled'} title="${esc(aria)}" aria-label="${esc(aria)}" aria-pressed="${S.sel.has(ds)}"><span class="dn">${+ds.slice(8)}</span>${lab ? `<span class="tl">${lab}</span>` : ''}${fr >= 0 ? `<i class="favb">★${fr + 1}</i>` : ''}${dec.extra}</button>`;
}
export function updateCell(ds) {
  const old = document.querySelector(`[data-act="day"][data-d="${ds}"]`);
  if (old) {
    const tmp = document.createElement('div');
    tmp.innerHTML = voteCell(ds);
    old.replaceWith(tmp.firstElementChild);
  }
}
export function maybeCount() {
  if (!S.my || !S.poll) return 0;
  return Object.entries(S.my.days).filter(([ds, d]) => d && d.m && !d.n && ds >= TODAY && inPoll(S.poll, ds)).length;
}
/** Eingabemodi: „Einzeln“ immer, „Mehrere“ und „Top 3“ nur, wenn eingeschaltet. Nur ein Modus → kurzer Hinweis statt Umschalter. */
export function modeSeg() {
  const opts = [
    ['0', 'Einzeln', !S.selMode && !S.favMode],
    ...(feat('multi') ? [['1', 'Mehrere', S.selMode]] : []),
    ...(feat('favs') ? [['fav', '⭐ Top 3', S.favMode]] : []),
  ];
  if (opts.length < 2)
    return `<span class="small muted" style="flex:1;min-width:0" data-help="modes">Tippe die Tage an, an denen du kannst.</span>`;
  return `<div class="seg" role="group" aria-label="Eingabe" data-help="modes">${opts.map(([v, l, on]) => `<button data-act="selmode" data-v="${v}" class="${on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
export const undoBtn = () =>
  `<button class="btn sm ghost" data-act="undo" ${S.undo.length ? '' : 'disabled'} aria-label="Rückgängig">↶<span class="hide-sm"> Rückgängig</span></button>`;
export const dockRight = () =>
  `<div class="row" style="gap:2px;flex-wrap:nowrap;flex:none"><button class="btn sm ghost" data-act="features-open" data-help="options" aria-label="Optionen">⚙️<span class="hide-sm"> Optionen</span></button>${undoBtn()}</div>`;
/** Modi zurücksetzen, wenn die Funktion inzwischen ausgeblendet ist. */
export function syncModes() {
  if (S.selMode && !feat('multi')) {
    S.selMode = false;
    S.sel = new Set();
  }
  if (S.favMode && !feat('favs')) S.favMode = false;
}
export function favDock() {
  const f = validFavs();
  const slot = i => {
    const ds = f[i];
    return ds
      ? `<div class="fslot"><b class="frank">#${i + 1}</b><span class="fdate">${fmtDate(ds)} · ${esc(effective(S.my, ds).iv.map(ivText).join(', '))}</span><span class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn sm ghost" data-act="fav-move" data-v="${i},-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">↑</button><button class="btn sm ghost" data-act="fav-move" data-v="${i},1" ${i === f.length - 1 ? 'disabled' : ''} aria-label="Nach unten">↓</button><button class="btn sm ghost" data-act="fav-del" data-v="${ds}" aria-label="Entfernen">✕</button></span></div>`
      : `<div class="fslot empty"><b class="frank" style="opacity:.5">#${i + 1}</b><span class="fdate" style="font-weight:500">${i === f.length ? 'Tippe einen Tag an, an dem du kannst' : 'frei'}</span></div>`;
  };
  return `<div class="dock" id="dock" data-help="dock"><div class="dock-in">
    <div class="row between" style="flex-wrap:nowrap">${modeSeg()}${dockRight()}</div>
    ${[0, 1, 2].map(slot).join('')}
    <div class="savestate" id="savestate" aria-live="polite">${S.save === 'saved' || S.save === 'idle' ? 'Deine Rangliste: #1 ist dein Lieblingstag. Nur der Organisator sieht sie.' : SAVE_TXT[S.save] || ''}</div></div></div>`;
}
export function validFavs() {
  return ((S.my && S.my.favs) || []).filter(
    ds => ds >= TODAY && inPoll(S.poll, ds) && allowedWd(S.poll, ds) && effective(S.my, ds).iv.length
  );
}
export function dock() {
  if (S.favMode) return favDock();
  const b = S.brush,
    lim = maybeLimit(S.poll),
    sm = S.selMode,
    n = S.sel.size;
  const modes = [
    ['all', 'Ganztags', `<i class="sw" style="background:var(--accent);border-color:var(--accent)"></i>`],
    ...(feat('time')
      ? [['time', 'Uhrzeit', `<i class="sw" style="background:var(--accent-soft);border-color:var(--accent)"></i>`]]
      : []),
    ...(lim && feat('maybe') ? [['maybe', 'Vielleicht', `<i class="sw maybe"></i>`]] : []),
    ...(feat('tools')
      ? [
          ['no', 'Kann nicht', `<i class="sw" style="background:var(--surface-2)"></i>`],
          ['auto', 'Löschen', `<i class="sw" style="background:var(--surface);border-style:dashed"></i>`],
        ]
      : []),
  ];
  if (!modes.some(m => m[0] === b.mode)) b.mode = 'all';
  if (b.pending && !modes.some(m => m[0] === b.pending)) b.pending = null;
  const onMode = sm ? b.pending || '' : b.mode;
  const br = ([mode, label, sw]) =>
    `<button class="brush ${onMode === mode ? 'on' : ''}" data-act="brush" data-v="${mode}" aria-pressed="${onMode === mode}">${sw}<span>${label}</span>${mode === 'maybe' ? `<span class="cnt">${maybeCount()}/${lim}</span>` : ''}</button>`;
  const showTime = sm ? b.pending === 'time' || b.pending === 'maybe' : b.mode === 'time' || b.mode === 'maybe';
  const timeMode = sm ? b.pending : b.mode;
  return `<div class="dock" id="dock" data-help="dock"><div class="dock-in">
    <div class="row between" style="flex-wrap:nowrap">${modeSeg()}${dockRight()}</div>
    ${
      sm
        ? `<div class="quick"><b class="small" style="flex:none">${n} ausgewählt</b>
      <button class="chip" data-act="qsel" data-v="weekend">Wochenenden</button><button class="chip" data-act="qsel" data-v="weekdays">Mo–Fr</button>
      <button class="chip" data-act="qsel" data-v="empty">Leere Tage</button><button class="chip" data-act="qsel" data-v="all">Alle</button>
      ${n ? `<button class="chip" data-act="qsel" data-v="none">Auswahl leeren</button>` : ''}</div>`
        : ''
    }
    ${
      showTime
        ? `<div class="timebar"><label>ab<input type="time" id="b-s" step="900" value="${esc(b.s)}"></label><label>bis<input type="time" id="b-e" step="900" value="${esc(b.e)}"></label>
      ${sm ? `<button class="btn sm primary" data-act="sel-apply" ${n ? '' : 'disabled'}>Auf ${n} ${n === 1 ? 'Tag' : 'Tage'} anwenden</button>` : ''}</div>
      <div class="hint">${timeMode === 'maybe' ? `Vielleicht: Uhrzeit optional, leer = ganzer Tag · nur für die wahrscheinlichsten Tage, ${Math.max(0, lim - maybeCount())} von ${lim} frei` : 'Nur „ab“ = ab der Uhrzeit · nur „bis“ = bis zur Uhrzeit · beides = Zeitfenster'}</div>`
        : ''
    }
    <div class="brushes" style="--n:${modes.length}">${modes.map(br).join('')}</div>
    <div class="savestate" id="savestate" aria-live="polite">${sm && !showTime ? (n ? 'Tippe auf eine Option, um sie auf alle ausgewählten Tage anzuwenden.' : 'Tage antippen, um sie auszuwählen.') : SAVE_TXT[S.save] || ''}</div></div></div>`;
}
export function renderDock() {
  const d = $('#dock');
  if (!d) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = dock();
  d.replaceWith(tmp.firstElementChild);
}
export function refreshAfterEdit() {
  const s = $('#mysum');
  if (s) s.innerHTML = mySummary();
  renderDock();
  ((S.my && S.my.favs) || []).forEach(updateCell);
}
export const WD_ORDER = [0, 1, 2, 3, 4, 5, 6];
export function ruleText(r) {
  const days =
    r.wd.length === 7
      ? 'Jeden Tag'
      : r.wd.length === 5 && [0, 1, 2, 3, 4].every(x => r.wd.includes(x))
        ? 'Mo–Fr'
        : r.wd.length === 2 && r.wd.includes(5) && r.wd.includes(6)
          ? 'Wochenende'
          : [...r.wd]
              .sort()
              .map(x => WD_SHORT[x])
              .join(', ');
  return { days, time: ivText(ruleRange(r)) };
}
export function ruleRow(r, closed) {
  const t = ruleText(r);
  return `<div class="rule"><div class="stack" style="gap:2px"><span><span class="k ${r.kind}">${r.kind === 'no' ? 'Kann nicht' : 'Kann'}</span> · ${esc(t.days)} · ${esc(t.time)}</span>${r.label ? `<span class="small muted">${esc(r.label)}</span>` : ''}</div>
    ${closed ? '' : `<button class="btn sm ghost" data-act="rule-del" data-id="${esc(r.id)}" aria-label="Wiederholung löschen">Löschen</button>`}</div>`;
}
export function ruleForm() {
  const f = S.ruleForm;
  return `<div class="card" style="background:var(--bg)">
    <div class="seg" role="group" aria-label="Art"><button data-act="rf-kind" data-v="no" class="${f.kind === 'no' ? 'on' : ''}">Kann nicht</button><button data-act="rf-kind" data-v="yes" class="${f.kind === 'yes' ? 'on' : ''}">Kann</button></div>
    <div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Jeden …</span>
      <div class="chips">${WD_ORDER.map(i => `<button class="chip ${f.wd.includes(i) ? 'on' : ''}" data-act="rf-wd" data-v="${i}" aria-pressed="${f.wd.includes(i)}">${WD_SHORT[i]}</button>`).join('')}</div></div>
    <div class="seg" role="group" aria-label="Zeit"><button data-act="rf-whole" data-v="1" class="${f.whole ? 'on' : ''}">Ganztägig</button><button data-act="rf-whole" data-v="0" class="${!f.whole ? 'on' : ''}">Mit Uhrzeit</button></div>
    ${f.whole ? '' : `<div class="timebar"><label>ab<input type="time" id="rf-s" step="900" value="${esc(f.s)}"></label><label>bis<input type="time" id="rf-e" step="900" value="${esc(f.e)}"></label></div>`}
    <label class="field">Bezeichnung <span class="muted small" style="font-weight:400">(optional)</span><input type="text" id="rf-label" maxlength="40" placeholder="z. B. Verein, Arbeit, Uni" value="${esc(f.label)}"></label>
    <div class="row"><button class="btn primary sm" data-act="rf-save">Hinzufügen</button><button class="btn sm ghost" data-act="rf-cancel">Abbrechen</button></div></div>`;
}
export const drinkRule = () =>
  `<div class="drink"><span class="drink-ic" aria-hidden="true">🍻</span><span><b>Absage-Regel:</b> Wer beim festgelegten Termin nicht spätestens 1 Woche vorher absagt, schuldet beim Treffen jedem aus der Gruppe einen Drink seiner Wahl. Ausnahme: verständliche Gründe wie Krankheit.</span></div>`;
export function gateCard(p) {
  const rq = S.myRequest;
  return `<div class="hero"><span class="eyebrow">${esc(monthsLabel(pollMonths(p)))}</span><h1>${esc(p.title || 'Event')}</h1></div>
    <div class="card"><h2>Nur für eingeladene Personen</h2><p class="muted">Bei diesem Event legt der Organisator fest, wer abstimmen darf, und du stehst (noch) nicht auf der Liste.</p>
    ${
      rq
        ? `<div class="banner ok"><span>Anfrage gesendet als <b>${esc(rq.name)}</b>. Sobald du freigegeben bist, kannst du hier direkt abstimmen. Die Seite aktualisiert sich von selbst.</span></div>`
        : `<label class="field">Dein Name<input type="text" id="rq-name" maxlength="40" placeholder="Name oder Gamertag" value="${esc((S.my && S.my.name) || '')}"></label><div><button class="btn primary" data-act="rq-send">Teilnahme anfragen</button></div>`
    }
    ${B.isAnon() ? `<p class="small muted">Du hast schon ein Konto, mit dem du auf der Liste stehst? <button class="linkbtn" data-act="acc-open" data-v="login">Anmelden</button></p>` : ''}</div>`;
}
export function newsFor(p, me) {
  if (!me || !me.updatedAt) return [];
  const out = [],
    uid = B && B.uid();
  if ((p.reopenedAt || 0) > me.updatedAt)
    out.push(
      `Die Abstimmung wurde neu eröffnet${p.reopenNote ? `: ${esc(p.reopenNote)}` : ''}. Bitte prüf nochmal, wann du kannst.`
    );
  if ((p.expandedAt || 0) > me.updatedAt) out.push('Der Organisator hat neue Tage zur Auswahl hinzugefügt.');
  for (const a of addedOk(p))
    if (a.uid !== uid && (a.at || 0) > me.updatedAt)
      out.push(
        `${esc(a.name || 'Jemand')} kann im bisherigen Zeitraum nicht. Neu dazugekommen: <b>${rangeText(a.from, a.to)}</b>.`
      );
  return out;
}
export const noDaysAtAll = () =>
  pollDays(S.poll)
    .filter(ds => ds >= TODAY)
    .every(ds => !effective(S.my, ds).iv.length);

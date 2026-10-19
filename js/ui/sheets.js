/* Aufklapp-Fenster (Bottom-Sheets): Teilen, Text, Tagesdetails. */
import { S, isOwner } from '../app/state.js';
import { effective, ivText } from '../core/availability.js';
import { durStr, fmtDate, minShort, minStr } from '../core/dates.js';
import { pollClosed } from '../core/poll.js';
import { colorFor, esc } from '../core/util.js';
import { dayDecor } from './calendar.js';
import { sheetAccount } from './account.js';
import { sheetCancel } from './cancel.js';
import { $, sheetHead, voteLink, waLink } from './dom.js';
import { sheetExtend, sheetPerson } from './extend.js';
import { sheetFeatures } from './features.js';
import { sheetAch, sheetDice } from './fun.js';
import { sheetHelp } from './help.js';
import { sheetNotify } from './notify.js';
import { sheetAdmins, sheetTemplateSave, sheetTemplates } from './organizers.js';
import { sheetPropose, sheetReopen } from './period.js';
import { computeResults, nameOf, sheetMessage } from './results.js';
import { copyList } from './vote.js';

/* ---------- Bottom-Sheets ----------
   Verzeichnis aller Fenster: S.sheet = { type: '<Name>', … } öffnet das Fenster, renderSheet() zeichnet es.
   Neues Fenster: Funktion schreiben, die HTML zurückgibt, und hier eintragen.
   (Als () => f() geschrieben, damit die Reihenfolge der Module beim Laden egal ist.) */
export const SHEETS = {
  share: () => sheetShare(),
  day: () => sheetDay(),
  text: () => sheetText(),
  copy: () => sheetCopy(),
  extend: () => sheetExtend(),
  person: () => sheetPerson(),
  cancel: () => sheetCancel(),
  ach: () => sheetAch(),
  dice: () => sheetDice(),
  propose: () => sheetPropose(),
  reopen: () => sheetReopen(),
  help: () => sheetHelp(),
  features: () => sheetFeatures(),
  account: () => sheetAccount(),
  message: () => sheetMessage(),
  'tpl-save': () => sheetTemplateSave(),
  templates: () => sheetTemplates(),
  admins: () => sheetAdmins(),
  notify: () => sheetNotify(),
};
/* Fenster öffnen = Fokus hinein (für Tastatur und Screenreader), schließen = Fokus zurück zum auslösenden Knopf. */
let openerEl = null,
  wasOpen = false;
export function renderSheet() {
  const root = $('#sheet-root');
  if (!S.sheet) {
    root.innerHTML = '';
    document.body.style.overflow = '';
    if (wasOpen) {
      wasOpen = false;
      if (openerEl && document.contains(openerEl)) openerEl.focus({ preventScroll: true });
      openerEl = null;
    }
    return;
  }
  const t = S.sheet.type;
  const fn = SHEETS[t];
  const inner = fn ? fn() : '';
  const ae = document.activeElement,
    aid = ae && root.contains(ae) ? ae.id : null;
  root.innerHTML = `<div class="scrim" data-act="close-sheet"><div class="sheet${t === 'help' ? ' tall' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">${inner}</div></div>`;
  document.body.style.overflow = 'hidden';
  const sheet = root.querySelector('.sheet');
  if (!wasOpen) {
    wasOpen = true;
    openerEl = ae && !root.contains(ae) ? ae : null;
    sheet.focus({ preventScroll: true });
  } else if (aid && document.getElementById(aid)) document.getElementById(aid).focus({ preventScroll: true });
  else if (!root.contains(document.activeElement)) sheet.focus({ preventScroll: true });
}
/** Tab bleibt im offenen Fenster (statt hinter das Fenster zu springen). */
export function trapTab(e) {
  const sheet = document.querySelector('#sheet-root .sheet');
  if (!sheet || e.key !== 'Tab') return;
  const items = [
    ...sheet.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex="0"]'
    ),
  ].filter(x => x.offsetParent !== null);
  if (!items.length) return;
  const first = items[0],
    last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
export function sheetShare() {
  const ids = S.sheet.ids,
    link = voteLink(ids);
  const all = S.polls || (S.poll ? [S.poll] : []);
  const titles = ids.map(id => (all.find(x => x.id === id) || {}).title).filter(Boolean);
  const others = (S.polls || []).filter(x => !ids.includes(x.id) && !pollClosed(x));
  const msg = `${titles.length > 1 ? `Wir suchen Termine für: ${titles.join(', ')}.` : titles[0] ? `${titles[0]}:` : ''} Trag bitte ein, wann du kannst: ${link}`;
  return `${sheetHead('Link teilen')}
    <p class="small muted">Jeder mit diesem Link kann abstimmen, sieht aber nur die eigenen Angaben. Die Auswertung siehst nur du.</p>
    ${
      S.polls && S.polls.length > 1
        ? `<div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Events in diesem Link</span>
      <div class="chips">${ids
        .map(id => {
          const p = all.find(x => x.id === id);
          return `<button class="chip on" data-act="share-toggle" data-id="${id}" ${ids.length === 1 ? 'disabled' : ''}>✓ ${esc(p ? p.title : id)}</button>`;
        })
        .join('')}
      ${others.map(p => `<button class="chip" data-act="share-toggle" data-id="${p.id}">+ ${esc(p.title)}</button>`).join('')}</div>
      <span class="small muted">Mehrere Events in einem Link: Deine Freunde stimmen für jedes getrennt ab und können ihre Angaben von einem Event ins nächste übernehmen.</span></div>`
        : ''
    }
    <div class="linkbox">${esc(link)}</div>
    <div class="row"><button class="btn primary" data-act="copy" data-v="${esc(link)}">Link kopieren</button>
    <a class="btn" href="${esc(waLink(msg))}" target="_blank" rel="noopener">WhatsApp</a>
    ${navigator.share ? `<button class="btn" data-act="native-share" data-v="${esc(link)}" data-t="${esc(titles.join(', ') || 'Treffpunkt')}">Teilen …</button>` : ''}</div>`;
}
export const textBlock = text => `<div class="linkbox msg">${esc(text)}</div>
    <div class="row"><button class="btn primary" data-act="copy" data-v="${esc(text)}">Text kopieren</button><a class="btn" href="${esc(waLink(text))}" target="_blank" rel="noopener">WhatsApp</a>
    ${navigator.share ? `<button class="btn" data-act="native-share-text" data-v="${esc(text)}">Teilen …</button>` : ''}</div>`;
export function sheetText() {
  const s = S.sheet;
  return `${sheetHead(esc(s.title))}${s.info ? `<p class="small muted">${s.info}</p>` : ''}${textBlock(s.text)}`;
}
export function sheetCopy() {
  return `${sheetHead('Aus anderem Event übernehmen')}<p class="small muted">Übernommen werden deine Tage im gemeinsamen Zeitraum und deine Wiederholungen. Tage, die du hier schon eingetragen hast, bleiben unverändert.</p>${S.copyCands && S.copyCands.length ? copyList() : '<p class="muted">Nichts zum Übernehmen gefunden.</p>'}`;
}
export function sheetDay() {
  const ds = S.sheet.ds;
  const R = computeResults();
  const d = R.days.find(x => x.ds === ds);
  const dec = dayDecor(ds),
    p = S.poll;
  let h = `<div class="row between"><div class="stack" style="gap:2px"><h2>${fmtDate(ds, true)}</h2>${dec.title ? `<span class="small" style="color:var(--holiday)">${esc(dec.title)}</span>` : ''}</div><button class="btn sm ghost" data-act="close-sheet">Schließen</button></div>`;
  if (!d) return h + `<p class="muted">Keine Daten.</p>`;
  let lo = 8 * 60;
  d.per.forEach(x =>
    x.iv.forEach(([s]) => {
      if (s > 0 && s < lo) lo = Math.floor(s / 60) * 60;
    })
  );
  const hi = 1440,
    span = hi - lo;
  const pos = m => (((Math.max(lo, Math.min(hi, m)) - lo) / span) * 100).toFixed(2);
  const ticks = [];
  for (let t = lo; t <= hi; t += 120) ticks.push(t);
  const grid = ticks.map(t => `<i class="tick" style="left:${pos(t)}%"></i>`).join('');
  const bars = (iv, col, maybe) =>
    iv
      .map(
        ([s, e]) =>
          `<i class="bar" style="left:${pos(s)}%;width:${(pos(e) - pos(s)).toFixed(2)}%;background:${maybe ? `repeating-linear-gradient(135deg,${col} 0 5px,color-mix(in srgb,${col} 30%,transparent) 5px 9px)` : col}" title="${ivText([s, e])}${maybe ? ' (vielleicht)' : ''}"></i>`
      )
      .join('');
  const ov = d.segs
    .filter(g => g.who.length > 0)
    .map(
      g =>
        `<i class="bar" style="left:${pos(g.s)}%;width:${(pos(g.e) - pos(g.s)).toFixed(2)}%;background:color-mix(in srgb,var(--accent) ${Math.round(15 + (85 * g.who.length) / Math.max(1, R.n))}%,var(--surface-2))" title="${g.who.length} Personen ${minStr(g.s)}–${minStr(g.e)}"></i>`
    )
    .join('');
  const len = x => x.iv.reduce((s, y) => s + y[1] - y[0], 0);
  const per = [...d.per].sort((a, b) => a.maybe - b.maybe || len(b) - len(a));
  const none = R.resps.filter(r => !effective(r, ds).iv.length).map(r => r.name);
  h += `<div class="stack" style="gap:6px"><h3>Wer kann wann?</h3><div class="tl-wrap"><div class="tline">
      <span></span><div class="axis">${ticks.map(t => `<span style="left:${pos(t)}%;${t === lo ? 'transform:none' : t >= hi ? 'transform:translateX(-100%)' : ''}">${minShort(t)}</span>`).join('')}</div>
      <span class="nm" style="font-weight:800">Zusammen</span><div class="track ov"><span class="tgrid">${grid}</span>${ov}</div>
      ${per.map(x => `<span class="nm" title="${esc(x.r.name)}">${x.r.emoji ? esc(x.r.emoji) + ' ' : ''}${esc(x.r.name)}${x.maybe ? ' ?' : ''}</span><div class="track"><span class="tgrid">${grid}</span>${bars(x.iv, colorFor(x.r.uid), x.maybe)}</div>`).join('')}
    </div></div>
    <span class="small muted">${none.length ? `Kann gar nicht: ${esc(none.join(', '))}` : ''}${d.per.some(x => x.maybe && x.iv.length) ? `${none.length ? ' · ' : ''}Gestreift = vielleicht` : ''}</span></div>`;
  const tiers = d.tiers.filter(t => t.k >= 2 || R.n === 1);
  h += `<div class="stack" style="gap:6px"><h3>Längste gemeinsame Zeit</h3>${
    tiers.length
      ? tiers
          .map(
            t =>
              `<div class="rule"><div class="stack" style="gap:1px"><span><b>${t.k} von ${R.n}</b> · ${t.len >= 1440 ? 'ganztägig' : `${minStr(t.s)}–${minStr(t.e)} (${durStr(t.len)})`}</span><span class="small muted">${esc(t.who.map(u => nameOf(R, u)).join(', '))}</span></div></div>`
          )
          .join('')
      : '<p class="muted small">Niemand überschneidet sich an diesem Tag.</p>'
  }</div>`;
  // Termin festlegen – nur Organisatoren (Teilnehmer mit Freigabe sehen nur, wer wann kann)
  const isFin = p.final && p.final.date === ds;
  if (!isOwner())
    return (
      h +
      (isFin
        ? `<div class="banner ok"><span>Festgelegter Termin: ${esc(ivText([p.final.s, p.final.e]))}</span></div>`
        : '')
    );
  const m = d.main || d.tiers[0];
  const preS = isFin ? p.final.s : m ? m.s : 0,
    preE = isFin ? p.final.e : m ? m.e : 1440;
  const tv = (v, isEnd) => ((isEnd && v >= 1440) || (!isEnd && v === 0) ? '' : minStr(v));
  h += `<div class="card" style="background:var(--bg)"><h3>${isFin ? 'Festgelegter Termin' : 'Als Termin festlegen'}</h3>
     <p class="small muted">Deine Freunde sehen den Termin dann oben in der Abstimmung und können ihn in ihren Kalender übernehmen.</p>
     <div class="timebar"><label>ab<input type="time" id="fx-s" step="900" value="${tv(preS, false)}"></label><label>bis<input type="time" id="fx-e" step="900" value="${tv(preE, true)}"></label></div>
     <span class="small muted">Leer lassen = ganztägig bzw. offenes Ende.</span>
     ${isFin ? '' : `<label class="check small"><input type="checkbox" id="fx-close" ${pollClosed(p) ? 'checked disabled' : 'checked'}> Abstimmung gleichzeitig schließen</label>`}
     <div class="row"><button class="btn primary sm" data-act="set-final" data-d="${ds}">${isFin ? 'Uhrzeit speichern' : 'Termin festlegen'}</button>${isFin ? `<button class="btn sm ghost" data-act="unfinal">Festlegung aufheben</button>` : ''}</div></div>`;
  return h;
}

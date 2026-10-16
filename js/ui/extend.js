/* Frist verlängern, Personen freischalten, Nachzügler-Links. */
import { B, S, TODAY } from '../app/state.js';
import { deadlineFrom, deadlineText, endOfDayPlus, parseYmd, remainText, toYmd } from '../core/dates.js';
import { isParticipant, isRestricted, pollClosed } from '../core/poll.js';
import { esc, rid } from '../core/util.js';
import { $, baseUrl, msgBlock, sheetHead, toast, voteLink } from './dom.js';
import { renderSheet } from './sheets.js';

export const untilFor = kind => (kind === '1d' ? Date.now() + 864e5 : endOfDayPlus(kind === '3d' ? 3 : 7));
export const DUR = [
  ['1d', '24 Std.'],
  ['3d', '3 Tage'],
  ['7d', '1 Woche'],
];
export const activeExts = p => Object.entries((p && p.extensions) || {}).filter(([, x]) => x && x.until > Date.now());
export const passLink = (pid, code) => `${baseUrl()}#/p/${pid}/${pid}/${code}`;
export function sheetExtend() {
  const p = S.poll,
    s = S.sheet,
    closed = pollClosed(p);
  const status = p.closed
    ? 'Für alle geschlossen.'
    : p.closesAt
      ? closed
        ? `Frist ist abgelaufen (${deadlineText(p.closesAt, true)}).`
        : `Frist: ${deadlineText(p.closesAt, true)} (${remainText(p.closesAt)}).`
      : 'Keine Frist, die Abstimmung ist offen.';
  const people = S.responses.filter(r => r.name).sort((a, b) => a.name.localeCompare(b.name));
  const passes = (S.passes || []).filter(x => x.until > Date.now()).sort((a, b) => a.until - b.until);
  let h = sheetHead('Frist & nachträglich öffnen');
  h += `<div class="stack" style="gap:8px"><h3>Für alle verlängern</h3><p class="small muted">${esc(status)}</p>
    <div class="chips">${[
      [1, '+1 Tag'],
      [3, '+3 Tage'],
      [7, '+1 Woche'],
      [14, '+2 Wochen'],
    ]
      .map(([n, l]) => `<button class="chip" data-act="ext-group" data-v="${n}">${l}</button>`)
      .join('')}</div>
    <div class="timebar"><label>bis<input type="date" id="ext-date" min="${TODAY}"></label><label>um<input type="time" id="ext-time"></label><button class="btn sm" data-act="ext-group-custom">Übernehmen</button></div>
    <div class="row">${p.closed ? `<button class="btn sm primary" data-act="reopen">Wieder öffnen</button>` : ''}${p.closesAt ? `<button class="btn sm ghost" data-act="ext-group" data-v="remove">Frist entfernen</button>` : ''}</div>
    ${s.msg ? `<span class="small muted">Sag der Gruppe Bescheid:</span>${msgBlock(s.msg)}` : ''}</div>`;
  // Eine Stelle für „nachträglich öffnen“: wer schon geantwortet hat → freischalten; wer noch nie → persönlicher Link.
  h += `<div class="stack" style="gap:8px"><h3>Für einzelne Personen nachträglich öffnen</h3><p class="small muted">Wer schon geantwortet hat, darf seine Auswahl nochmal ändern, auch wenn für alle anderen zu ist.</p>
    ${
      people.length
        ? people
            .map(r => {
              const x = p.extensions && p.extensions[r.uid],
                on = x && x.until > Date.now();
              return `<div class="rule"><div class="stack" style="gap:1px"><b>${r.emoji ? esc(r.emoji) + ' ' : ''}${esc(r.name)}</b><span class="small muted">${on ? `freigeschaltet bis ${deadlineText(x.until)}` : r.done ? 'fertig' : 'trägt noch ein'}</span></div><button class="btn sm" data-act="person-open" data-id="${esc(r.uid)}">${on ? 'Ändern' : 'Freischalten'}</button></div>`;
            })
            .join('')
        : '<p class="small muted">Noch keine Antworten.</p>'
    }</div>`;
  h += `<div class="stack ext-sub" style="gap:8px"><b>Jemand hat noch gar nicht abgestimmt?</b><p class="small muted">Dann bekommt er einen persönlichen Link, der auch nach Fristende funktioniert.</p>
    <label class="field">Für wen? <span class="muted small" style="font-weight:400">(nur zur Übersicht für dich)</span><input type="text" id="pass-name" maxlength="40" placeholder="z. B. Dana"></label>
    <div class="row"><span class="small" style="font-weight:600">Link erstellen, gültig für</span>${DUR.map(([k, l]) => `<button class="chip" data-act="pass-create" data-v="${k}">${l}</button>`).join('')}</div>
    ${passes.map(x => `<div class="rule"><div class="stack" style="gap:1px"><b>${esc(x.label || 'Nachzügler')}</b><span class="small muted">gültig bis ${deadlineText(x.until)}</span></div><div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="copy" data-v="${esc(passLink(p.id, x.code))}">Link kopieren</button><button class="btn sm ghost" data-act="pass-del" data-id="${esc(x.code)}">Beenden</button></div></div>`).join('')}</div>`;
  return h;
}
export function sheetPerson() {
  const p = S.poll,
    s = S.sheet,
    r = S.responses.find(x => x.uid === s.uid);
  if (!r) return sheetHead('Person') + '<p class="muted">Nicht gefunden.</p>';
  const x = p.extensions && p.extensions[r.uid],
    on = x && x.until > Date.now();
  let h = sheetHead(`Ändern erlauben: ${esc(r.name)}`);
  h += `<p class="small muted">${esc(r.name)} kann die eigene Auswahl über den normalen Link nochmal bearbeiten, auch wenn die Abstimmung für alle anderen geschlossen ist.</p>`;
  if (on)
    h += `<div class="banner ok"><span>Freigeschaltet bis <b>${deadlineText(x.until, true)}</b>${x.ask ? ' · mit Bitte ums Überprüfen' : ''}</span><button class="btn sm" data-act="person-ext-end" data-id="${esc(r.uid)}">Beenden</button></div>`;
  h += `<div class="stack" style="gap:8px"><span style="font-weight:600;font-size:.9rem">${on ? 'Neu freischalten für' : 'Freischalten für'}</span><div class="chips">${DUR.map(([k, l]) => `<button class="chip" data-act="person-ext" data-id="${esc(r.uid)}" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="check small"><input type="checkbox" id="pe-ask" ${s.ask === false ? '' : 'checked'}> ${esc(r.name)} bitten, die Auswahl nochmal zu überprüfen</label></div>`;
  if (s.msg)
    h += `<div class="stack" style="gap:8px"><span class="small muted">Sag ${esc(r.name)} Bescheid:</span>${msgBlock(s.msg)}</div>`;
  if (isRestricted(p) && isParticipant(p, r.uid))
    h += `<div class="row"><button class="btn sm ghost" data-act="part-remove" data-id="${esc(r.uid)}">Von der Teilnehmerliste entfernen</button></div>`;
  return h;
}
export async function extendGroup(v) {
  const p = S.poll;
  if (v === 'remove') {
    await B.savePoll(p.id, { closesAt: null });
    S.sheet.msg = null;
    renderSheet();
    toast('Frist entfernt');
    return;
  }
  let closesAt;
  if (v === 'custom') {
    const d = ($('#ext-date') || {}).value;
    if (!d) {
      toast('Bitte ein Datum wählen');
      return;
    }
    closesAt = deadlineFrom(d, ($('#ext-time') || {}).value);
  } else {
    const now = Date.now(),
      base = p.closesAt && p.closesAt > now ? p.closesAt - 1 : now;
    const d = parseYmd(toYmd(new Date(base)));
    d.setDate(d.getDate() + +v + 1);
    d.setHours(0, 0, 0, 0);
    closesAt = d.getTime();
  }
  if (closesAt <= Date.now()) {
    toast('Die Frist liegt in der Vergangenheit');
    return;
  }
  await B.savePoll(p.id, { closesAt, closed: false });
  S.sheet.msg = `Gute Nachricht: Ihr könnt bei „${p.title}“ jetzt noch bis ${deadlineText(closesAt, true)} abstimmen. Wer noch nicht dabei ist: ${voteLink(p.id)}`;
  renderSheet();
  toast(`Verlängert bis ${deadlineText(closesAt)}`);
}
export async function extendPerson(uid, kind) {
  const p = S.poll,
    r = S.responses.find(x => x.uid === uid);
  if (!r) return;
  const until = untilFor(kind),
    ask = !!($('#pe-ask') && $('#pe-ask').checked);
  await B.savePoll(p.id, { extensions: { [uid]: { until, ask } } });
  S.sheet.ask = ask;
  S.sheet.msg = `Hey ${r.name}, du kannst deine Angaben bei „${p.title}“ nochmal ändern, bis ${deadlineText(until, true)}${ask ? '. Schau bitte nochmal drüber 🙏' : ''}: ${voteLink(p.id)}`;
  renderSheet();
  toast(`${r.name} ist freigeschaltet`);
}
export async function createPass(kind) {
  const p = S.poll,
    label = (($('#pass-name') || {}).value || '').trim().slice(0, 40);
  const code = rid(12),
    until = untilFor(kind);
  await B.savePass(p.id, code, { until, label, createdAt: Date.now() });
  const link = passLink(p.id, code);
  S.sheet = {
    type: 'text',
    title: 'Nachzügler-Link',
    info: `Gilt bis ${deadlineText(until, true)}${label ? ` für ${esc(label)}` : ''}. Nur wer diesen Link hat, kann damit auch nach Fristende abstimmen.`,
    text: `Hey${label ? ' ' + label : ''}, hier ist dein persönlicher Link für „${p.title}“. Du kannst noch bis ${deadlineText(until, true)} eintragen, wann du kannst: ${link}`,
  };
  renderSheet();
}

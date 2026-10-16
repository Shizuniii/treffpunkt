/* Zeitraum vorschlagen, neu eröffnen, Personenliste. */
import { cancelPendingSave } from '../app/save.js';
import { B, S, TODAY, isOwner } from '../app/state.js';
import { deadlineText, endOfDayPlus, fmtDate, monthKey, monthLabel, parseYmd, rangeText } from '../core/dates.js';
import { addRangeToForm, pollDays } from '../core/poll.js';
import { clone, esc } from '../core/util.js';
import { $, sheetHead, toast, voteLink } from './dom.js';
import { render } from './render.js';
import { renderSheet } from './sheets.js';

export let peopleBusy = false;
export async function loadPeople() {
  if (peopleBusy || !isOwner()) return;
  peopleBusy = true;
  try {
    S.people = (await B.loadPeople()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn(e);
    S.people = S.people || [];
  }
  peopleBusy = false;
  if (S.editPoll || S.route.name === 'results') render();
}
export function sheetPropose() {
  const p = S.poll,
    s = S.sheet,
    mode = p.addMode || 'auto',
    mine = (p.added || {})[B.uid()];
  const lastDay = pollDays(p).slice(-1)[0] || TODAY;
  const [ly, lm] = lastDay.split('-').map(Number);
  const nextMonths = [1, 2, 3].map(i => {
    const d = new Date(ly, lm - 1 + i, 1);
    return monthKey(d.getFullYear(), d.getMonth() + 1);
  });
  let h = sheetHead('Neuen Zeitraum vorschlagen');
  h += `<p class="small muted">${s.fromDone ? 'Du hast an keinem einzigen Tag Zeit eingetragen. ' : ''}Sag, wann du als Nächstes kannst. ${mode === 'auto' ? 'Der Zeitraum wird sofort hinzugefügt, und alle anderen sehen beim nächsten Öffnen einen Hinweis, damit sie auch dafür abstimmen.' : 'Der Organisator bestätigt den Vorschlag, danach können alle dafür abstimmen.'}</p>`;
  if (mine && !mine.declined)
    h += `<div class="banner info">Dein bisheriger Vorschlag: ${rangeText(mine.from, mine.to)} · ${mine.ok ? 'hinzugefügt' : 'wartet auf Bestätigung'}. Ein neuer Vorschlag ersetzt ihn.</div>`;
  h += `<div class="chips">${nextMonths.map(k => `<button class="chip" data-act="pr-month" data-v="${k}">${monthLabel(k)}</button>`).join('')}</div>
    <div class="timebar"><label>von<input type="date" id="pr-from" min="${TODAY}" value="${esc(s['pr-from'] || '')}"></label><label>bis<input type="date" id="pr-to" min="${TODAY}" value="${esc(s['pr-to'] || '')}"></label></div>
    <div class="row"><button class="btn primary" data-act="pr-send">${mode === 'auto' ? 'Zeitraum hinzufügen' : 'Vorschlag senden'}</button>${s.fromDone ? `<button class="btn ghost" data-act="pr-skip">Ohne Vorschlag abschicken</button>` : `<button class="btn ghost" data-act="close-sheet">Abbrechen</button>`}</div>`;
  return h;
}
export async function sendProposal() {
  const p = S.poll,
    s = S.sheet,
    from = ($('#pr-from') || {}).value,
    to = ($('#pr-to') || {}).value,
    mode = p.addMode || 'auto';
  if (!from || !to) {
    toast('Bitte „von“ und „bis“ wählen');
    return;
  }
  if (to < from) {
    toast('„bis“ muss nach „von“ liegen');
    return;
  }
  if (from < TODAY) {
    toast('Der Zeitraum muss in der Zukunft liegen');
    return;
  }
  if ((parseYmd(to) - parseYmd(from)) / 864e5 > 92) {
    toast('Bitte höchstens 3 Monate auf einmal');
    return;
  }
  if (!S.my.name.trim()) {
    S.sheet = null;
    renderSheet();
    toast('Bitte zuerst oben deinen Namen eingeben');
    const n = $('#v-name');
    if (n) n.focus();
    return;
  }
  cancelPendingSave();
  if (s.fromDone) S.my.done = true;
  const now = Date.now();
  await B.saveMine(S.route.id, clone({ ...S.my, v: 2, name: S.my.name.trim().slice(0, 40), updatedAt: now })); // Antwort muss vor dem Vorschlag existieren
  S.my.updatedAt = now;
  const entry = { from, to, name: S.my.name.trim().slice(0, 40), at: now + 1, ok: mode === 'auto', declined: false };
  await B.savePoll(S.route.id, { added: { [B.uid()]: entry } });
  const r = rangeText(from, to);
  S.sheet = {
    type: 'text',
    title: mode === 'auto' ? 'Zeitraum hinzugefügt 📅' : 'Vorschlag gesendet 📨',
    info:
      mode === 'auto'
        ? 'Trag jetzt ein, wann du in diesem Zeitraum kannst. Sag der Gruppe kurz Bescheid:'
        : 'Sobald der Organisator bestätigt, erscheint der Zeitraum für alle. Sag der Gruppe ruhig schon Bescheid:',
    text: `Ich kann bei „${p.title}“ im bisherigen Zeitraum leider an keinem Tag. ${mode === 'auto' ? `Ich habe ${r} hinzugefügt` : `Ich habe ${r} als neuen Zeitraum vorgeschlagen`}. Tragt bitte auch dafür ein, wann ihr könnt: ${voteLink(S.route.ids)}`,
  };
  render();
  renderSheet();
}
export function sheetReopen() {
  const p = S.poll,
    f = p.final,
    s = S.sheet;
  return `${sheetHead('Neu eröffnen')}<p class="small muted">Startet eine neue Runde, z. B. weil jemand absagen musste. Alle Antworten bleiben erhalten, aber jeder wird gebeten, seine Tage nochmal zu prüfen und neu zu bestätigen.</p>
    <label class="field">Grund <span class="muted small" style="font-weight:400">(optional, sehen alle)</span><input type="text" id="ro-note" maxlength="120" placeholder="z. B. Ben musste absagen" value="${esc(s['ro-note'] || '')}"></label>
    ${f ? `<label class="check small"><input type="checkbox" id="ro-excl" ${s['ro-excl'] !== false ? 'checked' : ''}> Bisherigen Termin (${fmtDate(f.date, true)}) ausschließen</label>` : ''}
    <div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Zeitraum erweitern <span class="muted small" style="font-weight:400">(optional)</span></span>
      <div class="timebar"><label>von<input type="date" id="ro-from" min="${TODAY}" value="${esc(s['ro-from'] || '')}"></label><label>bis<input type="date" id="ro-to" min="${TODAY}" value="${esc(s['ro-to'] || '')}"></label></div></div>
    <div class="stack" style="gap:6px"><span style="font-weight:600;font-size:.9rem">Neue Frist</span><div class="chips">${[
      ['none', 'keine'],
      ['7', '1 Woche'],
      ['14', '2 Wochen'],
    ]
      .map(
        ([k, l]) =>
          `<button class="chip ${(s.dl || 'none') === k ? 'on' : ''}" data-act="ro-dl" data-v="${k}">${l}</button>`
      )
      .join('')}</div></div>
    <div class="row"><button class="btn primary" data-act="ro-go">Neu eröffnen</button><button class="btn ghost" data-act="close-sheet">Abbrechen</button></div>`;
}
export async function doReopen() {
  const p = S.poll,
    s = S.sheet;
  const note = (($('#ro-note') || {}).value || '').trim().slice(0, 120);
  const exclOld = $('#ro-excl') ? $('#ro-excl').checked : false;
  const from = ($('#ro-from') || {}).value,
    to = ($('#ro-to') || {}).value;
  if ((from && !to) || (!from && to) || (from && to && to < from)) {
    toast('Bitte einen gültigen Zeitraum wählen oder beide Felder leer lassen');
    return;
  }
  const f = { months: [...(p.months || [])], excluded: [...(p.excluded || [])] };
  if (from && to) addRangeToForm(f, from, to);
  if (p.final && exclOld) f.excluded = [...new Set([...f.excluded, p.final.date])].sort();
  const now = Date.now(),
    closesAt = s.dl && s.dl !== 'none' ? endOfDayPlus(+s.dl) : null;
  const history = [...(p.history || []), ...(p.final ? [{ ...p.final, at: now, note }] : [])].slice(-20);
  await B.savePoll(p.id, {
    closed: false,
    final: null,
    reopenedAt: now,
    reopenNote: note,
    history,
    months: f.months.sort(),
    excluded: f.excluded,
    closesAt,
    updatedAt: now,
  });
  S.sheet = {
    type: 'text',
    title: 'Neue Runde gestartet 🔄',
    info: 'Schick das an eure Gruppe, damit alle nochmal abstimmen.',
    text: `Neue Runde für „${p.title}“${note ? ` (${note})` : ''}: Bitte prüft nochmal, wann ihr könnt, und tippt auf „Fertig“${closesAt ? `, bis ${deadlineText(closesAt, true)}` : ''}: ${voteLink(p.id)}`,
  };
  renderSheet();
  toast('Neue Runde gestartet 🔄');
}

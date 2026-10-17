/* Absagen mit Drink-Regel. */
import { B, S } from '../app/state.js';
import { ivText } from '../core/availability.js';
import { fmtDate } from '../core/dates.js';
import { groupSize, startOf } from '../core/poll.js';
import { esc } from '../core/util.js';
import { $, sheetHead, toast } from './dom.js';
import { unlock } from './fun.js';
import { render } from './render.js';

export function sheetCancel() {
  const p = S.poll,
    f = p && p.final,
    s = S.sheet;
  if (!f) return sheetHead('Absagen') + '<p class="muted">Es gibt noch keinen festgelegten Termin.</p>';
  const left = startOf(f) - Date.now(),
    days = Math.floor(left / 864e5),
    late = left < 7 * 864e5,
    rule = p.cancelRule !== false;
  const N = groupSize(p) ? groupSize(p) - 1 : 0;
  let h = `${sheetHead('Absagen')}<p>Termin: <b>${fmtDate(f.date, true)}</b>, ${ivText([f.s, f.e])} · ${days >= 1 ? `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : 'schon bald'}</p>`;
  if (!late) h += `<div class="banner ok">Mehr als eine Woche vorher, alles fair. Kein Drink fällig 👍</div>`;
  else if (rule) {
    h += `<div class="stack" style="gap:6px"><span style="font-weight:600">Das ist weniger als eine Woche vorher. Was ist der Grund?</span>
      <div class="seg full" role="group" aria-label="Grund"><button data-act="cancel-reason" data-v="sick" class="${s.reason === 'sick' ? 'on' : ''}">Krank / Notfall</button><button data-act="cancel-reason" data-v="other" class="${s.reason === 'other' ? 'on' : ''}">Anderer Grund</button></div></div>`;
    if (s.reason === 'sick')
      h += `<div class="banner ok">Gute Besserung! Verständlicher Grund, kein Drink fällig 🍵</div>`;
    if (s.reason === 'other')
      h += `<div class="banner warn">Der Council muss entscheiden. Gib deine Begründung in der WhatsApp Gruppe an</div>`;
  }
  h += `<label class="field">Nachricht an Selim <span class="muted small" style="font-weight:400">(optional)</span><input type="text" id="cx-note" maxlength="120" placeholder="z. B. Sorry, Familienfeier" value="${esc(s.note || '')}"></label>`;
  const ready = !late || !rule || s.reason;
  return (
    h +
    `<div class="row"><button class="btn danger" data-act="cancel-send" ${ready ? '' : 'disabled'}>Absage senden</button><button class="btn ghost" data-act="close-sheet">Doch nicht</button></div>`
  );
}
export async function sendCancel() {
  const p = S.poll,
    f = p && p.final;
  if (!f || !S.my) return;
  const late = startOf(f) - Date.now() < 7 * 864e5,
    rule = p.cancelRule !== false;
  const reason = !late ? 'early' : S.sheet.reason || 'other';
  const owes = rule && late && reason === 'other';
  const cancel = {
    date: f.date,
    at: Date.now(),
    reason,
    late,
    owes,
    drinks: owes && groupSize(p) ? groupSize(p) - 1 : null,
    note: (($('#cx-note') || {}).value || '').trim().slice(0, 120),
  };
  await B.updateMine(S.route.id, { cancel, updatedAt: Date.now() });
  S.my.cancel = cancel;
  S.sheet = null;
  render();
  toast(
    owes
      ? 'Absage gesendet. Respekt, dass du zu deinen Drinks stehst 🍻'
      : 'Absage gesendet. Danke fürs rechtzeitige Bescheidsagen!'
  );
  unlock('honest');
}

/* Fenster „Benachrichtigungen“: freiwillig, jeder Weg einzeln, Arten wählbar. */
import {
  calUrl,
  channels,
  disableCalendar,
  disablePush,
  disconnectDiscord,
  enableCalendar,
  enablePush,
  googleCalUrl,
  loadNotify,
  notifyDraft,
  setCalDeadlines,
  setType,
  startDiscord,
  thisDevicePush,
  webcalUrl,
} from '../app/notify.js';
import { B, DEMO, S, isOwner } from '../app/state.js';
import { NOTIFY_TYPES, hasChannel } from '../core/notify.js';
import { esc } from '../core/util.js';
import { isIOS, sheetHead, toast } from './dom.js';
import { renderSheet } from './sheets.js';

export async function openNotify() {
  S.sheet = { type: 'notify', loading: true };
  renderSheet();
  try {
    await loadNotify();
  } catch (e) {
    console.warn(e);
  }
  if (S.sheet && S.sheet.type === 'notify') {
    S.sheet.loading = false;
    renderSheet();
  }
}

export function sheetNotify() {
  const s = S.sheet,
    ch = channels(),
    n = notifyDraft();
  let h = sheetHead('🔔 Benachrichtigungen');
  if (s.loading) return h + '<p class="muted">Lädt …</p>';
  h += `<p class="small muted">Ganz freiwillig: Treffpunkt meldet sich nur über die Wege, die du hier einschaltest. Nachrichten kommen mit etwa 15 Minuten Verzögerung.${DEMO ? ' <b>Demo:</b> Hier wird nur so getan, als ob.' : ''}</p>`;
  if (B.isAnon())
    h += `<div class="banner info"><span>Gilt für dieses Gerät. Mit einem Konto gilt es überall. <button class="linkbtn" data-act="acc-open">Konto</button></span></div>`;

  h += `<h3>Wie?</h3>`;
  // Discord
  if (ch.discord)
    h += `<div class="nf-row"><div class="stack" style="gap:2px;min-width:0"><b>💬 Discord</b><span class="small muted">${
      n.discord
        ? `Verbunden als <b>${esc(n.discord.name || 'Discord')}</b> – Nachrichten kommen als Direktnachricht vom Treffpunkt-Bot.`
        : 'Direktnachricht vom Treffpunkt-Bot. Du musst dafür auf dem Discord-Server sein, auf dem der Bot ist.'
    }</span></div>${n.discord ? `<button class="btn sm ghost" data-act="nf-discord-off">Trennen</button>` : `<button class="btn sm primary" data-act="nf-discord">Verbinden</button>`}</div>
    ${n.discordError ? `<div class="banner warn"><span>${esc(n.discordError)}</span></div>` : ''}`;
  // Push
  if (ch.push) {
    const on = thisDevicePush();
    h += `<div class="nf-row"><div class="stack" style="gap:2px;min-width:0"><b>📲 Push auf dieses Gerät</b><span class="small muted">${on ? 'Eingeschaltet auf diesem Gerät.' : 'Eine Mitteilung wie bei anderen Apps.'}${isIOS && !on ? ' Auf dem iPhone geht das nur, wenn Treffpunkt auf dem Home-Bildschirm liegt (Teilen → „Zum Home-Bildschirm“).' : ''}</span></div>
      ${on ? `<button class="btn sm ghost" data-act="nf-push-off">Ausschalten</button>` : `<button class="btn sm primary" data-act="nf-push">Einschalten</button>`}</div>`;
  }
  // Kalender
  if (ch.cal) {
    if (!n.cal)
      h += `<div class="nf-row"><div class="stack" style="gap:2px;min-width:0"><b>📅 Kalender-Abo</b><span class="small muted">Festgelegte Termine erscheinen automatisch in deinem Kalender und werden dort aktualisiert. Dein Kalender ruft dafür eine geheime Adresse ab – wer sie kennt, sieht Titel und Datum deiner Termine.</span></div>
        <button class="btn sm primary" data-act="nf-cal">Abo einrichten</button></div>`;
    else
      h += `<div class="nf-cal stack"><b>📅 Kalender-Abo ist eingerichtet</b>
        <span class="small muted">In etwa 15–30 Minuten ist die Adresse bereit. Danach einmal abonnieren:</span>
        <div class="row"><a class="btn sm primary" href="${esc(webcalUrl(n.cal.token))}">Im Handy-Kalender abonnieren</a><a class="btn sm" href="${esc(googleCalUrl(n.cal.token))}" target="_blank" rel="noopener">Google Kalender</a><button class="btn sm" data-act="copy" data-v="${esc(calUrl(n.cal.token))}">Adresse kopieren</button></div>
        <label class="check small"><input type="checkbox" id="nf-cal-deadlines" ${n.cal.deadlines ? 'checked' : ''}> Auch Abstimmungsfristen eintragen</label>
        <span class="small muted">Google Kalender holt Änderungen nur alle paar Stunden ab, Apple-Kalender öfter.</span>
        <div><button class="btn sm ghost" data-act="nf-cal-off">Abo beenden</button></div></div>`;
  }
  if (!ch.discord && !ch.push && !ch.cal)
    h += `<p class="muted">Der Organisator hat Benachrichtigungen noch nicht eingerichtet.</p>`;

  // Arten
  const types = NOTIFY_TYPES.filter(t => t.who !== 'admin' || isOwner());
  h += `<h3>Worüber?</h3><p class="small muted">Gilt für Discord und Push${hasChannel(n) ? '' : ' – sobald du oben einen Weg einschaltest'}.</p>
    <div class="flist">${types
      .map(
        t => `<label class="frow"><span class="hi" aria-hidden="true">${t.icon}</span><span class="stack" style="gap:1px;flex:1;min-width:0"><b>${esc(t.label)}${t.who === 'admin' ? ' <span class="muted small" style="font-weight:500">(Organisator)</span>' : ''}</b><span class="small muted">${esc(t.desc)}</span></span>
        <input type="checkbox" class="switch" data-nf-type="${t.id}" ${n.types && n.types[t.id] ? 'checked' : ''} aria-label="${esc(t.label)}"></label>`
      )
      .join('')}</div>`;
  return h;
}

/* ---------- Aktionen ---------- */
async function step(fn, okText) {
  try {
    const res = await fn();
    if (res && res.err) {
      toast(
        res.err === 'iphone'
          ? 'Auf dem iPhone: Treffpunkt zuerst zum Home-Bildschirm hinzufügen und von dort öffnen.'
          : res.err === 'denied'
            ? 'Mitteilungen sind für Treffpunkt blockiert. Du kannst sie in den Browser-Einstellungen erlauben.'
            : res.err
      );
    } else if (okText) toast(okText);
  } catch (e) {
    console.warn(e);
    toast('Das hat nicht geklappt. Versuch es nochmal.');
  }
  if (S.sheet && S.sheet.type === 'notify') renderSheet();
}
export const notifyActions = {
  'nf-discord': () => step(startDiscord, DEMO ? 'Discord verbunden (Demo)' : ''),
  'nf-discord-off': () => step(disconnectDiscord, 'Discord getrennt'),
  'nf-push': () => step(enablePush, 'Push eingeschaltet. Gleich kommt eine Test-Mitteilung.'),
  'nf-push-off': () => step(disablePush, 'Push auf diesem Gerät ausgeschaltet'),
  'nf-cal': () => step(enableCalendar, 'Kalender-Abo eingerichtet'),
  'nf-cal-off': () => step(disableCalendar, 'Kalender-Abo beendet'),
};
export const notifyTypeChanged = (id, on) => step(() => setType(id, on));
export const notifyCalDeadlines = on => step(() => setCalDeadlines(on));

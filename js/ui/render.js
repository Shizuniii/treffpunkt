/* Zeichnet die aktuelle Seite neu (Kopfzeile, Fußzeile, Seitenauswahl). */
import { APP_VERSION, B, DEMO, FORCED_DEMO, S, installEvt, isOwner } from '../app/state.js';
import { anyChannel } from '../app/notify.js';
import { feat } from '../app/prefs.js';
import { accountLabel } from '../core/account.js';
import { esc } from '../core/util.js';
import { $, isIOS, isStandalone, timeAgo } from './dom.js';
import { ACH, LOAD_TXT, achGot } from './fun.js';
import { unseenNews } from './help.js';
import { viewHome } from './home.js';
import { viewResults } from './results.js';
import { renderSheet } from './sheets.js';
import { viewVote } from './vote.js';

export function render() {
  const app = $('#app');
  let html = '';
  if (DEMO) html += demoBar();
  if (S.updateAvailable)
    html += `<div class="wrap slim"><div class="banner info"><span>Eine neue Version von Treffpunkt ist da.</span><button class="btn sm primary" data-act="reload">Aktualisieren</button></div></div>`;
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    html += `<div class="wrap slim"><div class="banner info" role="status"><span>📴 Du bist offline. Was du einträgst, wird auf dem Gerät gemerkt und gesendet, sobald du wieder Netz hast.</span></div></div>`;
  const r = S.route.name;
  if (!B) html += `<div class="wrap"><div class="empty">${LOAD_TXT}</div></div>`;
  else if (r === 'vote') html += viewVote();
  else if (r === 'results')
    html += isOwner() ? viewResults() : viewSignIn('Die Auswertung kann nur der Organisator sehen.');
  else html += isOwner() ? viewHome() : viewSignIn();
  const ae = document.activeElement,
    aid = ae && ae.id,
    sel = ae && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;
  app.innerHTML = html;
  if (aid) {
    const n = document.getElementById(aid);
    if (n) {
      n.focus({ preventScroll: true });
      try {
        if (sel && n.setSelectionRange && sel[0] != null) n.setSelectionRange(...sel);
      } catch {}
    }
  }
  renderSheet();
}
export function demoBar() {
  return `<div class="wrap slim"><div class="demo">
    <span><b>Demo-Modus</b> · ${FORCED_DEMO ? 'zum Ausprobieren, deine echten Events sind nicht betroffen' : 'noch nicht mit Firebase verbunden'}. Daten bleiben nur in diesem Browser.</span>
    <div class="row"><div class="seg" role="group" aria-label="Ansicht">
      <button data-act="demo-role" data-v="owner" class="${S.demoRole === 'owner' ? 'on' : ''}">Organisator</button>
      <button data-act="demo-role" data-v="participant" class="${S.demoRole === 'participant' ? 'on' : ''}">Freund</button></div>
      <button class="btn sm" data-act="demo-reset">Zurücksetzen</button></div></div></div>`;
}
export const topbar = (right = '') =>
  `<div class="topbar"><a class="brand" href="#/"><img src="icon-192.png" alt="">Treffpunkt</a><div class="row">${installEvt ? `<button class="btn sm" data-act="install">App installieren</button>` : ''}${unseenNews().length ? `<button class="btn sm newchip" data-act="help-news" title="Neuerungen ansehen">✨ Neu</button>` : ''}<button class="btn sm" data-act="help-open" aria-label="Hilfe und alle Funktionen">? Hilfe</button>${right}</div></div>`;
export function viewSignIn(msg) {
  const wrong = !DEMO && B && B.isGoogle(); // mit Google angemeldet, aber nicht als Organisator eingetragen
  const friend = !!B && B.hasUser() && !B.isAnon() && !B.isGoogle(); // Freund mit Benutzername/Passwort
  const mp = (S.member && S.member.polls) || {};
  const mine = Object.entries(mp).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  let h = `<div class="wrap">${topbar()}`;
  h += friend
    ? `<div class="row small" style="gap:6px"><span class="muted">Angemeldet als <b>${esc(accountLabel(B.accountEmail()))}</b></span><button class="linkbtn" data-act="acc-open">Konto</button></div>`
    : `<div class="row small" style="gap:6px"><span class="muted">Du hast ein Treffpunkt-Konto?</span><button class="linkbtn" data-act="acc-open" data-v="login">Anmelden</button></div>`;
  if (mine.length)
    h += `<div class="card"><div class="hero"><span class="eyebrow">Deine Abstimmungen</span><h1>Schön, dass du da bist${S.member.name ? ', ' + esc(S.member.name) : ''}</h1></div>
     <div class="stack" style="gap:8px">${mine.map(([pid, x]) => `<a class="rule" style="text-decoration:none;color:var(--fg)" href="#/p/${esc(pid)}"><b>${esc(x.t || 'Abstimmung')}</b><span class="small muted">zuletzt ${timeAgo(x.at)} →</span></a>`).join('')}</div></div>`;
  h += `<div class="card"><div class="hero"><span class="eyebrow">Organisator-Bereich</span>${mine.length ? '<h2>Du organisierst selbst?</h2>' : '<h1>Termine finden, ohne Chat-Chaos</h1>'}
    <p class="muted">${esc(msg || 'Hier erstellst du Abstimmungen, verschickst Links und siehst live, wann alle können.')}</p></div>
    ${
      wrong
        ? `<div class="banner warn">Angemeldet als ${esc(B.email() || 'unbekannt')}. Dieses Konto ist nicht als Organisator eingetragen (siehe Firestore-Regeln).</div>
      <div class="row"><button class="btn" data-act="signout">Abmelden</button><button class="btn primary" data-act="signin">Anderes Google-Konto</button></div>`
        : `<div class="row"><button class="btn ${mine.length ? '' : 'primary'}" data-act="signin">Mit Google anmelden</button></div>`
    }
    <p class="small muted">Du hast einen Abstimmungs-Link bekommen? Öffne einfach diesen Link, eine Anmeldung brauchst du dafür nicht.</p></div>`;
  return h + footer() + `</div>`;
}
export function footer(extra = '') {
  const tip =
    isIOS && !isStandalone()
      ? `<span>Tipp fürs iPhone: Teilen-Symbol → „Zum Home-Bildschirm“, dann hast du Treffpunkt wie eine App.</span>`
      : '';
  return `<div class="footer">${extra}${tip}<span class="row" style="justify-content:center;gap:16px"><button class="linkbtn ver" data-act="help-open">❓ Alle Funktionen</button><button class="linkbtn ver" data-act="features-open">⚙️ Deine Ansicht</button>${anyChannel() ? `<button class="linkbtn ver" data-act="notify-open">🔔 Benachrichtigungen</button>` : ''}${feat('fun') ? `<button class="linkbtn ver" data-act="ach-open" id="achcount">🏆 ${achGot().length}/${Object.keys(ACH).length} Erfolge</button>` : ''}<button class="linkbtn ver" data-act="ver-tap">Treffpunkt ${APP_VERSION}</button>${isOwner() ? `<a class="linkbtn ver" href="tests/" target="_blank" rel="noopener" title="Prüft die Rechen-Logik der App direkt in diesem Browser">🧪 Selbsttest</a>` : ''}</span></div>`;
}

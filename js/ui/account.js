/* Fenster „Konto“: anlegen, anmelden, Passwort vergessen/ändern, abmelden – plus der kurze Hinweis unter dem Namen.
   Die eigentliche Arbeit macht js/app/account.js. */
import { changePassword, createAccount, forgotPassword, signIn, signOutAccount } from '../app/account.js';
import { B, DEMO, S } from '../app/state.js';
import { accountLabel, suggestUser } from '../core/account.js';
import { esc } from '../core/util.js';
import { $, sheetHead, toast } from './dom.js';
import { render } from './render.js';
import { renderSheet } from './sheets.js';

const signedIn = () => !!B && B.hasUser() && !B.isAnon();

/** Kurzer Hinweis unter dem Namen auf der Abstimmungsseite. */
export function accountLine() {
  if (!B) return '';
  if (!signedIn())
    return `<span class="small muted">Deine Angaben sind nur auf diesem Gerät gespeichert. <button class="linkbtn" data-act="acc-open">Mit Konto auf jedem Gerät abstimmen</button></span>`;
  return `<span class="small muted">Angemeldet als <b>${esc(accountLabel(B.accountEmail()))}</b>. Du kannst auf jedem Gerät weitermachen. <button class="linkbtn" data-act="acc-open">Konto</button></span>`;
}

export function openAccountSheet(mode) {
  S.sheet = { type: 'account', mode: mode || (signedIn() ? 'manage' : 'create') };
  renderSheet();
}

/* ---------- Fenster ---------- */
export function sheetAccount() {
  const s = S.sheet;
  if (s.mode === 'created') return createdView(s);
  if (s.mode === 'welcome') return welcomeView(s);
  if (signedIn()) return manageView(s);
  if (s.mode === 'forgot') return forgotView(s);
  return anonView(s);
}

const errBox = s => (s.err ? `<div class="banner bad" role="alert"><span>${esc(s.err)}</span></div>` : '');
const busy = s => (s.busy ? 'disabled' : '');
const userInput = (s, label, value) =>
  `<label class="field" for="acc-user"><span>${label}</span><input type="text" id="acc-user" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="80" placeholder="z. B. anna" value="${esc(value)}"></label>`;
const pwInput = (s, label, auto) =>
  `<label class="field" for="acc-pw"><span>${label}</span><input type="password" id="acc-pw" name="password" autocomplete="${auto}" maxlength="100" value="${esc(s.pw || '')}"></label>
   <label class="check small"><input type="checkbox" id="acc-show"> Passwort anzeigen</label>`;

function anonView(s) {
  const create = s.mode !== 'login';
  const suggestion = s.user ?? (create ? suggestUser((S.my && S.my.name) || (S.member && S.member.name) || '') : '');
  let h = sheetHead('Mit Konto auf jedem Gerät');
  h += `<p class="small muted">Ohne Konto sind deine Antworten nur in diesem Browser gespeichert. Mit einem Konto meldest du dich auf jedem Handy oder PC an und siehst überall dasselbe. Ganz freiwillig.</p>
    <div class="seg full" role="group" aria-label="Konto">
      <button type="button" data-act="acc-mode" data-v="create" class="${create ? 'on' : ''}">Neues Konto</button>
      <button type="button" data-act="acc-mode" data-v="login" class="${create ? '' : 'on'}">Ich habe schon eins</button></div>
    ${errBox(s)}`;
  if (create)
    h += `<form class="stack" data-submit="acc-create" novalidate>
      ${userInput(s, 'Benutzername', suggestion)}
      ${pwInput(s, 'Passwort <span class="muted small" style="font-weight:400">(mindestens 6 Zeichen)</span>', 'new-password')}
      <div><button type="submit" class="btn primary" ${busy(s)}>${s.busy ? 'Moment …' : 'Konto anlegen'}</button></div></form>
      <p class="small muted">Statt eines Benutzernamens geht auch deine E-Mail-Adresse – dann kannst du ein vergessenes Passwort selbst zurücksetzen. Deine bisherigen Antworten auf diesem Gerät gehören danach zu deinem Konto. Der Organisator sieht deinen Benutzernamen, aber nie dein Passwort.</p>`;
  else
    h += `<form class="stack" data-submit="acc-login" novalidate>
      ${userInput(s, 'Benutzername oder E-Mail', suggestion)}
      ${pwInput(s, 'Passwort', 'current-password')}
      <div class="row"><button type="submit" class="btn primary" ${busy(s)}>${s.busy ? 'Moment …' : 'Anmelden'}</button>
        <button type="button" class="linkbtn" data-act="acc-mode" data-v="forgot">Passwort vergessen?</button></div></form>
      <p class="small muted">Du hast auf diesem Gerät schon ohne Konto abgestimmt? Kein Problem: Beim Anmelden wird das in dein Konto übernommen.</p>`;
  if (!DEMO)
    h += `<p class="small muted">Oder ohne Passwort: <button type="button" class="linkbtn" data-act="link-google">Mit Google verbinden</button></p>`;
  return h;
}

function forgotView(s) {
  let h = sheetHead('Passwort vergessen');
  h += `${errBox(s)}<form class="stack" data-submit="acc-forgot" novalidate>
      ${userInput(s, 'Benutzername oder E-Mail', s.user || '')}
      <div><button type="submit" class="btn primary" ${busy(s)}>Weiter</button></div></form>`;
  if (s.info === 'pseudo')
    h += `<div class="banner info"><span>Bei einem Konto mit Benutzernamen (ohne E-Mail) kann nur der Organisator ein neues Passwort setzen. Schreib ihm kurz deinen Benutzernamen – du bekommst dann ein neues.</span></div>`;
  if (s.info === 'sent')
    h += `<div class="banner ok"><span>Wenn es ein Konto mit dieser Adresse gibt, ist jetzt eine E-Mail mit einem Link zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner.</span></div>`;
  return (
    h +
    `<div><button type="button" class="linkbtn" data-act="acc-mode" data-v="login">← Zurück zum Anmelden</button></div>`
  );
}

function manageView(s) {
  const google = B.isGoogle();
  let h = sheetHead('Dein Konto');
  h += `<div class="banner ok"><span>Angemeldet als <b>${esc(accountLabel(B.accountEmail()))}</b>. Melde dich auf jedem Gerät mit diesem Konto an, dann siehst du überall dieselben Antworten.</span></div>${errBox(s)}`;
  if (!google)
    h += `<form class="stack" data-submit="acc-pw" novalidate><h3>Passwort ändern</h3>
      ${pwInput(s, 'Neues Passwort <span class="muted small" style="font-weight:400">(mindestens 6 Zeichen)</span>', 'new-password')}
      <div><button type="submit" class="btn" ${busy(s)}>Passwort ändern</button></div></form>`;
  h += `<div class="stack" style="gap:6px"><h3>Abmelden</h3><p class="small muted">Danach ist dieses Gerät wieder ohne Konto. Deine Antworten bleiben sicher in deinem Konto.</p>
    <div><button type="button" class="btn" data-act="acc-signout" ${busy(s)}>Abmelden</button></div></div>`;
  return h;
}

function createdView(s) {
  return `${sheetHead('Konto angelegt 🎉')}
    <p>Dein Benutzername: <b>${esc(s.user)}</b></p>
    <p class="small muted">Am anderen Handy oder PC: den Treffpunkt-Link öffnen, unter deinem Namen auf „Mit Konto auf jedem Gerät abstimmen“ tippen, dann „Ich habe schon eins“.
    ${s.real ? 'Passwort vergessen? Das setzt du über deine E-Mail selbst zurück.' : 'Merk dir dein Passwort gut (am besten im Passwort-Manager speichern). Vergessen? Dann kann dir nur der Organisator ein neues setzen.'}</p>
    <div><button type="button" class="btn primary" data-act="close-sheet">Alles klar</button></div>`;
}

function welcomeView(s) {
  const r = s.report || {},
    list = a => a.map(esc).join(', ');
  return `${sheetHead(`Hallo ${esc(s.user)} 👋`)}
    <p class="small muted">Du bist jetzt auf diesem Gerät angemeldet und siehst die Antworten aus deinem Konto.</p>
    ${r.taken && r.taken.length ? `<div class="banner ok"><span>Von diesem Gerät übernommen: <b>${list(r.taken)}</b></span></div>` : ''}
    ${r.kept && r.kept.length ? `<div class="banner info"><span>Im Konto behalten, weil die Antwort dort neuer war: <b>${list(r.kept)}</b></span></div>` : ''}
    ${r.failed && r.failed.length ? `<div class="banner warn"><span>Nicht übernommen, weil die Abstimmung schon zu ist: <b>${list(r.failed)}</b>. Frag den Organisator, falls du dort noch etwas ändern musst.</span></div>` : ''}
    <div><button type="button" class="btn primary" data-act="close-sheet">Weiter</button></div>`;
}

/* ---------- Aktionen (aus js/app/events.js aufgerufen) ---------- */
const readInputs = () => {
  const u = $('#acc-user'),
    p = $('#acc-pw');
  if (u) S.sheet.user = u.value;
  if (p) S.sheet.pw = p.value;
};
async function run(fn) {
  readInputs();
  Object.assign(S.sheet, { busy: true, err: null });
  renderSheet();
  let res;
  try {
    res = await fn(S.sheet);
  } catch (e) {
    console.error(e);
    res = { err: 'Das hat nicht geklappt. Versuch es nochmal.' };
  }
  if (S.sheet && S.sheet.type === 'account') S.sheet.busy = false;
  return res;
}

/** Formular abgeschickt (Knopf oder Enter). kind = data-submit des Formulars. */
export async function accountSubmit(kind) {
  if (!S.sheet || S.sheet.type !== 'account') return;
  if (kind === 'acc-create') {
    const res = await run(s => createAccount(s.user, s.pw));
    if (res.err) S.sheet.err = res.err;
    else S.sheet = { type: 'account', mode: 'created', user: res.user, real: res.real };
    render();
  } else if (kind === 'acc-login') {
    const res = await run(s => signIn(s.user, s.pw));
    if (res.err) S.sheet.err = res.err;
    else S.sheet = { type: 'account', mode: 'welcome', user: res.user, report: res.report };
  } else if (kind === 'acc-forgot') {
    const res = await run(s => forgotPassword(s.user));
    if (res.err) S.sheet.err = res.err;
    else S.sheet.info = res.pseudo ? 'pseudo' : 'sent';
  } else if (kind === 'acc-pw') {
    const res = await run(s => changePassword(s.pw));
    if (res.err) S.sheet.err = res.err;
    else {
      S.sheet.pw = '';
      toast('Passwort geändert');
    }
  }
  renderSheet();
}

export async function accountSignOut() {
  await run(() => signOutAccount());
  S.sheet = null;
  renderSheet();
  toast('Abgemeldet. Dieses Gerät ist wieder ohne Konto.');
}

export function accountMode(mode) {
  readInputs();
  Object.assign(S.sheet, { mode, err: null, info: null });
  renderSheet();
}

/** „Passwort anzeigen“ */
export function togglePasswordVisible(on) {
  const p = $('#acc-pw');
  if (p) p.type = on ? 'text' : 'password';
}

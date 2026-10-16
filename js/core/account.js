/* Konten mit Benutzername & Passwort (rein, ohne DOM).
   Firebase kennt nur „E-Mail + Passwort“. Aus einem Benutzernamen wird deshalb intern eine Pseudo-Adresse
   wie „anna@konto.treffpunkt.invalid“. Die Endung .invalid ist reserviert und existiert garantiert nie –
   an diese Adressen kann also niemand Mails empfangen (auch keine „Passwort zurücksetzen“-Mails).
   Wer statt eines Benutzernamens eine echte E-Mail angibt, kann „Passwort vergessen“ per Mail nutzen. */
import { isEmptyResp } from './poll.js';

export const ACCOUNT_DOMAIN = 'konto.treffpunkt.invalid';
export const PW_MIN = 6; // Mindestlänge, die Firebase verlangt
export const USER_MIN = 3;
export const USER_MAX = 30;

const TRANS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Benutzername vereinheitlichen: Kleinbuchstaben, Umlaute umschreiben, Leerzeichen → Punkt. */
export const normUser = s =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[äöüß]/g, c => TRANS[c])
    .replace(/\s+/g, '.');

/** Ist das eine interne Pseudo-Adresse (also ein Konto ohne echte E-Mail)? */
export const isPseudo = email =>
  !!email &&
  String(email)
    .toLowerCase()
    .endsWith('@' + ACCOUNT_DOMAIN);

/**
 * Eingabe „Benutzername oder E-Mail“ prüfen.
 * Ergebnis: { email, user, real } – email = was Firebase bekommt, user = was angezeigt wird,
 * real = echte E-Mail (dann geht „Passwort vergessen“ per Mail) – oder { err: 'Text' }.
 */
export function parseLogin(input) {
  const s = String(input || '').trim();
  if (!s) return { err: 'Bitte einen Benutzernamen eingeben.' };
  if (s.includes('@')) {
    const e = s.toLowerCase();
    if (isPseudo(e)) return parseLogin(e.split('@')[0]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return { err: 'Das sieht nicht wie eine E-Mail-Adresse aus.' };
    return { email: e, user: e, real: true };
  }
  const u = normUser(s);
  if (u.length < USER_MIN) return { err: `Der Benutzername braucht mindestens ${USER_MIN} Zeichen.` };
  if (u.length > USER_MAX) return { err: `Der Benutzername darf höchstens ${USER_MAX} Zeichen haben.` };
  if (!/^[a-z0-9._-]+$/.test(u)) return { err: 'Im Benutzernamen gehen nur Buchstaben, Ziffern, Punkt, Minus und _.' };
  return { email: `${u}@${ACCOUNT_DOMAIN}`, user: u, real: false };
}

/** Was in der App als Kontoname angezeigt wird: der Benutzername bzw. die echte E-Mail. */
export const accountLabel = email => (isPseudo(email) ? String(email).split('@')[0].toLowerCase() : email || '');

/** Vorschlag für einen Benutzernamen aus dem Anzeigenamen („Anna Müller“ → „anna.mueller“). */
export function suggestUser(name) {
  const u = normUser(name)
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.]+|[.]+$/g, '')
    .slice(0, USER_MAX);
  return u.length >= USER_MIN ? u : '';
}

/** Passwort prüfen. null = in Ordnung, sonst Fehlertext. */
export const checkPassword = pw =>
  String(pw || '').length >= PW_MIN ? null : `Das Passwort braucht mindestens ${PW_MIN} Zeichen.`;

/** Hat eine Antwort echten Inhalt? (Tage, Wiederholungen, „kann meistens“, „fertig“ oder eine Absage) */
export const hasContent = r => !!r && (!isEmptyResp(r) || r.base === 'all' || !!r.done || !!r.cancel);

/**
 * Anmelden auf einem Gerät, auf dem schon OHNE Konto abgestimmt wurde: welche Antwort gilt?
 *   'take' – Antwort vom Gerät ins Konto übernehmen
 *   'keep' – Antwort im Konto behalten (die vom Gerät wird verworfen)
 *   'none' – auf dem Gerät gibt es nichts Brauchbares
 * Regel: Hat nur eine Seite etwas, gilt diese. Haben beide etwas, gewinnt die zuletzt geänderte.
 */
export function mergeChoice(device, account) {
  if (!hasContent(device)) return 'none';
  if (!hasContent(account)) return 'take';
  return (device.updatedAt || 0) > (account.updatedAt || 0) ? 'take' : 'keep';
}

/** Verständliche Texte für Firebase-Fehlercodes rund ums Konto. */
const AUTH_ERRORS = {
  'auth/email-already-in-use':
    'Diesen Benutzernamen gibt es schon. Nimm einen anderen – oder melde dich an, falls es deiner ist.',
  'auth/credential-already-in-use':
    'Diesen Benutzernamen gibt es schon. Nimm einen anderen – oder melde dich an, falls es deiner ist.',
  'auth/invalid-credential': 'Benutzername oder Passwort stimmt nicht.',
  'auth/invalid-login-credentials': 'Benutzername oder Passwort stimmt nicht.',
  'auth/wrong-password': 'Benutzername oder Passwort stimmt nicht.',
  'auth/user-not-found': 'Benutzername oder Passwort stimmt nicht.',
  'auth/weak-password': `Das Passwort ist zu kurz (mindestens ${PW_MIN} Zeichen).`,
  'auth/invalid-email': 'Dieser Benutzername geht leider nicht. Probier einen anderen.',
  'auth/too-many-requests': 'Zu viele Versuche. Warte ein paar Minuten und versuch es dann nochmal.',
  'auth/network-request-failed': 'Keine Verbindung. Prüfe dein Internet und versuch es nochmal.',
  'auth/user-disabled': 'Dieses Konto ist gesperrt. Frag den Organisator.',
  'auth/operation-not-allowed':
    'Konten sind noch nicht eingeschaltet. Sag dem Organisator Bescheid (Firebase → Authentication → E-Mail/Passwort aktivieren).',
  'auth/requires-recent-login':
    'Aus Sicherheitsgründen: bitte einmal abmelden, wieder anmelden und es dann nochmal versuchen.',
};
export const authError = e => {
  const code = (e && e.code) || '';
  return AUTH_ERRORS[code] || `Das hat nicht geklappt${code ? ` (${code})` : ''}. Versuch es nochmal.`;
};

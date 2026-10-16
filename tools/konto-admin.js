/* Konten deiner Freunde verwalten – läuft nur auf DEINEM PC, nie im Browser und nie auf GitHub.

   Einmalig einrichten (siehe ANLEITUNG.md, „Passwort für einen Freund neu setzen“):
     1. Node.js installieren, im Treffpunkt-Ordner `npm install` ausführen.
     2. Firebase-Konsole → Zahnrad → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“.
        Die heruntergeladene Datei als `admin-schluessel.json` in den Treffpunkt-Ordner legen.
        GEHEIM halten: Mit dieser Datei hat man vollen Zugriff auf dein Firebase-Projekt. Nie hochladen oder verschicken.

   Befehle:
     node tools/konto-admin.js liste                         alle Konten mit Passwort anzeigen
     node tools/konto-admin.js passwort anna                 neues Zufalls-Passwort für „anna“ setzen und anzeigen
     node tools/konto-admin.js passwort anna MeinNeues1      bestimmtes Passwort setzen
     node tools/konto-admin.js sperren anna | entsperren anna */
import { existsSync, readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountLabel, checkPassword, isPseudo, parseLogin } from '../js/core/account.js';

export const USAGE = `Treffpunkt – Konten verwalten

  node tools/konto-admin.js liste                      alle Konten anzeigen
  node tools/konto-admin.js passwort <name>            neues Zufalls-Passwort setzen
  node tools/konto-admin.js passwort <name> <passwort> bestimmtes Passwort setzen
  node tools/konto-admin.js sperren <name>             Konto sperren
  node tools/konto-admin.js entsperren <name>          Sperre aufheben

<name> = Benutzername (z. B. anna) oder E-Mail-Adresse.`;

export const KEY_HELP = `Der Admin-Schlüssel fehlt.
Firebase-Konsole → Zahnrad → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“
und die Datei als admin-schluessel.json in den Treffpunkt-Ordner legen.
(Oder den Pfad in der Umgebungsvariable TREFFPUNKT_ADMIN_KEY angeben.)
Die Datei ist GEHEIM – nie hochladen oder verschicken.`;

/** Gut lesbares Zufalls-Passwort ohne verwechselbare Zeichen, z. B. „k7mpx-2qafh“. */
export function newPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = () => Array.from({ length: 5 }, () => a[randomInt(a.length)]).join('');
  return `${part()}-${part()}`;
}

const day = s => (s ? new Date(s).toLocaleDateString('de-DE') : '–');

/**
 * Führt einen Befehl aus. `auth` = Firebase-Admin-Auth (oder in Tests ein Ersatz), `out` = Ausgabe.
 * Rückgabe: 0 = ok, 1 = Fehler (für den Exit-Code).
 */
export async function run(args, auth, out = console.log) {
  const [cmd, who, pwArg] = args;
  if (!cmd || cmd === 'hilfe' || cmd === '--help') {
    out(USAGE);
    return cmd ? 0 : 1;
  }
  if (cmd === 'liste') {
    const users = [];
    let token;
    do {
      const page = await auth.listUsers(1000, token);
      users.push(...page.users);
      token = page.pageToken;
    } while (token);
    const withPw = users.filter(u => u.email && (u.providerData || []).some(p => p.providerId === 'password'));
    if (!withPw.length) {
      out('Noch keine Konten mit Passwort.');
      return 0;
    }
    withPw.sort((a, b) => accountLabel(a.email).localeCompare(accountLabel(b.email)));
    for (const u of withPw)
      out(
        `${accountLabel(u.email).padEnd(28)} ${isPseudo(u.email) ? 'Benutzername' : 'E-Mail      '}  angelegt ${day(u.metadata && u.metadata.creationTime)}  zuletzt ${day(u.metadata && u.metadata.lastSignInTime)}${u.disabled ? '  (gesperrt)' : ''}`
      );
    return 0;
  }
  if (!['passwort', 'sperren', 'entsperren'].includes(cmd)) {
    out(`Unbekannter Befehl „${cmd}“.\n\n${USAGE}`);
    return 1;
  }
  const L = parseLogin(who);
  if (L.err) {
    out(L.err);
    return 1;
  }
  let user;
  try {
    user = await auth.getUserByEmail(L.email);
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      out(`Kein Konto „${L.user}“ gefunden. Mit „liste“ siehst du alle Konten.`);
      return 1;
    }
    throw e;
  }
  if (cmd === 'passwort') {
    const pw = pwArg || newPassword();
    const pwErr = checkPassword(pw);
    if (pwErr) {
      out(pwErr);
      return 1;
    }
    await auth.updateUser(user.uid, { password: pw });
    out(`Neues Passwort für ${L.user}: ${pw}`);
    out(`Schick es ${L.user} privat. Ändern kann man es danach in der App unter „Konto“.`);
    return 0;
  }
  await auth.updateUser(user.uid, { disabled: cmd === 'sperren' });
  out(cmd === 'sperren' ? `${L.user} ist gesperrt.` : `${L.user} kann sich wieder anmelden.`);
  return 0;
}

// Direkt aufgerufen? Dann mit dem echten Firebase-Projekt verbinden.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const keyPath =
    process.env.TREFFPUNKT_ADMIN_KEY || resolve(fileURLToPath(new URL('..', import.meta.url)), 'admin-schluessel.json');
  if (!existsSync(keyPath)) {
    console.log(KEY_HELP);
    process.exit(1);
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
  try {
    process.exit(await run(process.argv.slice(2), getAuth()));
  } catch (e) {
    console.error('Fehler:', e.message || e);
    process.exit(1);
  }
}

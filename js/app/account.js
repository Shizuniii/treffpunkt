/* Konto: anlegen, anmelden (mit Übernahme der Antworten von diesem Gerät), Passwort, abmelden.
   Welche Antwort beim Zusammenführen gilt, entscheidet mergeChoice() in js/core/account.js (getestet).
   Alle Funktionen geben { ok … } oder { err: 'Text für die Anzeige' } zurück und werfen nicht. */
import { authError, checkPassword, mergeChoice, parseLogin } from '../core/account.js';
import { clone } from '../core/util.js';
import { loadRoute } from './router.js';
import { settleSave } from './save.js';
import { B, S } from './state.js';

/** Antworten, die auf diesem Gerät OHNE Konto liegen: alle Events aus der privaten Liste plus die gerade offenen. */
async function deviceResponses() {
  if (!B.hasUser() || !B.isAnon()) return { list: [], member: null };
  const member = await B.getMember().catch(() => null);
  const polls = (member && member.polls) || {};
  const ids = new Set([...Object.keys(polls), ...(S.route.ids || [])]);
  const list = [];
  for (const pid of ids) {
    const resp = await B.getMine(pid).catch(() => null);
    const title = (polls[pid] && polls[pid].t) || (S.pollsById[pid] && S.pollsById[pid].title) || 'Event';
    if (resp) list.push({ pid, resp, title });
  }
  return { list, member };
}

/** Neues Konto. Auf diesem Gerät bleibt alles, wie es ist – die Antworten gehören ab jetzt zum Konto. */
export async function createAccount(login, pw) {
  const L = parseLogin(login);
  if (L.err) return { err: L.err };
  const pwErr = checkPassword(pw);
  if (pwErr) return { err: pwErr };
  try {
    await settleSave();
    await B.ensureUser();
    await B.createAccount(L.email, pw);
  } catch (e) {
    console.warn(e);
    return { err: authError(e) };
  }
  return { ok: true, user: L.user, real: L.real };
}

/**
 * Mit bestehendem Konto anmelden. Vorher werden Antworten, die auf diesem Gerät ohne Konto entstanden sind,
 * ins Konto übernommen (oder verworfen, wenn die Konto-Antwort neuer ist) und hier aufgeräumt –
 * so taucht niemand doppelt in der Auswertung auf.
 * Ergebnis: { ok, user, report: { taken: [Titel], kept: [Titel], failed: [Titel] } }
 */
export async function signIn(login, pw) {
  const L = parseLogin(login);
  if (L.err) return { err: L.err };
  if (!pw) return { err: 'Bitte dein Passwort eingeben.' };
  await settleSave();
  let acc;
  try {
    acc = await B.openAccount(L.email, pw); // prüft das Passwort, ohne dieses Gerät schon umzumelden
  } catch (e) {
    console.warn(e);
    return { err: authError(e) };
  }
  const report = { taken: [], kept: [], failed: [] };
  try {
    const dev = await deviceResponses();
    if (acc.uid !== B.uid()) {
      for (const { pid, resp, title } of dev.list) {
        const choice = mergeChoice(resp, await acc.getResponse(pid).catch(() => null));
        if (choice === 'take') {
          try {
            const data = clone({ ...resp, updatedAt: Date.now() });
            delete data.uid;
            await acc.saveResponse(pid, data);
            report.taken.push(title);
          } catch (e) {
            console.warn(e); // z. B. Abstimmung schon geschlossen → Antwort bleibt, wie sie ist
            report.failed.push(title);
            continue;
          }
        } else if (choice === 'keep') report.kept.push(title);
        await B.deleteResponse(pid, B.uid()).catch(e => console.warn(e));
      }
      // Benachrichtigungs-Einstellungen mitnehmen, falls das Konto noch keine hat
      const devNotify = await B.getNotify().catch(() => null);
      if (devNotify) {
        if (!(await acc.getNotify().catch(() => null))) await acc.saveNotify(devNotify).catch(e => console.warn(e));
        await B.deleteNotify().catch(e => console.warn(e));
      }
      const polls = (dev.member && dev.member.polls) || {};
      if (Object.keys(polls).length) {
        await acc.saveMember({ polls }).catch(e => console.warn(e));
        await B.deleteMember().catch(e => console.warn(e));
      }
    }
  } finally {
    await acc.close();
  }
  try {
    await B.signInAccount(L.email, pw);
  } catch (e) {
    console.warn(e);
    return { err: authError(e) };
  }
  await loadRoute();
  return { ok: true, user: L.user, report };
}

/** Passwort vergessen: bei echter E-Mail kommt ein Link, bei Benutzernamen hilft nur der Organisator. */
export async function forgotPassword(login) {
  const L = parseLogin(login);
  if (L.err) return { err: L.err };
  if (!L.real) return { ok: true, pseudo: true };
  try {
    await B.resetPassword(L.email);
  } catch (e) {
    console.warn(e);
    return { err: authError(e) };
  }
  return { ok: true, sent: true };
}

export async function changePassword(pw) {
  const pwErr = checkPassword(pw);
  if (pwErr) return { err: pwErr };
  try {
    await B.changePassword(pw);
  } catch (e) {
    console.warn(e);
    return { err: authError(e) };
  }
  return { ok: true };
}

/** Abmelden: dieses Gerät ist danach wieder ohne Konto; die Antworten bleiben im Konto. */
export async function signOutAccount() {
  await settleSave();
  await B.signOut();
  await loadRoute();
  return { ok: true };
}

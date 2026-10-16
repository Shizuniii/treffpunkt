/* Monatlicher Wartungs-Check (GitHub Actions, .github/workflows/maintenance.yml):
   • Reicht die Ferientabelle noch mindestens ein Jahr?
   • Gibt es eine neuere Firebase-Version als die, die die App lädt?
   Findet er etwas, schreibt er einen Text nach GITHUB_OUTPUT – der Workflow legt daraus ein GitHub-Issue an,
   und GitHub schickt dir dazu eine E-Mail. */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FERIEN_UNTIL } from '../js/core/holidays.js';

/** Version aus der Adresse in js/backend/firebase.js (…/firebasejs/10.12.2/). */
export const usedFirebaseVersion = src => (src.match(/firebasejs\/(\d+\.\d+\.\d+)\//) || [])[1] || null;
const parts = v => v.split('.').map(Number);
/** Lohnt sich ein Update? Ja bei neuer Hauptversion oder mindestens 3 Nebenversionen Abstand. */
export function firebaseBehind(used, latest) {
  if (!used || !latest) return false;
  const [a, b] = parts(used),
    [c, d] = parts(latest);
  return c > a || (c === a && d - b >= 3);
}
export function ferienWarning(until, today = new Date()) {
  const limit = new Date(today);
  limit.setFullYear(limit.getFullYear() + 1);
  return until < limit.toISOString().slice(0, 10)
    ? `Die Schulferien NRW sind nur bis ${until} eingetragen. Bitte neue Termine in js/core/holidays.js ergänzen (Quelle: Ferienordnung des Schulministeriums NRW).`
    : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const notes = [];
  const fer = ferienWarning(FERIEN_UNTIL);
  if (fer) notes.push(`- 🗓️ ${fer}`);
  const used = usedFirebaseVersion(readFileSync(new URL('../js/backend/firebase.js', import.meta.url), 'utf8'));
  try {
    const latest = (await (await fetch('https://registry.npmjs.org/firebase/latest')).json()).version;
    if (firebaseBehind(used, latest))
      notes.push(
        `- 🔥 Die App lädt Firebase ${used}, aktuell ist ${latest}. Bei Gelegenheit die Versionsnummer in js/backend/firebase.js anheben und die Tests laufen lassen.`
      );
  } catch (e) {
    console.warn('Firebase-Version nicht prüfbar:', e.message);
  }
  console.log(notes.length ? notes.join('\n') : 'Alles aktuell.');
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `found=${notes.length ? 'true' : 'false'}\nbody<<EOF\n${notes.join('\n')}\nEOF\n`
    );
}

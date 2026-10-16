/* Sicherheitsregeln (firestore.rules) nach Firebase veröffentlichen – wie „Veröffentlichen“ in der Firebase-Konsole.
   Läuft in GitHub Actions nach grünen Tests (.github/workflows/tests.yml). Braucht FIREBASE_SERVICE_ACCOUNT.
   Schutz: Gibt es noch keinen Organisator in der Sammlung „admins“, wird abgebrochen – sonst könntest du dich
   mit den neuen Regeln selbst aussperren. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const hasLead = admins => admins.some(a => a.role === 'owner');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.log('FIREBASE_SERVICE_ACCOUNT fehlt – Regeln bitte per Hand in der Firebase-Konsole einfügen.');
    process.exit(0);
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getSecurityRules } = await import('firebase-admin/security-rules');
  initializeApp({ credential: cert(JSON.parse(raw)) });
  const admins = (await getFirestore().collection('admins').get()).docs.map(d => ({ email: d.id, ...d.data() }));
  if (!hasLead(admins)) {
    console.error(
      'Abgebrochen: In Firestore gibt es noch keinen Organisator (Sammlung „admins“, Feld role = owner).\n' +
        'Leg ihn zuerst an (ANLEITUNG, Teil A, Schritt 3) – sonst sperrst du dich mit den neuen Regeln aus.'
    );
    process.exit(1);
  }
  const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const r = await getSecurityRules().releaseFirestoreRulesetFromSource(source);
  console.log(`Regeln veröffentlicht (${r.name}). Organisatoren: ${admins.map(a => a.email).join(', ')}`);
}

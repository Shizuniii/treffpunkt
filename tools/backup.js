/* Sicherung der Datenbank – verschlüsselt, damit sie auch in einem öffentlichen Repository sicher ist.
   Läuft wöchentlich über GitHub Actions (.github/workflows/backup.yml); die Datei liegt dann 90 Tage unter
   „Actions → Sicherung → Artifacts“. Ohne das Passwort (Secret BACKUP_PASSWORD) kann niemand sie lesen.

   Befehle (auf deinem PC im Treffpunkt-Ordner, nach `npm install`):
     node tools/backup.js export  [--out sicherung.enc]       Sicherung erstellen (braucht Admin-Schlüssel)
     node tools/backup.js decrypt sicherung.enc [--out x.json] Sicherung lesbar machen (nur zum Anschauen)
     node tools/backup.js restore sicherung.enc --ja          Sicherung zurückspielen (überschreibt gleichnamige Einträge)
   Passwort: Umgebungsvariable BACKUP_PASSWORD. Admin-Schlüssel: FIREBASE_SERVICE_ACCOUNT oder admin-schluessel.json. */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------- Verschlüsseln (AES-256-GCM, Schlüssel aus dem Passwort per scrypt) ---------- */
export function encrypt(obj, password) {
  if (!password) throw new Error('BACKUP_PASSWORD fehlt');
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({
    treffpunktBackup: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
}
export function decrypt(text, password) {
  const e = JSON.parse(text);
  if (!e.treffpunktBackup) throw new Error('Das ist keine Treffpunkt-Sicherung');
  const d = createDecipheriv(
    'aes-256-gcm',
    scryptSync(password || '', Buffer.from(e.salt, 'base64'), 32),
    Buffer.from(e.iv, 'base64')
  );
  d.setAuthTag(Buffer.from(e.tag, 'base64'));
  try {
    return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data, 'base64')), d.final()]).toString('utf8'));
  } catch {
    throw new Error('Falsches Passwort oder beschädigte Datei');
  }
}

/* ---------- Exportieren / Zurückspielen (Firebase Admin) ---------- */
/** Alle Dokumente aller Sammlungen (inkl. Unter-Sammlungen) als { 'pfad/zum/doc': daten }. */
export async function exportAll(db) {
  const docs = {};
  const walk = async cols => {
    for (const c of cols)
      for (const d of (await c.get()).docs) {
        docs[d.ref.path] = d.data();
        await walk(await d.ref.listCollections());
      }
  };
  await walk(await db.listCollections());
  return { version: 1, at: Date.now(), count: Object.keys(docs).length, docs };
}
export async function restoreAll(db, backup) {
  const entries = Object.entries(backup.docs || {});
  for (let i = 0; i < entries.length; i += 400) {
    const b = db.batch();
    for (const [path, data] of entries.slice(i, i + 400)) b.set(db.doc(path), data);
    await b.commit();
  }
  return entries.length;
}

async function adminDb() {
  const keyFile = resolve(fileURLToPath(new URL('..', import.meta.url)), 'admin-schluessel.json');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '');
  if (!raw) throw new Error('Admin-Schlüssel fehlt (FIREBASE_SERVICE_ACCOUNT oder admin-schluessel.json)');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, file] = process.argv.slice(2);
  const arg = name => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const pw = process.env.BACKUP_PASSWORD;
  try {
    if (cmd === 'export') {
      const backup = await exportAll(await adminDb());
      const out = arg('--out') || `sicherung-${new Date().toISOString().slice(0, 10)}.enc`;
      writeFileSync(out, encrypt(backup, pw));
      console.log(`${backup.count} Einträge gesichert → ${out}`);
    } else if (cmd === 'decrypt') {
      const out = arg('--out') || file.replace(/\.enc$/, '') + '.json';
      writeFileSync(out, JSON.stringify(decrypt(readFileSync(file, 'utf8'), pw), null, 2));
      console.log(`Entschlüsselt → ${out} (enthält private Daten – nicht weitergeben)`);
    } else if (cmd === 'restore') {
      const text = readFileSync(file, 'utf8');
      const backup = text.includes('treffpunktBackup') ? decrypt(text, pw) : JSON.parse(text);
      if (!process.argv.includes('--ja')) {
        console.log(
          `Die Sicherung vom ${new Date(backup.at).toLocaleString('de-DE')} enthält ${backup.count} Einträge.\nZum Zurückspielen nochmal mit --ja aufrufen. Gleichnamige Einträge werden überschrieben.`
        );
        process.exit(1);
      }
      console.log(`${await restoreAll(await adminDb(), backup)} Einträge zurückgespielt.`);
    } else {
      console.log('Befehle: export | decrypt <datei> | restore <datei> --ja   (siehe Kopf dieser Datei)');
      process.exit(1);
    }
  } catch (e) {
    console.error('Fehler:', e.message || e);
    process.exit(1);
  }
}

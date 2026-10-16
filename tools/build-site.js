/* Baut den Ordner, der auf GitHub Pages veröffentlicht wird (Standard: _site). Läuft in GitHub Actions.

   config.js wird aus den GitHub-Einstellungen erzeugt, wenn FIREBASE_CONFIG gesetzt ist – dann kann die config.js
   im Repository nie mehr versehentlich echte Werte überschreiben. Ohne FIREBASE_CONFIG wird die config.js aus dem
   Repository genommen (so wie beim Hochladen per Hand).

   Umgebungsvariablen: FIREBASE_CONFIG (der Block aus der Firebase-Konsole), DISCORD_CLIENT_ID, VAPID_PUBLIC_KEY,
   CALENDAR ("true", wenn Kalender-Abos erzeugt werden), CAL_DIR (Ordner mit .ics-Dateien), OUT (Zielordner). */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
/** Was veröffentlicht wird. Tests im Browser (tests/) sind dabei, UI-/Regel-/Node-Tests nicht. */
export const SITE_FILES = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'version.json',
  'icon-192.png',
  'icon-512.png',
];
export const SITE_DIRS = ['css', 'js', 'tests/lib', 'tests/unit'];

/**
 * Firebase-Konfiguration lesen – als JSON oder genau so, wie die Firebase-Konsole sie anzeigt
 * (const firebaseConfig = { apiKey: "…", … };).
 */
export function parseFirebaseConfig(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t);
    if (j && j.apiKey) return j;
  } catch {}
  const out = {};
  for (const m of t.matchAll(/(\w+)\s*:\s*["']([^"']*)["']/g)) out[m[1]] = m[2];
  return out.apiKey ? out : null;
}

export function configJs({ firebase, discordClientId = '', vapidPublicKey = '', calendar = false }) {
  return `// Automatisch erzeugt beim Veröffentlichen (tools/build-site.js) – nicht von Hand ändern.
window.TREFFPUNKT_CONFIG = ${JSON.stringify({ firebase, discordClientId, vapidPublicKey, calendar: !!calendar }, null, 2)};
`;
}

export function buildSite({ out, env = process.env, root = ROOT }) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const f of SITE_FILES) cpSync(join(root, f), join(out, f));
  for (const d of SITE_DIRS) cpSync(join(root, d), join(out, d), { recursive: true });
  cpSync(join(root, 'tests/index.html'), join(out, 'tests/index.html'));
  const firebase = parseFirebaseConfig(env.FIREBASE_CONFIG);
  if (firebase)
    writeFileSync(
      join(out, 'config.js'),
      configJs({
        firebase,
        discordClientId: env.DISCORD_CLIENT_ID || '',
        vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
        calendar: env.CALENDAR === 'true',
      })
    );
  else cpSync(join(root, 'config.js'), join(out, 'config.js'));
  if (env.CAL_DIR && existsSync(env.CAL_DIR)) cpSync(env.CAL_DIR, join(out, 'cal'), { recursive: true });
  writeFileSync(join(out, '.nojekyll'), ''); // GitHub Pages soll die Dateien unverändert ausliefern
  return { generatedConfig: !!firebase };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.env.OUT || '_site');
  const r = buildSite({ out });
  console.log(
    `Seite gebaut in ${out} (config.js ${r.generatedConfig ? 'aus GitHub-Einstellungen erzeugt' : 'aus dem Repository'}).`
  );
  if (!r.generatedConfig && /DEIN_API_KEY/.test(readFileSync(join(out, 'config.js'), 'utf8')))
    console.log('Hinweis: config.js enthält noch Platzhalter – die Seite läuft im Demo-Modus.');
}

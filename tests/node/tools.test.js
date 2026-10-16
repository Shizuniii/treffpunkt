/* Tests für die Werkzeuge in tools/: Seite bauen, Sicherung, Wartungs-Check. Ohne Netz und ohne echtes Firebase. */
import { suite, assert } from '../lib/mini-test.js';
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, configJs, parseFirebaseConfig } from '../../tools/build-site.js';
import { decrypt, encrypt, exportAll, restoreAll } from '../../tools/backup.js';
import { ferienWarning, firebaseBehind, usedFirebaseVersion } from '../../tools/check-updates.js';
import { hasLead } from '../../tools/deploy-rules.js';

suite('Werkzeuge: Seite bauen', t => {
  t('Firebase-Block aus der Konsole oder als JSON', () => {
    const konsole = `const firebaseConfig = {\n  apiKey: "AIzaXYZ",\n  authDomain: "tp.firebaseapp.com",\n  projectId: "tp",\n  appId: "1:2:web:3"\n};`;
    assert.eq(parseFirebaseConfig(konsole).projectId, 'tp');
    assert.eq(parseFirebaseConfig('{"apiKey":"A","projectId":"p"}').projectId, 'p');
    assert.eq(parseFirebaseConfig(''), null);
    assert.eq(parseFirebaseConfig('Quatsch'), null);
  });
  t('erzeugte config.js', () => {
    const js = configJs({ firebase: { apiKey: 'A' }, discordClientId: '123', calendar: true });
    assert.includes(js, 'window.TREFFPUNKT_CONFIG');
    assert.includes(js, '"discordClientId": "123"');
    assert.includes(js, '"calendar": true');
  });
  t('Ordner für GitHub Pages: App, Browser-Tests, Kalender – keine UI-/Regel-Tests', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tp-site-'));
    const cal = join(dir, 'cal-src');
    mkdirSync(cal);
    writeFileSync(join(cal, 'a'.repeat(24) + '.ics'), 'BEGIN:VCALENDAR');
    const out = join(dir, 'site');
    const r = buildSite({ out, env: { FIREBASE_CONFIG: '{"apiKey":"A"}', CAL_DIR: cal, CALENDAR: 'true' } });
    assert.ok(r.generatedConfig);
    for (const f of [
      'index.html',
      'sw.js',
      'js/app/main.js',
      'css/app.css',
      'tests/index.html',
      'tests/unit/all.js',
      'cal/' + 'a'.repeat(24) + '.ics',
      '.nojekyll',
    ])
      assert.ok(existsSync(join(out, f)), f);
    for (const f of ['tests/ui', 'tests/rules', 'tools', 'admin-schluessel.json', 'firestore.rules'])
      assert.no(existsSync(join(out, f)), f);
    assert.includes(readFileSync(join(out, 'config.js'), 'utf8'), '"calendar": true');
    rmSync(dir, { recursive: true, force: true });
  });
});

suite('Werkzeuge: Sicherung', t => {
  t('verschlüsseln und mit richtigem Passwort wieder lesen', () => {
    const enc = encrypt({ docs: { 'polls/a': { title: 'Kino' } } }, 'geheim');
    assert.no(enc.includes('Kino'), 'Inhalt ist nicht lesbar');
    assert.eq(decrypt(enc, 'geheim').docs['polls/a'].title, 'Kino');
    assert.throws(() => decrypt(enc, 'falsch'));
  });
  t('alles exportieren (mit Unter-Sammlungen) und zurückspielen', async () => {
    // Mini-Ersatz für Firestore: { sammlung: { docId: { data, sub: { sammlung: … } } } }
    const tree = {
      polls: { a: { data: { title: 'Kino' }, sub: { responses: { anna: { data: { name: 'Anna' } } } } } },
      admins: { 'x@y.de': { data: { role: 'owner' } } },
    };
    const colsOf = (node, prefix) =>
      Object.entries(node || {}).map(([name, docs]) => ({
        get: async () => ({
          docs: Object.entries(docs).map(([id, d]) => ({
            data: () => d.data,
            ref: {
              path: `${prefix}${name}/${id}`,
              listCollections: async () => colsOf(d.sub, `${prefix}${name}/${id}/`),
            },
          })),
        }),
      }));
    const backup = await exportAll({ listCollections: async () => colsOf(tree, '') });
    assert.eq(backup.count, 3);
    assert.eq(backup.docs['polls/a/responses/anna'].name, 'Anna');
    const written = {};
    const n = await restoreAll(
      { batch: () => ({ set: (ref, data) => (written[ref] = data), commit: async () => {} }), doc: p => p },
      backup
    );
    assert.eq(n, 3);
    assert.eq(written['admins/x@y.de'].role, 'owner');
  });
});

suite('Werkzeuge: Wartungs-Check', t => {
  t('Firebase-Version erkennen und vergleichen', () => {
    assert.eq(usedFirebaseVersion("const V = 'https://www.gstatic.com/firebasejs/10.12.2/';"), '10.12.2');
    assert.ok(firebaseBehind('10.12.2', '11.0.0'), 'neue Hauptversion');
    assert.ok(firebaseBehind('10.12.2', '10.15.0'), '3 Nebenversionen');
    assert.no(firebaseBehind('10.12.2', '10.13.1'));
  });
  t('Ferien-Warnung ein Jahr vorher', () => {
    assert.eq(ferienWarning('2030-08-06', new Date('2026-10-15')), null);
    assert.ok(ferienWarning('2030-08-06', new Date('2029-09-01')));
  });
  t('Regeln nur veröffentlichen, wenn es eine Leitung gibt (sonst Aussperren)', () => {
    assert.no(hasLead([]));
    assert.no(hasLead([{ role: 'co' }]));
    assert.ok(hasLead([{ role: 'co' }, { role: 'owner' }]));
  });
});

import { suite, assert } from '../lib/mini-test.js';
import { helpSearch, normTxt, lev } from '../../js/core/search.js';
import { HELP } from '../../js/content/help.js';
import { FEATURES, PRESETS, resolveFeatures, usageOf, presetOf } from '../../js/core/features.js';
import { icsFor, gcalUrl } from '../../js/core/calexport.js';
import { esc, cmpVer, deepMerge, initials } from '../../js/core/util.js';

suite('Hilfe-Suche', t => {
  const ids = r => ({ hits: r.hits.map(x => x.t.id), guesses: r.guesses.map(x => x.t.id) });
  t('Umlaute und Tippfehler', () => {
    assert.eq(normTxt('Später Übersicht'), 'spaeter uebersicht');
    assert.eq(lev('kalnder', 'kalender'), 1);
  });
  t('direkter Treffer', () => assert.eq(ids(helpSearch('ich bin krank', HELP)).hits[0], 'cancel'));
  t('„Meintest du“ ohne das genaue Wort', () => {
    assert.includes(ids(helpSearch('Lieblingsdatum', HELP)).guesses, 'favs');
    assert.includes(ids(helpSearch('nach feierabend', HELP)).guesses, 'time');
  });
  t('ganze Phrase hat Vorrang', () => assert.eq(ids(helpSearch('zu spät', HELP)).hits[0], 'deadline'));
  t('Konto-Fragen finden das Konto-Thema', () => {
    for (const q of ['passwort vergessen', 'login', 'neues handy', 'benutzername'])
      assert.eq(ids(helpSearch(q, HELP)).hits[0], 'devices', q);
  });
  t('Neue Themen werden gefunden', () => {
    assert.eq(ids(helpSearch('discord benachrichtigung', HELP)).hits[0], 'notify');
    assert.eq(ids(helpSearch('kein netz', HELP)).hits[0], 'offline');
    assert.eq(ids(helpSearch('vorlage', HELP)).hits[0], 'o-templates');
    assert.eq(ids(helpSearch('mitorganisator', HELP)).hits[0], 'o-admins');
  });
  t('Unsinn findet nichts', () => {
    const r = helpSearch('qwertz', HELP);
    assert.eq(r.hits.length + r.guesses.length, 0);
  });
  t('jedes Thema hat Titel, Text und eine eindeutige id', () => {
    const seen = new Set();
    for (const h of HELP) {
      assert.ok(h.id && h.title && h.text, h.id);
      assert.no(seen.has(h.id), 'doppelt: ' + h.id);
      seen.add(h.id);
    }
  });
});

suite('Einfach-Modus & Optionen', t => {
  t('Standard = Einfach', () => {
    const f = resolveFeatures({}, {}, {});
    assert.ok(f.time);
    assert.no(f.maybe);
    assert.no(f.rules);
    assert.no(f.favs);
    assert.eq(presetOf({}), 'simple');
  });
  t('„Alles“ schaltet alles ein', () => {
    assert.ok(Object.values(resolveFeatures(PRESETS.all)).every(Boolean));
    assert.eq(presetOf(PRESETS.all), 'all');
    assert.eq(presetOf({ maybe: true }), 'custom');
  });
  t('genutzte Funktionen bleiben sichtbar', () => {
    const u = usageOf({
      days: { a: { s: 0, e: 1440, m: 1 }, b: { s: 600, e: 900 } },
      rules: [{ wd: [1] }],
      favs: ['x'],
      emoji: '🐸',
      base: 'none',
    });
    const f = resolveFeatures({ maybe: false, rules: false }, u, {});
    assert.ok(f.maybe);
    assert.ok(f.rules);
    assert.ok(f.favs);
    assert.ok(f.avatar);
    assert.ok(f.time);
  });
  t('Event ohne Vielleicht', () =>
    assert.no(resolveFeatures({ maybe: true }, { maybe: true }, { maybe: false }).maybe)
  );
  t('jede Funktion hat id, Text und Hilfe-Thema', () => {
    for (const f of FEATURES) {
      assert.ok(f.id && f.label && f.desc, f.id);
      assert.ok(
        HELP.some(h => h.id === f.help),
        'Hilfe fehlt: ' + f.id
      );
    }
  });
});

suite('Kalender-Export', t => {
  const p = { id: 'p1', title: 'Spieleabend, 2. Runde', final: { date: '2026-11-07', s: 1080, e: 1440 } };
  t('.ics mit Uhrzeit', () => {
    const ics = icsFor(p, 'https://x');
    assert.ok(ics.includes('DTSTART:20261107T180000'));
    assert.ok(ics.includes('DTEND:20261108T000000'));
    assert.ok(ics.includes('SUMMARY:Spieleabend\\, 2. Runde'), 'Komma escaped');
  });
  t('.ics ganztägig', () =>
    assert.ok(icsFor({ ...p, final: { date: '2026-11-07', s: 0, e: 1440 } }).includes('DTSTART;VALUE=DATE:20261107'))
  );
  t('Google-Kalender-Link', () =>
    assert.ok(gcalUrl(p, 'https://x').includes('dates=20261107T180000%2F20261108T000000'))
  );
});

suite('Helfer', t => {
  t('HTML wird maskiert', () => assert.eq(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;'));
  t('Versionen vergleichen', () => {
    assert.ok(cmpVer('2.10.0', '2.9.9') > 0);
    assert.eq(cmpVer('2.3.0', '2.3.0'), 0);
  });
  t('deepMerge wie Firestore', () =>
    assert.deep(deepMerge({ a: { x: 1, y: 2 }, l: [1] }, { a: { y: 3 }, l: [2] }), { a: { x: 1, y: 3 }, l: [2] })
  );
  t('Initialen', () => {
    assert.eq(initials('Dana (Beispiel)'), 'DB');
    assert.eq(initials(''), '?');
  });
});

import { suite, assert } from '../lib/mini-test.js';
import {
  BUILTIN_TEMPLATES,
  formFromTemplate,
  nextMonths,
  reuseForm,
  templateFromPoll,
} from '../../js/core/templates.js';
import { pollSummary } from '../../js/core/results.js';

suite('Vorlagen & Wiederverwenden', t => {
  t('nächste Monate ab heute', () => {
    assert.deep(nextMonths('2026-10-15', 2), ['2026-10', '2026-11']);
    assert.deep(nextMonths('2026-10-27', 2), ['2026-11', '2026-12'], 'Monat fast vorbei → ab nächstem');
    assert.deep(nextMonths('2026-12-03', 2), ['2026-12', '2027-01'], 'Jahreswechsel');
  });
  t('Vorlage → Formular mit Frist ab heute', () => {
    const f = formFromTemplate(BUILTIN_TEMPLATES[0], '2026-10-15');
    assert.eq(f.title, 'Spieleabend');
    assert.deep(f.weekdays, [4, 5, 6]);
    assert.ok(f.dlOn);
    assert.eq(f.dlDate, '2026-10-22');
    assert.eq(f.id, null);
  });
  t('Vorlage aus Event merkt sich Abstände, nicht Daten', () => {
    const p = {
      title: 'Bowling',
      months: ['2026-01', '2026-02'],
      weekdays: [5],
      createdAt: Date.UTC(2026, 0, 1),
      closesAt: Date.UTC(2026, 0, 15),
      maybeLimit: 2,
      restricted: true,
      participants: { a: { on: true, name: 'A' } },
    };
    const tpl = templateFromPoll(p, 'Mein Bowling');
    assert.eq(tpl.name, 'Mein Bowling');
    assert.eq(tpl.months, 2);
    assert.eq(tpl.deadlineDays, 14);
    assert.ok(tpl.participants.a.on);
  });
  t('Nochmal mit neuem Zeitraum', () => {
    const p = { title: 'Spieleabend', months: ['2025-03'], excluded: ['2025-03-07'], weekdays: [5, 6], createdAt: 0 };
    const f = reuseForm(p, '2026-10-15');
    assert.eq(f.title, 'Spieleabend', 'gleicher Titel, nicht „(Kopie)“');
    assert.deep(f.months, ['2026-10']);
    assert.deep(f.excluded, [], 'alte Ausschlüsse fallen weg');
    assert.no(f.dlOn, 'ohne Frist bleibt ohne Frist');
  });
});

suite('Überblick für Organisatoren', t => {
  const ALL = { s: 0, e: 1440 };
  const poll = {
    id: 'p',
    months: ['2026-11'],
    restricted: true,
    participants: { a: { on: true, name: 'Anna' }, b: { on: true, name: 'Ben' }, c: { on: true, name: 'Cem' } },
  };
  const resp = (uid, days, done = true) => ({ uid, name: uid.toUpperCase(), done, updatedAt: 1, days, rules: [] });
  t('wer fehlt, bester Tag, Fortschritt', () => {
    const s = pollSummary({
      poll,
      responses: [resp('a', { '2026-11-07': ALL }), resp('b', { '2026-11-07': ALL }, false)],
      today: '2026-11-01',
    });
    assert.eq(s.done, 1);
    assert.eq(s.expected, 3);
    assert.deep(s.missing, ['Ben', 'Cem']);
    assert.eq(s.best.ds, '2026-11-07');
    assert.eq(s.best.k, 2);
  });
  t('ohne Antworten kein bester Tag', () => {
    const s = pollSummary({ poll, responses: [], today: '2026-11-01' });
    assert.eq(s.best, null);
    assert.eq(s.missing.length, 3);
  });
});

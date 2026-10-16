import { suite, assert } from '../lib/mini-test.js';
import { calendarEntries, defaultTypes, hasChannel, planNotifications } from '../../js/core/notify.js';
import { icsFeed } from '../../js/core/calexport.js';

const H = 3600e3;
const NOW = new Date(2026, 10, 1, 12, 0).getTime(); // 1. Nov 2026, 12 Uhr
const all = defaultTypes(true);
const sub = (uid, extra = {}) => ({ uid, types: { ...all }, admin: false, ...extra });
const resp = (uid, extra = {}) => ({
  uid,
  name: uid.toUpperCase(),
  days: { '2026-11-07': { s: 0, e: 1440 } },
  rules: [],
  done: true,
  updatedAt: NOW - H,
  ...extra,
});
const plan = args => planNotifications({ now: NOW, site: 'https://x/', sent: new Set(), ...args });
const byType = (list, type) => list.filter(m => m.type === type);

suite('Benachrichtigungen planen', t => {
  t('neues Event: an alle, die noch nicht abgestimmt haben – nicht an Organisatoren', () => {
    const polls = [{ id: 'p', title: 'Kino', months: ['2026-11'], createdAt: NOW - H }];
    const m = byType(
      plan({ polls, responses: { p: [resp('anna')] }, subs: [sub('anna'), sub('ben'), sub('shy', { admin: true })] }),
      'new'
    );
    assert.eq(m.length, 1);
    assert.deep(m[0].to, ['ben']);
    assert.eq(m[0].url, 'https://x/#/p/p');
  });
  t('alte Events lösen kein „neu“ aus', () => {
    const polls = [{ id: 'p', months: ['2026-11'], createdAt: NOW - 10 * 24 * H }];
    assert.eq(byType(plan({ polls, subs: [sub('ben')] }), 'new').length, 0);
  });
  t('Termin steht: an alle Beteiligten, nur einmal', () => {
    const polls = [{ id: 'p', title: 'Kino', months: ['2026-11'], final: { date: '2026-11-07', s: 1080, e: 1440 } }];
    const args = { polls, responses: { p: [resp('anna')] }, subs: [sub('anna'), sub('ben')] };
    const m = byType(plan(args), 'final');
    assert.deep(m[0].to, ['anna'], 'Ben hat nicht abgestimmt');
    assert.includes(m[0].body, '18:00');
    assert.eq(byType(plan({ ...args, sent: new Set([m[0].key]) }), 'final').length, 0, 'schon verschickt');
  });
  t('geänderter Termin = neue Nachricht', () => {
    const p = { id: 'p', months: ['2026-11'], final: { date: '2026-11-07', s: 0, e: 1440 } };
    const k1 = byType(plan({ polls: [p], subs: [] }), 'final')[0].key;
    const k2 = byType(plan({ polls: [{ ...p, final: { date: '2026-11-08', s: 0, e: 1440 } }], subs: [] }), 'final')[0]
      .key;
    assert.ok(k1 !== k2);
  });
  t('Frist: nur wer noch nicht fertig ist, nur in den letzten 24 Stunden', () => {
    const polls = [{ id: 'p', months: ['2026-11'], closesAt: NOW + 5 * H }];
    const responses = { p: [resp('anna'), resp('ben', { done: false })] };
    const m = byType(plan({ polls, responses, subs: [sub('anna'), sub('ben'), sub('cem')] }), 'deadline');
    assert.deep(m[0].to, ['ben', 'cem']);
    assert.eq(
      byType(plan({ polls: [{ ...polls[0], closesAt: NOW + 48 * H }], responses, subs: [sub('ben')] }), 'deadline')
        .length,
      0
    );
  });
  t('Erinnerung am Tag vorher – nicht an wer abgesagt hat', () => {
    const polls = [{ id: 'p', months: ['2026-11'], final: { date: '2026-11-02', s: 1080, e: 1440 } }];
    const responses = { p: [resp('anna'), resp('ben', { cancel: { date: '2026-11-02', at: 1 } })] };
    const m = byType(plan({ polls, responses, subs: [sub('anna'), sub('ben')] }), 'before');
    assert.deep(m[0].to, ['anna']);
  });
  t('nur gewählte Arten', () => {
    const polls = [{ id: 'p', months: ['2026-11'], final: { date: '2026-11-07', s: 0, e: 1440 } }];
    const m = byType(
      plan({ polls, responses: { p: [resp('anna')] }, subs: [sub('anna', { types: { final: false } })] }),
      'final'
    );
    assert.deep(m[0].to, [], 'abgewählt');
  });
  t('Teilnehmerliste: Außenstehende bekommen nichts', () => {
    const polls = [
      { id: 'p', months: ['2026-11'], createdAt: NOW, restricted: true, participants: { ben: { on: true } } },
    ];
    const m = byType(plan({ polls, subs: [sub('ben'), sub('cem')] }), 'new');
    assert.deep(m[0].to, ['ben']);
  });
  t('Organisatoren: fertig, alle fertig, Anfrage, Absage', () => {
    const polls = [
      { id: 'p', title: 'Kino', months: ['2026-11'], expected: 1, final: { date: '2026-11-07', s: 0, e: 1440 } },
    ];
    const responses = { p: [resp('anna', { cancel: { date: '2026-11-07', at: 5, reason: 'sick' } })] };
    const requests = { p: [{ uid: 'emil', name: 'Emil', at: 3 }] };
    const out = plan({ polls, responses, requests, subs: [sub('shy', { admin: true }), sub('anna')] });
    for (const type of ['o-votes', 'o-requests', 'o-cancel']) {
      const m = byType(out, type);
      assert.ok(m.length, type);
      assert.ok(
        m.every(x => x.to.join() === 'shy'),
        type + ' nur an Organisator'
      );
      assert.includes(m[0].url, '#/r/p');
    }
    assert.ok(byType(out, 'o-votes').some(m => m.title.includes('Alle haben abgestimmt')));
  });
  t('Kanal vorhanden?', () => {
    assert.no(hasChannel({ types: {} }));
    assert.ok(hasChannel({ discord: { id: '1' } }));
    assert.ok(hasChannel({ push: [{ endpoint: 'x' }] }));
  });
});

suite('Kalender-Abo', t => {
  const polls = [
    { id: 'a', title: 'Kino', months: ['2026-11'], final: { date: '2026-11-07', s: 1080, e: 1440 } },
    { id: 'b', title: 'Bowling', months: ['2026-11'], final: { date: '2026-11-14', s: 0, e: 1440 } },
    { id: 'c', title: 'Grillen', months: ['2026-11'], closesAt: Date.now() + 3 * 24 * H },
  ];
  const responses = {
    a: [resp('anna')],
    b: [resp('anna', { cancel: { date: '2026-11-14', at: 1 } })],
    c: [resp('anna', { done: false })],
  };
  t('nur eigene Termine, ohne Absagen', () => {
    const e = calendarEntries({ uid: 'anna', polls, responses });
    assert.deep(
      e.map(x => x.title),
      ['Kino']
    );
    assert.eq(calendarEntries({ uid: 'ben', polls, responses }).length, 0, 'Ben war nirgends dabei');
  });
  t('auf Wunsch mit Abstimmungsfristen', () => {
    const e = calendarEntries({ uid: 'anna', polls, responses, withDeadlines: true });
    assert.ok(e.some(x => x.title.includes('Grillen')));
  });
  t('.ics-Datei mit Name und mehreren Einträgen', () => {
    const ics = icsFeed(calendarEntries({ uid: 'anna', polls, responses, withDeadlines: true }), {
      name: 'Treffpunkt',
    });
    assert.includes(ics, 'X-WR-CALNAME:Treffpunkt');
    assert.eq(ics.split('BEGIN:VEVENT').length - 1, 2);
    assert.includes(ics, 'DTSTART:20261107T180000');
  });
});

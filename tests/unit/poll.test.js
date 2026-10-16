import { suite, assert } from '../lib/mini-test.js';
import {
  pollDays,
  inPoll,
  pollMonths,
  pollClosed,
  isParticipant,
  partList,
  isStale,
  countsAsDone,
  normResp,
  groupSize,
  addRangeToForm,
  maybeLimit,
  addedOk,
} from '../../js/core/poll.js';

suite('Event-Regeln', t => {
  t('Monate, ausgeschlossene Tage und Wochentage', () => {
    const p = { months: ['2026-11'], excluded: ['2026-11-07'], weekdays: [5, 6] };
    const days = pollDays(p);
    assert.eq(days.length, 8, '9 Wochenendtage im Nov 2026 minus 1');
    assert.no(days.includes('2026-11-07'), 'ausgeschlossen');
    assert.no(days.includes('2026-11-09'), 'Montag nicht erlaubt');
  });
  t('Zeitraum-Vorschläge zählen erst nach Bestätigung', () => {
    const p = {
      months: ['2026-11'],
      added: {
        u1: { from: '2026-12-01', to: '2026-12-14', ok: false },
        u2: { from: '2027-01-02', to: '2027-01-03', ok: true },
      },
    };
    assert.no(inPoll(p, '2026-12-05'), 'unbestätigt');
    assert.ok(inPoll(p, '2027-01-02'), 'bestätigt');
    assert.no(inPoll(p, '2027-01-04'), 'außerhalb des Zeitraums');
    assert.deep(pollMonths(p), ['2026-11', '2027-01']);
    assert.eq(addedOk(p).length, 1);
  });
  t('geschlossen: Schalter oder Frist', () => {
    assert.ok(pollClosed({ closed: true }));
    assert.ok(pollClosed({ closesAt: Date.now() - 1000 }));
    assert.no(pollClosed({ closesAt: Date.now() + 60000 }));
    assert.no(pollClosed({}));
  });
  t('Teilnehmerliste', () => {
    const p = { restricted: true, participants: { a: { on: true, name: 'Anna' }, b: { on: false, name: 'Ben' } } };
    assert.ok(isParticipant(p, 'a'));
    assert.no(isParticipant(p, 'b'));
    assert.no(isParticipant(p, 'x'));
    assert.ok(isParticipant({}, 'x'), 'ohne Liste dürfen alle');
    assert.eq(partList(p).length, 1);
    assert.eq(groupSize(p), 1);
    assert.eq(groupSize({ expected: 6 }), 6);
  });
  t('veraltete Antworten nach neuer Runde oder neuen Tagen', () => {
    const p = { reopenedAt: 2000, added: { me: { from: '2026-12-01', to: '2026-12-02', ok: true, at: 5000 } } };
    assert.ok(isStale(p, { uid: 'x', updatedAt: 1000, done: true }), 'vor neuer Runde');
    assert.no(isStale(p, { uid: 'x', updatedAt: 6000 }), 'danach');
    assert.no(isStale(p, { uid: 'me', updatedAt: 3000 }), 'eigener Vorschlag macht nicht veraltet');
    assert.ok(isStale(p, { uid: 'x', updatedAt: 3000 }), 'Vorschlag anderer macht veraltet');
    assert.no(countsAsDone(p, { uid: 'x', updatedAt: 1000, done: true }));
  });
  t('normResp räumt auf', () => {
    const r = normResp({
      name: 'A',
      favs: ['2026-10-17', 'kaputt', '2026-10-18', '2026-10-19', '2026-10-20'],
      rules: [null, { wd: [1] }],
      base: 'egal',
    });
    assert.deep(r.favs, ['2026-10-17', '2026-10-18', '2026-10-19']);
    assert.eq(r.rules.length, 1);
    assert.eq(r.base, 'none');
    assert.eq(r.v, 2);
  });
  t('Vielleicht-Limit', () => {
    assert.eq(maybeLimit({}), 4);
    assert.eq(maybeLimit({ maybeLimit: 0 }), 0);
  });
  t('Zeitraum ins Formular übernehmen', () => {
    const f = { months: ['2026-11'], excluded: ['2026-11-20'] };
    addRangeToForm(f, '2026-11-15', '2026-12-03');
    assert.deep(f.months, ['2026-11', '2026-12']);
    assert.no(f.excluded.includes('2026-11-20'), 'im Zeitraum wieder eingeschlossen');
    assert.ok(f.excluded.includes('2026-12-04'), 'neuer Monat nur im Zeitraum');
    assert.no(f.excluded.includes('2026-12-02'));
  });
});

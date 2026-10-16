import { suite, assert } from '../lib/mini-test.js';
import { computeResultsFor } from '../../js/core/results.js';

const poll = { id: 'p', months: ['2026-11'] };
const F = { minPeople: 2, minHours: 0, onlyDone: false, inclMaybe: false, sortFav: false };
const r = (uid, days, extra = {}) => ({
  uid,
  name: uid,
  base: 'none',
  rules: [],
  done: true,
  updatedAt: 1,
  days,
  favs: [],
  ...extra,
});
const ALL = { s: 0, e: 1440 };

suite('Auswertung', t => {
  const resps = [
    r('anna', { '2026-11-07': ALL, '2026-11-08': ALL, '2026-11-14': { s: 1080, e: 1440 } }),
    r('ben', { '2026-11-07': ALL, '2026-11-14': ALL }),
    r('cem', { '2026-11-07': { s: 840, e: 1440 }, '2026-11-08': ALL, '2026-11-14': ALL }),
  ];
  t('bester Tag = die meisten Personen', () => {
    const R = computeResultsFor({ poll, responses: resps, filters: F, today: '2026-11-01', myUid: null });
    assert.eq(R.ranked[0].ds, '2026-11-07');
    assert.eq(R.ranked[0].score, 3);
    assert.deep([R.ranked[0].main.s, R.ranked[0].main.e], [840, 1440]);
  });
  t('längere gemeinsame Zeit gewinnt bei Gleichstand', () => {
    const R = computeResultsFor({ poll, responses: resps, filters: F, today: '2026-11-01', myUid: null });
    assert.eq(R.ranked[1].ds, '2026-11-14', '3 Personen ab 18 Uhr');
    assert.eq(R.ranked[2].ds, '2026-11-08', '2 Personen ganztägig');
  });
  t('Filter: mindestens Stunden', () => {
    const R = computeResultsFor({
      poll,
      responses: resps,
      filters: { ...F, minPeople: 3, minHours: 10 },
      today: '2026-11-01',
      myUid: null,
    });
    assert.deep(
      R.ranked.map(d => d.ds),
      ['2026-11-07']
    );
  });
  t('vergangene Tage zählen nicht', () => {
    const R = computeResultsFor({ poll, responses: resps, filters: F, today: '2026-11-10', myUid: null });
    assert.no(R.ranked.some(d => d.ds < '2026-11-10'));
  });
  t('Top 3 sortieren', () => {
    const withFavs = [
      r('anna', { '2026-11-07': ALL, '2026-11-08': ALL }, { favs: ['2026-11-08'] }),
      r('ben', { '2026-11-07': ALL, '2026-11-08': ALL }, { favs: ['2026-11-08', '2026-11-07'] }),
    ];
    const R1 = computeResultsFor({
      poll,
      responses: withFavs,
      filters: { ...F, sortFav: true },
      today: '2026-11-01',
      myUid: null,
    });
    assert.eq(R1.ranked[0].ds, '2026-11-08');
    assert.eq(R1.ranked[0].favPts, 6, 'zweimal Platz 1');
  });
  t('Vielleicht getrennt zählen', () => {
    const m = [
      r('anna', { '2026-11-21': ALL }),
      r('ben', { '2026-11-21': ALL }),
      r('cem', { '2026-11-21': { ...ALL, m: 1 } }),
    ];
    const R = computeResultsFor({ poll, responses: m, filters: F, today: '2026-11-01', myUid: null });
    assert.eq(R.ranked[0].score, 2);
    assert.eq(R.ranked[0].maybeIn.length, 1);
  });
  t('Teilnehmerliste: Außenstehende zählen nicht', () => {
    const p = { ...poll, restricted: true, participants: { anna: { on: true }, ben: { on: true } } };
    const R = computeResultsFor({ poll: p, responses: resps, filters: F, today: '2026-11-01', myUid: null });
    assert.eq(R.n, 2);
    assert.deep(
      R.outsiders.map(x => x.uid),
      ['cem']
    );
  });
});

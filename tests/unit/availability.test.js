import { suite, assert } from '../lib/mini-test.js';
import {
  effective,
  dayOverlap,
  bestRun,
  ivLabel,
  ivText,
  norm,
  subtract,
  eqDay,
  sameRule,
} from '../../js/core/availability.js';

// 2026-10-16 ist ein Freitag (wd 4), 2026-10-17 ein Samstag (wd 5)
const FR = '2026-10-16',
  SA = '2026-10-17';
const person = (uid, extra = {}) => ({ uid, name: uid, base: 'none', days: {}, rules: [], ...extra });

suite('Verfügbarkeit', t => {
  t('Intervalle zusammenfassen und abziehen', () => {
    assert.deep(
      norm([
        [600, 720],
        [700, 900],
        [1000, 1100],
      ]),
      [
        [600, 900],
        [1000, 1100],
      ]
    );
    assert.deep(subtract([[0, 1440]], [1020, 1260]), [
      [0, 1020],
      [1260, 1440],
    ]);
  });
  t('einzeln gesetzter Tag', () => {
    const r = person('a', { days: { [SA]: { s: 780, e: 1440 } } });
    assert.deep(effective(r, SA), { iv: [[780, 1440]], explicit: true, maybe: false });
    assert.deep(effective(r, FR).iv, [], 'nicht markiert = kann nicht');
  });
  t('„kann meistens“ minus Wiederholung', () => {
    const r = person('b', { base: 'all', rules: [{ kind: 'no', wd: [4], s: 1020, e: 1260 }] });
    assert.deep(effective(r, FR).iv, [
      [0, 1020],
      [1260, 1440],
    ]);
    assert.deep(effective(r, SA).iv, [[0, 1440]]);
  });
  t('„kann“-Wiederholung', () => {
    const r = person('c', { rules: [{ kind: 'yes', wd: [5], s: 780, e: null }] });
    assert.deep(effective(r, SA).iv, [[780, 1440]]);
  });
  t('einzelner Tag hat Vorrang vor Wiederholung', () => {
    const r = person('d', {
      base: 'all',
      rules: [{ kind: 'no', wd: [4], s: null, e: null }],
      days: { [FR]: { s: 0, e: 1440 } },
    });
    assert.deep(effective(r, FR).iv, [[0, 1440]]);
  });
  t('Vielleicht und „kann nicht“', () => {
    const r = person('e', { base: 'all', days: { [FR]: { s: 1080, e: 1440, m: 1 }, [SA]: { n: 1 } } });
    assert.ok(effective(r, FR).maybe);
    assert.deep(effective(r, SA).iv, []);
  });
  t('Überschneidung mehrerer Personen', () => {
    const a = person('a', { days: { [SA]: { s: 600, e: 1260 } } });
    const b = person('b', { days: { [SA]: { s: 840, e: 1440 } } });
    const c = person('c', { days: { [SA]: { s: 0, e: 1440, m: 1 } } });
    const o = dayOverlap([a, b, c], SA, false);
    assert.eq(o.max, 2, 'ohne Vielleicht');
    const run = bestRun(o.segs, 2);
    assert.deep([run.s, run.e, run.len], [840, 1260, 420]);
    assert.eq(dayOverlap([a, b, c], SA, true).max, 3, 'mit Vielleicht');
  });
  t('bestRun ohne Treffer', () => {
    const o = dayOverlap([person('a')], SA, false);
    assert.eq(bestRun(o.segs, 1), null);
  });
  t('Beschriftungen', () => {
    assert.eq(ivLabel([[0, 1440]]), 'ganz');
    assert.eq(ivLabel([[1080, 1440]]), 'ab 18');
    assert.eq(ivLabel([[0, 720]]), 'bis 12');
    assert.eq(ivText([[780, 1080]][0]), '13:00–18:00');
  });
  t('Vergleiche', () => {
    assert.ok(eqDay({ s: 0, e: 1440 }, { e: 1440, s: 0 }));
    assert.no(eqDay({ s: 0, e: 1440 }, { s: 0, e: 1440, m: 1 }));
    assert.ok(sameRule({ kind: 'no', wd: [4, 1], s: 1, e: 2 }, { kind: 'no', wd: [1, 4], s: 1, e: 2 }));
  });
});

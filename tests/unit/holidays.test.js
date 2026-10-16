import { suite, assert } from '../lib/mini-test.js';
import { FERIEN_UNTIL, easter, holiday, ferien } from '../../js/core/holidays.js';
import { toYmd } from '../../js/core/dates.js';

suite('Feiertage & Ferien NRW', t => {
  t('Ostersonntag (Gauß)', () => {
    assert.eq(toYmd(easter(2026)), '2026-04-05');
    assert.eq(toYmd(easter(2027)), '2027-03-28');
    assert.eq(toYmd(easter(2028)), '2028-04-16');
  });
  t('bewegliche Feiertage', () => {
    assert.eq(holiday('2026-06-04').name, 'Fronleichnam');
    assert.eq(holiday('2026-05-14').name, 'Christi Himmelfahrt');
    assert.eq(holiday('2027-02-08').name, 'Rosenmontag');
    assert.no(holiday('2027-02-08').legal, 'Rosenmontag ist kein gesetzlicher Feiertag');
  });
  t('feste Feiertage', () => {
    assert.eq(holiday('2026-10-03').name, 'Tag der Deutschen Einheit');
    assert.ok(holiday('2026-11-01').legal, 'Allerheiligen ist Feiertag in NRW');
    assert.eq(holiday('2026-11-11').emoji, '🎭');
    assert.eq(holiday('2026-10-20'), null);
  });
  t('Schulferien', () => {
    assert.eq(ferien('2026-10-20'), 'Herbstferien');
    assert.eq(ferien('2027-01-06'), 'Weihnachtsferien');
    assert.eq(ferien('2026-11-05'), null);
  });
  t('Ferientabelle reicht noch mindestens ein Jahr (sonst: neue Ferien eintragen)', () => {
    const inOneYear = new Date();
    inOneYear.setFullYear(inOneYear.getFullYear() + 1);
    const limit = inOneYear.toISOString().slice(0, 10);
    assert.ok(FERIEN_UNTIL >= limit, `Ferien nur bis ${FERIEN_UNTIL} eingetragen – bitte js/core/holidays.js ergänzen`);
  });
  t('Ferien 2029/30', () => {
    assert.eq(ferien('2029-12-24'), 'Weihnachtsferien');
    assert.eq(ferien('2030-04-20'), 'Osterferien');
    assert.eq(ferien('2030-07-01'), 'Sommerferien');
    assert.eq(ferien('2030-09-01'), null);
  });
});

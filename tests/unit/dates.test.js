import { suite, assert } from '../lib/mini-test.js';
import {
  ymd,
  parseYmd,
  toYmd,
  wdIdx,
  minStr,
  minShort,
  strMin,
  daysOfMonths,
  monthsBetween,
  rangeText,
  deadlineFrom,
  deadlineText,
  isoWeek,
  durStr,
  fmtDate,
  monthsLabel,
} from '../../js/core/dates.js';

suite('Datum & Zeit', t => {
  t('ymd ↔ parseYmd ↔ toYmd', () => {
    assert.eq(ymd(2026, 3, 7), '2026-03-07');
    assert.eq(toYmd(parseYmd('2026-12-31')), '2026-12-31');
  });
  t('wdIdx: 0 = Montag, 6 = Sonntag', () => {
    assert.eq(wdIdx('2026-10-19'), 0);
    assert.eq(wdIdx('2026-10-25'), 6);
  });
  t('Minuten ↔ Uhrzeit', () => {
    assert.eq(minStr(0), '00:00');
    assert.eq(minStr(1110), '18:30');
    assert.eq(minStr(1440), '24:00');
    assert.eq(minShort(1080), '18');
    assert.eq(minShort(1110), '18:30');
    assert.eq(strMin('18:30'), 1110);
    assert.eq(strMin(''), null);
  });
  t('daysOfMonths zählt Schaltjahre richtig', () => {
    assert.eq(daysOfMonths(['2026-02']).length, 28);
    assert.eq(daysOfMonths(['2028-02']).length, 29);
    assert.eq(daysOfMonths(['2026-11', '2026-10'])[0], '2026-10-01', 'sortiert');
  });
  t('monthsBetween über den Jahreswechsel', () => {
    assert.deep(monthsBetween('2026-11-15', '2027-02-01'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  });
  t('rangeText', () => {
    assert.eq(rangeText('2026-12-01', '2026-12-14'), '1. Dez – 14. Dez 2026');
    assert.eq(rangeText('2026-12-20', '2027-01-03'), '20. Dez 2026 – 3. Jan 2027');
  });
  t('Frist ohne Uhrzeit endet um 24 Uhr', () => {
    const ms = deadlineFrom('2026-11-16', '');
    assert.eq(toYmd(new Date(ms)), '2026-11-17');
    assert.eq(new Date(ms).getHours(), 0);
    assert.ok(deadlineText(ms).includes('24:00'), 'Text zeigt 24:00');
    assert.ok(deadlineText(ms).startsWith('Mo, 16.'), 'Text zeigt den 16.');
  });
  t('Frist mit Uhrzeit', () => {
    const d = new Date(deadlineFrom('2026-11-16', '18:30'));
    assert.eq(d.getHours(), 18);
    assert.eq(d.getMinutes(), 30);
  });
  t('ISO-Kalenderwoche', () => {
    assert.eq(isoWeek(parseYmd('2026-01-01')), 1);
    assert.eq(isoWeek(parseYmd('2026-12-31')), 53);
    assert.eq(isoWeek(parseYmd('2027-01-04')), 1);
  });
  t('Texte', () => {
    assert.eq(durStr(90), '1 Std. 30 Min.');
    assert.eq(fmtDate('2026-10-17'), 'Sa, 17. Okt');
    assert.eq(monthsLabel(['2026-11', '2026-10']), 'Oktober 2026, November 2026');
  });
});

/* Monatskalender und Feiertags-Hinweise (gemeinsam für Abstimmen und Auswertung). */
import { TODAY } from '../app/state.js';
import { feat } from '../app/prefs.js';
import { MONTHS, MONTHS_S, WD_LONG, WD_SHORT, parseYmd, ymd } from '../core/dates.js';
import { FERIEN, ferien, holiday, holidaysOf } from '../core/holidays.js';

export function monthNotes(k) {
  if (!feat('cal')) return '';
  const [y, m] = k.split('-').map(Number);
  const first = ymd(y, m, 1),
    last = ymd(y, m, new Date(y, m, 0).getDate());
  const items = [];
  for (const [s, v] of Object.entries(holidaysOf(y)))
    if (s >= first && s <= last)
      items.push({
        s,
        html: `${v.emoji ? `<span>${v.emoji} </span>` : `<span class="${v.legal ? 'h' : ''}">● </span>`}<b>${parseYmd(s).getDate()}.</b> ${v.name}${v.legal ? '' : ' <span class="muted">(kein Feiertag)</span>'}`,
      });
  for (const [a, b, n] of FERIEN)
    if (a <= last && b >= first) {
      const da = parseYmd(a),
        db = parseYmd(b);
      const txt =
        a === b
          ? `${da.getDate()}. ${MONTHS_S[da.getMonth()]}`
          : `${da.getDate()}. ${MONTHS_S[da.getMonth()]} – ${db.getDate()}. ${MONTHS_S[db.getMonth()]}`;
      items.push({
        s: a < first ? first : a,
        html: `<span style="color:var(--ferien)">▬ </span><b>${txt}</b> ${n} (Schulferien NRW)`,
      });
    }
  items.sort((p, q) => p.s.localeCompare(q.s));
  return items.length ? `<div class="notes">${items.map(i => `<span>${i.html}</span>`).join('')}</div>` : '';
}
export function monthGrid(k, cellFn, headSelect) {
  const [y, m] = k.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7,
    n = new Date(y, m, 0).getDate();
  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<div class="cell blank" aria-hidden="true"></div>`;
  for (let d = 1; d <= n; d++) cells += cellFn(ymd(y, m, d));
  const head = WD_SHORT.map((w, i) =>
    headSelect
      ? `<button data-act="wk-sel" data-m="${k}" data-v="${i}" aria-label="Alle ${WD_LONG[i]}e im ${MONTHS[m - 1]} auswählen">${w}</button>`
      : `<span>${w}</span>`
  ).join('');
  return `<section class="month"><h3>${MONTHS[m - 1]} ${y}</h3><div class="wk" ${headSelect ? '' : 'aria-hidden="true"'}>${head}</div><div class="grid">${cells}</div>${monthNotes(k)}</section>`;
}
export function dayDecor(ds) {
  const showCal = feat('cal'),
    hol = showCal ? holiday(ds) : null,
    fer = showCal ? ferien(ds) : null;
  let cls = '',
    extra = '',
    title = [];
  if (hol) {
    extra += hol.emoji
      ? `<i class="emo" aria-hidden="true">${hol.emoji}</i>`
      : `<i class="hd ${hol.legal ? '' : 'soft'}"></i>`;
    if (hol.legal) cls += ' isholiday';
    title.push(hol.name);
  }
  if (fer) {
    cls += ' fer';
    title.push(fer);
  }
  if (ds === TODAY) cls += ' today';
  return { cls, extra, title: title.join(' · ') };
}

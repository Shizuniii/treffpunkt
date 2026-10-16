/* Verfügbarkeit: wann kann eine Person an einem Tag, Überschneidungen mehrerer Personen. Rein, ohne DOM. */
import { minShort, minStr, wdIdx } from './dates.js';

export function norm(iv) {
  const a = iv
    .filter(([s, e]) => e > s)
    .map(x => [...x])
    .sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const x of a) {
    const l = out[out.length - 1];
    if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]);
    else out.push(x);
  }
  return out;
}
export function subtract(iv, [s, e]) {
  const out = [];
  for (const [x, y] of iv) {
    if (y <= s || x >= e) out.push([x, y]);
    else {
      if (x < s) out.push([x, s]);
      if (y > e) out.push([e, y]);
    }
  }
  return out;
}
export const ruleRange = r => [r.s ?? 0, r.e ?? 1440];
/** Wann kann Person r am Tag ds? Einzelne Tage haben Vorrang vor Wiederholungen. */
export function effective(r, ds) {
  const d = r && r.days && r.days[ds];
  if (d) return { iv: d.n ? [] : [[d.s ?? 0, d.e ?? 1440]], explicit: true, maybe: !d.n && !!d.m };
  const wd = wdIdx(ds);
  let iv = r && r.base === 'all' ? [[0, 1440]] : [];
  const rules = (r && r.rules) || [];
  for (const x of rules) if (x.kind === 'yes' && (x.wd || []).includes(wd)) iv = norm([...iv, ruleRange(x)]);
  for (const x of rules) if (x.kind === 'no' && (x.wd || []).includes(wd)) iv = subtract(iv, ruleRange(x));
  return { iv: norm(iv), explicit: false, maybe: false };
}
export const isAllDay = iv => iv.length === 1 && iv[0][0] === 0 && iv[0][1] === 1440;
export function ivLabel(iv) {
  if (!iv.length) return '';
  if (isAllDay(iv)) return 'ganz';
  const one = ([s, e]) =>
    s === 0 ? `bis ${minShort(e)}` : e === 1440 ? `ab ${minShort(s)}` : `${minShort(s)}–${minShort(e)}`;
  return iv.length === 1 ? one(iv[0]) : one(iv[0]) + ' +';
}
export const ivText = ([s, e]) =>
  s === 0 && e === 1440
    ? 'ganztägig'
    : s === 0
      ? `bis ${minStr(e)}`
      : e === 1440
        ? `ab ${minStr(s)}`
        : `${minStr(s)}–${minStr(e)}`;
export const covers = (iv, s, e) => iv.some(([a, b]) => a <= s && b >= e);
/** Zerlegt einen Tag in Abschnitte mit der Menge der verfügbaren Personen. */
export function dayOverlap(resps, ds, inclMaybe) {
  const per = resps.map(r => {
    const ef = effective(r, ds);
    return { r, iv: ef.iv, maybe: ef.maybe };
  });
  const counted = inclMaybe ? per : per.filter(p => !p.maybe);
  const pts = new Set([0, 1440]);
  counted.forEach(p =>
    p.iv.forEach(([s, e]) => {
      pts.add(s);
      pts.add(e);
    })
  );
  const xs = [...pts].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const s = xs[i],
      e = xs[i + 1];
    const who = counted.filter(p => covers(p.iv, s, e)).map(p => p.r.uid);
    const l = segs[segs.length - 1];
    if (l && l.who.length === who.length && l.who.every((u, j) => u === who[j])) l.e = e;
    else segs.push({ s, e, who });
  }
  const max = segs.reduce((m, x) => Math.max(m, x.who.length), 0);
  return { per, segs, max };
}
/** Längster zusammenhängender Zeitraum, in dem mindestens k Personen können. */
export function bestRun(segs, k) {
  if (k <= 0) return null;
  let best = null,
    cur = null;
  for (const g of segs) {
    if (g.who.length >= k) {
      if (cur && cur.e === g.s) {
        cur.e = g.e;
        cur.who = cur.who.filter(u => g.who.includes(u));
      } else cur = { s: g.s, e: g.e, who: [...g.who] };
      if (!best || cur.e - cur.s > best.e - best.s) best = { ...cur, who: [...cur.who] };
    } else cur = null;
  }
  if (best) best.len = best.e - best.s;
  return best;
}
export const eqDay = (a, b) =>
  !!a && !!b && !!a.n === !!b.n && (a.n || (a.s === b.s && a.e === b.e && !!a.m === !!b.m));
export const sameRule = (a, b) =>
  a.kind === b.kind &&
  (a.s ?? null) === (b.s ?? null) &&
  (a.e ?? null) === (b.e ?? null) &&
  [...a.wd].sort().join() === [...b.wd].sort().join();

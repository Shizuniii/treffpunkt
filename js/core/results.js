/* Auswertung (rein, ohne DOM). */
import { bestRun, covers, dayOverlap, effective } from './availability.js';
import {
  countsAsDone,
  groupSize,
  isParticipant,
  isRestricted,
  normResp,
  partList,
  pollClosed,
  pollDays,
} from './poll.js';

/** Standard-Filter der Auswertung (auch für den einfachen Überblick). */
export const DEFAULT_FILTERS = Object.freeze({
  minPeople: 2,
  minHours: 0,
  onlyDone: false,
  inclMaybe: false,
  sortFav: false,
});

/**
 * Auswertung als reine Funktion: aus Event + Antworten werden die besten Tage berechnet.
 * people = optionale Auswahl von Personen (uids). Ist sie gesetzt, zählen nur diese Personen –
 * so sieht der Organisator, was einzelne Personen eingetragen haben bzw. wann genau sie zusammen können.
 * Die Auswahl gilt auch für noch nicht fertige Antworten („nur fertige“ wird dafür ignoriert).
 * Unbekannte uids (z. B. aus einem anderen Event) werden still übergangen.
 */
export function computeResultsFor({ poll: p, responses, filters: F, today, myUid, people = [] }) {
  const named = responses.filter(r => (r.name || '').trim());
  const all = isRestricted(p) ? named.filter(r => isParticipant(p, r.uid) || r.pass || r.uid === myUid) : named;
  const outsiders = named.filter(r => !all.includes(r));
  const sel = (people || []).filter(uid => all.some(r => r.uid === uid));
  const resps = sel.length
    ? all.filter(r => sel.includes(r.uid))
    : F.onlyDone
      ? all.filter(r => countsAsDone(p, r))
      : all;
  const n = resps.length;
  const minP = Math.max(1, Math.min(F.minPeople, n || 1));
  const minLen = Math.max(F.minHours * 60, 1);
  const days = pollDays(p)
    .filter(d => d >= today)
    .map(ds => {
      const o = dayOverlap(resps, ds, F.inclMaybe);
      const tiers = [];
      for (let k = o.max; k >= 1; k--) {
        const run = bestRun(o.segs, k);
        if (run && (!tiers.length || run.len > tiers[tiers.length - 1].len)) tiers.push({ k, ...run });
      }
      const main = tiers.find(t => t.k >= minP && t.len >= minLen) || null;
      const maybeIn = main && !F.inclMaybe ? o.per.filter(x => x.maybe && covers(x.iv, main.s, main.e)) : [];
      const maybeAny = o.per.filter(x => x.maybe && x.iv.length).length;
      const fav = [];
      for (const r of resps) {
        const i = (r.favs || []).indexOf(ds);
        if (i >= 0 && i < 3 && effective(r, ds).iv.length) fav.push({ r, rank: i + 1 });
      }
      fav.sort((a, b) => a.rank - b.rank);
      const favPts = fav.reduce((t, x) => t + (4 - x.rank), 0);
      return { ds, ...o, tiers, main, score: main ? main.k : 0, maybeIn, maybeAny, fav, favPts };
    });
  const byAvail = (a, b) =>
    b.score - a.score ||
    b.maybeIn.length - a.maybeIn.length ||
    b.favPts - a.favPts ||
    b.main.len - a.main.len ||
    a.ds.localeCompare(b.ds);
  const ranked = days.filter(d => d.main).sort(F.sortFav ? (a, b) => b.favPts - a.favPts || byAvail(a, b) : byAvail);
  return { all, resps, n, days, ranked, minP, outsiders, sel };
}

/**
 * Kurzfassung eines Events für den einfachen Überblick des Organisators.
 * { done, expected, answered, missing[], waiting[], best, top[], closed }
 *   missing = wer noch fehlt (Namen von der Teilnehmerliste bzw. wer angefangen, aber nicht fertig ist)
 *   best    = bester Tag bisher { ds, s, e, k, n, maybe } oder null
 */
export function pollSummary({ poll, responses, today, filters = DEFAULT_FILTERS }) {
  const R = computeResultsFor({ poll, responses: responses.map(normResp), filters, today, myUid: null });
  const doneR = R.all.filter(r => countsAsDone(poll, r));
  const expected = groupSize(poll);
  const missing = isRestricted(poll)
    ? partList(poll)
        .filter(x => !doneR.some(r => r.uid === x.uid))
        .map(x => x.name || '?')
    : R.all.filter(r => !countsAsDone(poll, r)).map(r => r.name);
  const pick = d => d && { ds: d.ds, s: d.main.s, e: d.main.e, k: d.score, n: R.n, maybe: d.maybeIn.length };
  return {
    done: doneR.length,
    expected,
    answered: R.all.length,
    missing,
    best: pick(R.ranked[0]) || null,
    top: R.ranked.slice(0, 3).map(pick),
    closed: pollClosed(poll),
  };
}

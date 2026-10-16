/* Eigene Angaben aus anderen Events übernehmen. */
import { votable } from './access.js';
import { loadSeq } from './router.js';
import { pushUndo, scheduleSave } from './save.js';
import { B, S, TODAY, lsSet } from './state.js';
import { sameRule } from '../core/availability.js';
import { isEmptyResp, maybeLimit, normResp, pollDays } from '../core/poll.js';
import { clone, rid } from '../core/util.js';
import { toast } from '../ui/dom.js';
import { unlock } from '../ui/fun.js';
import { render } from '../ui/render.js';
import { maybeCount } from '../ui/vote.js';

/* ---------- Übernehmen aus anderen Events (nur eigene, private Daten) ---------- */
export async function loadCopyCands(seq) {
  const cur = S.poll || (await B.getPoll(S.route.id).catch(() => null));
  if (!cur || seq !== loadSeq) return;
  const curDays = new Set(pollDays(cur).filter(ds => ds >= TODAY));
  const mp = (S.member && S.member.polls) || {};
  const ids = [...new Set([...S.route.ids, ...Object.keys(mp).sort((a, b) => (mp[b].at || 0) - (mp[a].at || 0))])]
    .filter(x => x !== S.route.id)
    .slice(0, 12);
  const out = [];
  await Promise.all(
    ids.map(async pid => {
      try {
        const raw = pid in S.myAll ? S.myAll[pid] : await B.getMine(pid);
        if (!raw) return;
        const resp = normResp(raw);
        const p = S.pollsById[pid] || (await B.getPoll(pid));
        if (!p) return;
        const overlap = pollDays(p).filter(ds => curDays.has(ds));
        if (!overlap.length) return;
        const nDays = overlap.filter(ds => resp.days[ds]).length;
        if (!nDays && !resp.rules.length) return;
        out.push({
          pid,
          title: p.title || (mp[pid] && mp[pid].t) || 'Anderes Event',
          overlap,
          nDays,
          nRules: resp.rules.length,
          resp,
        });
      } catch (e) {
        console.warn(e);
      }
    })
  );
  if (seq !== loadSeq) return;
  S.copyCands = out.sort((a, b) => b.nDays - a.nDays);
  render();
}
export function copyFrom(pid) {
  const c = (S.copyCands || []).find(x => x.pid === pid);
  if (!c) return;
  pushUndo();
  const wasEmpty = isEmptyResp(S.my),
    lim = maybeLimit(S.poll);
  let used = maybeCount(),
    nd = 0,
    skipped = 0,
    nr = 0;
  for (const ds of c.overlap) {
    const src = c.resp.days[ds];
    if (!src || S.my.days[ds] || !votable(ds)) continue;
    if (src.m && !src.n) {
      if (used >= lim) {
        skipped++;
        continue;
      }
      used++;
    }
    S.my.days[ds] = clone(src);
    nd++;
  }
  for (const r of c.resp.rules)
    if (!S.my.rules.some(x => sameRule(x, r))) {
      S.my.rules.push({ ...clone(r), id: rid(6) });
      nr++;
    }
  if (wasEmpty) S.my.base = c.resp.base;
  if (!S.my.name.trim() && c.resp.name) S.my.name = c.resp.name;
  dismissCopy();
  S.sheet = null;
  scheduleSave();
  render();
  const parts = [`${nd} ${nd === 1 ? 'Tag' : 'Tage'}`];
  if (nr) parts.push(`${nr} ${nr === 1 ? 'Wiederholung' : 'Wiederholungen'}`);
  toast(`${parts.join(' und ')} übernommen${skipped ? ` (${skipped}× Vielleicht über dem Limit ausgelassen)` : ''}`, {
    act: 'undo',
    label: 'Rückgängig',
  });
  unlock('ctrlc');
}
export function dismissCopy() {
  S.copyDismissed = true;
  lsSet('tp-copy-' + S.route.id, '1');
}

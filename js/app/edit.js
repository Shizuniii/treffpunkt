/* Bearbeiten: Tage setzen, Mehrfachauswahl, Top 3, Formulare speichern. */
import { votable } from './access.js';
import { loadRoute } from './router.js';
import { flushSave, pushUndo, scheduleSave } from './save.js';
import { B, S, TODAY } from './state.js';
import { effective, eqDay } from '../core/availability.js';
import { daysOfMonths, parseYmd, strMin, wdIdx } from '../core/dates.js';
import { isEmptyResp, maybeLimit, pollDays, pollMonths } from '../core/poll.js';
import { clone, rid } from '../core/util.js';
import { $, toast } from '../ui/dom.js';
import { checkMaybeAch, confetti, unlock } from '../ui/fun.js';
import { partOn } from '../ui/home.js';
import { render } from '../ui/render.js';
import { renderSheet } from '../ui/sheets.js';
import { maybeCount, refreshAfterEdit, renderDock, updateCell, validFavs } from '../ui/vote.js';

export function toggleFav(ds) {
  const before = [...(S.my.favs || [])];
  S.my.favs = validFavs();
  const i = S.my.favs.indexOf(ds);
  if (i < 0 && !effective(S.my, ds).iv.length) {
    toast('Top 3 geht nur an Tagen, an denen du kannst. Trag den Tag zuerst ein.');
    return;
  }
  if (i < 0 && S.my.favs.length >= 3) {
    toast('Du hast schon 3 Favoriten. Entferne einen, um Platz zu machen.');
    return;
  }
  S.undo.push(JSON.stringify({ days: S.my.days, rules: S.my.rules, base: S.my.base, favs: before }));
  if (i >= 0) S.my.favs.splice(i, 1);
  else S.my.favs.push(ds);
  scheduleSave();
  [...new Set([...before, ...S.my.favs, ds])].forEach(updateCell);
  refreshAfterEdit();
  if (i < 0 && S.my.favs.length === 3) toast('Top 3 komplett ⭐ Mit ↑ ↓ änderst du die Reihenfolge.');
}
export function moveFav(i, dir) {
  const f = validFavs(),
    j = i + dir;
  if (j < 0 || j >= f.length) return;
  pushUndo();
  [f[i], f[j]] = [f[j], f[i]];
  S.my.favs = f;
  scheduleSave();
  f.forEach(updateCell);
  refreshAfterEdit();
}
/* ---------- Eintragen ---------- */
export function readBrush() {
  const s = $('#b-s'),
    en = $('#b-e');
  if (s) S.brush.s = s.value;
  if (en) S.brush.e = en.value;
}
export function readRuleForm() {
  const f = S.ruleForm;
  if (!f) return;
  const s = $('#rf-s'),
    en = $('#rf-e'),
    l = $('#rf-label');
  if (s) f.s = s.value;
  if (en) f.e = en.value;
  if (l) f.label = l.value;
}
export function readPollForm() {
  const f = S.editPoll;
  if (!f) return;
  const g = id => $('#' + id);
  if (g('pf-title')) f.title = g('pf-title').value;
  if (g('pf-desc')) f.description = g('pf-desc').value;
  if (g('pf-expected')) f.expected = g('pf-expected').value;
  if (g('pf-dl-date')) f.dlDate = g('pf-dl-date').value;
  if (g('pf-dl-time')) f.dlTime = g('pf-dl-time').value;
  if (g('pf-range-from')) f.rangeFrom = g('pf-range-from').value;
  if (g('pf-range-to')) f.rangeTo = g('pf-range-to').value;
}
export function brushTarget(mode) {
  readBrush();
  const b = S.brush;
  if (mode === 'all') return { s: 0, e: 1440 };
  if (mode === 'no') return { n: 1 };
  if (mode === 'auto') return null;
  const s = strMin(b.s),
    en = strMin(b.e);
  if (mode === 'time' && s == null && en == null) return { err: 'Wähle unten eine Uhrzeit (ab und/oder bis)' };
  const ss = s ?? 0,
    ee = en == null || en === 0 ? 1440 : en;
  if (ee <= ss) return { err: '„bis“ muss nach „ab“ liegen' };
  return mode === 'maybe' ? { s: ss, e: ee, m: 1 } : { s: ss, e: ee };
}
export function setDay(ds, target) {
  const days = S.my.days;
  if ((!target || target.n) && S.my.favs && S.my.favs.includes(ds)) S.my.favs = S.my.favs.filter(x => x !== ds); // Top 3 nur an Tagen, an denen man kann
  if (!target) {
    delete days[ds];
    return true;
  }
  if (target.m && !(days[ds] && days[ds].m && !days[ds].n) && maybeCount() >= maybeLimit(S.poll)) return false;
  days[ds] = { ...target };
  return true;
}
export function maybeLimitToast() {
  const lim = maybeLimit(S.poll);
  toast(
    `Schrödinger-Limit erreicht 🐈 Höchstens ${lim} Vielleicht-Tage. Entferne einen, um einen anderen zu setzen, damit nur die wahrscheinlichsten übrig bleiben.`
  );
}
export function onBrush(mode) {
  readBrush();
  if (!S.selMode) {
    S.brush.mode = mode;
    renderDock();
    return;
  }
  if (mode === 'time' || mode === 'maybe') {
    S.brush.pending = S.brush.pending === mode ? null : mode;
    renderDock();
    return;
  }
  S.brush.pending = null;
  applyToSel(mode);
}
export function applySingle(ds) {
  const t = brushTarget(S.brush.mode);
  if (t && t.err) {
    toast(t.err);
    return;
  }
  pushUndo();
  const cur = S.my.days[ds];
  if (!setDay(ds, !t || eqDay(cur, t) ? null : t)) {
    S.undo.pop();
    maybeLimitToast();
    return;
  }
  scheduleSave();
  updateCell(ds);
  refreshAfterEdit();
  checkMaybeAch();
}
export function setSel(ds, on) {
  on ? S.sel.add(ds) : S.sel.delete(ds);
  updateCell(ds);
}
export function toggleSel(ds) {
  setSel(ds, !S.sel.has(ds));
  renderDock();
}
export function votableDays() {
  return daysOfMonths(pollMonths(S.poll)).filter(votable);
}
export function selectWeekday(month, wd) {
  const list = votableDays().filter(ds => ds.startsWith(month) && wdIdx(ds) === wd);
  if (!list.length) {
    toast('Keine wählbaren Tage');
    return;
  }
  const allOn = list.every(ds => S.sel.has(ds));
  list.forEach(ds => setSel(ds, !allOn));
  renderDock();
}
export function quickSelect(kind) {
  if (kind === 'none') {
    [...S.sel].forEach(ds => setSel(ds, false));
    renderDock();
    return;
  }
  const f = {
    weekend: ds => wdIdx(ds) >= 5,
    weekdays: ds => wdIdx(ds) < 5,
    all: () => true,
    empty: ds => !S.my.days[ds],
  }[kind];
  const list = votableDays().filter(f);
  list.forEach(ds => setSel(ds, true));
  renderDock();
  if (!list.length) toast('Keine passenden Tage');
}
export function applyToSel(mode) {
  const sel = [...S.sel];
  if (!sel.length) {
    toast('Wähle zuerst Tage im Kalender aus');
    return;
  }
  const t = brushTarget(mode);
  if (t && t.err) {
    toast(t.err);
    return;
  }
  if (t && t.m) {
    const needed = sel.filter(ds => !(S.my.days[ds] && S.my.days[ds].m && !S.my.days[ds].n)).length;
    const free = maybeLimit(S.poll) - maybeCount();
    if (needed > free) {
      toast(
        `Nur noch ${Math.max(0, free)} Vielleicht-Tage frei. Wähle weniger Tage aus, nimm nur die wahrscheinlichsten.`
      );
      return;
    }
  }
  pushUndo();
  sel.forEach(ds => setDay(ds, t));
  S.sel = new Set();
  S.brush.pending = null;
  scheduleSave();
  render();
  if (mode === 'maybe') checkMaybeAch();
  const wk = votableDays().filter(ds => wdIdx(ds) >= 5);
  if ((mode === 'all' || mode === 'time') && wk.length >= 4 && wk.every(ds => sel.includes(ds))) unlock('weekend');
  const label = {
    all: 'ganztags',
    time: 'mit Uhrzeit',
    maybe: 'als vielleicht',
    no: 'als „kann nicht“',
    auto: 'zurückgesetzt',
  }[mode];
  toast(`${sel.length} ${sel.length === 1 ? 'Tag' : 'Tage'} ${mode === 'auto' ? label : label + ' eingetragen'}`, {
    act: 'undo',
    label: 'Rückgängig',
  });
}
export function saveRule() {
  readRuleForm();
  const f = S.ruleForm;
  if (!f.wd.length) {
    toast('Wähle mindestens einen Wochentag');
    return;
  }
  let s = null,
    e = null;
  if (!f.whole) {
    s = strMin(f.s);
    e = strMin(f.e);
    if (e === 0) e = 1440;
    if (s == null && e == null) {
      toast('Gib eine Uhrzeit an oder wähle „Ganztägig“');
      return;
    }
    if ((s ?? 0) >= (e ?? 1440)) {
      toast('„bis“ muss nach „ab“ liegen');
      return;
    }
  }
  pushUndo();
  S.my.rules.push({ id: rid(6), kind: f.kind, wd: [...f.wd].sort(), s, e, label: f.label.trim().slice(0, 40) });
  S.ruleForm = null;
  scheduleSave();
  render();
  unlock('routine');
}
export async function linkGoogle() {
  const pid = S.route.id,
    before = clone(S.my);
  flushSave();
  const res = await B.linkGoogle();
  if (res === 'redirect') return;
  if (res === 'switched') {
    // anderes (schon verknüpftes) Konto: Angaben von diesem Gerät mitnehmen, falls dort leer
    const mine = await B.getMine(pid);
    if (!mine && before && !isEmptyResp(before) && before.name.trim())
      await B.saveMine(pid, clone({ ...before, updatedAt: Date.now() }));
    toast('Mit deinem Google-Konto verbunden');
  } else toast('Verbunden. Du kannst jetzt auf jedem Gerät weitermachen.');
  loadRoute();
}
export async function savePollForm() {
  readPollForm();
  const f = S.editPoll;
  if (!f.title.trim()) {
    toast('Bitte einen Titel eingeben');
    $('#pf-title').focus();
    return;
  }
  if (!f.months.length) {
    toast('Wähle mindestens einen Monat');
    return;
  }
  let closesAt = null;
  if (f.dlOn) {
    if (!f.dlDate) {
      toast('Bitte ein Datum für die Frist wählen');
      return;
    }
    const d = parseYmd(f.dlDate);
    if (f.dlTime) {
      const m = strMin(f.dlTime);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    } else {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
    }
    closesAt = d.getTime();
    if (closesAt <= Date.now()) {
      toast('Die Frist liegt in der Vergangenheit');
      return;
    }
  }
  const exp = parseInt(f.expected, 10);
  if (f.restricted && !partOn(f)) {
    toast('Wähle mindestens eine Person für die Teilnehmerliste');
    return;
  }
  const months = [...f.months].sort();
  const data = {
    title: f.title.trim().slice(0, 80),
    description: f.description.trim().slice(0, 500),
    months,
    excluded: [...new Set(f.excluded)].filter(ds => months.includes(ds.slice(0, 7))).sort(),
    weekdays: f.weekdays.length >= 7 ? null : [...f.weekdays].sort(),
    maybeLimit: f.maybeLimit,
    closesAt,
    cancelRule: f.cancelRule !== false,
    addMode: f.addMode,
    restricted: !!f.restricted,
    participants: f.participants,
    expected: f.restricted ? partOn(f) : exp > 0 ? exp : null,
    updatedAt: Date.now(),
  };
  if (f.id) {
    const old = (S.polls || []).find(x => x.id === f.id);
    if (old) {
      const before = new Set(pollDays(old));
      if (pollDays({ ...old, ...data }).some(ds => ds >= TODAY && !before.has(ds))) data.expandedAt = Date.now();
    }
    await B.savePoll(f.id, data);
    S.editPoll = null;
    render();
    toast(
      data.expandedAt
        ? 'Gespeichert. Neue Tage: Deine Freunde sehen beim nächsten Öffnen einen Hinweis.'
        : 'Gespeichert'
    );
    return;
  }
  const id = rid(10);
  await B.savePoll(id, { ...data, added: {}, closed: false, final: null, createdAt: Date.now() });
  S.editPoll = null;
  render();
  S.sheet = { type: 'share', ids: [id] };
  renderSheet();
  toast('Event erstellt');
}
export async function setFinal(ds) {
  const s = strMin(($('#fx-s') || {}).value) ?? 0;
  let e = strMin(($('#fx-e') || {}).value);
  if (e == null || e === 0) e = 1440;
  if (e <= s) {
    toast('„bis“ muss nach „ab“ liegen');
    return;
  }
  const close = $('#fx-close') && $('#fx-close').checked;
  await B.savePoll(S.poll.id, { final: { date: ds, s, e }, ...(close && !S.poll.closed ? { closed: true } : {}) });
  S.sheet = null;
  render();
  toast('Termin gelockt 🔒 Deine Freunde sehen ihn jetzt.');
  confetti();
  unlock('gm');
}

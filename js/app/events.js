/* Alle Klicks und Eingaben laufen hier zusammen und werden an die passenden Funktionen verteilt.
   So funktioniert ein Knopf: Im HTML (js/ui/…) steht data-act="name" (optional data-v="wert", data-id="…"),
   hier steht der passende `case 'name':`. Neue Aktion = Knopf mit data-act + ein case hier;
   größere Logik gehört in js/app/edit.js (bzw. js/core/ wenn sie ohne Bildschirm auskommt). */
import { closedForMe } from './access.js';
import { applyPreset, setFeat } from './prefs.js';
import { FEATURES } from '../core/features.js';
import { copyFrom, dismissCopy } from './copy.js';
import {
  applySingle,
  applyToSel,
  brushTarget,
  linkGoogle,
  maybeLimitToast,
  moveFav,
  onBrush,
  quickSelect,
  readBrush,
  readPollForm,
  readRuleForm,
  savePollForm,
  saveRule,
  selectWeekday,
  setDay,
  setFinal,
  setSel,
  toggleFav,
  toggleSel,
} from './edit.js';
import {
  addAdmin,
  deleteTemplate,
  leaveAdmins,
  removeAdmin,
  reusePoll,
  saveTemplate,
  transferLead,
  useTemplate,
} from './organize.js';
import { go, loadRoute } from './router.js';
import { pushUndo, scheduleSave, undo } from './save.js';
import { B, S, TODAY, installEvt, lsSet, setInstallEvt } from './state.js';
import { eqDay } from '../core/availability.js';
import { daysOfMonths, rangeText, wdIdx, ymd } from '../core/dates.js';
import { addRangeToForm, isStale } from '../core/poll.js';
import { esc } from '../core/util.js';
import { accountMode, accountSignOut, accountSubmit, openAccountSheet, togglePasswordVisible } from '../ui/account.js';
import { sendCancel } from '../ui/cancel.js';
import { notifyActions, notifyCalDeadlines, notifyTypeChanged, openNotify } from '../ui/notify.js';
import { $, copyText, downloadIcs, toast } from '../ui/dom.js';
import { createPass, extendGroup, extendPerson } from '../ui/extend.js';
import { checkMaybeAch, confetti, diceCands, doneFx, konamiKey, rollDice, verTap } from '../ui/fun.js';
import { helpBody, markNewsSeen, showMe } from '../ui/help.js';
import { partOn, pollToForm } from '../ui/home.js';
import { doReopen, sendProposal } from '../ui/period.js';
import { render } from '../ui/render.js';
import { computeResults } from '../ui/results.js';
import { renderSheet, trapTab } from '../ui/sheets.js';
import { noDaysAtAll, refreshAfterEdit, renderDock, updateCell, validFavs } from '../ui/vote.js';

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act,
    v = el.dataset.v;
  if (act === 'close-sheet') {
    if (el.classList.contains('scrim') && e.target !== el) return;
    S.sheet = null;
    renderSheet();
    return;
  }
  if (act === 'day' && suppressClick) return;
  try {
    switch (act) {
      // ---- Demo & Anmeldung ----
      case 'demo-role':
        S.demoRole = v;
        if (v === 'participant' && S.route.name !== 'vote') go('#/p/demo1,demo2');
        else loadRoute();
        break;
      case 'demo-reset':
        B.reset();
        S.demoRole = 'owner';
        lsSet('tp-copy-demo1', '');
        lsSet('tp-copy-demo2', '');
        go('#/');
        toast('Demo zurückgesetzt');
        break;
      case 'reload':
        location.reload();
        break;
      case 'install':
        if (installEvt) {
          installEvt.prompt();
          setInstallEvt(null);
          render();
        }
        break;
      case 'signin':
        await B.signInOwner();
        break;
      case 'signout':
        await B.signOut();
        go('#/');
        break;
      case 'link-google':
        await linkGoogle();
        break;
      case 'notify-open':
        await openNotify();
        break;
      case 'nf-discord':
      case 'nf-discord-off':
      case 'nf-push':
      case 'nf-push-off':
      case 'nf-cal':
      case 'nf-cal-off':
        await notifyActions[act]();
        break;
      case 'acc-open':
        openAccountSheet(v);
        break;
      case 'acc-mode':
        accountMode(v);
        break;
      case 'acc-signout':
        await accountSignOut();
        break;
      // ---- Organisator: Event anlegen & bearbeiten ----
      case 'new-poll':
        S.editPoll = pollToForm(null);
        render();
        break;
      case 'edit-poll':
        S.editPoll = pollToForm(S.polls.find(x => x.id === el.dataset.id));
        render();
        break;
      case 'dup-poll': // früher „Duplizieren“ – jetzt dasselbe wie „Nochmal mit neuem Zeitraum“
      case 'reuse-poll':
        reusePoll(el.dataset.id);
        break;
      case 'tpl-use':
        useTemplate(el.dataset.id);
        break;
      case 'tpl-save-open':
        S.sheet = { type: 'tpl-save', pid: el.dataset.id };
        S.moreOpen = null;
        renderSheet();
        break;
      case 'tpl-manage':
        S.sheet = { type: 'templates' };
        renderSheet();
        break;
      case 'tpl-del':
        await deleteTemplate(el.dataset.id);
        renderSheet();
        break;
      // ---- Organisatoren (Zusatzfunktion) ----
      case 'admins-open':
        S.sheet = { type: 'admins' };
        renderSheet();
        break;
      case 'adm-lead':
        S.sheet.confirm = el.dataset.id;
        renderSheet();
        break;
      case 'adm-lead-no':
        S.sheet.confirm = null;
        renderSheet();
        break;
      case 'adm-lead-yes':
        await transferLead(el.dataset.id);
        renderSheet();
        break;
      case 'adm-del':
        await removeAdmin(el.dataset.id);
        renderSheet();
        break;
      case 'adm-leave':
        await leaveAdmins();
        break;
      case 'pf-month': {
        readPollForm();
        const m = S.editPoll.months,
          i = m.indexOf(v);
        i >= 0 ? m.splice(i, 1) : m.push(v);
        render();
        break;
      }
      case 'pf-wd': {
        readPollForm();
        const w = S.editPoll.weekdays,
          n = +v,
          i = w.indexOf(n);
        if (i >= 0) {
          if (w.length > 1) w.splice(i, 1);
        } else w.push(n);
        render();
        break;
      }
      case 'pf-maybe':
        readPollForm();
        S.editPoll.maybeLimit = Math.max(0, Math.min(10, S.editPoll.maybeLimit + +v));
        render();
        break;
      case 'pf-cancel':
        S.editPoll = null;
        render();
        break;
      case 'pf-save':
        await savePollForm();
        break;
      // ---- Organisator: Teilen, Termin festlegen, Auswertung ----
      case 'toggle-closed': {
        const p = S.polls.find(x => x.id === el.dataset.id);
        await B.savePoll(p.id, { closed: !p.closed });
        toast(p.closed ? 'Wieder geöffnet' : 'Geschlossen');
        break;
      }
      case 'share':
        S.sheet = { type: 'share', ids: [el.dataset.id] };
        renderSheet();
        break;
      case 'share-toggle': {
        const ids = S.sheet.ids,
          id = el.dataset.id,
          i = ids.indexOf(id);
        if (i >= 0) {
          if (ids.length > 1) ids.splice(i, 1);
        } else ids.push(id);
        renderSheet();
        break;
      }
      case 'copy':
        copyText(v, 'Kopiert');
        break;
      case 'native-share':
        try {
          await navigator.share({ title: el.dataset.t, text: 'Trag bitte ein, wann du kannst:', url: v });
        } catch {}
        break;
      case 'native-share-text':
        try {
          await navigator.share({ text: v });
        } catch {}
        break;
      case 'remind':
      case 'share-result':
      case 'message':
        S.sheet = { type: 'message', kind: act === 'share-result' ? 'status' : 'remind' };
        renderSheet();
        break;
      case 'msg-kind':
        S.sheet.kind = v;
        renderSheet();
        break;
      case 'owner-view':
        S.ownerView = v === 'details' ? 'details' : 'simple';
        lsSet('tp-owner-view', S.ownerView);
        render();
        window.scrollTo(0, 0);
        break;
      case 'more':
        S.moreOpen = S.moreOpen === el.dataset.id ? null : el.dataset.id;
        render();
        break;
      case 'set-final':
        await setFinal(el.dataset.d);
        break;
      case 'unfinal':
        await B.savePoll(S.poll.id, { final: null });
        S.sheet = null;
        render();
        toast('Festlegung aufgehoben');
        break;
      case 'ics': {
        const p = S.pollsById[el.dataset.id] || S.poll;
        if (p && p.final) downloadIcs(p);
        break;
      }
      case 'f-people': {
        const R = computeResults();
        S.filters.minPeople = Math.max(1, Math.min(R.n || 1, R.minP + +v));
        render();
        break;
      }
      case 'f-hours':
        S.filters.minHours = Math.max(0, Math.min(24, S.filters.minHours + +v));
        render();
        break;
      case 'toggle-all':
        S.showAllDays = !S.showAllDays;
        render();
        break;
      case 'open-day':
        S.sheet = { type: 'day', ds: el.dataset.d };
        renderSheet();
        break;
      case 'del-ask':
        S.confirmDel = el.dataset.id;
        render();
        break;
      case 'del-cancel':
        S.confirmDel = null;
        render();
        break;
      case 'del-resp':
        await B.deleteResponse(S.route.id, el.dataset.id);
        S.confirmDel = null;
        toast('Antwort gelöscht');
        break;
      // ---- Abstimmen: Grundeinstellung, Eingabemodus, Top 3 ----
      case 'base':
        if (S.my.base !== v) {
          pushUndo();
          S.my.base = v;
          scheduleSave();
          render();
        }
        break;
      case 'selmode':
        readBrush();
        S.selMode = v === '1';
        S.favMode = v === 'fav';
        S.sel = new Set();
        S.brush.pending = null;
        render();
        if (S.favMode && S.my) {
          S.my.favs = validFavs();
        }
        break;
      case 'fav-move': {
        const [i, d] = v.split(',').map(Number);
        moveFav(i, d);
        break;
      }
      case 'fav-del':
        toggleFav(v);
        break;
      case 'f-sort':
        S.filters.sortFav = v === '1';
        render();
        break;
      // ---- Hilfe ----
      case 'help-open':
        S.sheet = { type: 'help', view: 'home', q: '' };
        renderSheet();
        setTimeout(() => {
          const q = $('#help-q');
          if (q && matchMedia('(pointer:fine)').matches) q.focus();
        }, 50);
        break;
      case 'help-news':
        S.sheet = { type: 'help', view: 'news', q: '' };
        renderSheet();
        markNewsSeen();
        break;
      case 'help-all-news':
        S.sheet = { type: 'help', view: 'news', all: true, q: '' };
        renderSheet();
        markNewsSeen();
        break;
      case 'help-topic':
        S.sheet = { type: 'help', view: 'topic', topic: v, q: '' };
        renderSheet();
        {
          const sh = $('.sheet');
          if (sh) sh.scrollTop = 0;
        }
        break;
      case 'help-home':
        S.sheet = { type: 'help', view: 'home', q: '' };
        renderSheet();
        break;
      case 'help-q-set':
        S.sheet.q = v;
        renderSheet();
        break;
      case 'help-show':
        showMe(v);
        break;
      // ---- Abstimmen: Tage, Pinsel, Mehrfachauswahl, Wiederholungen ----
      case 'brush':
        onBrush(v);
        break;
      case 'day':
        if (S.favMode) toggleFav(el.dataset.d);
        else if (S.selMode) toggleSel(el.dataset.d);
        else applySingle(el.dataset.d);
        break;
      case 'wk-sel':
        selectWeekday(el.dataset.m, +v);
        break;
      case 'qsel':
        quickSelect(v);
        break;
      case 'sel-apply':
        applyToSel(S.brush.pending);
        break;
      case 'undo':
        undo();
        break;
      case 'rule-new':
        S.ruleForm = { kind: 'no', wd: [], whole: true, s: '', e: '', label: '' };
        render();
        break;
      case 'rf-kind':
        readRuleForm();
        S.ruleForm.kind = v;
        render();
        break;
      case 'rf-wd': {
        readRuleForm();
        const w = S.ruleForm.wd,
          n = +v,
          i = w.indexOf(n);
        i >= 0 ? w.splice(i, 1) : w.push(n);
        render();
        break;
      }
      case 'rf-whole':
        readRuleForm();
        S.ruleForm.whole = v === '1';
        render();
        break;
      case 'rf-cancel':
        S.ruleForm = null;
        render();
        break;
      case 'rf-save':
        saveRule();
        break;
      case 'rule-del':
        pushUndo();
        S.my.rules = S.my.rules.filter(r => r.id !== el.dataset.id);
        scheduleSave();
        render();
        toast('Wiederholung gelöscht', { act: 'undo', label: 'Rückgängig' });
        break;
      // ---- Übernehmen, Avatar, Absage ----
      case 'copy-open':
        S.sheet = { type: 'copy' };
        renderSheet();
        break;
      case 'copy-from':
        copyFrom(el.dataset.id);
        break;
      case 'copy-dismiss':
        dismissCopy();
        render();
        break;
      case 'emoji':
        if (S.my.emoji === v) delete S.my.emoji;
        else S.my.emoji = v;
        scheduleSave();
        render();
        break;
      case 'cancel-open':
        S.sheet = { type: 'cancel', reason: null, note: '' };
        renderSheet();
        break;
      case 'cancel-reason':
        S.sheet.note = ($('#cx-note') || {}).value || '';
        S.sheet.reason = v;
        renderSheet();
        break;
      case 'cancel-send':
        await sendCancel();
        break;
      case 'uncancel':
        await B.updateMine(S.route.id, { cancel: null, updatedAt: Date.now() });
        delete S.my.cancel;
        render();
        confetti();
        toast('Schön, dass du doch dabei bist! 🎉');
        break;
      // ---- Organisator: Frist & Freischaltungen ----
      case 'extend-open':
        S.sheet = { type: 'extend' };
        renderSheet();
        break;
      case 'ext-group':
        await extendGroup(v);
        break;
      case 'ext-group-custom':
        await extendGroup('custom');
        break;
      case 'reopen':
        await B.savePoll(S.poll.id, { closed: false });
        toast('Wieder geöffnet');
        break;
      case 'person-open':
        S.sheet = { type: 'person', uid: el.dataset.id };
        renderSheet();
        break;
      case 'person-ext':
        await extendPerson(el.dataset.id, v);
        break;
      case 'person-ext-end':
        await B.savePoll(S.poll.id, { extensions: { [el.dataset.id]: { until: 0, ask: false } } });
        S.sheet.msg = null;
        renderSheet();
        toast('Freischaltung beendet');
        break;
      case 'pass-create':
        await createPass(v);
        break;
      case 'pass-del':
        await B.deletePass(S.poll.id, el.dataset.id);
        toast('Link deaktiviert');
        break;
      // ---- Optionen („Deine Ansicht“) & Gimmicks ----
      case 'ach-open':
        S.sheet = { type: 'ach' };
        renderSheet();
        break;
      case 'ver-tap':
        verTap();
        break;
      case 'features-open':
        S.sheet = { type: 'features' };
        renderSheet();
        break;
      case 'preset':
        applyPreset(v);
        render();
        toast(v === 'all' ? 'Alle Funktionen eingeblendet 🧰' : 'Einfach-Modus 🧘');
        break;
      case 'feat-on':
        setFeat(v, true);
        render();
        toast(`„${(FEATURES.find(f => f.id === v) || {}).label}“ ist jetzt eingeschaltet`);
        break;
      case 'dice': {
        const c = diceCands();
        if (c.length >= 2) rollDice(c);
        break;
      }
      case 'dice-again':
        rollDice(S.sheet.cands);
        break;
      // ---- Organisator: Tage ausschließen, Zeitraum, Teilnehmerliste ----
      case 'ex-day': {
        const x = new Set(S.editPoll.excluded);
        x.has(el.dataset.d) ? x.delete(el.dataset.d) : x.add(el.dataset.d);
        S.editPoll.excluded = [...x];
        readPollForm();
        render();
        break;
      }
      case 'ex-week':
      case 'ex-wd': {
        readPollForm();
        const f = S.editPoll,
          x = new Set(f.excluded);
        const list = (
          act === 'ex-week' ? v.split(',') : daysOfMonths([el.dataset.m]).filter(ds => wdIdx(ds) === +v)
        ).filter(ds => ds >= TODAY);
        const allEx = list.every(ds => x.has(ds));
        list.forEach(ds => (allEx ? x.delete(ds) : x.add(ds)));
        f.excluded = [...x];
        render();
        break;
      }
      case 'ex-clear':
        readPollForm();
        S.editPoll.excluded = [];
        render();
        break;
      case 'pf-range-add': {
        readPollForm();
        const f = S.editPoll;
        if (!f.rangeFrom || !f.rangeTo || f.rangeTo < f.rangeFrom) {
          toast('Bitte „von“ und „bis“ richtig wählen');
          return;
        }
        addRangeToForm(f, f.rangeFrom, f.rangeTo);
        toast(`${rangeText(f.rangeFrom, f.rangeTo)} hinzugefügt`);
        f.rangeFrom = f.rangeTo = '';
        render();
        break;
      }
      case 'pf-restr': {
        readPollForm();
        const f = S.editPoll;
        f.restricted = v === '1';
        f.openPeople = true;
        if (f.restricted && !partOn(f) && B.uid())
          f.participants[B.uid()] = { on: true, name: (f.participants[B.uid()] || {}).name || 'Du (Organisator)' };
        render();
        break;
      }
      case 'pf-person': {
        readPollForm();
        const f = S.editPoll,
          id = el.dataset.id,
          cur = f.participants[id];
        f.participants[id] = { on: !(cur && cur.on), name: (cur && cur.name) || v || '' };
        render();
        break;
      }
      case 'pf-addmode':
        readPollForm();
        S.editPoll.addMode = v;
        render();
        break;
      // ---- Teilnehmer: Zeitraum vorschlagen, Neuigkeiten, Teilnahme anfragen ----
      case 'propose-open':
        S.sheet = { type: 'propose', fromDone: false };
        renderSheet();
        break;
      case 'pr-month': {
        const [y, m] = v.split('-').map(Number);
        const first = ymd(y, m, 1);
        S.sheet['pr-from'] = first < TODAY ? TODAY : first;
        S.sheet['pr-to'] = ymd(y, m, new Date(y, m, 0).getDate());
        renderSheet();
        break;
      }
      case 'pr-send':
        await sendProposal();
        break;
      case 'pr-skip': {
        S.sheet = null;
        renderSheet();
        const wasDone = S.my.done && !isStale(S.poll, S.my, B.uid());
        S.my.done = true;
        scheduleSave(true);
        render();
        doneFx(wasDone);
        break;
      }
      case 'news-ok':
        S.my.done = true;
        scheduleSave(true);
        render();
        toast('Danke, bestätigt ✓');
        break;
      case 'rq-send': {
        const name = (($('#rq-name') || {}).value || '').trim().slice(0, 40);
        if (!name) {
          toast('Bitte deinen Namen eingeben');
          return;
        }
        const data = { name, at: Date.now() };
        await B.sendRequest(S.route.id, data);
        S.myRequest = data;
        render();
        toast('Anfrage gesendet 📨');
        break;
      }
      // ---- Organisator: Anfragen & Vorschläge bestätigen, neue Runde ----
      case 'rq-ok': {
        const q = S.requests.find(x => x.uid === el.dataset.id);
        if (!q) break;
        await B.savePoll(S.poll.id, { participants: { [q.uid]: { on: true, name: q.name } } });
        await B.deleteRequest(S.poll.id, q.uid);
        toast(`${q.name} ist jetzt dabei`);
        break;
      }
      case 'rq-no':
        await B.deleteRequest(S.poll.id, el.dataset.id);
        toast('Anfrage abgelehnt');
        break;
      case 'add-ok':
        await B.savePoll(S.poll.id, { added: { [el.dataset.id]: { ok: true, declined: false, at: Date.now() } } });
        toast('Zeitraum hinzugefügt. Alle sehen beim nächsten Öffnen einen Hinweis.');
        break;
      case 'add-no':
        await B.savePoll(S.poll.id, { added: { [el.dataset.id]: { ok: false, declined: true } } });
        toast('Zeitraum entfernt');
        break;
      case 'part-add':
        await B.savePoll(S.poll.id, { participants: { [el.dataset.id]: { on: true, name: v || '' } } });
        toast('Zur Teilnehmerliste hinzugefügt');
        break;
      case 'part-remove':
        await B.savePoll(S.poll.id, { participants: { [el.dataset.id]: { on: false } } });
        S.sheet = null;
        render();
        toast('Von der Teilnehmerliste entfernt');
        break;
      case 'reopen-open':
        S.sheet = { type: 'reopen', dl: 'none', 'ro-excl': true };
        renderSheet();
        break;
      case 'ro-dl':
        S.sheet.dl = v;
        renderSheet();
        break;
      case 'ro-go':
        await doReopen();
        break;
      // ---- Abstimmen: Fertig ----
      case 'done': {
        S.my.note = ($('#v-note') || {}).value || '';
        if (!S.my.name.trim()) {
          toast('Bitte zuerst deinen Namen eingeben');
          $('#v-name').focus();
          return;
        }
        if (noDaysAtAll() && (S.poll.addMode || 'auto') !== 'off' && !closedForMe(S.poll)) {
          S.sheet = { type: 'propose', fromDone: true };
          renderSheet();
          return;
        }
        const wasDone = S.my.done && !isStale(S.poll, S.my, B.uid());
        S.my.done = true;
        scheduleSave(true);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        doneFx(wasDone);
        break;
      }
    }
  } catch (err) {
    console.error(err);
    toast('Das hat nicht geklappt. Bitte nochmal versuchen.');
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'v-name' && S.my) {
    S.my.name = t.value;
    scheduleSave();
  }
  if (t.id === 'v-note' && S.my) {
    S.my.note = t.value;
    scheduleSave();
  }
  if (t.id === 'b-s' || t.id === 'b-e') readBrush();
  if (t.id && t.id.startsWith('rf-')) readRuleForm();
  if (t.id && t.id.startsWith('pf-') && t.type !== 'checkbox') readPollForm();
  if (t.id && /^(ro|pr)-/.test(t.id) && S.sheet) S.sheet[t.id] = t.value;
  if (t.id === 'help-q' && S.sheet) {
    S.sheet.q = t.value;
    const r = $('#help-results');
    if (r) r.innerHTML = helpBody();
  }
});
document.addEventListener(
  'toggle',
  e => {
    const d = e.target;
    if (d && d.matches && d.matches('details[data-key]') && S.editPoll) S.editPoll[d.dataset.key] = d.open;
  },
  true
);
// Formulare (Konto): Abschicken per Knopf oder Enter. <form data-submit="name"> → Aktion „name“.
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  const kind = f.dataset.submit;
  if (kind.startsWith('acc-')) accountSubmit(kind);
  else if (kind === 'tpl-save') saveTemplate(S.sheet.pid, ($('#tpl-name') || {}).value);
  else if (kind === 'adm-add')
    addAdmin(($('#adm-email') || {}).value, ($('#adm-name') || {}).value).then(() => {
      if (S.sheet && S.sheet.type === 'admins') renderSheet();
    });
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-done') {
    S.filters.onlyDone = t.checked;
    render();
  }
  if (t.id === 'f-maybe') {
    S.filters.inclMaybe = t.checked;
    render();
  }
  if (t.id === 'pf-dl-on') {
    readPollForm();
    S.editPoll.dlOn = t.checked;
    render();
  }
  if (t.id === 'pf-cancel' && S.editPoll) S.editPoll.cancelRule = t.checked;
  if (t.id === 'ro-excl' && S.sheet) S.sheet['ro-excl'] = t.checked;
  if (t.id === 'acc-show') togglePasswordVisible(t.checked);
  if (t.dataset && t.dataset.nfType) notifyTypeChanged(t.dataset.nfType, t.checked);
  if (t.id === 'nf-cal-deadlines') notifyCalDeadlines(t.checked);
  if (t.dataset && t.dataset.feat) {
    setFeat(t.dataset.feat, t.checked);
    render();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.sheet) {
    S.sheet = null;
    renderSheet();
  }
  if (S.sheet) trapTab(e);
  if (/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
  konamiKey(e.key);
});
window.addEventListener('hashchange', loadRoute);
/* ---------- Maus: über mehrere Tage ziehen ---------- */
export let drag = null,
  suppressClick = false;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || S.route.name !== 'vote' || S.favMode) return;
  const c = e.target.closest('[data-act="day"]');
  if (!c || c.disabled) return;
  e.preventDefault();
  suppressClick = true;
  const ds = c.dataset.d;
  if (S.selMode) {
    drag = { sel: !S.sel.has(ds), seen: new Set([ds]) };
    setSel(ds, drag.sel);
    renderDock();
    return;
  }
  const t = brushTarget(S.brush.mode);
  if (t && t.err) {
    toast(t.err);
    drag = null;
    return;
  }
  pushUndo();
  const clear = !t || eqDay(S.my.days[ds], t);
  drag = { op: clear ? null : t, seen: new Set([ds]), limitHit: false };
  dragApply(ds, true);
});
document.addEventListener('pointerover', e => {
  if (!drag) return;
  const c = e.target.closest('[data-act="day"]');
  if (!c || c.disabled) return;
  const ds = c.dataset.d;
  if (drag.seen.has(ds)) return;
  drag.seen.add(ds);
  if (S.selMode) {
    setSel(ds, drag.sel);
    renderDock();
  } else dragApply(ds);
});
document.addEventListener('pointerup', () => {
  if (drag) {
    if (!S.selMode) {
      scheduleSave();
      refreshAfterEdit();
      checkMaybeAch();
    }
    drag = null;
  }
  setTimeout(() => {
    suppressClick = false;
  }, 0);
});
export function dragApply(ds, first) {
  if (!setDay(ds, drag.op)) {
    if (!drag.limitHit) maybeLimitToast();
    drag.limitHit = true;
    return;
  }
  updateCell(ds);
  if (first) refreshAfterEdit();
}

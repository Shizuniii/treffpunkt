/* Seitenwechsel über die Adresse (#/, #/p/<ids>, #/r/<id>) und Laden der Daten. */
import { loadCopyCands } from './copy.js';
import { flushSave } from './save.js';
import { B, S, TODAY, isOwner, lsGet, lsSet, refreshToday } from './state.js';
import { canSeeOthers, normResp } from '../core/poll.js';
import { pollSummary } from '../core/results.js';
import { fullPartyFx } from '../ui/fun.js';
import { loadPeople } from '../ui/period.js';
import { render } from '../ui/render.js';
import { renderSheet } from '../ui/sheets.js';

export let unsubs = [];
export function onAuthChanged() {
  if (S.route.name === 'vote') render();
  else loadRoute();
}
export function parseRoute() {
  const [a, b, c, d] = location.hash.replace(/^#\/?/, '').split('/');
  const code = /^[a-z0-9]{6,40}$/.test(d || '') ? d : null;
  const clean = s =>
    [
      ...new Set(
        (s || '')
          .split(',')
          .map(x => x.trim())
          .filter(x => /^[a-z0-9-]{3,40}$/i.test(x))
      ),
    ].slice(0, 8);
  if (a === 'p' && b) {
    const ids = clean(b);
    if (ids.length) return { name: 'vote', ids, id: ids.includes(c) ? c : ids[0], code };
  }
  if (a === 'r' && b) {
    const ids = clean(b);
    if (ids.length) return { name: 'results', ids: [ids[0]], id: ids[0] };
  }
  return { name: 'home', ids: [] };
}
export function go(hash) {
  if (location.hash === hash) loadRoute();
  else location.hash = hash;
}
export let loadSeq = 0;
export async function loadRoute() {
  flushSave();
  const seq = ++loadSeq;
  unsubs.forEach(f => f && f());
  unsubs = [];
  refreshToday();
  Object.assign(S, {
    route: parseRoute(),
    poll: undefined,
    pollsById: {},
    polls: null,
    responses: [],
    my: null,
    myAll: {},
    answered: undefined, // Teilnehmer in der Auswertung: hat selbst schon eine Antwort?
    viewDenied: false,
    loadErr: null,
    sheet: null,
    editPoll: null,
    ruleForm: null,
    save: 'idle',
    showAllDays: false,
    sel: new Set(),
    selMode: false,
    undo: [],
    copyCands: null,
    copyDismissed: false,
    confirmDel: null,
    passInfo: null,
    passes: [],
    requests: [],
    myRequest: null,
    favMode: false,
  });
  render();
  const r = S.route;
  const fail = e => {
    console.error(e);
    if (seq !== loadSeq) return;
    S.loadErr =
      e && e.code === 'permission-denied'
        ? 'Keine Berechtigung. Bist du mit dem richtigen Konto angemeldet?'
        : 'Verbindung fehlgeschlagen. Bitte Seite neu laden.';
    render();
  };
  try {
    if (r.name === 'vote') {
      await B.ensureUser();
      if (seq !== loadSeq) return;
      for (const id of r.ids)
        unsubs.push(
          B.watchPoll(
            id,
            p => {
              S.pollsById[id] = p;
              if (id === r.id) S.poll = p;
              render();
            },
            fail
          )
        );
      const [mine, member, others] = await Promise.all([
        B.getMine(r.id),
        B.getMember().catch(() => null),
        Promise.all(
          r.ids
            .filter(x => x !== r.id)
            .map(x =>
              B.getMine(x)
                .then(v => [x, v])
                .catch(() => [x, null])
            )
        ),
      ]);
      if (seq !== loadSeq) return;
      S.member = member || { polls: {} };
      S.member.polls ||= {};
      for (const [x, v] of others) S.myAll[x] = v;
      S.my = normResp(mine);
      if (!S.my.name && S.member.name) S.my.name = S.member.name;
      S.copyDismissed = lsGet('tp-copy-' + r.id) === '1';
      const code = r.code || S.my.pass || lsGet('tp-pass-' + r.id);
      if (code) {
        S.passInfo = await B.getPass(r.id, code).catch(() => null);
        if (seq !== loadSeq) return;
        if (S.passInfo) {
          S.my.pass = code;
          lsSet('tp-pass-' + r.id, code);
        }
      }
      S.myRequest = await B.getRequest(r.id).catch(() => null);
      if (seq !== loadSeq) return;
      S.openedAt = Date.now();
      render();
      loadCopyCands(seq);
    } else if (r.name === 'results') {
      if (!isOwner()) return await loadViewer(seq, r, fail);
      unsubs.push(
        B.watchPoll(
          r.id,
          p => {
            S.poll = p;
            render();
            fullPartyFx();
          },
          fail
        )
      );
      unsubs.push(
        B.watchResponses(
          r.id,
          rs => {
            S.responses = rs.map(normResp);
            render();
            fullPartyFx();
          },
          fail
        )
      );
      unsubs.push(
        B.watchPasses(
          r.id,
          ps => {
            S.passes = ps;
            if (S.sheet && S.sheet.type === 'extend') renderSheet();
          },
          e => console.warn(e)
        )
      );
      unsubs.push(
        B.watchRequests(
          r.id,
          rs => {
            S.requests = rs;
            render();
          },
          e => console.warn(e)
        )
      );
      loadPeople();
    } else if (isOwner()) {
      unsubs.push(
        B.watchPolls(ps => {
          S.polls = ps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          render();
          refreshCounts();
        }, fail)
      );
      loadPeople();
      // Organisatoren und eigene Vorlagen (optional – Fehler hier stören die Übersicht nicht)
      unsubs.push(
        B.watchAdmins(
          a => ((S.admins = a), render()),
          e => console.warn(e)
        )
      );
      unsubs.push(
        B.watchTemplates(
          t => ((S.templates = t), render()),
          e => console.warn(e)
        )
      );
    } else if (B.hasUser()) {
      S.member = await B.getMember().catch(() => null);
      if (seq !== loadSeq) return;
      render();
    }
  } catch (e) {
    fail(e);
  }
}
export let countsBusy = false;
export async function refreshCounts() {
  if (countsBusy || !S.polls) return;
  countsBusy = true;
  try {
    for (const p of S.polls) {
      try {
        S.counts[p.id] = await B.countResponses(p.id);
        S.reqCounts[p.id] = await B.countRequests(p.id);
        // Kurzfassung für den einfachen Überblick (bester Tag, wer fehlt)
        S.summaries[p.id] = pollSummary({ poll: p, responses: await B.getResponses(p.id), today: TODAY });
      } catch (e) {
        console.warn(e);
      }
    }
  } finally {
    countsBusy = false;
  }
  if (S.route.name === 'home') render();
}

/**
 * Auswertung für Teilnehmer (nur ansehen) – wenn der Organisator es für dieses Event erlaubt hat.
 * Die Firestore-Regeln prüfen dasselbe noch einmal; ohne Erlaubnis kommen keine Antworten an.
 */
async function loadViewer(seq, r, fail) {
  await B.ensureUser();
  if (seq !== loadSeq) return;
  const mine = await B.getMine(r.id).catch(() => null);
  if (seq !== loadSeq) return;
  S.my = normResp(mine);
  S.answered = !!mine;
  let watching = false;
  unsubs.push(
    B.watchPoll(
      r.id,
      p => {
        S.poll = p;
        if (p && !watching && canSeeOthers(p, B.uid(), S.answered)) {
          watching = true;
          S.viewDenied = false;
          unsubs.push(
            B.watchResponses(
              r.id,
              rs => {
                S.responses = rs.map(normResp);
                render();
              },
              e => {
                // z. B. Freigabe wurde gerade zurückgenommen
                console.warn(e);
                if (seq !== loadSeq) return;
                S.viewDenied = true;
                S.responses = [];
                watching = false;
                render();
              }
            )
          );
        }
        render();
      },
      fail
    )
  );
}

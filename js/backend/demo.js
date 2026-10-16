/* Demo-Backend: gleiche Schnittstelle wie Firebase, Daten nur im Browser (localStorage). */
import { S, TODAY, lsGet, lsSet } from '../app/state.js';
import { addDays, daysOfMonths, monthKey, parseYmd, toYmd, wdIdx } from '../core/dates.js';
import { clone, deepMerge, rid } from '../core/util.js';

export function seedDemo() {
  const now = new Date();
  const y = now.getFullYear(),
    m = now.getMonth() + 1;
  const m2 = m === 12 ? [y + 1, 1] : [y, m + 1];
  const months = [monthKey(y, m), monthKey(...m2)];
  const days = daysOfMonths(months).filter(d => d >= TODAY);
  const pick = (wds, every = 1) => days.filter(d => wds.includes(wdIdx(d))).filter((_, i) => i % every === 0);
  const mk = (list, val) => Object.fromEntries(list.map(d => [d, val]));
  const t = Date.now();
  const deadline = addDays(new Date(y, m - 1, now.getDate()), 21);
  deadline.setHours(0, 0, 0, 0);
  const sats = pick([5]);
  const nextFrom = toYmd(new Date(m2[0], m2[1], 1)); // erster Tag nach dem Demo-Zeitraum
  return {
    polls: {
      demo1: {
        title: 'Spieleabend',
        description: 'Wir suchen einen Tag für den nächsten Spieleabend bei Shy. Trag ein, wann du kannst!',
        months,
        expected: 6,
        maybeLimit: 4,
        weekdays: null,
        closesAt: deadline.getTime(),
        closed: false,
        final: null,
        createdAt: t,
      },
      demo2: {
        title: 'Bowling',
        description: 'Bowling in Aachen, danach essen.',
        months,
        expected: null,
        maybeLimit: 3,
        weekdays: [4, 5, 6],
        closesAt: null,
        closed: false,
        final: null,
        createdAt: t - 1000,
        addMode: 'ask',
        restricted: true,
        excluded: pick([4]).slice(0, 1),
        participants: {
          'demo-me': { on: true, name: 'Shy' },
          'demo-ben': { on: true, name: 'Ben (Beispiel)' },
          'demo-cem': { on: true, name: 'Cem (Beispiel)' },
          'demo-anna': { on: true, name: 'Anna (Beispiel)' },
        },
        added: {
          'demo-cem': {
            from: nextFrom,
            to: toYmd(addDays(parseYmd(nextFrom), 13)),
            name: 'Cem (Beispiel)',
            at: t - 3600e3,
            ok: false,
            declined: false,
          },
        },
      },
    },
    responses: {
      demo1: {
        'demo-anna': {
          v: 2,
          name: 'Anna (Beispiel)',
          base: 'none',
          done: true,
          updatedAt: t - 3600e3 * 5,
          rules: [],
          days: {
            ...mk(pick([5]), { s: 0, e: 1440 }),
            ...mk(pick([4], 2), { s: 1080, e: 1440 }),
            ...mk(pick([6], 2), { s: 600, e: 1260 }),
            ...mk(pick([3]).slice(0, 2), { s: 1080, e: 1440, m: 1 }),
          },
        },
        'demo-ben': {
          v: 2,
          name: 'Ben (Beispiel)',
          base: 'all',
          done: true,
          updatedAt: t - 3600e3 * 26,
          rules: [
            { id: 'r1', kind: 'no', wd: [4], s: 1020, e: 1260, label: 'Verein' },
            { id: 'r2', kind: 'no', wd: [0, 1, 2], s: 480, e: 1080, label: 'Arbeit' },
          ],
          days: {},
        },
        'demo-cem': {
          v: 2,
          name: 'Cem (Beispiel)',
          base: 'none',
          done: true,
          updatedAt: t - 60e3 * 40,
          rules: [{ id: 'r1', kind: 'yes', wd: [5], s: 780, e: null, label: '' }],
          days: { ...mk(pick([6], 3), { s: 0, e: 1440 }), ...mk(pick([3]), { s: 1140, e: 1380 }) },
        },
        'demo-dana': {
          v: 2,
          name: 'Dana (Beispiel)',
          base: 'none',
          done: false,
          updatedAt: t - 60e3 * 6,
          rules: [],
          days: {
            ...mk(sats.slice(0, 4), { s: 0, e: 1080 }),
            ...mk(pick([6]).slice(0, 2), { s: 840, e: 1440 }),
            ...mk(sats.slice(4, 6), { s: 0, e: 1440, m: 1 }),
          },
        },
      },
      demo2: {
        'demo-me': {
          v: 2,
          name: 'Shy',
          base: 'none',
          done: true,
          updatedAt: t - 3600e3 * 30,
          rules: [{ id: 'r1', kind: 'no', wd: [4], s: 960, e: 1200, label: 'Training' }],
          days: {
            ...mk(sats.slice(0, 5), { s: 720, e: 1440 }),
            ...mk(pick([6], 2), { s: 0, e: 1440 }),
            ...mk(pick([4]).slice(1, 2), { s: 1200, e: 1440, m: 1 }),
          },
        },
        'demo-ben': {
          v: 2,
          name: 'Ben (Beispiel)',
          base: 'all',
          done: true,
          updatedAt: t - 3600e3 * 20,
          rules: [{ id: 'r1', kind: 'no', wd: [4], s: 1020, e: 1260, label: 'Verein' }],
          days: {},
        },
      },
    },
    passes: {},
    requests: { demo2: { 'demo-emil': { name: 'Emil (Beispiel)', at: t - 7200e3 } } },
    members: { 'demo-me': { name: 'Shy', polls: { demo2: { t: 'Bowling', at: t - 3600e3 * 30 } } } },
  };
}
export function makeDemo() {
  const KEY = 'treffpunkt-demo-v3';
  let st = null;
  try {
    st = JSON.parse(lsGet(KEY));
  } catch {}
  if (!st || !st.members) st = seedDemo();
  // Fehlende Bereiche ergänzen (ältere Demo-Daten im Browser, oder nach „Zurücksetzen“)
  const ensureDefaults = () => {
    st.passes ||= {};
    st.requests ||= {};
    // Simulierte Anmeldung: wer gerade „auf diesem Gerät“ ist, und angelegte Konten (Passwörter nur hier im Demo-Speicher)
    st.session ||= { uid: 'demo-me', email: null };
    st.accounts ||= {};
    st.admins ||= { 'shy@example.com': { role: 'owner', name: 'Shy' } };
    st.templates ||= {};
    st.notify ||= {};
  };
  ensureDefaults();
  const subs = new Set();
  const persist = () => {
    lsSet(KEY, JSON.stringify(st));
    subs.forEach(f => f());
  };
  let ME = st.session.uid;
  const watch = f => {
    subs.add(f);
    f();
    return () => subs.delete(f);
  };
  const setUser = () => (S.user = { uid: ME, isAnonymous: !st.session.email, email: st.session.email || '' });
  setUser();
  const fail = code => Object.assign(new Error(code), { code });
  const account = (email, pw) => {
    const a = st.accounts[email];
    if (!a || a.pw !== pw) throw fail('auth/invalid-credential');
    return a;
  };
  const switchTo = (uid, email) => {
    ME = uid;
    st.session = { uid, email };
    setUser();
    persist();
  };
  return {
    uid: () => ME,
    hasUser: () => true,
    isAnon: () => !st.session.email,
    email: () => st.session.email || '',
    isGoogle: () => false,
    accountEmail: () => st.session.email || '',
    ensureUser: async () => {},
    signInOwner: async () => {},
    /** Abmelden = dieses „Gerät“ ist danach wieder ohne Konto, mit neuer, leerer Identität. */
    signOut: async () => switchTo('demo-anon-' + rid(6), null),
    linkGoogle: async () => 'linked',
    createAccount: async (email, pw) => {
      if (st.accounts[email]) throw fail('auth/email-already-in-use');
      if (String(pw).length < 6) throw fail('auth/weak-password');
      st.accounts[email] = { pw, uid: ME };
      switchTo(ME, email);
    },
    openAccount: async (email, pw) => {
      const a = account(email, pw);
      return {
        uid: a.uid,
        getResponse: async pid => clone((st.responses[pid] || {})[a.uid] || null),
        saveResponse: async (pid, data) => {
          (st.responses[pid] ||= {})[a.uid] = clone(data);
          persist();
        },
        getMember: async () => clone(st.members[a.uid] || null),
        saveMember: async data => {
          const cur = st.members[a.uid] || { polls: {} };
          st.members[a.uid] = { ...cur, ...clone(data), polls: { ...(cur.polls || {}), ...clone(data.polls || {}) } };
          persist();
        },
        getNotify: async () => clone(st.notify[a.uid] || null),
        saveNotify: async data => {
          st.notify[a.uid] = clone(data);
          persist();
        },
        close: async () => {},
      };
    },
    signInAccount: async (email, pw) => switchTo(account(email, pw).uid, email),
    resetPassword: async () => {},
    changePassword: async pw => {
      if (String(pw).length < 6) throw fail('auth/weak-password');
      st.accounts[st.session.email].pw = pw;
      persist();
    },
    deleteMember: async () => {
      delete st.members[ME];
      persist();
    },
    getNotify: async () => clone(st.notify[ME] || null),
    saveNotify: async data => {
      st.notify[ME] = clone(data);
      persist();
    },
    deleteNotify: async () => {
      delete st.notify[ME];
      persist();
    },
    watchPoll: (id, cb) => watch(() => cb(st.polls[id] ? { id, ...clone(st.polls[id]) } : null)),
    watchPolls: cb => watch(() => cb(Object.entries(st.polls).map(([id, p]) => ({ id, ...clone(p) })))),
    getPoll: async id => (st.polls[id] ? { id, ...clone(st.polls[id]) } : null),
    savePoll: async (id, data) => {
      st.polls[id] = deepMerge(st.polls[id], clone(data));
      persist();
    },
    getMine: async pid => clone((st.responses[pid] || {})[ME] || null),
    saveMine: async (pid, data) => {
      (st.responses[pid] ||= {})[ME] = clone(data);
      persist();
    },
    updateMine: async (pid, patch) => {
      const r = (st.responses[pid] || {})[ME];
      if (!r) throw new Error('missing');
      Object.assign(r, clone(patch));
      persist();
    },
    getPass: async (pid, code) => clone((st.passes[pid] || {})[code] || null),
    watchPasses: (pid, cb) =>
      watch(() => cb(Object.entries(st.passes[pid] || {}).map(([code, x]) => ({ code, ...clone(x) })))),
    savePass: async (pid, code, data) => {
      (st.passes[pid] ||= {})[code] = clone(data);
      persist();
    },
    deletePass: async (pid, code) => {
      if (st.passes[pid]) delete st.passes[pid][code];
      persist();
    },
    getMember: async () => clone(st.members[ME] || null),
    saveMember: async data => {
      const cur = st.members[ME] || { polls: {} };
      st.members[ME] = { ...cur, ...clone(data), polls: { ...(cur.polls || {}), ...clone(data.polls || {}) } };
      persist();
    },
    watchResponses: (pid, cb) =>
      watch(() => cb(Object.entries(st.responses[pid] || {}).map(([uid, r]) => ({ ...clone(r), uid })))),
    waitForPendingWrites: async () => {},
    getResponses: async pid => Object.entries(st.responses[pid] || {}).map(([uid, r]) => ({ ...clone(r), uid })),
    deleteResponse: async (pid, uid) => {
      if (st.responses[pid]) delete st.responses[pid][uid];
      persist();
    },
    countResponses: async pid => Object.keys(st.responses[pid] || {}).length,
    countRequests: async pid => Object.keys(st.requests[pid] || {}).length,
    getRequest: async pid => clone((st.requests[pid] || {})[ME] || null),
    sendRequest: async (pid, data) => {
      (st.requests[pid] ||= {})[ME] = clone(data);
      persist();
    },
    watchRequests: (pid, cb) =>
      watch(() => cb(Object.entries(st.requests[pid] || {}).map(([uid, x]) => ({ ...clone(x), uid })))),
    deleteRequest: async (pid, uid) => {
      if (st.requests[pid]) delete st.requests[pid][uid];
      persist();
    },
    // Organisatoren & Vorlagen. In der Demo ist „Organisator“ = shy@example.com.
    myEmail: () => (S.demoRole === 'owner' ? 'shy@example.com' : ''),
    watchAdmins: cb => watch(() => cb(Object.entries(st.admins).map(([email, a]) => ({ email, ...clone(a) })))),
    saveAdmin: async (email, data) => {
      st.admins[email] = { ...(st.admins[email] || {}), ...clone(data) };
      persist();
    },
    deleteAdmin: async email => {
      delete st.admins[email];
      persist();
    },
    transferLead: async toEmail => {
      st.admins[toEmail].role = 'owner';
      st.admins['shy@example.com'].role = 'co';
      persist();
    },
    watchTemplates: cb => watch(() => cb(Object.entries(st.templates).map(([id, t]) => ({ id, ...clone(t) })))),
    saveTemplate: async (id, data) => {
      st.templates[id] = clone(data);
      persist();
    },
    deleteTemplate: async id => {
      delete st.templates[id];
      persist();
    },
    async loadPeople() {
      const map = {};
      for (const rs of Object.values(st.responses))
        for (const [uid, r] of Object.entries(rs))
          if (r.name && (!map[uid] || (r.updatedAt || 0) > map[uid].at))
            map[uid] = { uid, name: r.name, emoji: r.emoji || '', at: r.updatedAt || 0 };
      return Object.values(map);
    },
    reset() {
      st = seedDemo();
      ensureDefaults();
      switchTo('demo-me', null);
    },
  };
}

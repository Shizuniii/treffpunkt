/* Tests für die Firestore-Sicherheitsregeln (firestore.rules).
   Laufen gegen den lokalen Firebase-Emulator – nichts davon berührt deine echte Datenbank.

   Aufruf:  npm run test:rules        (braucht Java 11+ und einmalig `npm install`)
   Auf GitHub laufen sie automatisch bei jedem Hochladen (.github/workflows/tests.yml).

   Aufbau: Jeder Test startet mit leerer Datenbank. `seed()` legt Daten an, ohne Regeln zu prüfen;
   danach versucht eine bestimmte Person etwas, und wir prüfen: erlaubt (allowed) oder abgelehnt (denied). */
import { describe, test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch } from 'firebase/firestore';

const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
// Organisatoren stehen in der Sammlung „admins“ – für die Tests: eine Leitung und ein Mitorganisator.
const LEAD_EMAIL = 'leitung@example.com';
const CO_EMAIL = 'mit@example.com';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-treffpunkt', firestore: { rules: RULES } });
});
after(() => env && env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(`admins/${LEAD_EMAIL}`, { role: 'owner', name: 'Shy' });
  await seed(`admins/${CO_EMAIL}`, { role: 'co', name: 'Mo' });
});

/* ---------- Personen ---------- */
const owner = () => env.authenticatedContext('owner', { email: LEAD_EMAIL, email_verified: true }).firestore();
const coOwner = () => env.authenticatedContext('co', { email: CO_EMAIL, email_verified: true }).firestore();
const fakeOwner = () => env.authenticatedContext('fake', { email: LEAD_EMAIL, email_verified: false }).firestore();
const user = uid => env.authenticatedContext(uid).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

/* ---------- Hilfen ---------- */
// allowed(…) / denied(…) mit optionalem Grund, der bei einem Fehlschlag mit ausgegeben wird
const expect =
  (check, label) =>
  async (promise, why = '') => {
    try {
      return await check(promise);
    } catch (e) {
      e.message = `${label}${why ? ` (${why})` : ''}: ${e.message}`;
      throw e;
    }
  };
const allowed = expect(assertSucceeds, 'sollte erlaubt sein');
const denied = expect(assertFails, 'sollte abgelehnt sein');
const seed = (path, data) => env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));
const HOUR = 3600e3;
const poll = (extra = {}) => ({ title: 'Spieleabend', months: ['2026-11'], closed: false, closesAt: null, ...extra });
const resp = (extra = {}) => ({
  v: 2,
  name: 'Anna',
  base: 'none',
  days: { '2026-11-07': { s: 0, e: 1440 } },
  rules: [],
  done: false,
  updatedAt: Date.now(),
  ...extra,
});
const respDoc = (db, uid, pid = 'p1') => doc(db, 'polls', pid, 'responses', uid);
const propose = (db, uid, entry, pid = 'p1') =>
  setDoc(
    doc(db, 'polls', pid),
    {
      added: {
        [uid]: {
          from: '2026-12-01',
          to: '2026-12-14',
          name: 'Anna',
          at: Date.now(),
          ok: true,
          declined: false,
          ...entry,
        },
      },
    },
    { merge: true }
  );

/* ======================================================================= */
describe('Events', () => {
  test('wer angemeldet ist und den Link hat, darf das Event lesen', async () => {
    await seed('polls/p1', poll());
    await allowed(getDoc(doc(user('anna'), 'polls/p1')));
    await denied(getDoc(doc(nobody(), 'polls/p1')));
  });
  test('nur der Organisator sieht die Liste aller Events', async () => {
    await seed('polls/p1', poll());
    await allowed(getDocs(collection(owner(), 'polls')));
    await denied(getDocs(collection(user('anna'), 'polls')));
    await denied(getDocs(collection(fakeOwner(), 'polls')), 'unbestätigte E-Mail zählt nicht');
  });
  test('nur der Organisator legt Events an, ändert und löscht sie', async () => {
    await allowed(setDoc(doc(owner(), 'polls/p2'), poll()));
    await denied(setDoc(doc(user('anna'), 'polls/p3'), poll()));
    await denied(setDoc(doc(fakeOwner(), 'polls/p3'), poll()));
    await denied(updateDoc(doc(user('anna'), 'polls/p2'), { title: 'Gehackt' }));
    await denied(updateDoc(doc(user('anna'), 'polls/p2'), { closesAt: Date.now() + 99 * HOUR }));
    await allowed(updateDoc(doc(owner(), 'polls/p2'), { title: 'Bowling' }));
    await denied(deleteDoc(doc(user('anna'), 'polls/p2')));
    await allowed(deleteDoc(doc(owner(), 'polls/p2')));
  });
});

/* ======================================================================= */
describe('Antworten', () => {
  beforeEach(() => seed('polls/p1', poll()));

  test('eigene Antwort schreiben, fremde nicht', async () => {
    await allowed(setDoc(respDoc(user('anna'), 'anna'), resp()));
    await denied(setDoc(respDoc(user('anna'), 'ben'), resp({ name: 'Ben' })));
    await denied(setDoc(respDoc(nobody(), 'anna'), resp()));
  });
  test('ungültige Antworten werden abgelehnt', async () => {
    const db = user('anna');
    await denied(setDoc(respDoc(db, 'anna'), resp({ name: '' })), 'leerer Name');
    await denied(setDoc(respDoc(db, 'anna'), resp({ name: 'x'.repeat(41) })), 'Name zu lang');
    await denied(setDoc(respDoc(db, 'anna'), resp({ note: 'x'.repeat(301) })), 'Anmerkung zu lang');
    await denied(setDoc(respDoc(db, 'anna'), resp({ favs: ['a', 'b', 'c', 'd'] })), 'mehr als 3 Favoriten');
    await denied(setDoc(respDoc(db, 'anna'), resp({ rules: Array(31).fill({}) })), 'zu viele Wiederholungen');
    await denied(setDoc(respDoc(db, 'anna'), resp({ days: 'alle' })), 'days muss eine Map sein');
    await allowed(setDoc(respDoc(db, 'anna'), resp({ favs: ['2026-11-07'], emoji: '🐸', note: 'ok', cancel: null })));
  });
  test('jeder liest nur die eigene Antwort, der Organisator alle', async () => {
    await seed('polls/p1/responses/anna', resp());
    await seed('polls/p1/responses/ben', resp({ name: 'Ben' }));
    await allowed(getDoc(respDoc(user('anna'), 'anna')));
    await denied(getDoc(respDoc(user('anna'), 'ben')));
    await denied(getDocs(collection(user('anna'), 'polls/p1/responses')));
    await allowed(getDocs(collection(owner(), 'polls/p1/responses')));
  });
  test('löschen: eigene Antwort oder Organisator', async () => {
    await seed('polls/p1/responses/anna', resp());
    await seed('polls/p1/responses/ben', resp({ name: 'Ben' }));
    await denied(deleteDoc(respDoc(user('anna'), 'ben')));
    await allowed(deleteDoc(respDoc(user('anna'), 'anna')));
    await allowed(deleteDoc(respDoc(owner(), 'ben')));
  });
});

/* ======================================================================= */
describe('Frist, Freischaltung und Nachzügler-Link', () => {
  test('geschlossen oder Frist abgelaufen: keine Änderungen mehr', async () => {
    await seed('polls/p1', poll({ closed: true }));
    await seed('polls/p2', poll({ closesAt: Date.now() - HOUR }));
    await seed('polls/p3', poll({ closesAt: Date.now() + HOUR }));
    await denied(setDoc(respDoc(user('anna'), 'anna', 'p1'), resp()));
    await denied(setDoc(respDoc(user('anna'), 'anna', 'p2'), resp()));
    await allowed(setDoc(respDoc(user('anna'), 'anna', 'p3'), resp()));
  });
  test('der Organisator darf seine eigene Antwort trotzdem ändern', async () => {
    await seed('polls/p1', poll({ closed: true }));
    await allowed(setDoc(respDoc(owner(), 'owner'), resp({ name: 'Shy' })));
  });
  test('persönliche Freischaltung gilt nur bis zum Ablauf und nur für diese Person', async () => {
    await seed(
      'polls/p1',
      poll({
        closed: true,
        extensions: { anna: { until: Date.now() + HOUR, ask: true }, ben: { until: Date.now() - HOUR } },
      })
    );
    await allowed(setDoc(respDoc(user('anna'), 'anna'), resp()));
    await denied(setDoc(respDoc(user('ben'), 'ben'), resp({ name: 'Ben' })), 'abgelaufen');
    await denied(setDoc(respDoc(user('cem'), 'cem'), resp({ name: 'Cem' })), 'nicht freigeschaltet');
  });
  test('Nachzügler-Link: gültiger Code öffnet, abgelaufener oder falscher nicht', async () => {
    await seed('polls/p1', poll({ closed: true }));
    await seed('polls/p1/passes/abc123def456', { until: Date.now() + HOUR, label: 'Dana' });
    await seed('polls/p1/passes/old123old456', { until: Date.now() - HOUR });
    await allowed(setDoc(respDoc(user('dana'), 'dana'), resp({ name: 'Dana', pass: 'abc123def456' })));
    await denied(setDoc(respDoc(user('emil'), 'emil'), resp({ name: 'Emil', pass: 'old123old456' })), 'abgelaufen');
    await denied(setDoc(respDoc(user('emil'), 'emil'), resp({ name: 'Emil', pass: 'gibtsnicht99' })), 'unbekannt');
    await denied(setDoc(respDoc(user('emil'), 'emil'), resp({ name: 'Emil', pass: '../hack' })), 'ungültiges Format');
  });
  test('absagen geht auch nach Fristende – aber sonst nichts ändern', async () => {
    await seed('polls/p1', poll({ closed: true, final: { date: '2026-11-07', s: 1080, e: 1440 } }));
    await seed('polls/p1/responses/anna', resp({ done: true }));
    const db = user('anna');
    await allowed(
      updateDoc(respDoc(db, 'anna'), {
        cancel: { date: '2026-11-07', reason: 'sick', at: Date.now() },
        updatedAt: Date.now(),
      })
    );
    await allowed(updateDoc(respDoc(db, 'anna'), { cancel: null, updatedAt: Date.now() }), 'Absage zurücknehmen');
    await denied(updateDoc(respDoc(db, 'anna'), { days: {}, updatedAt: Date.now() }), 'Tage ändern');
    await denied(updateDoc(respDoc(db, 'anna'), { cancel: null, name: 'Neu' }), 'Absage + Name');
  });
});

/* ======================================================================= */
describe('Teilnehmerliste', () => {
  beforeEach(() =>
    seed(
      'polls/p1',
      poll({ restricted: true, participants: { anna: { on: true, name: 'Anna' }, ben: { on: false, name: 'Ben' } } })
    )
  );

  test('nur Personen auf der Liste dürfen abstimmen', async () => {
    await allowed(setDoc(respDoc(user('anna'), 'anna'), resp()));
    await denied(setDoc(respDoc(user('ben'), 'ben'), resp({ name: 'Ben' })), 'abgewählt');
    await denied(setDoc(respDoc(user('cem'), 'cem'), resp({ name: 'Cem' })), 'nicht auf der Liste');
  });
  test('Nachzügler-Link öffnet auch für Personen ohne Listenplatz', async () => {
    await seed('polls/p1/passes/abc123def456', { until: Date.now() + HOUR });
    await allowed(setDoc(respDoc(user('cem'), 'cem'), resp({ name: 'Cem', pass: 'abc123def456' })));
  });
  test('Teilnahme anfragen: nur für sich selbst, mit Namen', async () => {
    const db = user('cem');
    await allowed(setDoc(doc(db, 'polls/p1/requests/cem'), { name: 'Cem', at: Date.now() }));
    await denied(setDoc(doc(db, 'polls/p1/requests/dana'), { name: 'Dana', at: Date.now() }), 'fremde Anfrage');
    await denied(setDoc(doc(db, 'polls/p1/requests/cem'), { name: '', at: Date.now() }), 'ohne Namen');
    await allowed(getDoc(doc(db, 'polls/p1/requests/cem')));
    await denied(getDocs(collection(db, 'polls/p1/requests')), 'Liste nur für Organisator');
    await allowed(getDocs(collection(owner(), 'polls/p1/requests')));
    await allowed(deleteDoc(doc(owner(), 'polls/p1/requests/cem')));
  });
  test('fremde Anfragen kann man weder lesen noch löschen', async () => {
    await seed('polls/p1/requests/cem', { name: 'Cem', at: Date.now() });
    await denied(getDoc(doc(user('dana'), 'polls/p1/requests/cem')));
    await denied(deleteDoc(doc(user('dana'), 'polls/p1/requests/cem')));
  });
});

/* ======================================================================= */
describe('Neuen Zeitraum vorschlagen', () => {
  const setup = async (extra = {}) => {
    await seed('polls/p1', poll(extra));
    await seed('polls/p1/responses/anna', resp());
  };

  test('„automatisch“: Vorschlag zählt sofort (ok = true)', async () => {
    await setup({ addMode: 'auto' });
    await allowed(propose(user('anna'), 'anna', { ok: true }));
    await denied(propose(user('anna'), 'anna', { ok: false }), 'ok muss zum Modus passen');
  });
  test('„nachfragen“: Vorschlag wartet auf Bestätigung (ok = false)', async () => {
    await setup({ addMode: 'ask' });
    await allowed(propose(user('anna'), 'anna', { ok: false }));
    await denied(propose(user('anna'), 'anna', { ok: true }), 'darf sich nicht selbst bestätigen');
  });
  test('„aus“: keine Vorschläge', async () => {
    await setup({ addMode: 'off' });
    await denied(propose(user('anna'), 'anna', { ok: false }));
    await denied(propose(user('anna'), 'anna', { ok: true }));
  });
  test('nur mit eigener Antwort und nur der eigene Eintrag', async () => {
    await setup({
      addMode: 'auto',
      added: { ben: { from: '2027-01-01', to: '2027-01-02', name: 'Ben', ok: true, at: 1 } },
    });
    await denied(propose(user('cem'), 'cem', {}), 'Cem hat noch keine Antwort');
    await denied(propose(user('anna'), 'ben', {}), 'fremder Eintrag');
    await denied(
      setDoc(doc(user('anna'), 'polls/p1'), { added: { ben: null } }, { merge: true }),
      'fremden Eintrag löschen'
    );
  });
  test('sonst nichts am Event ändern', async () => {
    await setup({ addMode: 'auto' });
    const e = { from: '2026-12-01', to: '2026-12-14', name: 'Anna', ok: true, at: Date.now() };
    await denied(setDoc(doc(user('anna'), 'polls/p1'), { added: { anna: e }, title: 'Anders' }, { merge: true }));
    await denied(
      setDoc(doc(user('anna'), 'polls/p1'), { added: { anna: e }, closesAt: Date.now() + 99 * HOUR }, { merge: true })
    );
  });
  test('Datum muss stimmen', async () => {
    await setup({ addMode: 'auto' });
    await denied(propose(user('anna'), 'anna', { from: '2026-12-14', to: '2026-12-01' }), 'Ende vor Anfang');
    await denied(propose(user('anna'), 'anna', { from: 'morgen' }), 'kein Datum');
    await denied(propose(user('anna'), 'anna', { name: 'x'.repeat(41) }), 'Name zu lang');
  });
  test('geschlossen oder nicht auf der Liste: kein Vorschlag', async () => {
    await setup({ addMode: 'auto', closed: true });
    await denied(propose(user('anna'), 'anna', {}));
    await seed('polls/p2', poll({ addMode: 'auto', restricted: true, participants: {} }));
    await seed('polls/p2/responses/anna', resp());
    await denied(propose(user('anna'), 'anna', {}, 'p2'));
  });
});

/* ======================================================================= */
describe('Nachzügler-Links verwalten', () => {
  test('nur der Organisator legt Links an und sieht die Liste', async () => {
    await allowed(setDoc(doc(owner(), 'polls/p1/passes/abc123def456'), { until: Date.now() + HOUR }));
    await denied(setDoc(doc(user('anna'), 'polls/p1/passes/selbstgemacht'), { until: Date.now() + 99 * HOUR }));
    await denied(getDocs(collection(user('anna'), 'polls/p1/passes')));
    await allowed(getDocs(collection(owner(), 'polls/p1/passes')));
  });
  test('wer den Code kennt, darf genau diesen Eintrag lesen', async () => {
    await seed('polls/p1/passes/abc123def456', { until: Date.now() + HOUR });
    await allowed(getDoc(doc(user('dana'), 'polls/p1/passes/abc123def456')));
    await denied(deleteDoc(doc(user('dana'), 'polls/p1/passes/abc123def456')));
  });
});

/* ======================================================================= */
describe('Private Event-Liste (members)', () => {
  test('nur die Person selbst – auch nicht der Organisator', async () => {
    await allowed(
      setDoc(doc(user('anna'), 'members/anna'), { name: 'Anna', polls: { p1: { t: 'Spieleabend', at: 1 } } })
    );
    await allowed(getDoc(doc(user('anna'), 'members/anna')));
    await denied(getDoc(doc(user('ben'), 'members/anna')));
    await denied(getDoc(doc(owner(), 'members/anna')));
    await denied(setDoc(doc(user('ben'), 'members/anna'), { polls: {} }));
  });
  test('Format wird geprüft', async () => {
    await denied(setDoc(doc(user('anna'), 'members/anna'), { name: 'Anna' }), 'polls fehlt');
    await denied(setDoc(doc(user('anna'), 'members/anna'), { name: 'x'.repeat(41), polls: {} }), 'Name zu lang');
  });
});

/* ======================================================================= */
describe('Konten: Gerätewechsel', () => {
  // Ein Freund mit Benutzername-Konto hat eine Pseudo-Adresse, die nie bestätigt ist.
  const account = uid =>
    env.authenticatedContext(uid, { email: `${uid}@konto.treffpunkt.invalid`, email_verified: false }).firestore();

  test('Konto-Inhaber schreibt die eigene Antwort wie jeder andere', async () => {
    await seed('polls/p1', poll());
    await allowed(setDoc(respDoc(account('anna'), 'anna'), resp()));
    await denied(setDoc(respDoc(account('anna'), 'anon123'), resp()), 'nicht in fremde Antworten');
  });
  test('Konto mit Pseudo-Adresse ist nie Organisator', async () => {
    await denied(getDocs(collection(account('anna'), 'polls')));
  });
  test('Aufräumen nach dem Übernehmen: alte Geräte-Antwort und -Liste löschen – auch wenn die Abstimmung zu ist', async () => {
    await seed('polls/p1', poll({ closed: true }));
    await seed('polls/p1/responses/anon123', resp());
    await seed('members/anon123', { polls: { p1: { t: 'Spieleabend', at: 1 } } });
    await allowed(deleteDoc(respDoc(user('anon123'), 'anon123')));
    await allowed(deleteDoc(doc(user('anon123'), 'members/anon123')));
  });
  test('Event-Liste ins Konto übernehmen (zusammenführen)', async () => {
    await seed('members/anna', { name: 'Anna', polls: { p1: { t: 'Spieleabend', at: 1 } } });
    await allowed(
      setDoc(doc(account('anna'), 'members/anna'), { polls: { p2: { t: 'Bowling', at: 2 } } }, { merge: true })
    );
  });
});

/* ======================================================================= */
describe('Organisatoren (Leitung & Mitorganisatoren)', () => {
  test('Mitorganisator hat alle Organisator-Rechte bei Events', async () => {
    await seed('polls/p1', poll());
    await seed('polls/p1/responses/anna', resp());
    await allowed(getDocs(collection(coOwner(), 'polls')));
    await allowed(getDocs(collection(coOwner(), 'polls/p1/responses')));
    await allowed(updateDoc(doc(coOwner(), 'polls/p1'), { title: 'Neu' }));
  });
  test('nur die Leitung verwaltet Organisatoren', async () => {
    await allowed(getDocs(collection(coOwner(), 'admins')), 'Mitorganisator sieht die Liste');
    await denied(getDocs(collection(user('anna'), 'admins')), 'Freunde nicht');
    await denied(setDoc(doc(coOwner(), 'admins/neu@example.com'), { role: 'co' }));
    await allowed(setDoc(doc(owner(), 'admins/neu@example.com'), { role: 'co', name: 'Neu' }));
    await denied(
      setDoc(doc(owner(), 'admins/Gross@Example.com'), { role: 'co' }),
      'Adresse muss klein geschrieben sein'
    );
    await denied(setDoc(doc(owner(), 'admins/x@example.com'), { role: 'chef' }), 'nur owner/co');
  });
  test('Leitung übergeben (beide Änderungen auf einmal)', async () => {
    const db = owner();
    const b = writeBatch(db);
    b.update(doc(db, `admins/${CO_EMAIL}`), { role: 'owner' });
    b.update(doc(db, `admins/${LEAD_EMAIL}`), { role: 'co' });
    await allowed(b.commit());
  });
  test('Mitorganisator kann austreten, aber niemand anderen entfernen', async () => {
    await denied(deleteDoc(doc(coOwner(), `admins/${LEAD_EMAIL}`)));
    await allowed(deleteDoc(doc(coOwner(), `admins/${CO_EMAIL}`)));
  });
  test('Konto ohne bestätigte Adresse ist nie Organisator', async () => {
    await denied(getDocs(collection(fakeOwner(), 'admins')));
    await denied(getDocs(collection(fakeOwner(), 'polls')));
  });
});

/* ======================================================================= */
describe('Vorlagen und Benachrichtigungen', () => {
  test('Vorlagen nur für Organisatoren', async () => {
    await allowed(setDoc(doc(coOwner(), 'templates/t1'), { name: 'Bowling' }));
    await denied(getDoc(doc(user('anna'), 'templates/t1')));
  });
  test('Benachrichtigungs-Einstellungen: nur die Person selbst, Format geprüft', async () => {
    const ok = { types: { final: true }, discord: { id: '123456789012345678', name: 'anna' }, push: [], cal: null };
    await allowed(setDoc(doc(user('anna'), 'notify/anna'), ok));
    await denied(getDoc(doc(user('ben'), 'notify/anna')));
    await denied(getDoc(doc(owner(), 'notify/anna')), 'auch Organisatoren nicht');
    await denied(setDoc(doc(user('anna'), 'notify/anna'), { ...ok, cal: { token: 'kurz' } }), 'Kalender-Code zu kurz');
    await denied(setDoc(doc(user('anna'), 'notify/anna'), { ...ok, push: Array(11).fill({}) }), 'zu viele Geräte');
    await denied(setDoc(doc(user('anna'), 'notify/anna'), { discord: null }), 'types fehlt');
  });
  test('Versand-Protokoll ist für niemanden in der App lesbar', async () => {
    await denied(getDocs(collection(owner(), 'notifyLog')));
    await denied(setDoc(doc(user('anna'), 'notifyMeta/state'), { x: 1 }));
  });
});

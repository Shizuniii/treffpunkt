/* Mini-Testbibliothek: läuft im Browser (tests/index.html) und in Node (tests/run-unit.js).
   Neue Tests:  suite('Name', t => { t('macht X', () => { assert.eq(f(1), 2); }); });  */

const suites = [];

/** Testgruppe anlegen. `fn` bekommt `t(name, testFn)` zum Registrieren einzelner Tests. */
export function suite(name, fn) {
  const tests = [];
  fn((testName, testFn) => tests.push({ name: testName, fn: testFn }));
  suites.push({ name, tests });
}
export const getSuites = () => suites;

class AssertionError extends Error {}
const show = v => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};
export const assert = {
  ok(v, msg = 'erwartet: wahr') {
    if (!v) throw new AssertionError(`${msg} (war: ${show(v)})`);
  },
  no(v, msg = 'erwartet: falsch') {
    if (v) throw new AssertionError(`${msg} (war: ${show(v)})`);
  },
  eq(actual, expected, msg = '') {
    if (actual !== expected)
      throw new AssertionError(`${msg ? msg + ': ' : ''}erwartet ${show(expected)}, bekommen ${show(actual)}`);
  },
  deep(actual, expected, msg = '') {
    if (show(actual) !== show(expected))
      throw new AssertionError(`${msg ? msg + ': ' : ''}erwartet ${show(expected)}, bekommen ${show(actual)}`);
  },
  includes(list, item, msg = '') {
    if (!list.includes(item)) throw new AssertionError(`${msg ? msg + ': ' : ''}${show(item)} fehlt in ${show(list)}`);
  },
  throws(fn, msg = 'erwartet: Fehler') {
    try {
      fn();
    } catch {
      return;
    }
    throw new AssertionError(msg);
  },
};

/** Führt alle (oder gefilterte) Tests aus. filter: Teil des Gruppen- oder Testnamens. */
export async function runSuites(filter = '', onResult = () => {}) {
  const f = String(filter || '').toLowerCase();
  const results = [];
  for (const s of suites) {
    for (const t of s.tests) {
      if (f && !s.name.toLowerCase().includes(f) && !t.name.toLowerCase().includes(f)) continue;
      const t0 = Date.now();
      let ok = true,
        error = '';
      try {
        await t.fn();
      } catch (e) {
        ok = false;
        error = e && e.message ? e.message : String(e);
      }
      const r = { suite: s.name, test: t.name, ok, error, ms: Date.now() - t0 };
      results.push(r);
      onResult(r);
    }
  }
  return results;
}

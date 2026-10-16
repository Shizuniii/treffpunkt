/* Unit-Tests in Node ausführen:  node tests/run-unit.js [Filter]
   Beispiel: node tests/run-unit.js Auswertung   → nur die Gruppe „Auswertung“ */
import './unit/all.js'; // dieselben Tests wie auf der Browser-Seite tests/
import './node/konto-admin.test.js'; // nur in Node (Admin-Skript)
import './node/notify-tool.test.js'; // nur in Node (Versand-Skript)
import './node/sw.test.js'; // nur in Node (Service Worker)
import './node/tools.test.js'; // nur in Node (Werkzeuge in tools/)
import { runSuites } from './lib/mini-test.js';

const filter = process.argv[2] || '';
let last = '';
const results = await runSuites(filter, r => {
  if (r.suite !== last) {
    console.log(`\n${r.suite}`);
    last = r.suite;
  }
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.test}${r.ok ? '' : `\n      → ${r.error}`}`);
});
const failed = results.filter(r => !r.ok).length;
console.log(
  `\n${results.length - failed} von ${results.length} Tests bestanden${failed ? `, ${failed} fehlgeschlagen` : ''}.`
);
process.exit(failed ? 1 : 0);

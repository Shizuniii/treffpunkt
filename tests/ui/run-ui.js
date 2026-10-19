/* UI-Tests: klicken sich wie ein Mensch durch die Demo-App (Chromium über Playwright).
   Aufruf:  npm run test:ui              alle
            npm run test:ui -- Top 3     nur Tests/Gruppen, deren Name „Top 3“ enthält
   Einmalig vorher: npm install && npx playwright install chromium
   Bildschirmfotos bei Fehlern:  UI_SHOTS=ordner npm run test:ui */
import './participant.ui.js';
import './owner.ui.js';
import './help.ui.js';
import './account.ui.js';
import './organizer.ui.js';
import './notify.ui.js';
import './a11y.ui.js';
import './security.ui.js';
import './share.ui.js';
import { runSuites } from '../lib/mini-test.js';
import { startHarness, stopHarness } from './harness.js';

const filter = process.argv.slice(2).join(' ');
const url = await startHarness();
console.log(`App läuft für die Tests auf ${url}`);
let last = '';
const t0 = Date.now();
const results = await runSuites(filter, r => {
  if (r.suite !== last) {
    console.log(`\n${r.suite}`);
    last = r.suite;
  }
  console.log(
    `  ${r.ok ? '✓' : '✗'} ${r.test} (${(r.ms / 1000).toFixed(1)} s)${r.ok ? '' : `\n      → ${r.error.split('\n')[0]}`}`
  );
});
await stopHarness();
const failed = results.filter(r => !r.ok).length;
console.log(
  `\n${results.length - failed} von ${results.length} UI-Tests bestanden${failed ? `, ${failed} fehlgeschlagen` : ''} (${Math.round((Date.now() - t0) / 1000)} s).`
);
process.exit(failed ? 1 : 0);

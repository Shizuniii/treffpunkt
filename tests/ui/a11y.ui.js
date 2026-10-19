/* Barrierefreiheit: automatische Prüfung mit axe (WCAG 2.1 A/AA) auf allen wichtigen Seiten und Fenstern,
   hell und dunkel – plus Tastatur-Bedienung der Fenster. */
import { createRequire } from 'node:module';
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';
import { demoPatch } from './share.ui.js';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
async function axe(app) {
  await app.page.addScriptTag({ path: AXE });
  const v = await app.page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map(
      v => `${v.id} (${v.nodes.length}×): ${v.nodes[0].target.join(' ')}`
    )
  );
  assert.eq(v.length, 0, v.join(' | '));
}
const ALL = { preset: 'all' };

suite('UI · Barrierefreiheit', t => {
  for (const [name, route, opts] of [
    ['Startseite Organisator (einfach)', '#/', { ownerView: 'simple' }],
    ['Startseite Organisator (ausführlich)', '#/', {}],
    ['Auswertung (einfach)', '#/r/demo1', { ownerView: 'simple' }],
    ['Auswertung (ausführlich)', '#/r/demo1', {}],
    ['Abstimmen (einfach)', '#/p/demo1', {}],
    ['Abstimmen (alle Optionen)', '#/p/demo2', ALL],
    ['Auswertung dunkel', '#/r/demo1', { dark: true }],
    ['Abstimmen dunkel', '#/p/demo2', { ...ALL, dark: true }],
  ])
    t(`axe: ${name}`, ui(route, axe, opts));

  for (const [name, route, open, opts] of [
    ['Hilfe', '#/p/demo1', '[data-act=help-open]', {}],
    ['Benachrichtigungen', '#/p/demo1', '[data-act=notify-open]', {}],
    ['Konto', '#/p/demo1', '[data-act=acc-open]', {}],
    ['Optionen', '#/p/demo1', '.dock [data-act=features-open]', {}],
    ['Organisatoren', '#/', '[data-act=admins-open]', {}],
    ['Nachricht an die Gruppe', '#/r/demo1', '[data-act=message]', {}],
  ])
    t(
      `axe: Fenster ${name}`,
      ui(
        route,
        async app => {
          await app.click(open, 300);
          await axe(app);
        },
        opts
      )
    );

  for (const [name, opts] of [
    ['Auswertung: eine Person ansehen', {}],
    ['Auswertung: eine Person ansehen (dunkel)', { dark: true }],
  ])
    t(
      `axe: ${name}`,
      ui(
        '#/r/demo1',
        async app => {
          await app.click('.person [data-act=pick-only]');
          await axe(app);
        },
        opts
      )
    );

  for (const [name, opts] of [
    ['Auswahl der anderen (Freund, nur ansehen)', {}],
    ['Auswahl der anderen (Freund, dunkel)', { dark: true }],
  ])
    t(
      `axe: ${name}`,
      ui(
        '#/',
        async app => {
          await demoPatch(app, "d.polls.demo2.share = 'all';");
          await app.role('participant');
          await app.goto('#/p/demo1,demo2/demo2');
          await axe(app); // mit Hinweis 👀
          await app.click('.share-note a', 600);
          await axe(app);
        },
        opts
      )
    );
  t(
    'axe: Formular mit Freigabe „ausgewählte Personen“',
    ui('#/', async app => {
      await app.click('[data-act=edit-poll][data-id=demo2]');
      await app.click('details[data-key=openShare] > summary');
      await app.click('[data-act=pf-share][data-v=some]');
      await axe(app);
    })
  );

  t(
    'Fenster: Fokus hinein, Tab bleibt drin, Esc schließt, Fokus zurück',
    ui('#/p/demo1', async app => {
      await app.page.focus('.dock [data-act=features-open]');
      await app.page.keyboard.press('Enter');
      await app.wait(200);
      assert.ok(
        await app.page.evaluate(() => document.querySelector('#sheet-root').contains(document.activeElement)),
        'Fokus im Fenster'
      );
      for (let i = 0; i < 40; i++) await app.page.keyboard.press('Tab');
      assert.ok(
        await app.page.evaluate(() => document.querySelector('#sheet-root').contains(document.activeElement)),
        'Tab verlässt das Fenster nicht'
      );
      await app.page.keyboard.press('Escape');
      await app.wait(150);
      assert.no(await app.has('.sheet'), 'geschlossen');
      assert.ok(
        await app.page.evaluate(
          () => document.activeElement && document.activeElement.matches('[data-act=features-open]')
        ),
        'Fokus zurück auf dem Knopf'
      );
    })
  );

  t(
    'Tage lassen sich mit der Tastatur eintragen',
    ui('#/p/demo1', async app => {
      await app.clickIf('[data-act=copy-dismiss]');
      const [d] = await app.freeDays();
      await app.page.focus(`[data-act=day][data-d="${d}"]`);
      await app.page.keyboard.press('Enter');
      await app.wait(200);
      assert.ok(await app.has(`[data-d="${d}"].st-all`));
    })
  );

  t(
    '200 % Schriftgröße: nichts ragt über den Rand',
    ui('#/p/demo1', async app => {
      await app.page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await app.wait(200);
      assert.ok((await app.overflowX()) <= 0, 'seitliches Scrollen');
    })
  );
});

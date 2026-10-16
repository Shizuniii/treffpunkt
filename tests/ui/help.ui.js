/* UI-Tests für Hilfe, Neuigkeiten, Darstellung auf Handy/PC und die Test-Seite selbst. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

suite('UI · Hilfe', t => {
  const search = async (app, q) => {
    await app.fill('#help-q', q);
    await app.wait(150);
    return {
      guesses: await app.page.$$eval('.guess [data-act=help-topic]', l => l.map(e => e.dataset.v)),
      hits: await app.page.$$eval('.hres [data-act=help-topic]', l => l.map(e => e.dataset.v)),
    };
  };

  t(
    'Suche mit „Meintest du“',
    ui('#/p/demo1', async app => {
      await app.click('[data-act=help-open]');
      assert.includes((await search(app, 'Lieblingsdatum')).guesses, 'favs');
      assert.eq((await search(app, 'ich bin krank')).hits[0], 'cancel');
      const none = await search(app, 'qwertz');
      assert.eq(none.hits.length + none.guesses.length, 0);
    })
  );

  t(
    'Ausgeblendete Funktion über die Hilfe einschalten',
    ui('#/p/demo1', async app => {
      await app.click('[data-act=help-open]');
      await app.click('[data-act=help-topic][data-v=multi]');
      assert.ok(await app.has('.sheet [data-act=feat-on]'), 'Hinweis „ausgeblendet“');
      await app.click('[data-act=help-show]', 700);
      assert.includes(await app.texts('.dock .seg button'), 'Mehrere');
    })
  );

  t(
    '„Was ist neu“ öffnet sich nur auf Klick',
    ui('#/p/demo1', async app => {
      assert.no(await app.has('.sheet'), 'kein Fenster beim Start');
      assert.ok(await app.has('[data-act=help-news]'), '✨ Neu-Knopf');
      await app.click('[data-act=help-news]');
      assert.ok(await app.has('.sheet'));
      await app.reload();
      assert.no(await app.has('.topbar [data-act=help-news]'), 'nach dem Ansehen weg');
    })
  );
});

suite('UI · Darstellung', t => {
  const ROUTES = ['#/', '#/p/demo1', '#/p/demo1,demo2/demo2', '#/r/demo1', '#/r/demo2'];
  const noOverflow = async app => {
    for (const r of ROUTES) {
      await app.goto(r);
      assert.ok((await app.overflowX()) <= 0, 'seitliches Scrollen auf ' + r);
    }
  };
  t('Handy: nichts ragt über den Rand', ui('#/', noOverflow, { preset: 'all' }));
  t('PC, dunkles Design', ui('#/', noOverflow, { preset: 'all', view: 'desktop', dark: true }));
});

suite('UI · Test-Seite', t => {
  t(
    'alle Unit-Tests laufen auch im Browser',
    ui('#/', async app => {
      await app.open('tests/');
      await app.page.waitForFunction(() => window.__testResults, null, { timeout: 15000 });
      const res = await app.page.evaluate(() => window.__testResults);
      const bad = res.filter(r => !r.ok);
      assert.ok(res.length > 20, `${res.length} Tests`);
      assert.eq(bad.length, 0, bad.map(r => `${r.suite}: ${r.test} → ${r.error}`).join('; '));
      assert.eq(await app.count('li.ok'), res.length, 'jeder Test ist auf der Seite grün markiert');
    })
  );
});

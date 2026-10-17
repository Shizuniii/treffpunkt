/* UI-Tests aus Sicht des Organisators – und was Freunde danach sehen. */
import { suite, assert } from '../lib/mini-test.js';
import { ui, inDays } from './harness.js';

suite('UI · Organisator', t => {
  t(
    'Event anlegen und Link bekommen',
    ui('#/', async app => {
      await app.click('[data-act=new-poll]');
      await app.fill('#pf-title', 'Kino');
      await app.click('[data-act=pf-month]');
      await app.click('[data-act=pf-save]', 300);
      assert.includes(await app.text('.sheet .linkbox'), '?demo#/p/', 'Demo-Link bleibt in der Demo');
      const polls = Object.values((await app.demoData()).polls);
      assert.ok(polls.some(p => p.title === 'Kino'));
    })
  );

  t(
    'Titel fehlt → Hinweis statt Speichern',
    ui('#/', async app => {
      await app.click('[data-act=new-poll]');
      await app.click('[data-act=pf-save]');
      assert.includes(await app.toast(), 'Titel');
    })
  );

  t(
    'Tage ausschließen',
    ui('#/', async app => {
      await app.click('[data-act=edit-poll][data-id=demo1]'); // Spieleabend hat in der Demo noch keine ausgeschlossenen Tage
      await app.click('details[data-key=openExcl] > summary');
      await app.click('[data-act=ex-day]:not([disabled])');
      await app.click('[data-act=pf-save]', 300);
      assert.eq((await app.demoData()).polls.demo1.excluded.length, 1);
    })
  );

  t(
    'Auswertung: Filter „mindestens Personen“',
    ui('#/r/demo1', async app => {
      const n2 = await app.count('.dayrow');
      assert.ok(n2 > 0, 'es gibt passende Tage');
      await app.click('[data-act=f-people][data-v="1"]');
      await app.click('[data-act=f-people][data-v="1"]');
      assert.ok((await app.count('.dayrow')) <= n2, 'strengerer Filter → nicht mehr Tage');
    })
  );

  t(
    'Auswertung: eine Person ansehen → ihr Kalender wie beim Abstimmen',
    ui('#/r/demo1', async app => {
      assert.no(await app.has('.pick-banner'), 'am Anfang zählen alle');
      await app.click('.pick-row [data-act=pick]');
      assert.ok(await app.has('.pick-banner'), 'Hinweis, dass nur eine Person gezeigt wird');
      assert.includes(await app.text('.res-grid'), 'Kalender von');
      assert.ok(
        await app.count('.months .cell.st-all, .months .cell.st-part, .months .cell.st-maybe'),
        'Felder wie beim Abstimmen'
      );
      assert.eq(await app.count('.months .cell.heat'), 0, 'keine Häufigkeits-Farben');
      assert.no(await app.has('[data-act=dice]'), 'Würfeln nur, wenn alle zählen');
      await app.click('.pick-banner [data-act=pick-clear]');
      assert.no(await app.has('.pick-banner'));
      assert.ok(await app.count('.months .cell.heat'), 'wieder alle');
    })
  );

  t(
    'Auswertung: mehrere Personen → wann genau diese zusammen können',
    ui('#/r/demo1', async app => {
      const chips = '.pick-row [data-act=pick]';
      await app.click(`${chips} >> nth=0`);
      await app.click(`${chips} >> nth=1`);
      assert.eq(await app.count('.pick-row .chip.on'), 2);
      assert.includes(await app.text('.pick-banner'), 'zusammen');
      const scores = await app.texts('.dayrow .score');
      assert.ok(scores.length && scores.every(s => s.endsWith('/2')), `nur 2 Personen gezählt: ${scores}`);
      assert.ok(await app.count('.months .cell.heat'), 'Häufigkeits-Kalender für die Auswahl');
      await app.click(`${chips} >> nth=1`);
      assert.includes(await app.text('.res-grid'), 'Kalender von', 'zweite abgewählt → nur noch eine');
    })
  );

  t(
    'Auswertung: „Ansehen“ in der Teilnehmerliste; einfacher Überblick zählt weiter alle',
    ui('#/r/demo1', async app => {
      await app.click('.person [data-act=pick-only]');
      assert.eq(await app.count('.pick-row .chip.on'), 1);
      assert.ok(await app.has('.pick-banner'));
      await app.click('[data-act=owner-view][data-v=simple]');
      assert.no(await app.has('.pick-banner'), 'Einfach-Ansicht ist nie gefiltert');
      await app.click('[data-act=owner-view][data-v=details]');
      assert.ok(await app.has('.pick-banner'), 'Auswahl bleibt beim Zurückwechseln');
      await app.goto('#/r/demo2');
      assert.no(await app.has('.pick-banner'), 'gilt nur für dieses Event');
    })
  );

  t(
    'Zeitraum-Vorschlag bestätigen',
    ui('#/r/demo2', async app => {
      await app.click('[data-act=add-ok]', 300);
      assert.ok((await app.demoData()).polls.demo2.added['demo-cem'].ok);
    })
  );

  t(
    'Frist für alle und für eine Person verlängern',
    ui('#/r/demo1', async app => {
      await app.click('[data-act=extend-open]');
      await app.click('[data-act=ext-group][data-v="7"]', 300);
      assert.includes(await app.toast(), 'Verlängert');
      await app.click('.sheet [data-act=person-open][data-id=demo-anna]');
      await app.click('.sheet [data-act=person-ext][data-v="1d"]', 300);
      assert.includes(await app.toast(), 'freigeschaltet');
      const ext = (await app.demoData()).polls.demo1.extensions['demo-anna'];
      assert.ok(ext.until > Date.now() && ext.ask === true);
    })
  );

  t(
    'Termin festlegen, neu eröffnen → Freunde sehen einen Hinweis',
    ui('#/r/demo2', async app => {
      await app.click('.dayrow');
      await app.click('[data-act=set-final]', 300);
      await app.click('[data-act=reopen-open]');
      await app.fill('#ro-note', 'Ben musste absagen');
      await app.click('[data-act=ro-go]', 300);
      assert.includes(await app.toast(), 'Neue Runde');
      await app.click('.sheet [data-act=close-sheet]');
      await app.role('participant');
      await app.goto('#/p/demo2');
      assert.includes((await app.texts('.news li')).join(' '), 'Ben musste absagen');
      await app.click('[data-act=news-ok]', 1000);
      assert.eq(await app.count('.news li'), 0, 'nach Bestätigen weg');
    })
  );

  t(
    'Teilnehmerliste: Anfrage stellen und freigeben',
    ui('#/', async app => {
      await app.click('[data-act=edit-poll][data-id=demo2]');
      await app.click('details[data-key=openPeople] > summary');
      await app.click('[data-act=pf-person][data-id=demo-me]');
      await app.click('[data-act=pf-save]', 300);
      await app.role('participant');
      await app.goto('#/p/demo2');
      assert.ok(await app.has('#rq-name'), 'Anfrage-Formular statt Kalender');
      await app.fill('#rq-name', 'Shy');
      await app.click('[data-act=rq-send]', 300);
      assert.includes(await app.text('.banner.ok'), 'Anfrage gesendet');
      await app.role('owner');
      await app.goto('#/r/demo2');
      await app.click('[data-act=rq-ok][data-id=demo-me]', 300);
      assert.ok((await app.demoData()).polls.demo2.participants['demo-me'].on, 'wieder auf der Liste');
    })
  );

  t(
    'Termin festlegen, spät absagen → Drink-Regel',
    ui('#/r/demo2', async app => {
      const soon = await app.page.$$eval('.cell[data-act=open-day]', l => l.map(e => e.dataset.d));
      const ds = soon.find(d => d > inDays(0) && d < inDays(6));
      assert.ok(ds, 'ein Tag in den nächsten 6 Tagen');
      await app.click(`.cell[data-act=open-day][data-d="${ds}"]`);
      await app.click('[data-act=set-final]', 300);
      assert.ok((await app.demoData()).polls.demo2.final, 'Termin gespeichert');
      await app.role('participant');
      await app.goto('#/p/demo2');
      await app.click('[data-act=cancel-open]');
      await app.click('[data-act=cancel-reason][data-v=other]');
      await app.click('[data-act=cancel-send]', 400);
      assert.includes(await app.text('.final-card .banner'), 'Drink');
      await app.click('[data-act=uncancel]', 400);
      assert.ok(await app.has('[data-act=cancel-open]'), 'Absage zurückgenommen');
    })
  );

  t(
    'Krank absagen → keine Drinks',
    ui('#/r/demo2', async app => {
      const ds = (await app.page.$$eval('.cell[data-act=open-day]', l => l.map(e => e.dataset.d))).find(
        d => d > inDays(0) && d < inDays(6)
      );
      await app.click(`.cell[data-act=open-day][data-d="${ds}"]`);
      await app.click('[data-act=set-final]', 300);
      await app.role('participant');
      await app.goto('#/p/demo2');
      await app.click('[data-act=cancel-open]');
      await app.click('[data-act=cancel-reason][data-v=sick]');
      await app.click('[data-act=cancel-send]', 400);
      const txt = await app.text('.final-card .banner');
      assert.includes(txt, 'krank');
      assert.no(txt.includes('Drink'), 'keine Drinks');
    })
  );
});

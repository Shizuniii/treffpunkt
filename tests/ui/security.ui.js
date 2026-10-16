/* Sicherheitsnetz gegen eingeschleusten Code (XSS): Überall, wo Freunde oder Organisatoren Text eingeben können,
   steht hier ein „Angriff“. Die App muss ihn als Text anzeigen – nichts davon darf ausgeführt werden. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

const EVIL = `<img src=x onerror="window.__xss=1">"'><svg onload="window.__xss=1">`;

/** Demo-Daten mit dem Angriffs-Text in allen frei eingebbaren Feldern. */
async function poison(app) {
  const route = await app.page.evaluate(() => location.hash);
  await app.click('[data-act=demo-reset]', 300); // Demo-Daten einmal speichern, damit wir sie verändern können
  await app.page.evaluate(evil => {
    const d = JSON.parse(localStorage.getItem('treffpunkt-demo-v3'));
    const p1 = d.polls.demo1,
      p2 = d.polls.demo2;
    Object.assign(p1, { title: evil, description: evil, reopenNote: evil, reopenedAt: 1 });
    p2.title = evil;
    p2.participants['demo-ben'].name = evil;
    p2.added['demo-cem'].name = evil;
    p2.final = { date: Object.keys(d.responses.demo2['demo-me'].days)[0], s: 0, e: 1440, note: evil };
    for (const r of Object.values(d.responses.demo1)) Object.assign(r, { name: evil, note: evil });
    d.responses.demo1['demo-ben'].rules[0].label = evil;
    d.responses.demo2['demo-ben'].cancel = { date: p2.final.date, at: 1, reason: 'other', note: evil };
    d.requests.demo2['demo-emil'].name = evil;
    d.admins['evil@example.com'] = { role: 'co', name: evil };
    d.templates = { t1: { name: evil, title: evil, months: 1 } };
    d.members['demo-me'] = { name: evil, polls: { demo1: { t: evil, at: 1 } } };
    d.notify = { 'demo-me': { types: {}, discord: { id: '1', name: evil }, push: [], cal: null, discordError: evil } };
    d.passes = { demo1: { abcdefghijkl: { until: Date.now() + 1e8, label: evil } } };
    localStorage.setItem('treffpunkt-demo-v3', JSON.stringify(d));
  }, EVIL);
  await app.goto(route);
  await app.reload();
}
async function clean(app, where) {
  await app.wait(150);
  const r = await app.page.evaluate(() => ({
    flag: !!window.__xss,
    img: !!document.querySelector('img[src="x"]'),
    svg: !!document.querySelector('svg[onload]'),
  }));
  assert.no(r.flag || r.img || r.svg, `eingeschleuster Code aktiv: ${where} ${JSON.stringify(r)}`);
}

suite('UI · Sicherheit (eingeschleuster Code)', t => {
  t(
    'Organisator: Startseite, Auswertung, Fenster',
    ui('#/', async app => {
      await poison(app);
      await clean(app, 'Startseite ausführlich');
      await app.click('[data-act=owner-view][data-v=simple]');
      await clean(app, 'Startseite einfach');
      await app.click('[data-act=admins-open]');
      await clean(app, 'Organisatoren');
      await app.page.keyboard.press('Escape');
      await app.click('[data-act=new-poll]');
      await clean(app, 'Formular mit Vorlagen');
      for (const route of ['#/r/demo1', '#/r/demo2']) {
        await app.goto(route);
        await clean(app, route + ' einfach');
        await app.click('[data-act=owner-view][data-v=details]');
        await clean(app, route + ' ausführlich');
        await app.click('.dayrow');
        await clean(app, route + ' Tagesdetails');
        await app.page.keyboard.press('Escape');
        await app.click('[data-act=extend-open]');
        await clean(app, route + ' Frist');
        await app.page.keyboard.press('Escape');
        await app.click('[data-act=message]');
        await clean(app, route + ' Nachricht');
        await app.page.keyboard.press('Escape');
        await app.click('[data-act=owner-view][data-v=simple]');
      }
    })
  );

  t(
    'Teilnehmer: Abstimmen, Neuigkeiten, Benachrichtigungen, Startseite',
    ui(
      '#/p/demo1,demo2',
      async app => {
        await poison(app);
        await clean(app, 'Abstimmen');
        await app.goto('#/p/demo1,demo2/demo2');
        await clean(app, 'zweites Event mit Termin');
        await app.click('[data-act=notify-open]', 300);
        await clean(app, 'Benachrichtigungen');
        await app.page.keyboard.press('Escape');
        await app.goto('#/');
        await clean(app, 'Startseite Teilnehmer');
      },
      { preset: 'all' }
    )
  );
});

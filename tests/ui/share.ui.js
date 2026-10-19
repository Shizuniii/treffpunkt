/* UI-Tests: Antworten der anderen sehen (pro Event vom Organisator freigegeben).
   Geprüft wird: Einstellung im Formular, Hinweis beim Abstimmen, Auswertung zum Nur-Ansehen ohne
   Organisator-Knöpfe, und dass ohne Freigabe nichts zu sehen ist. (Die echte Absicherung prüfen die Regel-Tests.) */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

/** Demo-Daten direkt ändern (wie ein Organisator, der gespeichert hat) und Seite neu laden. */
export async function demoPatch(app, fn, arg = null) {
  const route = await app.page.evaluate(() => location.hash);
  await app.click('[data-act=demo-reset]', 300); // Demo-Daten einmal speichern, damit wir sie verändern können
  await app.page.evaluate(
    ([src, a]) => {
      const d = JSON.parse(localStorage.getItem('treffpunkt-demo-v3'));
      new Function('d', 'a', src)(d, a);
      localStorage.setItem('treffpunkt-demo-v3', JSON.stringify(d));
    },
    [fn, arg]
  );
  await app.goto(route);
  await app.reload();
}
const share = (app, pid, mode, viewers = {}) =>
  demoPatch(app, 'd.polls[a.pid].share = a.mode; d.polls[a.pid].viewers = a.viewers;', { pid, mode, viewers });
const ADMIN_ACTS = [
  'share',
  'message',
  'unfinal',
  'extend-open',
  'reopen-open',
  'del-ask',
  'person-open',
  'dice',
  'add-no',
];

suite('UI · Antworten freigeben', t => {
  t(
    'Organisator: Freigabe im Formular einstellen und speichern',
    ui('#/', async app => {
      await app.click('[data-act=edit-poll][data-id=demo2]');
      await app.click('details[data-key=openShare] > summary');
      await app.click('[data-act=pf-share][data-v=some]');
      await app.click('[data-act=pf-save]', 300);
      assert.includes(await app.toast(), 'mindestens eine Person', 'ohne Auswahl nicht speichern');
      await app.click('[data-act=pf-viewer][data-id=demo-ben]');
      await app.click('[data-act=pf-save]', 300);
      const p = (await app.demoData()).polls.demo2;
      assert.eq(p.share, 'some');
      assert.ok(p.viewers['demo-ben'].on, 'Ben darf ansehen');
      await app.goto('#/r/demo2');
      await app.click('[data-act=owner-view][data-v=details]');
      assert.includes(await app.text('.share-line'), 'Ben', 'Organisator sieht, wer freigeschaltet ist');
    })
  );

  t(
    'Freund mit Freigabe „alle“: Hinweis, Knopf und Auswertung nur zum Ansehen',
    ui('#/', async app => {
      await share(app, 'demo2', 'all');
      await app.role('participant');
      await app.goto('#/p/demo1,demo2/demo2');
      assert.includes(await app.text('.share-note'), 'alle, die abgestimmt haben');
      await app.click('.share-note a', 600);
      assert.ok(await app.count('.dayrow'), 'beste Tage zu sehen');
      assert.ok(await app.has('.pick-row'), 'Personen ansehen geht auch');
      for (const a of ADMIN_ACTS) assert.no(await app.has(`#app [data-act="${a}"]`), `kein Organisator-Knopf: ${a}`);
      await app.click('.person [data-act=pick-only]');
      assert.includes(await app.text('.res-grid'), 'Kalender von');
      await app.click('.dayrow', 300);
      assert.ok(await app.has('.sheet .tline'), 'Tagesdetails: wer kann wann');
      assert.no(await app.has('.sheet [data-act=set-final]'), 'kein Termin festlegen');
    })
  );

  t(
    'Freund ohne eigene Antwort: erst abstimmen – ohne Freigabe: gar nichts',
    ui('#/', async app => {
      await share(app, 'demo1', 'all');
      await app.role('participant');
      await app.goto('#/p/demo1,demo2');
      assert.includes(await app.text('.share-note'), 'Sobald du etwas eingetragen hast');
      assert.no(await app.has('.share-note a'), 'noch kein Knopf');
      await app.goto('#/r/demo1');
      assert.includes(await app.text('#app'), 'Erst selbst abstimmen');
      assert.no(await app.has('.dayrow'));
      await app.goto('#/r/demo2');
      assert.includes(await app.text('#app'), 'nur der Organisator');
      assert.no(await app.has('.dayrow'), 'Bowling ist nicht freigegeben');
      await app.goto('#/p/demo1,demo2/demo2');
      assert.no(await app.has('.share-note'), 'kein Hinweis ohne Freigabe');
    })
  );

  t(
    'Freigabe „nur ausgewählte“: nur wer ausgewählt ist, bekommt den Knopf',
    ui('#/', async app => {
      await share(app, 'demo2', 'some', { 'demo-ben': { on: true, name: 'Ben' } });
      await app.role('participant');
      await app.goto('#/p/demo1,demo2/demo2');
      assert.includes(await app.text('.share-note'), 'ausgewählte Personen');
      assert.no(await app.has('.share-note a'), 'Shy ist nicht ausgewählt');
      await share(app, 'demo2', 'some', { 'demo-me': { on: true, name: 'Shy' } });
      assert.ok(await app.has('.share-note a'), 'jetzt ausgewählt');
    })
  );

  t(
    'Notizen an den Organisator bleiben beim Ansehen verborgen',
    ui('#/', async app => {
      await demoPatch(
        app,
        `d.polls.demo2.share = 'all';
         d.responses.demo2['demo-ben'].note = 'GEHEIM-NOTIZ';
         d.responses.demo2['demo-ben'].cancel = { date: '2099-01-01', reason: 'other', note: 'GEHEIM-ABSAGE' };`
      );
      await app.role('participant');
      await app.goto('#/r/demo2');
      assert.ok(await app.count('.person'), 'Teilnehmer zu sehen');
      assert.no((await app.text('#app')).includes('GEHEIM'), 'Notizen nicht angezeigt');
    })
  );
});

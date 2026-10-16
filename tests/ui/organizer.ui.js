/* UI-Tests für Organisator-Werkzeuge: einfacher Überblick, Nachrichten, Vorlagen, Wiederverwenden, Mitorganisatoren. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

const SIMPLE = { ownerView: 'simple' };

suite('UI · Organisator: einfacher Überblick', t => {
  t(
    'Startseite: Fortschritt, bester Tag, was wartet – Rest unter „Mehr“',
    ui(
      '#/',
      async app => {
        await app.wait(400);
        const card = await app.text('.ov-card');
        assert.includes(card, 'fertig');
        assert.includes(await app.text('#app'), 'Bester Tag bisher');
        assert.includes(await app.text('#app'), 'wartet auf dich');
        assert.no(await app.has('[data-act=edit-poll]'), 'Bearbeiten erst unter „Mehr“');
        await app.click('[data-act=more][data-id=demo1]');
        assert.ok(await app.has('[data-act=edit-poll][data-id=demo1]'));
      },
      SIMPLE
    )
  );

  t(
    'Umschalten auf „Ausführlich“ bleibt gespeichert',
    ui(
      '#/',
      async app => {
        await app.click('[data-act=owner-view][data-v=details]');
        assert.ok(await app.has('[data-act=edit-poll][data-id=demo1]'));
        await app.reload();
        assert.ok(await app.has('[data-act=edit-poll][data-id=demo1]'), 'nach Neuladen');
      },
      SIMPLE
    )
  );

  t(
    'Auswertung einfach: Status, wer fehlt, Top 3, dann Details',
    ui(
      '#/r/demo2',
      async app => {
        assert.includes(await app.text('.ov-status'), 'Fehlt noch');
        assert.ok(await app.has('[data-act=rq-ok]'), 'Anfrage direkt zulassen');
        assert.ok((await app.count('.dayrow')) <= 3, 'höchstens 3 Tage');
        assert.no(await app.has('#f-maybe'), 'keine Filter');
        await app.click('[data-act=owner-view][data-v=details]');
        assert.ok(await app.has('#f-maybe'), 'Details mit Filtern');
      },
      SIMPLE
    )
  );

  t(
    'Termin im einfachen Überblick festlegen',
    ui(
      '#/r/demo1',
      async app => {
        await app.click('.dayrow');
        await app.click('[data-act=set-final]', 400);
        assert.includes(await app.text('.final-card'), 'Der Termin steht');
      },
      SIMPLE
    )
  );

  t(
    'Eine Stelle für Nachrichten an die Gruppe',
    ui(
      '#/r/demo1',
      async app => {
        await app.click('[data-act=remind]');
        assert.includes(await app.text('.sheet'), 'Kleine Erinnerung');
        await app.click('.sheet [data-act=msg-kind][data-v=status]');
        assert.includes(await app.text('.sheet .linkbox'), 'besten Termine');
      },
      SIMPLE
    )
  );
});

suite('UI · Organisator: Vorlagen & Wiederverwenden', t => {
  t(
    'Schnellstart „Spieleabend“ füllt das Formular',
    ui('#/', async app => {
      await app.click('[data-act=new-poll]');
      await app.click('[data-act=tpl-use][data-id=b-spiele]');
      assert.eq(await app.page.inputValue('#pf-title'), 'Spieleabend');
      assert.deep(await app.page.$$eval('[data-act=pf-wd].on', l => l.map(e => e.dataset.v)), ['4', '5', '6'], 'Fr–So');
      assert.ok(await app.page.isChecked('#pf-dl-on'), 'Frist an');
      await app.click('[data-act=pf-save]', 400);
      const polls = Object.values((await app.demoData()).polls);
      const p = polls.find(x => x.title === 'Spieleabend' && x.createdAt > Date.now() - 60000);
      assert.ok(p && p.closesAt > Date.now(), 'mit Frist gespeichert');
    })
  );

  t(
    'Eigene Vorlage speichern und wieder benutzen',
    ui('#/', async app => {
      await app.click('[data-act=tpl-save-open][data-id=demo2]');
      await app.fill('#tpl-name', 'Mein Bowling');
      await app.click('.sheet form button[type=submit]', 300);
      assert.includes(await app.toast(), 'Mein Bowling');
      await app.click('[data-act=new-poll]');
      assert.includes(await app.text('#pollform'), 'Mein Bowling');
      await app.click('#pollform [data-act=tpl-use]:last-of-type');
      assert.eq(await app.page.inputValue('#pf-title'), 'Bowling');
      await app.click('details[data-key=openPeople] > summary');
      assert.ok((await app.count('[data-act=pf-person].on')) >= 3, 'Teilnehmerliste übernommen');
    })
  );

  t(
    'Nochmal mit neuem Zeitraum',
    ui('#/', async app => {
      await app.click('[data-act=reuse-poll][data-id=demo1]');
      assert.eq(await app.page.inputValue('#pf-title'), 'Spieleabend', 'kein „(Kopie)“');
      assert.includes(await app.text('#pollform h2'), 'wie „Spieleabend“');
      await app.click('[data-act=pf-save]', 400);
      const n = Object.values((await app.demoData()).polls).filter(p => p.title === 'Spieleabend').length;
      assert.eq(n, 2);
    })
  );

  t(
    'Weitere Einstellungen sind eingeklappt',
    ui('#/', async app => {
      await app.click('[data-act=new-poll]');
      assert.no(await app.page.isVisible('[data-act=pf-maybe][data-v="1"]'), 'Vielleicht-Limit versteckt');
      await app.click('details[data-key=openMore] > summary');
      assert.ok(await app.page.isVisible('[data-act=pf-maybe][data-v="1"]'));
    })
  );

  t(
    'Freischalten und persönlicher Link an einer Stelle',
    ui('#/r/demo1', async app => {
      await app.click('[data-act=extend-open]');
      const txt = await app.text('.sheet');
      assert.includes(txt, 'nachträglich öffnen');
      assert.includes(txt, 'noch gar nicht abgestimmt');
    })
  );
});

suite('UI · Organisator: Mitorganisatoren', t => {
  t(
    'Hinzufügen, Leitung übergeben, danach nur noch Mitorganisator',
    ui('#/', async app => {
      await app.click('[data-act=admins-open]');
      assert.includes(await app.text('.sheet'), 'Leitung');
      await app.fill('#adm-name', 'Ben');
      await app.fill('#adm-email', 'Ben@Example.com');
      await app.click('.sheet form button[type=submit]', 400);
      assert.includes(await app.text('.sheet'), 'ben@example.com', 'klein geschrieben');
      await app.click('[data-act=adm-lead][data-id="ben@example.com"]');
      await app.click('[data-act=adm-lead-yes]', 400);
      const a = (await app.demoData()).admins;
      assert.eq(a['ben@example.com'].role, 'owner');
      assert.eq(a['shy@example.com'].role, 'co');
      assert.no(await app.has('#adm-email'), 'kein Hinzufügen mehr');
      assert.ok(await app.has('[data-act=adm-leave]'), 'Austreten möglich');
    })
  );
});

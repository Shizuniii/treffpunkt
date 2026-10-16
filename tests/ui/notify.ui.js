/* UI-Tests für Benachrichtigungen. In der Demo werden Discord, Push und Kalender nur simuliert –
   getestet wird, dass alles freiwillig ist, sich einzeln ein- und ausschalten lässt und richtig gespeichert wird. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

const VOTE = '#/p/demo1';
const mine = async app => {
  const d = await app.demoData();
  return d ? (d.notify || {})[d.session.uid] || null : null; // null = noch nichts gespeichert
};
const open = async app => {
  await app.click('[data-act=notify-open]', 300);
};

suite('UI · Benachrichtigungen', t => {
  t(
    'standardmäßig aus – nichts gespeichert, bis man etwas einschaltet',
    ui(VOTE, async app => {
      await open(app);
      assert.includes(await app.text('.sheet'), 'Ganz freiwillig');
      assert.includes(await app.text('.sheet'), 'sobald du oben einen Weg einschaltest');
      assert.eq(await mine(app), null);
    })
  );

  t(
    'Discord verbinden und trennen',
    ui(VOTE, async app => {
      await open(app);
      await app.click('[data-act=nf-discord]', 300);
      assert.includes(await app.text('.sheet'), 'Verbunden als');
      assert.ok((await mine(app)).discord.id);
      await app.click('[data-act=nf-discord-off]', 300);
      assert.eq((await mine(app)).discord, null);
    })
  );

  t(
    'Push auf diesem Gerät ein- und ausschalten',
    ui(VOTE, async app => {
      await open(app);
      await app.click('[data-act=nf-push]', 300);
      assert.includes(await app.text('.sheet'), 'Eingeschaltet auf diesem Gerät');
      assert.eq((await mine(app)).push.length, 1);
      await app.click('[data-act=nf-push-off]', 300);
      assert.eq((await mine(app)).push.length, 0);
    })
  );

  t(
    'Kalender-Abo erst nach Zustimmung, mit geheimer Adresse',
    ui(VOTE, async app => {
      await open(app);
      assert.includes(await app.text('.sheet'), 'geheime Adresse');
      await app.click('[data-act=nf-cal]', 300);
      const cal = (await mine(app)).cal;
      assert.ok(/^[a-z0-9]{32}$/.test(cal.token), 'geheimer Code');
      const href = await app.page.getAttribute('.sheet a[href^="webcal:"]', 'href');
      assert.includes(href, `/cal/${cal.token}.ics`);
      await app.page.check('#nf-cal-deadlines');
      await app.wait(300);
      assert.ok((await mine(app)).cal.deadlines, 'Fristen auf Wunsch');
      await app.click('[data-act=nf-cal-off]', 300);
      assert.eq((await mine(app)).cal, null);
    })
  );

  t(
    'Arten einzeln wählen',
    ui(VOTE, async app => {
      await open(app);
      await app.click('[data-act=nf-discord]', 300);
      await app.page.uncheck('[data-nf-type=final]');
      await app.wait(300);
      const n = await mine(app);
      assert.eq(n.types.final, false);
      assert.eq(n.types.deadline, true);
      assert.no(await app.has('[data-nf-type=o-votes]'), 'Organisator-Arten nur für Organisatoren');
    })
  );

  t(
    'Organisator sieht zusätzliche Arten',
    ui('#/', async app => {
      await open(app);
      assert.ok(await app.has('[data-nf-type=o-votes]'));
      assert.ok(await app.has('[data-nf-type=o-requests]'));
    })
  );

  t(
    'nach dem Abstimmen: Hinweis auf Benachrichtigungen',
    ui(VOTE, async app => {
      await app.clickIf('[data-act=copy-dismiss]');
      await app.tapDay((await app.freeDays())[0]);
      await app.click('[data-act=done]', 800);
      assert.ok(await app.has('.done-card [data-act=notify-open]'));
    })
  );

  t(
    'Rückkehr von Discord: Konto-ID holen, speichern, alte Seite wiederherstellen',
    ui(VOTE, async app => {
      let auth = '';
      await app.page.route('https://discord.com/api/users/@me', route => {
        auth = route.request().headers().authorization;
        route.fulfill({ json: { id: '123456789', username: 'anna_d', global_name: 'Anna' } });
      });
      await app.page.evaluate(() =>
        sessionStorage.setItem('tp-discord', JSON.stringify({ state: 'abc', hash: '#/p/demo1' }))
      );
      await app.goto('#token_type=Bearer&access_token=xyz&expires_in=604800&scope=identify&state=abc');
      await app.reload();
      await app.wait(500);
      assert.eq(auth, 'Bearer xyz');
      assert.eq(await app.page.evaluate(() => location.hash), '#/p/demo1', 'zurück auf der Abstimmung');
      assert.includes(await app.toast(), 'Discord verbunden als Anna');
      assert.eq((await mine(app)).discord.id, '123456789');
      assert.ok(await app.has('.sheet [data-act=nf-discord-off]'), 'Einstellungen offen');
    })
  );

  t(
    'Rückkehr von Discord mit falschem Sicherheitscode wird abgelehnt',
    ui(VOTE, async app => {
      await app.page.route('https://discord.com/api/users/@me', route => route.fulfill({ json: { id: '1' } }));
      await app.page.evaluate(() =>
        sessionStorage.setItem('tp-discord', JSON.stringify({ state: 'abc', hash: '#/p/demo1' }))
      );
      await app.goto('#token_type=Bearer&access_token=xyz&state=FALSCH');
      await app.reload();
      await app.wait(500);
      assert.includes(await app.toast(), 'Sicherheitsprüfung');
      assert.eq(await mine(app), null, 'nichts gespeichert');
    })
  );
});

/* UI-Tests für Konten (Benutzername + Passwort). In der Demo werden Konten im Browser simuliert;
   „anderes Gerät“ = abmelden (neue, leere Identität) und wieder anmelden. */
import { suite, assert } from '../lib/mini-test.js';
import { ui } from './harness.js';

const VOTE = '#/p/demo1';
const me = async app => {
  const d = await app.demoData();
  return { uid: d.session.uid, email: d.session.email, d };
};
/** Konto-Fenster öffnen und ein Formular ausfüllen + abschicken. */
async function account(app, mode, user, pw) {
  if (!(await app.has('.sheet #acc-user'))) await app.click('[data-act=acc-open]');
  if (mode) await app.click(`.sheet [data-act=acc-mode][data-v=${mode}]`);
  await app.fill('#acc-user', user);
  if (pw !== undefined) await app.fill('#acc-pw', pw);
  await app.click('.sheet form button[type=submit]', 600);
}
const startVoting = async app => {
  await app.clickIf('[data-act=copy-dismiss]');
  await app.fill('#v-name', 'Testi');
};

suite('UI · Konto', t => {
  t(
    'Konto anlegen: Antworten bleiben, Name wird angezeigt',
    ui(VOTE, async app => {
      await startVoting(app);
      const [d] = await app.freeDays();
      await app.tapDay(d);
      await app.wait(900);
      const before = (await me(app)).uid;
      await account(app, 'create', 'Testi', 'geheim1');
      assert.includes(await app.text('.sheet h2'), 'Konto angelegt');
      await app.click('.sheet [data-act=close-sheet]');
      const after = await me(app);
      assert.eq(after.uid, before, 'gleiche interne ID → Antworten bleiben');
      assert.ok(after.d.responses.demo1[after.uid].days[d], 'Tag ist noch da');
      assert.includes(await app.text('[data-help=name]'), 'Angemeldet als testi');
    })
  );

  t(
    'Benutzername vergeben, Passwort zu kurz, falsches Passwort',
    ui(VOTE, async app => {
      await startVoting(app);
      await account(app, 'create', 'testi', '123');
      assert.includes(await app.text('.sheet .banner.bad'), 'mindestens 6');
      await account(app, null, 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-signout]', 600);
      assert.includes(await app.toast(), 'Abgemeldet');
      await account(app, 'create', 'Testi', 'anderes1');
      assert.includes(await app.text('.sheet .banner.bad'), 'gibt es schon');
      await account(app, 'login', 'testi', 'falsch99');
      assert.includes(await app.text('.sheet .banner.bad'), 'stimmt nicht');
    })
  );

  t(
    'Zweites Gerät: ohne Konto abgestimmt, dann angemeldet → wird übernommen',
    ui(VOTE, async app => {
      await startVoting(app);
      const days = await app.freeDays();
      await app.tapDay(days[0]);
      await app.wait(900);
      await account(app, 'create', 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      const accountUid = (await me(app)).uid;
      // „anderes Gerät“: abmelden → leere Identität, dort einen anderen Tag eintragen
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-signout]', 600);
      const anon = (await me(app)).uid;
      assert.ok(anon !== accountUid, 'neue Identität nach dem Abmelden');
      await startVoting(app);
      await app.tapDay(days[1]);
      await app.wait(900);
      await account(app, 'login', 'TESTI', 'geheim1');
      assert.includes(await app.text('.sheet'), 'Von diesem Gerät übernommen');
      const after = await me(app);
      assert.eq(after.uid, accountUid, 'jetzt im Konto');
      const days1 = Object.keys(after.d.responses.demo1[accountUid].days);
      assert.includes(days1, days[1], 'neuere Antwort vom Gerät gilt');
      assert.no(after.d.responses.demo1[anon], 'keine doppelte Antwort in der Auswertung');
      await app.click('.sheet [data-act=close-sheet]');
      assert.ok(await app.has(`[data-d="${days[1]}"].st-all`), 'im Kalender sichtbar');
    })
  );

  t(
    'Anmelden auf leerem Gerät: Konto-Antwort bleibt unangetastet',
    ui(VOTE, async app => {
      await startVoting(app);
      const [d] = await app.freeDays();
      await app.tapDay(d);
      await app.wait(900);
      await account(app, 'create', 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-signout]', 600);
      await account(app, 'login', 'testi', 'geheim1');
      assert.no((await app.text('.sheet')).includes('übernommen'), 'nichts zu übernehmen');
      await app.click('.sheet [data-act=close-sheet]');
      assert.ok(await app.has(`[data-d="${d}"].st-all`), 'Tag aus dem Konto ist da');
    })
  );

  t(
    'Teilnehmerliste: mit Konto anmelden statt Anfrage stellen',
    ui(VOTE, async app => {
      // „Shy“ steht beim Bowling auf der Liste. Konto anlegen, abmelden → fremd → anmelden → wieder drin.
      await app.clickIf('[data-act=copy-dismiss]');
      await account(app, 'create', 'shy', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-signout]', 600);
      await app.goto('#/p/demo2');
      assert.ok(await app.has('#rq-name'), 'ohne Konto: nur Anfrage möglich');
      await app.click('[data-act=acc-open][data-v=login]');
      await account(app, null, 'shy', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      assert.no(await app.has('#rq-name'), 'nach dem Anmelden: abstimmen');
      assert.ok(await app.has('[data-act=day]'));
    })
  );

  t(
    'Startseite: anmelden und eigene Events sehen',
    ui(VOTE, async app => {
      await startVoting(app);
      const [d] = await app.freeDays();
      await app.tapDay(d);
      await app.wait(900);
      await account(app, 'create', 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-signout]', 600);
      await app.goto('#/');
      assert.no((await app.text('#app')).includes('Spieleabend'), 'ohne Konto keine Events');
      await app.click('[data-act=acc-open][data-v=login]');
      await account(app, null, 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      assert.includes(await app.text('#app'), 'Angemeldet als testi');
      assert.includes(await app.text('#app'), 'Spieleabend');
    })
  );

  t(
    'Passwort vergessen: Benutzername → Organisator fragen, E-Mail → Link',
    ui(VOTE, async app => {
      await app.click('[data-act=acc-open]');
      await app.click('.sheet [data-act=acc-mode][data-v=login]');
      await app.click('.sheet [data-act=acc-mode][data-v=forgot]');
      await account(app, null, 'anna');
      // Nur prüfen, dass der Hinweis für Benutzernamen kommt – der genaue Wortlaut darf sich ändern.
      assert.includes(await app.text('.sheet .banner.info'), 'Benutzernamen');
      assert.no(await app.has('.sheet .banner.ok'), 'kein E-Mail-Link bei Benutzernamen');
      await account(app, null, 'anna@example.com');
      assert.includes(await app.text('.sheet .banner.ok'), 'E-Mail');
    })
  );

  t(
    'Passwort ändern',
    ui(VOTE, async app => {
      await startVoting(app);
      await account(app, 'create', 'testi', 'geheim1');
      await app.click('.sheet [data-act=close-sheet]');
      await app.click('[data-act=acc-open]');
      await app.fill('#acc-pw', 'neuesPW1');
      await app.click('.sheet form button[type=submit]', 400);
      assert.includes(await app.toast(), 'Passwort geändert');
      const d = await app.demoData();
      assert.eq(Object.values(d.accounts)[0].pw, 'neuesPW1');
    })
  );

  t(
    'Enter-Taste schickt das Formular ab',
    ui(VOTE, async app => {
      await startVoting(app);
      await app.click('[data-act=acc-open]');
      await app.fill('#acc-user', 'enteruser');
      await app.fill('#acc-pw', 'geheim1');
      await app.page.press('#acc-pw', 'Enter');
      await app.wait(600);
      assert.includes(await app.text('.sheet h2'), 'Konto angelegt');
    })
  );
});

/* Tests für tools/konto-admin.js – mit einem Ersatz für Firebase, berührt also kein echtes Projekt.
   Nur in Node (nicht auf der Browser-Testseite), weil das Skript Node-Funktionen nutzt. */
import { suite, assert } from '../lib/mini-test.js';
import { newPassword, run } from '../../tools/konto-admin.js';
import { ACCOUNT_DOMAIN } from '../../js/core/account.js';

/** Ersatz für Firebase-Admin-Auth mit ein paar Konten. */
function fakeAuth() {
  const users = [
    { uid: 'u1', email: `anna@${ACCOUNT_DOMAIN}`, providerData: [{ providerId: 'password' }], metadata: {} },
    { uid: 'u2', email: 'ben@example.com', providerData: [{ providerId: 'password' }], metadata: {} },
    { uid: 'u3', email: 'shy@gmail.com', providerData: [{ providerId: 'google.com' }], metadata: {} },
    { uid: 'u4', providerData: [], metadata: {} }, // anonym
  ];
  return {
    users,
    listUsers: async () => ({ users }),
    getUserByEmail: async email => {
      const u = users.find(x => x.email === email);
      if (!u) throw Object.assign(new Error('nope'), { code: 'auth/user-not-found' });
      return u;
    },
    updateUser: async (uid, patch) =>
      Object.assign(
        users.find(x => x.uid === uid),
        patch
      ),
  };
}
const capture = () => {
  const lines = [];
  return { lines, out: s => lines.push(s), text: () => lines.join('\n') };
};

suite('Admin-Skript (Konten)', t => {
  t('liste zeigt nur Konten mit Passwort', async () => {
    const o = capture();
    assert.eq(await run(['liste'], fakeAuth(), o.out), 0);
    assert.eq(o.lines.length, 2);
    assert.ok(o.lines[0].startsWith('anna') && o.lines[0].includes('Benutzername'));
    assert.ok(o.text().includes('ben@example.com'));
    assert.no(o.text().includes('shy@gmail.com'), 'Google-Konten nicht');
  });
  t('Passwort setzen per Benutzername', async () => {
    const a = fakeAuth(),
      o = capture();
    assert.eq(await run(['passwort', 'Anna', 'neuesPW1'], a, o.out), 0);
    assert.eq(a.users[0].password, 'neuesPW1');
    assert.includes(o.text(), 'neuesPW1');
  });
  t('ohne Angabe wird ein Zufalls-Passwort erzeugt', async () => {
    const a = fakeAuth();
    await run(['passwort', 'anna'], a, () => {});
    assert.ok(/^[a-z2-9]{5}-[a-z2-9]{5}$/.test(a.users[0].password), a.users[0].password);
    assert.ok(newPassword() !== newPassword(), 'zufällig');
  });
  t('Fehler: unbekannt, zu kurz, unbekannter Befehl', async () => {
    const o = capture();
    assert.eq(await run(['passwort', 'gibtsnicht', 'abcdef'], fakeAuth(), o.out), 1);
    assert.includes(o.text(), 'Kein Konto');
    assert.eq(await run(['passwort', 'anna', '123'], fakeAuth(), () => {}), 1);
    assert.eq(await run(['quatsch'], fakeAuth(), () => {}), 1);
  });
  t('sperren und entsperren', async () => {
    const a = fakeAuth();
    await run(['sperren', 'ben@example.com'], a, () => {});
    assert.eq(a.users[1].disabled, true);
    await run(['entsperren', 'ben@example.com'], a, () => {});
    assert.eq(a.users[1].disabled, false);
  });
});

/* Tests für den Service Worker (sw.js): Push-Nachrichten anzeigen und beim Antippen öffnen.
   sw.js läuft hier in einer Sandbox mit nachgebauten Browser-Teilen (Browser im Test zeigen keine Mitteilungen). */
import { suite, assert } from '../lib/mini-test.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadSw() {
  const handlers = {},
    shown = [],
    opened = [],
    focused = [];
  const self = {
    addEventListener: (type, fn) => (handlers[type] = fn),
    registration: { showNotification: async (title, opt) => shown.push({ title, ...opt }) },
    clients: {
      claim: async () => {},
      matchAll: async () => self.openWindows,
      openWindow: async url => opened.push(url),
    },
    location: { origin: 'https://x' },
    openWindows: [],
  };
  vm.runInNewContext(readFileSync(new URL('../../sw.js', import.meta.url), 'utf8'), {
    self,
    caches: {},
    fetch,
    URL,
    Response,
    console,
  });
  const fire = async (type, event) => {
    let p = null;
    handlers[type]({ ...event, waitUntil: x => (p = x) });
    await p;
  };
  return { fire, shown, opened, focused, self };
}

suite('Service Worker (Push)', t => {
  t('Push-Nachricht wird mit Titel, Text und Link angezeigt', async () => {
    const sw = loadSw();
    const payload = { title: 'Kino: Der Termin steht!', body: 'Samstag', url: 'https://x/#/p/k', tag: 'final|k' };
    await sw.fire('push', { data: { json: () => payload, text: () => JSON.stringify(payload) } });
    assert.eq(sw.shown.length, 1);
    assert.eq(sw.shown[0].title, payload.title);
    assert.eq(sw.shown[0].body, 'Samstag');
    assert.eq(sw.shown[0].data.url, payload.url);
  });
  t('kaputte Nachricht → trotzdem eine Mitteilung', async () => {
    const sw = loadSw();
    await sw.fire('push', {
      data: {
        json: () => {
          throw new Error('kein JSON');
        },
        text: () => 'Hallo',
      },
    });
    assert.eq(sw.shown[0].title, 'Treffpunkt');
    assert.eq(sw.shown[0].body, 'Hallo');
  });
  t('Antippen öffnet die Seite – oder holt ein offenes Fenster nach vorn', async () => {
    const sw = loadSw();
    const note = { close() {}, data: { url: 'https://x/#/p/k' } };
    await sw.fire('notificationclick', { notification: note });
    assert.deep(sw.opened, ['https://x/#/p/k']);
    const sw2 = loadSw();
    const win = {
      focused: false,
      nav: null,
      focus() {
        this.focused = true;
      },
      navigate(u) {
        this.nav = u;
        return Promise.resolve();
      },
    };
    sw2.self.openWindows = [win];
    await sw2.fire('notificationclick', { notification: note });
    assert.ok(win.focused);
    assert.eq(win.nav, 'https://x/#/p/k');
    assert.eq(sw2.opened.length, 0);
  });
});

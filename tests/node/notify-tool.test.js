/* Tests für tools/notify.js (Versand über GitHub Actions) – mit Ersatz für Discord und Push, ohne Netz. */
import { suite, assert } from '../lib/mini-test.js';
import {
  buildActions,
  calendarHash,
  deliver,
  discordSender,
  loadData,
  logId,
  saveResults,
} from '../../tools/notify.js';
import { defaultTypes } from '../../js/core/notify.js';

const NOW = new Date(2026, 10, 1, 12).getTime();
const data = (extra = {}) => ({
  polls: [{ id: 'p', title: 'Kino', months: ['2026-11'], final: { date: '2026-11-07', s: 1080, e: 1440 } }],
  responses: {
    p: [{ uid: 'anna', name: 'Anna', days: { '2026-11-07': { s: 0, e: 1440 } }, rules: [], done: true, updatedAt: 1 }],
  },
  requests: {},
  notify: {
    anna: {
      types: defaultTypes(false),
      discord: { id: '111' },
      push: [{ endpoint: 'https://push/1', keys: {} }],
      cal: { token: 'a'.repeat(24) },
    },
    ben: { types: defaultTypes(false) }, // kein Kanal
  },
  admins: [],
  meta: { initAt: 1 },
  sent: new Set(),
  ...extra,
});

suite('Versand-Skript (Benachrichtigungen)', t => {
  t('Termin steht → Discord und Push an Anna, Bestätigung beim ersten Mal', () => {
    const a = buildActions({ data: data(), now: NOW, site: 'https://x/' });
    const final = a.deliveries.filter(d => d.key.startsWith('final|'));
    assert.deep(final.map(d => d.channel).sort(), ['discord', 'push']);
    assert.includes(final.find(d => d.channel === 'discord').text, 'Der Termin steht');
    assert.ok(a.deliveries.some(d => d.key.startsWith('welcome-discord|anna|111')));
    assert.ok(a.deliveries.some(d => d.key.startsWith('welcome-push|anna|')));
  });
  t('erster Lauf: alte Ereignisse nur merken, nichts verschicken (außer Bestätigung)', () => {
    const a = buildActions({ data: data({ meta: null }), now: NOW, site: '', init: true });
    assert.no(a.deliveries.some(d => d.key.startsWith('final|')));
    assert.ok(
      a.logKeys.some(k => k.startsWith('final|')),
      'trotzdem als erledigt gemerkt'
    );
  });
  t('schon verschickt → nichts Neues', () => {
    const first = buildActions({ data: data(), now: NOW, site: '' });
    const again = buildActions({ data: data({ sent: new Set(first.logKeys) }), now: NOW, site: '' });
    assert.eq(again.deliveries.length, 0);
  });
  t('Kalender-Abo: Datei pro Person, Fingerabdruck ohne Zeitstempel', () => {
    const a1 = buildActions({ data: data(), now: NOW, site: '' });
    const a2 = buildActions({ data: data(), now: NOW + 60000, site: '' });
    assert.includes(a1.calendars['a'.repeat(24)], 'SUMMARY:Kino');
    assert.eq(
      calendarHash(a1.calendars),
      calendarHash(a2.calendars),
      'nur die Zeit anders → kein neues Veröffentlichen'
    );
  });
  t('Fehler werden gemerkt: Discord-DM gesperrt, Push-Gerät abgemeldet', async () => {
    const a = buildActions({ data: data(), now: NOW, site: '' });
    const res = await deliver(
      a.deliveries,
      {
        discord: async () => {
          throw Object.assign(new Error('Cannot send messages to this user'), { code: 50007, status: 403 });
        },
        push: async () => {
          throw Object.assign(new Error('gone'), { statusCode: 410 });
        },
      },
      () => {}
    );
    assert.includes(res.discordErrors.anna, 'Discord-Server');
    assert.deep(res.removePush.map(r => r.endpoint).slice(0, 1), ['https://push/1']);
    assert.eq(res.ok, 0);
  });
  t('Discord: erst Direktnachricht-Kanal, dann Nachricht', async () => {
    const calls = [];
    const fake = async (url, opt) => {
      calls.push([url.replace('https://discord.com/api/v10', ''), JSON.parse(opt.body)]);
      return { ok: true, status: 200, json: async () => ({ id: 'chan9' }) };
    };
    await discordSender('TOKEN', fake)('111', 'Hallo');
    assert.deep(calls[0], ['/users/@me/channels', { recipient_id: '111' }]);
    assert.eq(calls[1][0], '/channels/chan9/messages');
    assert.eq(calls[1][1].content, 'Hallo');
  });

  t('Laden und Speichern mit der Firebase-Admin-Schnittstelle (Ersatz)', async () => {
    // Mini-Ersatz für firebase-admin/firestore: Sammlungen als { pfad: { id: daten } }
    const store = {
      polls: { p: { title: 'Kino', months: ['2026-11'] } },
      'polls/p/responses': { anna: { name: 'Anna' } },
      'polls/p/requests': {},
      notify: { anna: { types: { final: true }, discord: { id: '1' } } },
      admins: { 'shy@x.de': { role: 'owner' } },
      notifyLog: { a: { key: 'final|p|x' } },
      notifyMeta: {},
    };
    const snapOf = (col, id) => ({
      id,
      data: () => store[col][id],
      ref: { collection: sub => colRef(`${col}/${id}/${sub}`) },
    });
    const colRef = col => ({ get: async () => ({ docs: Object.keys(store[col] || {}).map(id => snapOf(col, id)) }) });
    const written = [];
    const db = {
      collection: colRef,
      doc: path => ({
        path,
        get: async () => {
          const i = path.lastIndexOf('/');
          const d = (store[path.slice(0, i)] || {})[path.slice(i + 1)];
          return { exists: !!d, data: () => d };
        },
      }),
      batch: () => ({ set: (ref, data, opt) => written.push([ref.path, data, opt]), commit: async () => {} }),
    };
    const data = await loadData(db);
    assert.eq(data.polls[0].title, 'Kino');
    assert.eq(data.responses.p[0].uid, 'anna');
    assert.deep(data.admins, ['shy@x.de']);
    assert.ok(data.sent.has('final|p|x'));
    assert.eq(data.meta, null, 'erster Lauf');
    const FieldValue = { delete: () => '<löschen>' };
    await saveResults(db, FieldValue, {
      logKeys: ['k1'],
      res: { discordErrors: { anna: null }, removePush: [] },
      data,
      now: 5,
      calHash: 'h',
    });
    assert.deep(written[0], [`notifyLog/${logId('k1')}`, { key: 'k1', at: 5 }, undefined]);
    assert.deep(written[1][1], { discordError: '<löschen>' });
    assert.eq(written[2][0], 'notifyMeta/state');
  });
});

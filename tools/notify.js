/* Benachrichtigungen verschicken und Kalender-Abos erzeugen.
   Läuft über GitHub Actions (.github/workflows/notify.yml, alle 15 Minuten) – nie im Browser.

   Einstellungen (GitHub → Repository → Settings → Secrets and variables → Actions):
     FIREBASE_SERVICE_ACCOUNT   Secret    Inhalt des Firebase-Admin-Schlüssels (JSON)
     SITE_URL                   Variable  Adresse der App, z. B. https://name.github.io/treffpunkt/
     DISCORD_BOT_TOKEN          Secret    optional: Token des Discord-Bots (für Discord-Nachrichten)
     VAPID_PUBLIC_KEY           Variable  optional: für Push-Nachrichten (npm run push-schluessel)
     VAPID_PRIVATE_KEY          Secret    optional: dazu passender privater Schlüssel

   Aufruf:  node tools/notify.js                   planen, verschicken, Kalender schreiben
            node tools/notify.js --calendars-only  nur Kalender-Dateien schreiben (beim normalen Veröffentlichen)
            node tools/notify.js --dry-run         nur anzeigen, was passieren würde
   Kalender-Dateien landen in CAL_DIR (Standard: _cal). */
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icsFeed } from '../js/core/calexport.js';
import { calendarEntries, discordText, hasChannel, planNotifications } from '../js/core/notify.js';

const sha = s => createHash('sha256').update(s).digest('hex');
export const logId = key => sha(key).slice(0, 24);

/* ---------- Daten laden (Firebase Admin) ---------- */
export async function loadData(db) {
  const polls = [],
    responses = {},
    requests = {};
  for (const d of (await db.collection('polls').get()).docs) {
    polls.push({ id: d.id, ...d.data() });
    responses[d.id] = (await d.ref.collection('responses').get()).docs.map(x => ({ ...x.data(), uid: x.id }));
    requests[d.id] = (await d.ref.collection('requests').get()).docs.map(x => ({ ...x.data(), uid: x.id }));
  }
  const notify = Object.fromEntries((await db.collection('notify').get()).docs.map(d => [d.id, d.data()]));
  const admins = (await db.collection('admins').get()).docs.map(d => d.id);
  const metaSnap = await db.doc('notifyMeta/state').get();
  const sent = new Set((await db.collection('notifyLog').get()).docs.map(d => d.data().key));
  return { polls, responses, requests, notify, admins, meta: metaSnap.exists ? metaSnap.data() : null, sent };
}

/* ---------- Was ist zu tun? (rein, getestet) ---------- */
/**
 * Ergebnis: { deliveries: [{ channel, uid, target, text|payload, key }], logKeys: [key], calendars: { token: ics } }
 * init = allererster Lauf: alles bisher Geschehene nur als „erledigt“ merken, nichts verschicken.
 */
export function buildActions({ data, adminUids = new Set(), now, site, init = false }) {
  const subs = Object.entries(data.notify)
    .filter(([, n]) => hasChannel(n))
    .map(([uid, n]) => ({ uid, types: n.types || {}, admin: adminUids.has(uid) }));
  const planned = planNotifications({
    polls: data.polls,
    responses: data.responses,
    requests: data.requests,
    subs,
    sent: data.sent,
    now,
    site,
  });
  const deliveries = [],
    logKeys = planned.map(m => m.key);
  const toUser = (uid, m) => {
    const n = data.notify[uid] || {};
    if (n.discord && n.discord.id)
      deliveries.push({ channel: 'discord', uid, target: n.discord.id, text: discordText(m), key: m.key });
    for (const sub of n.push || [])
      deliveries.push({
        channel: 'push',
        uid,
        target: sub,
        payload: { title: m.title, body: m.body, url: m.url, tag: m.key },
        key: m.key,
      });
  };
  if (!init) for (const m of planned) for (const uid of m.to) toUser(uid, m);
  // Bestätigung, sobald jemand einen Kanal neu eingerichtet hat – so sieht man sofort, dass es funktioniert.
  for (const [uid, n] of Object.entries(data.notify)) {
    if (n.discord && n.discord.id) {
      const key = `welcome-discord|${uid}|${n.discord.id}`;
      if (!data.sent.has(key)) {
        logKeys.push(key);
        deliveries.push({
          channel: 'discord',
          uid,
          target: n.discord.id,
          key,
          text: '**Treffpunkt ist verbunden ✅**\nAb jetzt bekommst du hier die Nachrichten, die du ausgewählt hast. Ändern kannst du das jederzeit in der App unter „🔔 Benachrichtigungen“.',
        });
      }
    }
    for (const sub of n.push || []) {
      const key = `welcome-push|${uid}|${sha(sub.endpoint || '').slice(0, 16)}`;
      if (!data.sent.has(key)) {
        logKeys.push(key);
        deliveries.push({
          channel: 'push',
          uid,
          target: sub,
          key,
          payload: { title: 'Treffpunkt ✅', body: 'Push-Nachrichten sind eingeschaltet.', url: site, tag: key },
        });
      }
    }
  }
  const calendars = {};
  for (const [uid, n] of Object.entries(data.notify))
    if (n.cal && n.cal.token)
      calendars[n.cal.token] = icsFeed(
        calendarEntries({ uid, polls: data.polls, responses: data.responses, withDeadlines: !!n.cal.deadlines, site }),
        { name: 'Treffpunkt', now }
      );
  return { deliveries, logKeys, calendars };
}

/** Fingerabdruck aller Kalender (ohne Zeitstempel) – ändert er sich, wird die Seite neu veröffentlicht. */
export const calendarHash = cals =>
  sha(
    Object.keys(cals)
      .sort()
      .map(k => k + '\n' + cals[k].replace(/^DTSTAMP:.*$/gm, ''))
      .join('\n---\n')
  );

/* ---------- Verschicken ---------- */
/**
 * senders: { discord(userId, text), push(subscription, payload) } – werfen bei Fehlern.
 * Ergebnis: { ok, failed, discordErrors: { uid: text|null }, removePush: [{ uid, endpoint }] }
 */
export async function deliver(deliveries, senders, log = console.warn) {
  const res = { ok: 0, failed: 0, discordErrors: {}, removePush: [] };
  for (const d of deliveries) {
    try {
      if (d.channel === 'discord') {
        if (!senders.discord) continue;
        await senders.discord(d.target, d.text);
        if (!(d.uid in res.discordErrors)) res.discordErrors[d.uid] = null;
      } else if (d.channel === 'push') {
        if (!senders.push) continue;
        await senders.push(d.target, d.payload);
      }
      res.ok++;
    } catch (e) {
      res.failed++;
      if (d.channel === 'discord')
        res.discordErrors[d.uid] =
          e.code === 50007
            ? 'Der Bot kann dir keine Nachricht schicken. Bist du auf dem Discord-Server, auf dem der Treffpunkt-Bot ist, und erlaubst Direktnachrichten?'
            : `Discord-Fehler ${e.status || ''} ${e.message || ''}`.trim();
      if (d.channel === 'push' && (e.statusCode === 404 || e.statusCode === 410))
        res.removePush.push({ uid: d.uid, endpoint: d.target.endpoint }); // Gerät abgemeldet → Abo entfernen
      log(`[${d.channel}] ${d.uid}: ${e.message || e}`);
    }
  }
  return res;
}

export function discordSender(token, fetchFn = fetch) {
  const api = 'https://discord.com/api/v10';
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const call = async (path, body, retry = true) => {
    const r = await fetchFn(api + path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (r.status === 429 && retry) {
      const b = await r.json().catch(() => ({}));
      await new Promise(ok => setTimeout(ok, Math.ceil((b.retry_after || 1) * 1000)));
      return call(path, body, false);
    }
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      throw Object.assign(new Error(b.message || 'Discord'), { status: r.status, code: b.code });
    }
    return r.json();
  };
  const channels = {};
  return async (userId, content) => {
    channels[userId] ||= (await call('/users/@me/channels', { recipient_id: userId })).id;
    await call(`/channels/${channels[userId]}/messages`, {
      content: content.slice(0, 1900),
      allowed_mentions: { parse: [] },
    });
  };
}

/* ---------- Ergebnisse speichern ---------- */
export async function saveResults(db, FieldValue, { logKeys, res, data, now, calHash }) {
  const writes = [];
  for (const key of logKeys) writes.push(b => b.set(db.doc(`notifyLog/${logId(key)}`), { key, at: now }));
  for (const [uid, err] of Object.entries(res.discordErrors || {}))
    writes.push(b => b.set(db.doc(`notify/${uid}`), { discordError: err || FieldValue.delete() }, { merge: true }));
  const byUid = {};
  for (const r of res.removePush || []) (byUid[r.uid] ||= new Set()).add(r.endpoint);
  for (const [uid, gone] of Object.entries(byUid)) {
    const push = ((data.notify[uid] || {}).push || []).filter(s => !gone.has(s.endpoint));
    writes.push(b => b.set(db.doc(`notify/${uid}`), { push }, { merge: true }));
  }
  writes.push(b =>
    b.set(
      db.doc('notifyMeta/state'),
      { lastRun: now, initAt: (data.meta && data.meta.initAt) || now, calHash },
      { merge: true }
    )
  );
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(w => w(batch));
    await batch.commit();
  }
}

export function writeCalendars(dir, cals) {
  mkdirSync(dir, { recursive: true });
  for (const [token, ics] of Object.entries(cals))
    if (/^[a-z0-9]{24,40}$/.test(token)) writeFileSync(join(dir, `${token}.ics`), ics);
}

/* ---------- Start (GitHub Actions) ---------- */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.log('FIREBASE_SERVICE_ACCOUNT fehlt – Benachrichtigungen und Kalender-Abos sind aus.');
    process.exit(0);
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getAuth } = await import('firebase-admin/auth');
  initializeApp({ credential: cert(JSON.parse(raw)) });
  const db = getFirestore(),
    auth = getAuth(),
    now = Date.now();
  const site = (process.env.SITE_URL || '').replace(/\/?$/, '/');
  const data = await loadData(db);
  const adminUids = new Set();
  for (const email of data.admins)
    try {
      adminUids.add((await auth.getUserByEmail(email)).uid);
    } catch {}
  const init = !data.meta;
  const actions = buildActions({ data, adminUids, now, site, init });
  const calHash = calendarHash(actions.calendars);
  writeCalendars(process.env.CAL_DIR || '_cal', actions.calendars);
  const changed = !data.meta || data.meta.calHash !== calHash;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `cal_changed=${changed}\n`);
  console.log(
    `${Object.keys(actions.calendars).length} Kalender${changed ? ' (geändert)' : ''}, ${actions.deliveries.length} Nachrichten geplant${init ? ' (erster Lauf: alte Ereignisse werden nur gemerkt)' : ''}.`
  );
  if (args.has('--dry-run')) {
    for (const d of actions.deliveries) console.log(`→ ${d.channel} ${d.uid}: ${d.text || d.payload.title}`);
    process.exit(0);
  }
  if (args.has('--calendars-only')) {
    await db.doc('notifyMeta/state').set({ calHash }, { merge: true });
    process.exit(0);
  }
  const senders = {};
  if (process.env.DISCORD_BOT_TOKEN) senders.discord = discordSender(process.env.DISCORD_BOT_TOKEN);
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(site || 'https://github.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    senders.push = (sub, payload) => webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 24 * 3600 });
  }
  const res = await deliver(actions.deliveries, senders);
  await saveResults(db, FieldValue, { logKeys: actions.logKeys, res, data, now, calHash });
  console.log(`Verschickt: ${res.ok}, fehlgeschlagen: ${res.failed}.`);
}

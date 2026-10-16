/* Benachrichtigungen einstellen: Arten wählen, Discord verbinden, Push auf diesem Gerät, Kalender-Abo.
   Gespeichert wird nur in notify/<eigene ID> (nur für einen selbst lesbar). Verschickt wird von GitHub Actions
   (tools/notify.js). Welche Wege es gibt, hängt davon ab, was der Organisator eingerichtet hat (config.js). */
import { defaultTypes } from '../core/notify.js';
import { rid } from '../core/util.js';
import { isIOS, isStandalone } from '../ui/dom.js';
import { B, CFG, DEMO, S, isOwner, lsGet, lsSet } from './state.js';

/** Welche Wege eingerichtet sind. In der Demo wird alles simuliert. */
export const channels = () => ({
  discord: DEMO || !!CFG.discordClientId,
  push:
    DEMO ||
    (!!CFG.vapidPublicKey && typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator),
  cal: DEMO || !!CFG.calendar,
});
export const anyChannel = () => Object.values(channels()).some(Boolean);

export async function loadNotify() {
  await B.ensureUser();
  S.notify = (await B.getNotify().catch(() => null)) || null;
  return S.notify;
}
/** Aktueller Stand (oder Standard, solange noch nichts gespeichert ist). */
export const notifyDraft = () => S.notify || { types: defaultTypes(isOwner()), discord: null, push: [], cal: null };

async function save(patch) {
  const n = { ...notifyDraft(), ...patch, updatedAt: Date.now() };
  delete n.discordError; // wird vom Versand neu gesetzt, falls es wieder hakt
  await B.saveNotify(n);
  S.notify = n;
}

export const setType = (id, on) => save({ types: { ...notifyDraft().types, [id]: !!on } });

/* ---------- Discord ---------- */
/** Ordner-Adresse der App (ohne index.html) – so muss sie auch bei Discord als Redirect eingetragen sein. */
const appUrl = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
/** Zu Discord weiterleiten („Mit Discord verbinden“). Discord schickt uns danach mit einem Zugangscode zurück. */
export async function startDiscord() {
  if (DEMO) return save({ discord: { id: '000000000000000000', name: 'du (Demo)' } });
  const state = rid(16);
  try {
    sessionStorage.setItem('tp-discord', JSON.stringify({ state, hash: location.hash }));
  } catch {}
  const q = new URLSearchParams({
    client_id: CFG.discordClientId,
    response_type: 'token',
    redirect_uri: appUrl(),
    scope: 'identify',
    state,
  });
  location.href = `https://discord.com/oauth2/authorize?${q}`;
}
/** Beim Start: Kommen wir gerade von Discord zurück? Dann Konto-ID holen, speichern, alte Seite wiederherstellen. */
export async function finishDiscord() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!h.has('access_token') && !h.has('error')) return null;
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem('tp-discord') || '{}');
    sessionStorage.removeItem('tp-discord');
  } catch {}
  history.replaceState(null, '', location.pathname + location.search + (saved.hash || '#/'));
  if (h.has('error')) return { err: 'Discord-Verbindung abgebrochen.' };
  if (!saved.state || saved.state !== h.get('state'))
    return { err: 'Discord-Verbindung fehlgeschlagen (Sicherheitsprüfung). Bitte nochmal versuchen.' };
  try {
    const r = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${h.get('token_type') || 'Bearer'} ${h.get('access_token')}` },
    });
    if (!r.ok) throw new Error('Discord ' + r.status);
    const u = await r.json();
    await loadNotify();
    await save({ discord: { id: String(u.id), name: u.global_name || u.username || 'Discord' } });
    return { ok: true, name: u.global_name || u.username };
  } catch (e) {
    console.warn(e);
    return { err: 'Discord-Verbindung fehlgeschlagen. Bitte nochmal versuchen.' };
  }
}
export const disconnectDiscord = () => save({ discord: null });

/* ---------- Push auf diesem Gerät ---------- */
const b64ToU8 = b64 => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
export const thisDevicePush = () => {
  const ep = lsGet('tp-push-endpoint');
  return !!ep && (notifyDraft().push || []).some(x => x.endpoint === ep);
};
/** Ergebnis: { ok } oder { err: 'iphone' | 'denied' | Text } */
export async function enablePush() {
  let sub;
  if (DEMO) sub = { endpoint: 'demo:' + rid(8), keys: {} };
  else {
    if (isIOS && !isStandalone()) return { err: 'iphone' };
    if ((await Notification.requestPermission()) !== 'granted') return { err: 'denied' };
    const reg = await navigator.serviceWorker.ready;
    const s =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CFG.vapidPublicKey) }));
    const j = s.toJSON();
    sub = { endpoint: j.endpoint, keys: j.keys };
  }
  const push = [
    ...(notifyDraft().push || []).filter(x => x.endpoint !== sub.endpoint),
    { ...sub, at: Date.now() },
  ].slice(-10);
  lsSet('tp-push-endpoint', sub.endpoint);
  await save({ push });
  return { ok: true };
}
export async function disablePush() {
  const ep = lsGet('tp-push-endpoint');
  if (!DEMO)
    try {
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.getSubscription();
      if (s) await s.unsubscribe();
    } catch (e) {
      console.warn(e);
    }
  await save({ push: (notifyDraft().push || []).filter(x => x.endpoint !== ep) });
}

/* ---------- Kalender-Abo ---------- */
/** Erst nach ausdrücklicher Zustimmung: geheimen Code anlegen. Die Datei entsteht beim nächsten Versand-Lauf. */
export const enableCalendar = () => save({ cal: { token: rid(32), deadlines: false } });
export const setCalDeadlines = on => save({ cal: { ...notifyDraft().cal, deadlines: !!on } });
export const disableCalendar = () => save({ cal: null });
export const calUrl = token => `${appUrl()}cal/${token}.ics`;
export const webcalUrl = token => calUrl(token).replace(/^https?:/, 'webcal:');
export const googleCalUrl = token =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(token))}`;

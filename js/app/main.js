/* Einstiegspunkt: startet die App, Update-Prüfung, Service Worker. */
import { loadRoute } from './router.js';
import { backOnline } from './save.js';
import { APP_VERSION, DEMO, S, TODAY, lsGet, setBackend, setInstallEvt } from './state.js';
import { makeDemo } from '../backend/demo.js';
import { makeFirebase } from '../backend/firebase.js';
import { remainText, toYmd } from '../core/dates.js';
import { pollClosed } from '../core/poll.js';
import { $, toast } from '../ui/dom.js';
import { openNotify } from '../ui/notify.js';
import { finishDiscord } from './notify.js';
import { setRetro } from '../ui/fun.js';
import { initSeenVersion } from '../ui/help.js';
import { render } from '../ui/render.js';
import './events.js'; // registriert alle Klick-/Eingabe-Handler

export async function checkUpdate() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.version && j.version !== APP_VERSION && !S.updateAvailable) {
      S.updateAvailable = true;
      render();
    }
  } catch {}
}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
  navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  setInstallEvt(e);
  render();
});
// Offline / wieder online: Hinweis oben ein- und ausblenden, Gemerktes nachsenden
window.addEventListener('offline', () => render());
window.addEventListener('online', () => {
  render();
  backOnline();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkUpdate();
    if (toYmd(new Date()) !== TODAY && S.route.name !== 'vote') loadRoute();
  }
});
export let lastClosed = null;
setInterval(() => {
  const cd = $('#countdown');
  if (cd && S.poll && S.poll.closesAt) cd.textContent = remainText(S.poll.closesAt);
  const c = pollClosed(S.poll);
  if (lastClosed !== null && c !== lastClosed) render();
  lastClosed = c;
}, 30000);
(async () => {
  initSeenVersion();
  if (lsGet('tp-retro') === '1') setRetro(true);
  render();
  try {
    setBackend(DEMO ? makeDemo() : await makeFirebase());
  } catch (e) {
    console.error(e);
    $('#app').innerHTML =
      `<div class="wrap"><div class="banner bad">Firebase konnte nicht geladen werden. Prüfe config.js und deine Internetverbindung.</div></div>`;
    return;
  }
  // Zurück von „Mit Discord verbinden“? Erst das erledigen, dann die eigentliche Seite laden.
  const discord = await finishDiscord();
  if (DEMO && location.hash.startsWith('#/p/')) S.demoRole = 'participant';
  await loadRoute();
  if (discord) {
    toast(discord.err || `Discord verbunden${discord.name ? ` als ${discord.name}` : ''} ✓`);
    if (!discord.err) openNotify();
  }
  checkUpdate();
})();

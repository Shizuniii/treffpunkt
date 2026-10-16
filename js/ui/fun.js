/* Extras: Erfolge, Konfetti, Würfel, Retro-Cheat. */
import { S, lsGet, lsSet } from '../app/state.js';
import { feat } from '../app/prefs.js';
import { fmtDate } from '../core/dates.js';
import { maybeLimit } from '../core/poll.js';
import { esc } from '../core/util.js';
import { $, sheetHead, toast } from './dom.js';
import { computeResults } from './results.js';
import { renderSheet } from './sheets.js';
import { maybeCount } from './vote.js';

/* ---------- Gimmicks: Erfolge, Konfetti, Würfel, Cheat ---------- */
export const EMOJIS = ['🐸', '🦊', '🐼', '🐙', '👾', '🎮', '🐱', '🐶', '🦄', '🍕', '🌵', '🐧', '🐉', '🍄'];
export const LOADING = [
  'Lade Freundschaften …',
  'Spawne Kalender …',
  'Suche Lobby …',
  'Würfle Initiative …',
  'Respawn in 3, 2, 1 …',
  'Synchronisiere Ausreden …',
  'Lade Speicherstand …',
];
export const LOAD_TXT = LOADING[Math.floor(Math.random() * LOADING.length)];
export const ACH = {
  first: ['🥇', 'Erste Runde', 'Deine erste Antwort abgeschickt'],
  speedrun: ['⚡', 'Speedrunner (Any%)', 'In unter einer Minute fertig abgestimmt'],
  routine: ['🔁', 'Gewohnheitstier', 'Eine Wiederholung angelegt'],
  weekend: ['🛋️', 'Wochenend-Krieger', 'Alle Wochenenden auf einmal eingetragen'],
  schroedinger: ['🐈', 'Schrödingers Katze', 'Alle Vielleicht-Plätze aufgebraucht'],
  night: ['🦉', 'Nachteule', 'Zwischen 0 und 5 Uhr abgestimmt'],
  ctrlc: ['📋', 'Strg+C, Strg+V', 'Termine aus einem anderen Event übernommen'],
  ctrlz: ['⏪', 'Zeitreisender', '5× Rückgängig gedrückt'],
  party: ['🎟️', 'Season Pass', 'In allen Events eines Links fertig'],
  honest: ['🍻', 'Ehrenmann / Ehrenfrau', 'Fair abgesagt'],
  gm: ['🧙', 'Game Master', 'Einen Termin festgelegt'],
  dice: ['🎲', 'RNG-Gott', 'Den Termin auswürfeln lassen'],
  cheat: ['👾', 'Cheat-Code', 'Ein Geheimnis gefunden'],
};
export function achGot() {
  try {
    const a = JSON.parse(lsGet('tp-ach') || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
export let achQ = [],
  achBusy = false;
export function unlock(key) {
  if (!ACH[key] || !feat('fun')) return;
  const got = achGot();
  if (got.includes(key)) return;
  got.push(key);
  lsSet('tp-ach', JSON.stringify(got));
  achQ.push(key);
  if (!achBusy) showAch();
  const c = $('#achcount');
  if (c) c.textContent = `🏆 ${got.length}/${Object.keys(ACH).length} Erfolge`;
}
export function showAch() {
  const r = $('#ach-root'),
    key = achQ.shift();
  if (!key) {
    achBusy = false;
    r.innerHTML = '';
    return;
  }
  achBusy = true;
  const [ic, t] = ACH[key];
  r.innerHTML = `<div class="ach" role="status"><span class="ach-ic">${ic}</span><span class="stack" style="gap:0"><span class="eyebrow">Erfolg freigeschaltet</span><b>${esc(t)}</b></span></div>`;
  setTimeout(showAch, 3200);
}
export function sheetAch() {
  const got = achGot();
  return `${sheetHead(`Erfolge · ${got.length}/${Object.keys(ACH).length}`)}<p class="small muted">Nur zum Spaß und nur auf diesem Gerät gespeichert.</p>
    <div class="achlist">${Object.entries(ACH)
      .map(([k, [ic, t, d]]) => {
        const on = got.includes(k);
        return `<div class="achrow ${on ? 'on' : ''}"><span class="ach-ic">${on ? ic : '🔒'}</span><span class="stack" style="gap:0"><b>${on ? esc(t) : '???'}</b><span class="small muted">${!on && k === 'cheat' ? 'Manche Dinge muss man nur oft genug antippen …' : esc(d)}</span></span></div>`;
      })
      .join('')}</div>`;
}
export function confetti(n = 90) {
  if (!feat('fun') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.createElement('div');
  root.className = 'confetti';
  root.setAttribute('aria-hidden', 'true');
  const colors = ['#0F7B5A', '#35BF8D', '#EDC24A', '#3A86D1', '#C2410C', '#BE185D'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.35 + 's';
    c.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    c.style.setProperty('--dx', Math.round(Math.random() * 160 - 80) + 'px');
    c.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
    root.appendChild(c);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 3600);
}
export function doneFx(wasDone) {
  if (!wasDone) {
    confetti();
    toast('GG! Deine Antwort ist gespeichert.');
    unlock('first');
    if (Date.now() - S.openedAt < 60000) unlock('speedrun');
  }
  if (new Date().getHours() < 5) unlock('night');
  if (S.route.ids.length > 1 && S.route.ids.every(id => id === S.route.id || (S.myAll[id] && S.myAll[id].done)))
    unlock('party');
}
export function checkMaybeAch() {
  const lim = maybeLimit(S.poll);
  if (lim > 0 && maybeCount() >= lim) unlock('schroedinger');
}
export function fullPartyFx() {
  const p = S.poll;
  if (!p || !p.expected || S.route.name !== 'results') return;
  const done = S.responses.filter(x => x.done && x.name).length;
  if (done >= p.expected && lsGet('tp-full-' + p.id) !== '1') {
    lsSet('tp-full-' + p.id, '1');
    confetti();
    toast(`Full Party! Alle ${p.expected} haben abgestimmt 🎉`);
  }
}
export function diceCands() {
  const R = computeResults();
  if (!R.ranked.length) return [];
  const t = R.ranked[0];
  return R.ranked
    .filter(d => d.score === t.score && d.maybeIn.length === t.maybeIn.length)
    .slice(0, 8)
    .map(d => d.ds);
}
export let diceIv = null;
export function rollDice(cands) {
  clearInterval(diceIv);
  S.sheet = { type: 'dice', cands, cur: 0, done: false };
  renderSheet();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let n = 0;
  diceIv = setInterval(
    () => {
      if (!S.sheet || S.sheet.type !== 'dice') {
        clearInterval(diceIv);
        return;
      }
      S.sheet.cur = Math.floor(Math.random() * cands.length);
      if (++n >= (reduce ? 1 : 14)) {
        clearInterval(diceIv);
        S.sheet.done = true;
        unlock('dice');
      }
      renderSheet();
    },
    reduce ? 10 : 110
  );
}
export function sheetDice() {
  const s = S.sheet,
    ds = s.cands[s.cur];
  return `${sheetHead('Auswürfeln')}<p class="small muted">${s.cands.length} Tage sind gleich gut. Lass den Würfel entscheiden, die Entscheidung triffst am Ende trotzdem du.</p>
    <div class="dice ${s.done ? '' : 'roll'}" aria-hidden="true">🎲</div>
    <div style="text-align:center" aria-live="polite"><span class="eyebrow">${s.done ? 'Das Schicksal hat entschieden' : 'Würfelt …'}</span><h2 style="margin-top:4px">${fmtDate(ds, true)}</h2></div>
    ${s.done ? `<div class="row" style="justify-content:center"><button class="btn primary" data-act="open-day" data-d="${ds}">Tag ansehen</button><button class="btn" data-act="dice-again">Nochmal würfeln</button></div>` : ''}`;
}
export let verTaps = 0,
  verT = null;
export function verTap() {
  verTaps++;
  clearTimeout(verT);
  verT = setTimeout(() => {
    verTaps = 0;
  }, 2500);
  if (verTaps >= 7) {
    verTaps = 0;
    cheat();
  } else if (verTaps >= 4) toast(`Noch ${7 - verTaps}× tippen … 👀`);
}
export function setRetro(on) {
  document.documentElement.classList.toggle('retro', on);
  if (on && !document.getElementById('retro-font')) {
    const l = document.createElement('link');
    l.id = 'retro-font';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    document.head.appendChild(l);
  }
  lsSet('tp-retro', on ? '1' : '');
}
export function cheat() {
  const on = !document.documentElement.classList.contains('retro');
  setRetro(on);
  confetti();
  unlock('cheat');
  toast(
    on
      ? 'Cheat aktiviert: Retro-Modus 👾 (gleicher Trick schaltet ihn wieder aus)'
      : 'Retro-Modus aus. Willkommen zurück in 2026.'
  );
}
export const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];
export let konami = [];
export function konamiKey(key) {
  konami = [...konami, String(key).toLowerCase()].slice(-KONAMI.length);
  if (konami.join() === KONAMI.join()) {
    konami = [];
    cheat();
  }
}

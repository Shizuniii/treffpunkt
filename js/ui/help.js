/* Hilfe-Fenster: Themen, Bild-Vorschauen, Suche, „Was ist neu“. */
import { APP_VERSION, DEMO, S, isOwner, lsGet, lsSet } from '../app/state.js';
import { feat, setFeat } from '../app/prefs.js';
import { FEATURES } from '../core/features.js';
import { CHANGELOG, HELP } from '../content/help.js';
import { WD_SHORT } from '../core/dates.js';
import { helpSearch } from '../core/search.js';
import { cmpVer, esc } from '../core/util.js';
import { toast } from './dom.js';
import { render } from './render.js';
import { renderSheet } from './sheets.js';
import { drinkRule } from './vote.js';

export const SEEN_KEY = 'tp-seen-ver';
export function initSeenVersion() {
  // Erstbesuch: keine „Neu“-Markierung. Wer die App schon kannte (alte Einträge vorhanden), sieht die Neuerungen.
  if (lsGet(SEEN_KEY)) return;
  let returning = false;
  try {
    returning = Object.keys(localStorage).some(k => k.startsWith('tp-') || k.startsWith('treffpunkt-'));
  } catch {}
  lsSet(SEEN_KEY, DEMO || returning ? '2.1.0' : APP_VERSION);
}
export const unseenNews = () =>
  CHANGELOG.filter(c => cmpVer(c.v, lsGet(SEEN_KEY) || APP_VERSION) > 0 && cmpVer(c.v, APP_VERSION) <= 0);
export function markNewsSeen() {
  lsSet(SEEN_KEY, APP_VERSION);
  const c = document.querySelector('[data-act="help-news"]');
  if (c) c.remove();
}
export const helpTopics = () => HELP.filter(t => t.who !== 'owner' || isOwner());
export function markHit(text, toks) {
  let h = esc(text.length > 140 ? text.slice(0, 137) + ' …' : text);
  for (const t of toks)
    if (t.length >= 3) {
      const re = t
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/ae/g, '(?:ae|ä)')
        .replace(/oe/g, '(?:oe|ö)')
        .replace(/ue/g, '(?:ue|ü)')
        .replace(/ss/g, '(?:ss|ß)');
      h = h.replace(new RegExp(`(${re}[a-zäöüß]*)`, 'gi'), '<mark>$1</mark>');
    }
  return h;
}
export function helpBody() {
  const s = S.sheet,
    r = helpSearch(s.q, helpTopics());
  if (r) {
    const tile = (x, guess) =>
      `<button class="hhit" data-act="help-topic" data-v="${x.t.id}"><span class="hi">${x.t.icon}</span><span class="stack" style="gap:2px"><b>${guess ? esc(x.t.title) : markHit(x.t.title, r.toks)}</b><p>${guess ? esc(x.t.text.slice(0, 120)) + (x.t.text.length > 120 ? ' …' : '') : markHit(x.t.text, r.toks)}</p></span></button>`;
    let h = '';
    if (r.guesses.length)
      h += `<div class="guess"><span class="small" style="font-weight:700">💡 Meintest du vielleicht …</span>${r.guesses.map(x => tile(x, true)).join('')}</div>`;
    if (r.hits.length)
      h += `<div class="hres"><span class="eyebrow">Treffer</span>${r.hits.map(x => tile(x, false)).join('')}</div>`;
    if (!r.hits.length && !r.guesses.length)
      h += `<div class="empty">Dazu habe ich nichts gefunden. Probier es mit anderen Worten, z. B.:<div class="chips" style="justify-content:center">${['Lieblingstag', 'krank', 'mehrere Tage', 'abends', 'anderes Handy'].map(x => `<button class="chip" data-act="help-q-set" data-v="${x}">${x}</button>`).join('')}</div></div>`;
    return h;
  }
  const news = unseenNews();
  const tiles = list =>
    `<div class="htiles">${list.map(t => `<button class="htile" data-act="help-topic" data-v="${t.id}"><span class="hi">${t.icon}</span><span>${esc(t.title)}</span></button>`).join('')}</div>`;
  return `${news.length ? `<button class="htile newchip" data-act="help-news" style="width:100%"><span class="hi">✨</span><span>Neu in Version ${APP_VERSION}: ${news.reduce((n, c) => n + c.items.length, 0)} Neuerungen ansehen</span></button>` : ''}
    <div class="stack" style="gap:8px"><span class="eyebrow">Abstimmen</span>${tiles(helpTopics().filter(t => t.who !== 'owner'))}</div>
    ${isOwner() ? `<div class="stack" style="gap:8px"><span class="eyebrow">Für Organisatoren</span>${tiles(helpTopics().filter(t => t.who === 'owner'))}</div>` : ''}
    <div><button class="linkbtn" data-act="help-all-news">Was ist neu? (alle Versionen)</button></div>`;
}
export function helpMock(kind) {
  const mc = (cls, dn, tl = '', extra = '') =>
    `<div class="cell ${cls}"><span class="dn">${dn}</span>${tl ? `<span class="tl">${tl}</span>` : ''}${extra}</div>`;
  const fb = r => `<i class="favb">★${r}</i>`;
  const wk = `<div class="mrow">${WD_SHORT.map(w => `<span class="mwk">${w}</span>`).join('')}</div>`;
  const cap = list => `<div class="mrow">${list.map(x => `<span class="mcap">${x}</span>`).join('')}</div>`;
  const hand = (l, t) => `<span class="hand" style="left:${l};top:${t}" aria-hidden="true">👆</span>`;
  const brushes = on =>
    `<div class="brushes" style="--n:5">${[
      ['all', 'Ganztags', 'background:var(--accent);border-color:var(--accent)'],
      ['time', 'Uhrzeit', 'background:var(--accent-soft);border-color:var(--accent)'],
      ['maybe', 'Vielleicht', ''],
      ['no', 'Kann nicht', 'background:var(--surface-2)'],
      ['auto', 'Löschen', 'background:var(--surface);border-style:dashed'],
    ]
      .map(
        ([k, l, st]) =>
          `<div class="brush ${k === on ? 'on pulse' : ''}"><i class="sw ${k === 'maybe' ? 'maybe' : ''}" style="${st}"></i><span>${l}</span></div>`
      )
      .join('')}</div>`;
  const W = inner => `<div class="hmock" aria-hidden="true">${inner}</div>`;
  switch (kind) {
    case 'calendar':
      return W(
        wk +
          `<div class="mrow">${mc('st-all', 12)}${mc('st-part', 13, 'ab 18')}${mc('st-maybe', 14, '?')}${mc('st-no', 15)}${mc('auto st-all', 16)}${mc('st-all', 17, '', fb(1))}${mc('', 18)}</div>` +
          cap(['kann', 'ab 18 Uhr', 'vielleicht', 'kann nicht', 'automatisch', 'Top 1', 'leer'])
      );
    case 'dock':
      return W(
        `<div class="mrow">${mc('st-all', 5)}${mc('st-all', 6)}${mc('', 7)}${mc('', 8)}${mc('st-no', 9)}${mc('', 10)}${mc('', 11)}</div>${hand('34%', '30px')}` +
          brushes('all')
      );
    case 'time':
      return W(
        `<div class="timebar"><label>ab<input type="time" value="18:00" tabindex="-1"></label><label>bis<input type="time" tabindex="-1"></label></div><div class="mrow">${mc('', 3)}${mc('st-part', 4, 'ab 18')}${mc('st-part', 5, 'ab 18')}${mc('', 6)}${mc('st-part', 7, '13–18')}${mc('st-part', 8, 'bis 12')}${mc('', 9)}</div>` +
          brushes('time')
      );
    case 'multi':
      return W(
        `<div class="quick"><b class="small">4 ausgewählt</b><span class="chip on">Wochenenden</span><span class="chip">Mo–Fr</span><span class="chip">Leere Tage</span></div>` +
          wk +
          `<div class="mrow">${mc('', 12)}${mc('', 13)}${mc('', 14)}${mc('', 15)}${mc('', 16)}${mc('sel', 17)}${mc('sel', 18)}</div><div class="mrow">${mc('', 19)}${mc('', 20)}${mc('', 21)}${mc('', 22)}${mc('', 23)}${mc('sel', 24)}${mc('sel', 25)}</div>` +
          brushes('all')
      );
    case 'maybe':
      return W(
        `<div class="mrow">${mc('st-all', 3)}${mc('st-maybe', 4, '?')}${mc('', 5)}${mc('st-maybe', 6, 'ab 18?')}${mc('', 7)}${mc('st-all', 8)}${mc('', 9)}</div><div class="hint">2 von 4 Vielleicht-Plätzen benutzt: nur die wahrscheinlichsten Tage</div>` +
          brushes('maybe')
      );
    case 'favs':
      return W(`<div class="mrow">${mc('st-all', 14, '', fb(2))}${mc('st-part', 15, 'ab 18')}${mc('st-all', 16)}${mc('st-all', 17, '', fb(1))}${mc('st-part', 18, 'ab 12', fb(3))}${mc('', 19)}${mc('', 20)}</div>
      <div class="fslot"><b class="frank">#1</b><span class="fdate">Fr, 17. Okt · ganztägig</span><span class="small muted">↑ ↓ ✕</span></div><div class="fslot"><b class="frank">#2</b><span class="fdate">Di, 14. Okt · ganztägig</span><span class="small muted">↑ ↓ ✕</span></div><div class="fslot"><b class="frank">#3</b><span class="fdate">Sa, 18. Okt · ab 12:00</span><span class="small muted">↑ ↓ ✕</span></div>`);
    case 'rules':
      return W(
        `<div class="rule"><span><span class="k no">Kann nicht</span> · Fr · 17:00–21:00</span><span class="small muted">Verein</span></div>` +
          wk +
          `<div class="mrow">${mc('auto st-all', 6)}${mc('auto st-all', 7)}${mc('auto st-all', 8)}${mc('auto st-all', 9)}${mc('auto st-part', 10, 'bis 17 +')}${mc('st-no', 11)}${mc('auto st-all', 12)}</div>` +
          cap(['', '', '„meistens“', '', 'Verein', 'einzeln', ''])
      );
    case 'propose':
      return W(
        `<div class="row small"><span class="muted">Du kannst an keinem dieser Tage?</span><span class="linkbtn">Neuen Zeitraum vorschlagen</span></div><div class="chips"><span class="chip on">Dezember 2026</span><span class="chip">Januar 2027</span></div><div class="banner ok" style="padding:8px 12px"><span>Neu dazugekommen: <b>1. Dez – 31. Dez 2026</b></span></div>`
      );
    case 'final':
      return W(
        `<div class="card final-card" style="padding:12px;gap:6px"><span class="eyebrow" style="color:var(--accent)">Der Termin steht</span><b>Samstag, 17. Oktober</b><span class="small">14:00–21:00</span><div class="row"><span class="btn sm primary">In Google Kalender</span><span class="btn sm">Kalenderdatei (.ics)</span></div></div>`
      );
    case 'drink':
      return W(
        drinkRule() +
          `<div class="row"><span class="btn sm ghost">Ich muss absagen</span><span class="small muted">→ Krank? Kein Drink. Anderer Grund kurz vorher? 🍹 für alle.</span></div>`
      );
    case 'heat':
      return W(
        `<div class="mrow">${[[1], [2], [3], [4], [60, '3+1'], [2], [0, '']]
          .map(
            ([pp, l], i) =>
              `<div class="cell heat ${pp >= 60 ? 'hi' : ''} ${i === 3 ? 'best' : ''}" style="--p:${pp}"><span class="dn">${10 + i}</span>${l ? `<span class="tl">${l}</span>` : ''}${i === 3 ? fb(2) : ''}</div>`
          )
          .join('')}</div>` + cap(['', 'wenige', '', 'bester Tag', '+1 vielleicht', '', ''])
      );
    case 'options':
      return W(`<div class="seg full"><span class="btn sm" style="justify-content:center;border:0;background:var(--surface)">🧘 Einfach</span><span class="btn sm ghost" style="justify-content:center">🧰 Alles</span></div>
      ${[
        ['⏰', 'Uhrzeiten', true],
        ['🤔', 'Vielleicht', false],
        ['⭐', 'Top 3', true],
        ['🔁', 'Wiederholungen', false],
      ]
        .map(
          ([i, l, on]) =>
            `<div class="frow"><span class="hi">${i}</span><b style="flex:1">${l}</b><input type="checkbox" class="switch" ${on ? 'checked' : ''} tabindex="-1"></div>`
        )
        .join('')}`);
    default:
      return '';
  }
}
export function sheetHelp() {
  const s = S.sheet;
  if (s.view === 'topic') {
    const t = HELP.find(x => x.id === s.topic) || HELP[0];
    const off = t.feature && !feat(t.feature),
      fLabel = off ? (FEATURES.find(f => f.id === t.feature) || {}).label : '';
    const can =
      (!!t.spot && !!document.querySelector(`[data-help="${t.spot}"]`)) ||
      ((t.mode || t.feature) && S.route.name === 'vote' && !!document.getElementById('dock'));
    return `<div class="row between" style="flex-wrap:nowrap"><button class="btn sm ghost" data-act="help-home">← Alle Themen</button><button class="btn sm ghost" data-act="close-sheet">Schließen</button></div>
      <div class="row" style="flex-wrap:nowrap;gap:12px"><span class="hi" style="font-size:2rem;width:auto">${t.icon}</span><h2>${esc(t.title)}</h2></div>
      ${t.mock ? helpMock(t.mock) : ''}
      <p>${esc(t.text)}</p>
      ${t.steps ? `<ol class="steps">${t.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${off ? `<div class="banner info"><span>„${esc(fLabel)}“ ist bei dir gerade ausgeblendet.</span><button class="btn sm" data-act="feat-on" data-v="${t.feature}">Einschalten</button></div>` : ''}
      ${can ? `<div><button class="btn primary" data-act="help-show" data-v="${t.id}">👀 ${off ? 'Einschalten & zeigen' : 'Zeig mir’s'}</button></div>` : t.spot ? `<p class="small muted">„Zeig mir’s“ gibt es auf der Abstimmungsseite eines Events.</p>` : ''}`;
  }
  if (s.view === 'news') {
    const list = s.all
      ? CHANGELOG.filter(c => cmpVer(c.v, APP_VERSION) <= 0)
      : unseenNews().length
        ? unseenNews()
        : CHANGELOG.slice(0, 1);
    return `<div class="row between" style="flex-wrap:nowrap"><button class="btn sm ghost" data-act="help-home">← Alle Themen</button><button class="btn sm ghost" data-act="close-sheet">Schließen</button></div>
      <h2>✨ ${s.all ? 'Was ist neu?' : `Neu in Version ${APP_VERSION}`}</h2>
      ${list.map(c => `<div class="stack" style="gap:8px"><span class="eyebrow">Version ${c.v}</span>${c.items.map(([ic, t, d, id]) => `<button class="hhit" data-act="help-topic" data-v="${id}"><span class="hi">${ic}</span><span class="stack" style="gap:2px"><b>${esc(t)}</b><p>${esc(d)}</p></span></button>`).join('')}</div>`).join('')}`;
  }
  return `<div class="help-top"><div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><h2>Hilfe &amp; alle Funktionen</h2><button class="btn sm ghost" data-act="close-sheet" style="flex:none">Schließen</button></div>
    <input type="search" id="help-q" placeholder="Suchen, z. B. „Lieblingstag“, „krank“, „abends“" value="${esc(s.q || '')}" autocomplete="off" aria-label="Funktionen durchsuchen"></div>
    <div id="help-results" class="stack" style="gap:14px">${helpBody()}</div>`;
}
export function showMe(id) {
  const t = HELP.find(x => x.id === id);
  if (!t) return;
  S.sheet = null;
  renderSheet();
  if (t.feature && !feat(t.feature)) {
    setFeat(t.feature, true);
    render();
  }
  if (t.mode && S.route.name === 'vote' && S.my) {
    S.selMode = t.mode === 'multi';
    S.favMode = t.mode === 'fav';
    S.sel = new Set();
    render();
  }
  setTimeout(() => {
    const el = document.querySelector(`[data-help="${t.spot}"]`);
    if (!el) {
      toast('Das findest du auf der Abstimmungsseite eines Events.');
      return;
    }
    if (getComputedStyle(el).position !== 'fixed') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('spot');
    setTimeout(() => el.classList.remove('spot'), 3200);
  }, 60);
}

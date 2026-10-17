/* Gemeinsamer Zustand der App: Version, Konfiguration, Speicher-Helfer, aktuelles Backend (Firebase oder Demo). */
import { toYmd } from '../core/dates.js';
import { DEFAULT_FILTERS } from '../core/results.js';

/* =====================================================================
   Treffpunkt · Version 2
   Datenformat (Firestore):
     polls/{pid}                 Abstimmung = ein Event (öffentlich lesbar mit Link)
       title, description, months[], expected, closed, closesAt(ms|null),
       maybeLimit(Zahl), weekdays([0..6]|null, 0 = Montag), final({date,s,e}|null)
     polls/{pid}/responses/{uid} Antwort einer Person (nur sie selbst + Organisator)
       v:2, name, base('none'|'all'), days{ 'YYYY-MM-DD': {s,e,m?} | {n:1} }, rules[], done, note
     members/{uid}               privat, nur die Person selbst: name, polls{pid:{t,at}}
   Ältere Antworten (v1) bleiben gültig: v2 hat nur Felder ergänzt.
   ===================================================================== */
export const APP_VERSION = '3.1.0';
export const CFG = window.TREFFPUNKT_CONFIG || {};
/** Demo-Modus: solange config.js noch Platzhalter hat – oder jederzeit mit ?demo in der Adresse
    (z. B. https://…/treffpunkt/?demo). Dann wird nie mit Firebase gesprochen, alles bleibt in diesem Browser. */
export const FORCED_DEMO = /[?&]demo\b/.test(location.search);
export const DEMO = FORCED_DEMO || !CFG.firebase || !CFG.firebase.apiKey || /^DEIN/i.test(CFG.firebase.apiKey);
export let TODAY = toYmd(new Date());
export function refreshToday() {
  TODAY = toYmd(new Date());
  return TODAY;
}
export const lsGet = k => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
export const S = {
  route: { name: 'home', ids: [] },
  user: null,
  owner: false,
  demoRole: 'owner',
  poll: undefined,
  pollsById: {},
  polls: null,
  counts: {},
  my: null,
  myAll: {},
  member: null,
  responses: [],
  loadErr: null,
  brush: { mode: 'all', s: '', e: '' },
  selMode: false,
  sel: new Set(),
  undo: [],
  save: 'idle',
  filters: { ...DEFAULT_FILTERS },
  pick: { id: null, uids: [] }, // Auswertung: ausgewählte Personen (gilt nur für das Event mit dieser id)
  sheet: null,
  editPoll: null,
  ruleForm: null,
  confirmDel: null,
  showAllDays: false,
  copyCands: null,
  copyDismissed: false,
  updateAvailable: false,
  passInfo: null,
  passes: [],
  openedAt: 0,
  undoCount: 0,
  people: null,
  requests: [],
  reqCounts: {},
  myRequest: null,
  favMode: false,
  // Organisator
  summaries: {}, // Kurzfassung pro Event für den einfachen Überblick
  ownerView: lsGet('tp-owner-view') === 'details' ? 'details' : 'simple', // „Einfach“ oder „Ausführlich“
  moreOpen: null, // bei welchem Event „Mehr“ aufgeklappt ist
  templates: null, // eigene Vorlagen
  admins: null, // Organisatoren (Mitorganisatoren, Leitung)
  notify: null, // eigene Benachrichtigungs-Einstellungen (erst geladen, wenn das Fenster aufgeht)
};
export let B = null;
export function setBackend(b) {
  B = b;
}
export let installEvt = null;
export function setInstallEvt(e) {
  installEvt = e;
}
export const isOwner = () => (DEMO ? S.demoRole === 'owner' : S.owner);

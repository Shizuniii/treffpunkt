/* Eigene Ansicht (Einfach/Alles/eigene Auswahl). Gespeichert nur auf diesem Gerät. */
import { S, lsGet, lsSet } from './state.js';
import { FEATURES, PRESETS, resolveFeatures, usageOf } from '../core/features.js';
import { maybeLimit } from '../core/poll.js';

const KEY = 'tp-features';
let cache = null;

export function loadPrefs() {
  if (cache) return cache;
  try {
    cache = JSON.parse(lsGet(KEY) || '{}') || {};
  } catch {
    cache = {};
  }
  return cache;
}
export function savePrefs(p) {
  cache = { ...p };
  lsSet(KEY, JSON.stringify(cache));
}
export function setFeat(id, on) {
  savePrefs({ ...loadPrefs(), [id]: !!on });
}
export function applyPreset(name) {
  if (PRESETS[name]) savePrefs(PRESETS[name]);
}

/** Aktueller Stand aller Funktionen für die gerade offene Abstimmung. */
export function feats() {
  return resolveFeatures(loadPrefs(), usageOf(S.my), { maybe: S.poll ? maybeLimit(S.poll) > 0 : true });
}
/** Ist eine Funktion gerade sichtbar? Funktionen ohne Bezug zur eigenen Antwort (cal, fun) brauchen keine Nutzungsprüfung. */
export function feat(id) {
  if (id === 'cal' || id === 'fun' || id === 'multi') {
    const p = loadPrefs();
    const f = FEATURES.find(x => x.id === id);
    return typeof p[id] === 'boolean' ? p[id] : f.def;
  }
  return !!feats()[id];
}
/** Nur durch eigene Nutzung sichtbar, obwohl ausgeschaltet? (für den Hinweis im Optionen-Fenster) */
export function forcedByUse(id) {
  const p = loadPrefs(),
    f = FEATURES.find(x => x.id === id);
  const pref = typeof p[id] === 'boolean' ? p[id] : f.def;
  return !pref && !!usageOf(S.my)[id];
}

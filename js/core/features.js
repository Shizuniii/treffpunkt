/* Freiwillige Funktionen für Teilnehmer („Einfach“-Modus). Rein, ohne DOM.
   Neue Funktion zum Ein-/Ausblenden? Hier eintragen, dann mit feat('id') in der Oberfläche abfragen. */

/** Alle Funktionen, die Teilnehmer selbst ein- und ausblenden können. `def` = Standard im Einfach-Modus. */
export const FEATURES = [
  {
    id: 'time',
    icon: '⏰',
    label: 'Uhrzeiten',
    def: true,
    help: 'time',
    desc: '„ab 18 Uhr“, „bis 14 Uhr“ oder ein Zeitfenster angeben.',
  },
  {
    id: 'multi',
    icon: '☑️',
    label: 'Mehrere Tage auf einmal',
    def: false,
    help: 'multi',
    desc: 'Tage sammeln und gemeinsam festlegen, Schnellwahl für Wochenenden.',
  },
  {
    id: 'maybe',
    icon: '🤔',
    label: 'Vielleicht',
    def: false,
    help: 'maybe',
    desc: 'Unsichere Tage markieren (nur wenige pro Event).',
  },
  {
    id: 'favs',
    icon: '⭐',
    label: 'Top 3',
    def: false,
    help: 'favs',
    desc: 'Deine drei Lieblingstage in eine Reihenfolge bringen.',
  },
  {
    id: 'rules',
    icon: '🔁',
    label: 'Wiederholungen & Grundeinstellung',
    def: false,
    help: 'rules',
    desc: '„Freitags Verein“ oder „meistens kann ich“ automatisch eintragen.',
  },
  {
    id: 'tools',
    icon: '🧰',
    label: 'Werkzeuge „Kann nicht“ & „Löschen“',
    def: false,
    help: 'days',
    desc: 'Tage ausdrücklich als „kann nicht“ markieren oder zurücksetzen.',
  },
  { id: 'avatar', icon: '🐸', label: 'Avatar', def: false, help: 'start', desc: 'Ein Emoji neben deinem Namen.' },
  { id: 'note', icon: '📝', label: 'Anmerkung', def: false, help: 'done', desc: 'Ein kurzer Text an den Organisator.' },
  {
    id: 'cal',
    icon: '🎉',
    label: 'Feiertage & Ferien',
    def: true,
    help: 'start',
    desc: 'Feiertage, Schulferien NRW und besondere Tage im Kalender.',
  },
  {
    id: 'fun',
    icon: '🏆',
    label: 'Erfolge & Konfetti',
    def: true,
    help: 'fun',
    desc: 'Kleine Belohnungen und Extras.',
  },
];

export const PRESETS = {
  simple: Object.fromEntries(FEATURES.map(f => [f.id, f.def])),
  all: Object.fromEntries(FEATURES.map(f => [f.id, true])),
};

/** Welche Funktionen nutzt eine Antwort schon? Diese bleiben sichtbar, damit nichts „unsichtbar“ zählt. */
export function usageOf(r) {
  const u = {};
  if (!r) return u;
  for (const d of Object.values(r.days || {})) {
    if (!d) continue;
    if (d.n) u.tools = true;
    else if (d.m) u.maybe = true;
    else if (!((d.s ?? 0) === 0 && (d.e ?? 1440) >= 1440)) u.time = true;
  }
  if ((r.favs || []).length) u.favs = true;
  if ((r.rules || []).length || r.base === 'all') {
    u.rules = true;
    if (r.base === 'all') u.tools = true;
  }
  if (r.emoji) u.avatar = true;
  if ((r.note || '').trim()) u.note = true;
  return u;
}

/**
 * Ergebnis: { id: an/aus } für alle Funktionen.
 * prefs = eigene Auswahl, usage = was die Antwort schon nutzt, caps = was das Event erlaubt (z. B. { maybe: false }).
 */
export function resolveFeatures(prefs = {}, usage = {}, caps = {}) {
  const out = {};
  for (const f of FEATURES) {
    let on = typeof prefs[f.id] === 'boolean' ? prefs[f.id] : f.def;
    if (usage[f.id]) on = true;
    if (caps[f.id] === false) on = false;
    out[f.id] = on;
  }
  return out;
}

/** 'simple' | 'all' | 'custom' – welche Voreinstellung passt zu den eigenen Einstellungen? */
export function presetOf(prefs = {}) {
  const cur = Object.fromEntries(FEATURES.map(f => [f.id, typeof prefs[f.id] === 'boolean' ? prefs[f.id] : f.def]));
  for (const [name, p] of Object.entries(PRESETS)) if (FEATURES.every(f => cur[f.id] === p[f.id])) return name;
  return 'custom';
}

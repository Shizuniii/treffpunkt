/* Suche in der Hilfe: Umlaute, Tippfehler und Synonyme. Rein, ohne DOM. */

/* Suche: Umlaute/Tippfehler tolerant, mit Synonymen („was du meinst“) */
export const normTxt = x =>
  String(x || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const STOP = new Set(
  'ich du wie kann man der die das ein eine einen und oder zu wo was mit auf fuer mein meine ist geht mache machen wenn bei an in im den dem es sich mir mich will moechte soll wird hier da so auch noch nur dann wieso warum welche welcher wer nach vor am um beim zum zur bin bist sind habe hab hat mal gerade schon doch bitte gibt es einem einer'.split(
    ' '
  )
);
// Synonym-Gruppen: Schlüsselwort (steht in den passenden Themen) + Wörter, mit denen Leute danach suchen
export const SYN = [
  ['absagen', 'cancel canceln ausfallen krank krankheit abmelden verhindert erkaeltet fieber'],
  [
    'favorit',
    'lieblings lieblingstag best beste rangliste ranking prioritaet stern wunsch wunschtag bevorzugt liebsten gefaellt wichtigste',
  ],
  ['mehrere', 'viele gleichzeitig einmal massen sammeln mehrfach'],
  ['uhrzeit', 'stunde uhr abends abend morgens mittags nachmittags frueh spaet spaeter feierabend nachts'],
  ['vielleicht', 'unsicher eventuell evtl ungewiss maybe wahrscheinlich'],
  ['wiederholung', 'regelmaessig woechentlich verein training arbeit job uni schule dauerhaft jeden jede'],
  ['geraet', 'handy smartphone computer laptop tablet ipad iphone android kaputt'],
  ['frist', 'deadline ablauf abgelaufen ende schluss spaet countdown'],
  ['kalender', 'termin datum google outlook ics erinnerung festgelegt'],
  ['speichern', 'fertig senden abschicken absenden gespeichert'],
  ['rueckgaengig', 'zurueck undo fehler falsch versehentlich vertippt oops'],
  ['uebernehmen', 'kopieren copy gleiche duplizieren'],
  ['installieren', 'app homescreen startbildschirm download herunterladen icon'],
  ['privat', 'datenschutz sichtbar geheim anonym'],
  ['zeitraum', 'monat spaeter verschieben nie keinen urlaub verreist'],
  ['teilen', 'link einladen whatsapp schicken freunde'],
  ['drink', 'getraenk bier runde schulden strafe ausgeben'],
  ['erfolge', 'achievements trophaeen spass easter geheimnis cheat'],
];
export function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const _hidx = new Map();
export function helpIndex(t) {
  if (_hidx.has(t.id)) return _hidx.get(t.id);
  const x = { title: normTxt(t.title), kw: normTxt(t.kw), text: normTxt(t.text + ' ' + (t.steps || []).join(' ')) };
  x.all = `${x.title} ${x.kw} ${x.text}`;
  x.words = [...new Set(x.all.split(' ').filter(w => w.length >= 3))];
  _hidx.set(t.id, x);
  return x;
}
export function helpSearch(q, topics) {
  const qn = normTxt(q);
  if (!qn) return null;
  const toks = qn.split(' ').filter(t => t.length >= 2 && !STOP.has(t));
  const near = (a, b) => a.length >= 4 && b.length >= 4 && lev(a, b) <= (a.length >= 8 ? 2 : 1);
  const wordHit = (w, t) => w === t || (t.length >= 4 && w.startsWith(t)) || (w.length >= 5 && t.startsWith(w));
  // Welche Synonym-Gruppen passen zur Anfrage? (auch Tippfehler und Wortanfänge)
  const groups = SYN.filter(([k, list]) =>
    [k, ...list.split(' ')].some(w => toks.some(t => wordHit(w, t) || near(t, w)))
  );
  const out = [];
  for (const t of topics) {
    const ix = helpIndex(t);
    let direct = 0,
      guess = 0;
    const tw = ix.title.split(' '),
      kw = ix.kw.split(' '),
      xw = ix.text.split(' ');
    for (const tok of toks) {
      if (tw.some(w => w === tok || (tok.length >= 3 && w.startsWith(tok)))) direct += 6;
      else if (kw.some(w => w === tok || (tok.length >= 3 && w.startsWith(tok)))) direct += 4;
      else if (xw.some(w => w === tok || (tok.length >= 4 && w.startsWith(tok)))) direct += 2;
      else if (ix.words.some(w => near(tok, w))) guess += 2.5;
    }
    if (toks.length >= 1 && qn.length >= 5 && ` ${ix.kw} `.includes(` ${qn} `)) direct += 6; // ganze Phrase
    const own = [...tw, ...kw];
    for (const [k] of groups) if (own.some(w => w === k || (k.length >= 5 && w.startsWith(k)))) guess += 3;
    if (direct + guess > 0) out.push({ t, direct, guess, score: direct + guess });
  }
  out.sort((a, b) => b.score - a.score);
  return {
    toks,
    hits: out.filter(x => x.direct > 0).slice(0, 8),
    guesses: out.filter(x => x.direct === 0 && x.guess >= 3).slice(0, 4),
    groups,
  };
}

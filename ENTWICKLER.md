# Treffpunkt – für Entwickler

Wie der Code aufgebaut ist, wo man etwas ändert und wie man prüft, dass nichts kaputtgeht.
Für die Einrichtung (Firebase, GitHub) siehe `ANLEITUNG.md`.

## In 30 Sekunden

- Reine Web-App: HTML + CSS + JavaScript-Module. **Kein Build-Schritt**, keine Frameworks. Was im Ordner liegt, läuft so im Browser.
- Daten: Firebase (Anmeldung + Firestore). Ohne Firebase-Werte in `config.js` – oder mit `?demo` in der Adresse – läuft ein **Demo-Modus** mit Beispieldaten nur im Browser.
- Lokal starten: `npm start` → http://localhost:8000 (Node.js nötig). Ein Doppelklick auf `index.html` reicht nicht mehr, weil Browser Module von `file://` nicht laden.
- Prüfen: `npm test` (Rechen-Logik, 1 Sekunde), `npm run test:ui` (klickt durch die App), `npm run test:rules` (Sicherheitsregeln). Oder im Browser: `…/tests/`.

## Ordner

```
index.html            nur das Gerüst; lädt css/app.css, config.js und js/app/main.js
config.js             Firebase-Werte (mit GitHub Actions automatisch aus den Repository-Variablen erzeugt)
firestore.rules       Sicherheitsregeln (mit GitHub Actions automatisch veröffentlicht)
sw.js, manifest…      App-Installation, offline nutzbar, Push-Nachrichten anzeigen
version.json          aktuelle Version → „Neue Version ist da“-Hinweis

css/app.css           alle Styles, in Abschnitte gegliedert (Kommentar oben = Inhaltsverzeichnis)

js/core/              REINE LOGIK – kein HTML, kein Zustand, nur Ein- und Ausgabe. Hier wird gerechnet.
  dates.js              Datum/Uhrzeit-Helfer (Tage als "YYYY-MM-DD", Uhrzeiten als Minuten 0–1440)
  holidays.js           Feiertage (berechnet) und Schulferien NRW (Tabelle)
  availability.js       Wann kann eine Person an einem Tag? Überschneidungen
  poll.js               Regeln eines Events: welche Tage zur Wahl stehen, Teilnehmerliste, Frist, „veraltet“
  results.js            Auswertung: beste Tage, Filter, Top-3-Punkte
  features.js           freiwillige Funktionen für Teilnehmer (Einfach-Modus)
  account.js            Konten: Benutzername → Pseudo-Adresse, Passwort-Regeln, welche Antwort beim Zusammenführen gilt
  notify.js             Benachrichtigungen planen (wer bekommt wann was), Kalender-Abo-Einträge
  templates.js          Vorlagen, „Nochmal mit neuem Zeitraum“
  search.js             Suche in der Hilfe (Umlaute, Tippfehler, Synonyme)
  calexport.js          Google-Kalender-Link, .ics-Datei, Abo-Kalender mit mehreren Einträgen
  util.js               Kleinkram (HTML maskieren, Farben, Versionen vergleichen …)

js/content/help.js    Texte der Hilfe + „Was ist neu“ pro Version

js/backend/           Datenzugriff – beide Dateien haben GENAU dieselbe Schnittstelle
  firebase.js           echte Datenbank
  demo.js               Demo-Daten im localStorage (+ Beispiel-Events)

js/app/               Steuerung: Zustand, Seitenwechsel, Speichern, Reaktion auf Klicks
  state.js              gemeinsamer Zustand S, Version, Backend B, Demo-Schalter
  router.js             Adresse (#/, #/p/…, #/r/…) → Daten laden → zeichnen
  events.js             ALLE Klicks/Eingaben: data-act="…" → case '…'
  edit.js               Bearbeiten: Tage setzen, Mehrfachauswahl, Top 3, Formulare
  save.js               automatisches Speichern, Rückgängig
  prefs.js              „Deine Ansicht“ (welche Funktionen eingeblendet sind), pro Gerät
  access.js             Darf ich gerade abstimmen? (Frist, Freischaltung, Nachzügler-Link, Liste)
  copy.js               Angaben aus anderem Event übernehmen
  account.js            Konto anlegen, anmelden (mit Übernahme der Geräte-Antworten), Passwort, abmelden
  notify.js             Benachrichtigungs-Einstellungen, Discord verbinden, Push-Abo, Kalender-Abo
  organize.js           Vorlagen, Wiederverwenden, Mitorganisatoren
  main.js               Start, Update-Prüfung, Rückkehr von Discord, online/offline

js/ui/                Oberfläche: Funktionen, die HTML-Text zurückgeben
  render.js             zeichnet die aktuelle Seite, Kopf- und Fußzeile
  vote.js               Abstimmungsseite (Teilnehmer)
  results.js            Auswertung (Organisator)
  home.js               Übersicht + Event-Formular (Organisator)
  calendar.js           Monatskalender
  sheets.js             Fenster von unten (Teilen, Tagesdetails …) und deren Verzeichnis
  account.js            Fenster „Konto“ und der Hinweis unter dem Namen
  overview.js           einfacher Überblick für Organisatoren (Startseite + Auswertung)
  organizers.js         Schnellstart/Vorlagen, Fenster „Organisatoren“
  notify.js             Fenster „Benachrichtigungen“
  features.js, help.js, cancel.js, extend.js, period.js, fun.js, dom.js

tests/                siehe „Tests“
tools/                läuft in Node.js (auf deinem PC oder in GitHub Actions), nie im Browser
  serve.js              kleiner lokaler Webserver (npm start, UI-Tests)
  build-site.js         baut den Ordner für GitHub Pages (erzeugt config.js aus den Repository-Variablen)
  deploy-rules.js       veröffentlicht firestore.rules (bricht ab, wenn es keine Leitung in „admins“ gibt)
  notify.js             verschickt Benachrichtigungen (Discord, Push) und schreibt Kalender-Abos
  backup.js             verschlüsselte Sicherung exportieren / entschlüsseln / zurückspielen
  check-updates.js      Wartungs-Check (Ferien, Firebase-Version)
  konto-admin.js        Passwort eines Freundes neu setzen, Konten auflisten/sperren
  push-keys.js          Schlüsselpaar für Push erzeugen
  package.json          nur die Pakete für GitHub Actions (firebase-admin, web-push) – schnell installiert
.github/workflows/
  tests.yml             bei jedem Hochladen: Tests → Regeln veröffentlichen → App veröffentlichen
  publish.yml           Seite bauen und auf GitHub Pages veröffentlichen (wird aufgerufen)
  notify.yml            geplant alle 15 Minuten (GitHub startet oft erst nach Stunden): Benachrichtigungen, Kalender-Abos
  backup.yml            sonntags: verschlüsselte Sicherung; hält zeitgesteuerte Abläufe aktiv
  maintenance.yml       monatlich: Wartungs-Check → GitHub-Issue
```

**Eine Regel hält alles übersichtlich:** `core` importiert nur `core`. Dadurch ist die ganze Rechen-Logik ohne Browser testbar. `ui` und `app` dürfen alles importieren.

## So läuft ein Klick ab

1. Ein Knopf im HTML hat `data-act="day" data-d="2026-11-07"`.
2. `js/app/events.js` fängt **alle** Klicks ab und landet bei `case 'day':`.
3. Der case ruft eine Funktion in `js/app/edit.js` auf, die `S.my` (die eigene Antwort) ändert.
4. `scheduleSave()` speichert nach 0,7 s über das Backend `B` (Firebase oder Demo).
5. `render()` bzw. `updateCell()` zeichnet neu.

Die Oberfläche ist also immer eine Funktion des Zustands `S`. Wer etwas anzeigen will, ändert `S` und ruft `render()`.

## Konten (Benutzername + Passwort)

- Firebase kennt nur „E-Mail + Passwort“. Ein Benutzername wird deshalb zur Pseudo-Adresse `name@konto.treffpunkt.invalid` (`ACCOUNT_DOMAIN` in `js/core/account.js`). Die Endung `.invalid` gibt es garantiert nie, also kann niemand Mails an diese Adressen empfangen – auch keine Links zum Zurücksetzen. Wer eine echte E-Mail angibt, kann „Passwort vergessen“ normal nutzen.
- **Konto anlegen** verknüpft das bisherige anonyme Konto (`linkWithCredential`). Die interne ID bleibt gleich, also gehören alle Antworten automatisch zum Konto. An den Firestore-Regeln ändert sich nichts, weil dort alles an der ID hängt.
- **Anmelden** auf einem Gerät, das schon ohne Konto abgestimmt hat (`signIn()` in `js/app/account.js`):
  1. `B.openAccount()` öffnet das Konto in einer zweiten, unsichtbaren Firebase-Instanz – dieses Gerät ist noch nicht umgemeldet.
  2. Pro Event entscheidet `mergeChoice()`: Antwort vom Gerät übernehmen (`take`), Konto-Antwort behalten (`keep`) oder nichts tun. Haben beide etwas, gewinnt die zuletzt geänderte.
  3. Übernommene Antworten werden ins Konto geschrieben, danach die Geräte-Antwort gelöscht → niemand erscheint doppelt. Klappt das Schreiben nicht (z. B. Abstimmung zu), bleibt die Geräte-Antwort stehen.
  4. Erst dann wird dieses Gerät angemeldet und die Seite neu geladen.
- Passwörter liegen nur verschlüsselt bei Firebase, nie in der Datenbank. Der Organisator sieht Konten in der Firebase-Konsole und setzt vergessene Passwörter mit `npm run konto -- passwort <name>`.
- In der Demo werden Konten im Browser simuliert (`st.accounts`, `st.session` in `js/backend/demo.js`). „Abmelden“ erzeugt dort eine neue, leere Identität – so lässt sich ein zweites Gerät nachspielen.

## Organisatoren

- Wer Organisator ist, steht in Firestore in `admins/{google-adresse}` mit `role: 'owner'` (Leitung) oder `'co'` (Mitorganisator). Die Regeln prüfen das mit `isAdmin()` / `isLead()`. Die Adresse steht dadurch nirgends mehr im Code.
- Den ersten Eintrag legt man einmal von Hand in der Firebase-Konsole an. `tools/deploy-rules.js` veröffentlicht neue Regeln nur, wenn es eine Leitung gibt – so kann man sich nicht aussperren.
- In der App: `js/app/organize.js` (Logik), `js/ui/organizers.js` (Fenster). Die Leitung wird mit einem Batch übergeben (beide Rollen gleichzeitig).

## Benachrichtigungen

```
App (Browser)                         Firestore                    GitHub Actions (geplant 15 Min.)
„🔔 Benachrichtigungen“  ──schreibt──►  notify/{uid}      ◄──liest──  tools/notify.js
  Discord verbinden (OAuth, Konto-ID)     types, discord,              planNotifications()  (js/core/notify.js)
  Push einschalten (Abo des Geräts)       push[], cal                  → Discord-Bot: Direktnachricht
  Kalender-Abo (geheimer Code)                                         → web-push: Push an jedes Gerät
                                        notifyLog/*  ◄──merkt sich──  → cal/<code>.ics → publish.yml
```
- Jede Nachricht hat einen Schlüssel (z. B. `final|<event>|<datum>|…`). Was im Protokoll `notifyLog` steht, wird nie wieder verschickt. Beim allerersten Lauf wird alles Bisherige nur gemerkt.
- Neue Art von Nachricht: in `NOTIFY_TYPES` eintragen und in `planNotifications()` mit `add(schlüssel, art, …)` planen, Test in `tests/unit/notify.test.js`.
- Welche Wege die App anbietet, steht in `config.js` (`discordClientId`, `vapidPublicKey`, `calendar`) – beim Veröffentlichen aus den Repository-Variablen erzeugt. In der Demo wird alles simuliert.
- Discord: OAuth „implicit grant“ (Scope `identify`) liefert nur die Konto-ID; Redirect = Ordner-Adresse der App. Der Bot muss mit der Person einen Server teilen.

## Offline

- Firestore läuft mit Offline-Cache (`persistentLocalCache`). Ohne Netz wartet das Speichern nicht auf den Server, sondern zeigt „Auf dem Gerät gespeichert“; bei `online` wartet `backOnline()` auf `waitForPendingWrites()`.
- Der Service Worker liefert App-Dateien ohne Netz aus dem Zwischenspeicher und hält die Firebase-Bibliothek (feste Version) vor.

## Rezepte

### Neue Funktion, die Teilnehmer ein- und ausblenden können

1. **`js/core/features.js`** → Eintrag in `FEATURES`: `{ id: 'xyz', icon, label, desc, def: false, help: 'xyz' }`.
   `def` = Standard im Einfach-Modus. Fertig ist damit auch der Schalter in „Deine Ansicht“.
2. **In der Oberfläche** das Element nur zeigen, wenn `feat('xyz')` wahr ist (`import { feat } from '../app/prefs.js'`).
3. Hängt die Funktion an gespeicherten Daten (z. B. ein neues Feld in der Antwort), in `usageOf()` eintragen. Dann bleibt sie sichtbar, solange jemand sie benutzt – niemand verliert so Angaben aus den Augen.
4. **Hilfe**: in `js/content/help.js` ein Thema mit `id: 'xyz'` und `feature: 'xyz'` anlegen. Ist die Funktion ausgeblendet, bietet die Hilfe automatisch „Einschalten“ an.
5. **Was ist neu**: Eintrag in `CHANGELOG` (siehe unten „Neue Version“).
6. **Test**: Unit-Test in `tests/unit/misc.test.js` (Gruppe „Einfach-Modus“) und ggf. UI-Test in `tests/ui/participant.ui.js`.

### Neuer Knopf / neue Aktion

1. Im HTML-Text (in `js/ui/…`): `<button data-act="mein-knopf" data-v="…">`.
2. In `js/app/events.js`: `case 'mein-knopf': …; break;` im passenden Abschnitt.
3. Größere Logik als Funktion in `js/app/edit.js` (oder `js/core/…`, wenn sie nichts anzeigt – dann ist sie testbar).

### Neues Fenster (Sheet)

Funktion schreiben, die HTML zurückgibt (`sheetHead('Titel') + …`), in `js/ui/sheets.js` im Verzeichnis `SHEETS` eintragen, öffnen mit `S.sheet = { type: 'meins' }; renderSheet();`.

### Neues Feld in der Datenbank

1. Lesen/Aufräumen: `normResp()` in `js/core/poll.js` (für Antworten) – alte Daten ohne das Feld müssen weiter funktionieren.
2. **`firestore.rules`**: Bei Antworten prüft `validResponse()` jedes optionale Feld. Neues Feld dort ergänzen, sonst lehnt die Datenbank das Speichern ab.
3. Regel-Test in `tests/rules/rules.test.js` ergänzen (erlaubt/abgelehnt).
4. Demo-Daten in `js/backend/demo.js` ggf. erweitern.
5. Bei Änderungen an `firestore.rules`: neu in die Firebase-Konsole kopieren (siehe ANLEITUNG).

### Firebase-Version anheben

Version in der Adresse in `js/backend/firebase.js` ändern (`…/firebasejs/<version>/`). Der monatliche Wartungs-Check meldet, wenn es sich lohnt. Danach alle Tests laufen lassen.

### Neue Version veröffentlichen

1. Versionsnummer an **drei** Stellen gleich setzen: `APP_VERSION` in `js/app/state.js`, `version.json`, `package.json`.
2. In `js/content/help.js` oben in `CHANGELOG` einen Eintrag für die Version ergänzen → Freunde sehen „✨ Neu“.
3. `npm test` und `npm run test:ui` laufen lassen (oder nach dem Hochladen unter „Actions“ schauen).

## Datenmodell (Firestore)

```
polls/{pid}                         ein Event (lesbar für alle mit Link)
  title, description, months["YYYY-MM"], weekdays[0..6]|null (0 = Montag), excluded["YYYY-MM-DD"]
  expected, maybeLimit, closed, closesAt(ms)|null, cancelRule(bool)
  final {date, s, e, note}|null               festgelegter Termin (Minuten 0–1440)
  addMode 'auto'|'ask'|'off'                  dürfen Teilnehmer Zeiträume vorschlagen?
  added {uid: {from, to, name, at, ok, declined}}
  restricted(bool), participants {uid: {on, name}}
  extensions {uid: {until, ask}}              persönliche Freischaltungen
  reopenedAt, reopenNote, expandedAt, history[]

polls/{pid}/responses/{uid}         Antwort einer Person (nur sie selbst + Organisator)
  v:2, name, emoji, base 'none'|'all', done, updatedAt, note
  days {"YYYY-MM-DD": {s, e, m?:1} | {n:1}}    m = vielleicht, n = kann nicht
  rules [{id, kind 'yes'|'no', wd[], s, e, label}]
  favs ["YYYY-MM-DD", …] (max. 3, Reihenfolge = Rang)
  cancel {date, at, reason, late, owes, drinks, note}|null
  pass  Code eines Nachzügler-Links

polls/{pid}/passes/{code}           Nachzügler-Link: until, label, createdAt
polls/{pid}/requests/{uid}          Teilnahme-Anfrage: name, at
members/{uid}                       private Liste „meine Events“: name, polls {pid: {t, at}}
admins/{email}                      Organisatoren: role 'owner' (Leitung) | 'co', name, addedAt
templates/{id}                      eigene Vorlagen: name, title, weekdays, months (Anzahl), deadlineDays, …
notify/{uid}                        Benachrichtigungen (nur die Person selbst): types {art: bool},
                                    discord {id, name}|null, push [{endpoint, keys, at}], cal {token, deadlines}|null,
                                    discordError (vom Versand gesetzt)
notifyLog/{hash}, notifyMeta/state  nur für den Versand (Admin-Zugang), keine App hat Zugriff
```

Konten (Benutzername/E-Mail + Passwort) liegen in Firebase Authentication, nicht in Firestore.

Nur auf dem Gerät (localStorage): `tp-features` (Deine Ansicht), `tp-owner-view` (Einfach/Ausführlich), `tp-seen-ver` (✨ Neu gesehen), `tp-push-endpoint` (Push auf diesem Gerät), Erfolge, Retro-Modus, Demo-Daten (`treffpunkt-demo-v3`).

## Tests

| Was | Aufruf | Prüft | Braucht |
|---|---|---|---|
| Unit-Tests | `npm test` oder `…/tests/` im Browser | Rechen-Logik in `js/core` (Datum, Feiertage, Verfügbarkeit, Auswertung, Suche, Optionen, Konten, Vorlagen, Benachrichtigungs-Planung, Kalender-Abo, Export); in Node zusätzlich die Werkzeuge in `tools/` und der Service Worker | nur Node.js bzw. Browser |
| UI-Tests | `npm run test:ui` | klickt wie ein Mensch durch die Demo: Einfach-Modus, Optionen, Abstimmen, Offline, Organisator-Überblick, Vorlagen, Mitorganisatoren, Konten, Benachrichtigungen (inkl. Discord-Rückkehr), Hilfe, Darstellung, **Barrierefreiheit** (axe, Tastatur, 200 % Schrift) und **Schutz vor eingeschleustem Code** | `npm install`, `npx playwright install chromium` |
| Regel-Tests | `npm run test:rules` | Firestore-Regeln: Organisatoren & Leitung, Antworten, Frist, Freischaltung, Nachzügler-Link, Liste, Vorschläge, Absage nach Frist, Konten, Vorlagen, Benachrichtigungen | `npm install`, Java 11+ |

- **Nur einen Teil testen:** `npm test -- Feiertage`, `npm run test:ui -- "Top 3"`. Im Browser: Feld „Filter“ oder Knopf „▶ nur diese“.
- **UI-Tests laufen immer im Demo-Modus** (`?demo`), auch wenn `config.js` echte Werte hat. Echte Daten werden nie angefasst. Jeder UI-Test startet mit frischen Demo-Daten.
- **Regel-Tests** laufen gegen den lokalen Firebase-Emulator (Projekt `demo-treffpunkt`), nie gegen deine echte Datenbank. Organisatoren legen sie vor jedem Test selbst in `admins` an.
- **Fehlschlag bei UI-Tests verstehen:** `UI_SHOTS=ordner npm run test:ui` speichert ein Bildschirmfoto der Seite im Moment des Fehlers. Auf GitHub hängen die Fotos am fehlgeschlagenen Lauf („Artifacts“).

### Einen Test schreiben

Unit-Test (`tests/unit/*.test.js`, neue Datei in `tests/unit/all.js` eintragen):

```js
import { suite, assert } from '../lib/mini-test.js';
import { holiday } from '../../js/core/holidays.js';

suite('Feiertage & Ferien NRW', t => {
  t('Tag der Deutschen Einheit', () => {
    assert.ok(holiday('2026-10-03'));
  });
});
```

`assert` kennt: `ok`, `no`, `eq` (===), `deep` (gleicher Inhalt), `includes`, `throws`. Optional als letztes Argument ein Hinweistext.

UI-Test (`tests/ui/*.ui.js`):

```js
t('Mein Test', ui('#/p/demo1', async app => {
  await app.click('[data-act=features-open]');
  assert.ok(await app.has('.sheet'));
}, { preset: 'all' }));   // preset: 'simple' | 'all';  ownerView: 'details' (Standard in Tests) | 'simple'
```

Hilfen in `tests/ui/harness.js`: `click`, `fill`, `has`, `count`, `text`, `texts`, `toast`, `brushes`, `freeDays`, `tapDay`, `role('owner'|'participant')`, `options(fn)`, `demoData()`, `reload`, `goto`.

## Stil

- Kommentare und Texte auf Deutsch; jede Datei beginnt mit einem Satz, wofür sie da ist.
- Formatierung automatisch: `npm run format` (Prettier, Einstellungen in `.prettierrc.json`).
- Lieber kleine, benannte Funktionen in `core` (testbar) als Logik direkt im HTML-Text.
- Keine neuen Abhängigkeiten im Browser-Code: alles läuft ohne Build-Schritt direkt auf GitHub Pages.
- Alles, was Nutzer eingeben, mit `esc()` ausgeben. Der Sicherheitstest (`tests/ui/security.ui.js`) schlägt sonst Alarm.

## Warum kein Framework (z. B. Preact)?

Geprüft und bewusst (vorerst) nicht umgestellt: Für deine Freunde ändert sich dadurch nichts, aber fast jede Datei in `js/ui/` müsste neu geschrieben werden – bei einer App dieser Größe ein hohes Risiko für wenig Gewinn. Der wichtigste Vorteil eines Frameworks, automatisches Maskieren gegen eingeschleusten Code, ist durch `esc()` plus den Sicherheitstest abgedeckt. Sinnvoll wird ein Umstieg, wenn die Oberfläche deutlich wächst (z. B. mehrere neue Seiten); dank der Tests ließe er sich dann Schritt für Schritt machen, Seite für Seite.

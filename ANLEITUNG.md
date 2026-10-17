# Treffpunkt – Einrichtung

Kostenlos, ohne eigenen Server. Du brauchst ein **Google-Konto** (Firebase + deine Anmeldung) und ein **GitHub-Konto** (Hosting).

| Teil | Wofür | Zeit | Nötig? |
|---|---|---|---|
| **A** Grundeinrichtung | App läuft, Freunde stimmen ab, du siehst die Auswertung | ca. 15 Min. | ja |
| **B** Automatik | Veröffentlichen nur nach grünen Tests, Regeln automatisch, wöchentliche Sicherung, Wartungs-Hinweise | ca. 15 Min. | empfohlen |
| **C** Benachrichtigungen | Discord-Nachrichten, Push aufs Handy, Kalender-Abo – jeweils einzeln | je 5–10 Min. | optional |

Die Menüs in Firebase und GitHub heißen je nach Sprache leicht anders. Passt etwas nicht zu dem, was du siehst: Screenshot schicken.

**Ausprobieren ohne Einrichtung:** Mit `?demo` am Ende der Adresse läuft die App mit Beispieldaten, z. B. `https://DEINNAME.github.io/treffpunkt/?demo` – deine echten Events sind davon nie betroffen. Lokal (mit Node.js): `npm start`.

---

## Teil A – Grundeinrichtung

### A1. Firebase-Projekt anlegen
1. https://console.firebase.google.com → mit Google anmelden.
2. **Projekt erstellen** → Name z. B. `treffpunkt` → Google Analytics **ausschalten** → Projekt erstellen.
3. Du bleibst im kostenlosen **Spark**-Tarif.

### A2. Anmeldung einschalten
Links **Build → Authentication → Jetzt starten**, dann Tab **Sign-in method**:
- **Anonym** → aktivieren → Speichern (Freunde stimmen ohne Konto ab).
- **Google** → aktivieren → Support-E-Mail wählen → Speichern (für dich als Organisator).
- **E-Mail-Adresse/Passwort** → nur den ersten Schalter aktivieren → Speichern (freiwillige Konten für Freunde).

### A3. Datenbank, Regeln und dich als Organisator eintragen
1. Links **Build → Firestore Database → Datenbank erstellen** → Standort **eur3 (Europe)** → **Im Produktionsmodus starten** → Erstellen.
2. **Dich als Organisator eintragen** (Tab **Daten**):
   **+ Sammlung starten** (Fenster „Eine Sammlung erstellen“) → Sammlungs-ID `admins` → Weiter →
   **Dokument-ID:** deine Google-Adresse, **klein geschrieben** (z. B. `name@gmail.com`) – nicht auf „Automatische ID“ klicken →
   **Feld:** `role` → **Typ:** `string` (Voreinstellung, so lassen) → im Kästchen darunter mit der Überschrift **String:** `owner` → **Speichern**.
3. Tab **Regeln** → alles löschen → Inhalt von `firestore.rules` einfügen → **Veröffentlichen**.
   (Mit Teil B passiert das künftig automatisch.)

Die Regeln sorgen dafür, dass jeder Freund nur seine eigene Antwort sieht, nur Organisatoren alle Antworten sehen, nach Fristende niemand mehr ändern kann und private Daten (Event-Liste, Benachrichtigungs-Einstellungen) nur für die Person selbst lesbar sind. Deine E-Mail-Adresse steht seit Version 3 **nicht mehr** in `firestore.rules` – die Datei kann also bedenkenlos auf GitHub.

### A4. Web-App registrieren
1. **Zahnrad → Projekteinstellungen** (oder oben in der Suche „Allgemein“ wählen) → Tab **Allgemein** → ganz unten bei **Meine Apps** auf **`</>`** (Web).
   Nicht „App Hosting“, „Hosting“ oder „App Check“ – die brauchst du nicht.
2. Spitzname `Treffpunkt` → **App registrieren** (Firebase Hosting **nicht** anhaken).
3. Den Block `const firebaseConfig = { apiKey: "...", ... };` kopieren und aufheben – du brauchst ihn in A5 (oder in B2).
   Der `apiKey` darf öffentlich sein, das ist bei Firebase normal. Geschützt wird alles durch die Regeln.

### A5. Auf GitHub hochladen
**Teil 1 – Dateien hochladen**
1. https://github.com → **+ → New repository** → Name `treffpunkt`, **Public** → **Create repository**.
2. Auf der leeren Repository-Seite im Satz „Get started by …“ auf den blauen Link **uploading an existing file** klicken.
3. Auf deinem PC den entpackten Ordner öffnen. Du siehst darin direkt `css`, `js`, `tests`, `tools`, `config.js`, `index.html` usw.
4. Im Ordner **Strg + A** (Mac: ⌘ + A) → alles zusammen ins Browserfenster ziehen.
5. Warten, bis die Liste fertig ist. GitHub zeigt **96 Dateien** – das stimmt so. (Dateien, deren Name mit einem Punkt beginnt, lässt GitHub dabei weg; die braucht die App nicht.)
6. Nach unten scrollen → grüner Knopf **Commit changes**.

**Teil 2 – Firebase-Werte eintragen**
7. Du siehst jetzt die Dateiliste deines Repositorys → auf **`config.js`** klicken.
8. Rechts oben über dem Text auf den **Stift** klicken („Edit this file“).
9. Diese sechs Zeilen markieren: von `apiKey: "DEIN_API_KEY",` bis `appId: "1:000000000000:web:0000000000000000"`.
10. Durch die sechs Zeilen aus deinem Block von A4 ersetzen – nur die Zeilen **zwischen** `const firebaseConfig = {` und `};`. Die Zeilen `firebase: {` darüber und `},` darunter bleiben stehen.
11. Rechts oben **Commit changes…** → im Fenster **Commit changes**.

Diese Werte dürfen öffentlich sein, das ist bei Firebase normal – geschützt wird alles durch die Regeln aus A3.

### A6. GitHub Pages einschalten
Im Repository **Settings → Pages** → bei *Source* **Deploy from a branch** → Branch **main**, Ordner **/ (root)** → **Save**.

Nach 1–2 Minuten ist die App unter `https://DEINNAME.github.io/treffpunkt/` erreichbar.

### A7. Domain bei Firebase freigeben
Firebase → **Authentication → Einstellungen → Autorisierte Domains → Domain hinzufügen** → `DEINNAME.github.io`. (Sonst klappt die Google-Anmeldung nicht.)
`DEINNAME` ist dein GitHub-**Benutzername** (im Profil der graue Name unter dem Anzeigenamen), klein geschrieben – nicht der Anzeigename. Nur die Domain eintragen, ohne `https://` und ohne `/treffpunkt`. Die genaue Adresse steht auch unter **Settings → Pages** („Your site is live at …“).

### A8. Loslegen
`https://DEINNAME.github.io/treffpunkt/` → **Mit Google anmelden** → **+ Neues Event** (der **Schnellstart** füllt z. B. „Spieleabend“ aus) → **Erstellen** → Link per WhatsApp teilen.

---

## Teil B – Automatik (empfohlen)

Danach gilt: Du lädst neue Dateien hoch, GitHub testet alles, und **nur wenn alles grün ist**, gehen Regeln und App online. Dazu kommen eine wöchentliche verschlüsselte Sicherung und monatliche Wartungs-Hinweise. Alles kostenlos.

### B1. Admin-Schlüssel holen
Firebase → **Zahnrad → Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren** → Datei wird heruntergeladen.
**Geheim halten:** Wer diese Datei hat, hat vollen Zugriff auf dein Firebase-Projekt. Nie hochladen, nie verschicken.
Die Datei **nicht** in den Treffpunkt-Ordner legen – beim Hochladen per Hineinziehen würde sie sonst leicht mitgenommen. Geht sie verloren: einfach einen neuen Schlüssel erzeugen.

### B2. Einstellungen bei GitHub hinterlegen
Im Repository **Settings → Secrets and variables → Actions**.

Tab **Variables → New repository variable**:
| Name | Wert |
|---|---|
| `FIREBASE_CONFIG` | der Block aus A4 (so wie kopiert, mit `const firebaseConfig = {` … `};`) |

Tab **Secrets → New repository secret**:
| Name | Wert |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | den **kompletten Inhalt** der Datei aus B1 (Datei mit einem Texteditor öffnen, alles kopieren) |
| `BACKUP_PASSWORD` | ein langes Passwort für die Sicherungen – im Passwort-Manager aufheben! Ohne es kann niemand (auch du nicht) eine Sicherung lesen. |

### B3. Automatik hochladen und starten
Beim Hineinziehen (A5) hat GitHub den Ordner `.github` weggelassen, weil er mit einem Punkt beginnt. Er kommt jetzt von Hand dazu:
1. **Settings → Pages** → bei *Source* von „Deploy from a branch“ auf **GitHub Actions** umstellen.
2. Im Repository **Add file → Create new file** → als Dateinamen `.github/workflows/publish.yml` eintippen (bei jedem `/` wird daraus ein Ordner).
3. Auf deinem PC die Datei `.github/workflows/publish.yml` im Editor öffnen → **Strg + A**, **Strg + C** → ins große Feld bei GitHub einfügen → **Commit changes…** → **Commit changes**.
4. Du bist jetzt im Ordner `.github/workflows` → **Add file → Upload files** → die übrigen vier Dateien aus deinem Ordner `.github/workflows` hineinziehen (`backup.yml`, `maintenance.yml`, `notify.yml`, `tests.yml`) → **Commit changes**.
   (Auf dem Mac ist `.github` im Finder versteckt: **⌘ + ⇧ + .** drücken.)
5. Damit startet alles von selbst. **Actions** öffnen → oben steht ein Lauf „Tests & Veröffentlichen“. Nach ein paar Minuten:
   - grüner Haken = Tests bestanden, Regeln und App sind online;
   - rotes X = etwas stimmt nicht. Den Namen des roten Schritts (und bei Tests den Text darunter) an mich schicken.

**Was jetzt automatisch läuft** (alles unter **Actions** zu sehen):
| Ablauf | Wann | Was |
|---|---|---|
| Tests & Veröffentlichen | bei jedem Hochladen | Unit-, UI- und Regel-Tests → Regeln nach Firebase → App nach GitHub Pages |
| Benachrichtigungen | alle paar Stunden (geplant alle 15 Min., GitHub startet aber oft viel später) | nur aktiv, wenn Teil C eingerichtet ist; Kalender-Abos aktualisieren |
| Sicherung | sonntags | verschlüsselte Sicherung, 90 Tage unter „Actions → Sicherung → Artifacts“ |
| Wartung | am 1. jedes Monats | Ferien noch aktuell? Neue Firebase-Version? → legt ggf. ein Issue an (du bekommst eine E-Mail) |

Hinweis: GitHub pausiert zeitgesteuerte Abläufe, wenn 60 Tage nichts im Repository passiert. Die Sicherung hält sie automatisch aktiv. Falls doch einmal einer pausiert: **Actions → Ablauf → Enable workflow**.

### Sicherung zurückspielen (falls je nötig)
1. Unter **Actions → Sicherung** den gewünschten Lauf öffnen → unten bei *Artifacts* herunterladen und entpacken (`sicherung.enc`).
2. Auf deinem PC im Treffpunkt-Ordner (Node.js + `npm install`, Admin-Schlüssel als `admin-schluessel.json`):
   Mac/Linux: `BACKUP_PASSWORD='dein-passwort' npm run sicherung -- restore sicherung.enc`
   Windows (PowerShell): `$env:BACKUP_PASSWORD='dein-passwort'; npm run sicherung -- restore sicherung.enc`
   → zeigt an, was drin ist → mit `--ja` am Ende wirklich zurückspielen.

---

## Teil C – Benachrichtigungen (optional)

Freunde entscheiden selbst unter **🔔 Benachrichtigungen**, ob und worüber sie Bescheid bekommen. Du richtest nur die Wege ein, die du anbieten willst. Voraussetzung: Teil B. Nachrichten kommen **nicht sofort**: Der Versand ist alle 15 Minuten geplant, GitHub startet ihn in der Praxis aber oft nur alle 2–4 Stunden. Für „Der Termin steht“ reicht das meist; für Eiliges lieber direkt in die WhatsApp-Gruppe schreiben. In eine **WhatsApp-Gruppe** kann Treffpunkt nicht selbst schreiben – dafür gibt es weiter „Nachricht an die Gruppe“ zum Kopieren.

### C1. Kalender-Abo
Nichts weiter zu tun – mit Teil B ist es an. Freunde tippen auf „Abo einrichten“ (erst nach ausdrücklicher Zustimmung) und abonnieren die Adresse im Handy- oder Google-Kalender. Google holt Änderungen nur alle paar Stunden, Apple-Kalender öfter.

### C2. Discord
1. https://discord.com/developers/applications → **New Application** → Name `Treffpunkt` → Create.
2. Links **OAuth2** → bei *Redirects* **Add Redirect** → genau `https://DEINNAME.github.io/treffpunkt/` (mit `/` am Ende) → **Save Changes**.
   Auf derselben Seite die **Client ID** kopieren → bei GitHub als **Variable** `DISCORD_CLIENT_ID` anlegen.
3. Links **Bot** → **Reset Token** → Token kopieren → bei GitHub als **Secret** `DISCORD_BOT_TOKEN` anlegen.
4. Bot auf euren Discord-Server holen: **OAuth2 → URL Generator** → bei *Scopes* nur **bot** anhaken → die erzeugte Adresse öffnen → euren Server wählen → Autorisieren.
   (Der Bot braucht keine Rechte – er schickt nur Direktnachrichten an Leute, die auf demselben Server sind und Discord verbunden haben.)
5. **Actions → Tests & Veröffentlichen → Run workflow**, damit die App die neue Einstellung kennt.

### C3. Push aufs Handy
1. Auf deinem PC im Treffpunkt-Ordner (Node.js + `npm install`): `npm run push-schluessel`.
2. Den **öffentlichen** Schlüssel bei GitHub als **Variable** `VAPID_PUBLIC_KEY`, den **privaten** als **Secret** `VAPID_PRIVATE_KEY` anlegen. Den privaten Schlüssel sonst nirgends speichern.
3. **Actions → Tests & Veröffentlichen → Run workflow**.
Auf dem iPhone geht Push nur, wenn Treffpunkt auf dem Home-Bildschirm liegt (Teilen → „Zum Home-Bildschirm“) – die App erklärt das deinen Freunden.

---

## Updates (neue Versionen)
Deine Freunde installieren nichts neu, der Link bleibt gleich, alle Antworten bleiben gespeichert.

**Als Pull Request (wenn Claude Zugriff auf dein Repository hat):**
1. Im Repository oben **Pull requests** → den neuen Eintrag öffnen. Dort steht, was sich ändert; unter **Files changed** siehst du jede Zeile.
2. Warten, bis unten der Haken grün ist (die Tests laufen automatisch, ca. 4 Minuten).
3. **Merge pull request** → **Confirm merge**. Erst jetzt geht die neue Version online. Gefällt dir etwas nicht: einfach nicht mergen und Bescheid sagen.

Eigene Änderungen direkt auf GitHub (z. B. Texte) sind kein Problem – sie werden vor jedem Update übernommen.

**Oder von Hand hochladen:**
1. **Add file → Upload files** → die neuen Dateien und Ordner hineinziehen → **Commit changes**.
   Mit Teil B: Tests laufen, danach geht alles automatisch online. Ohne Teil B: `config.js` nicht überschreiben und geänderte Regeln per Hand einfügen (A3).
   Geänderte Dateien in `.github/workflows` lässt GitHub beim Hineinziehen weg: im Repository in den Ordner `.github/workflows` gehen und sie **dort** über **Add file → Upload files** hochladen.

Wer die App offen hat, sieht „Eine neue Version ist da“; alle anderen bekommen sie beim nächsten Öffnen.

### Von Version 2.x auf 3.0 umsteigen – wichtig, in dieser Reihenfolge
1. **Zuerst** dich als Organisator eintragen (A3, Punkt 2: Sammlung `admins`). Die neuen Regeln erkennen den Organisator nicht mehr an der Adresse in `firestore.rules`, sondern an diesem Eintrag.
2. **Dann** die Dateien hochladen bzw. die neuen Regeln veröffentlichen. (Mit Teil B bricht das automatische Veröffentlichen ab, solange Punkt 1 fehlt – so sperrst du dich nicht aus.)

---

## Organisator-Werkzeuge
- **Einfach / Ausführlich** (oben auf Startseite und Auswertung): Einfach zeigt pro Event nur Fortschritt, wer fehlt, die besten Tage und was auf dich wartet. Ausführlich zeigt alles.
- **Personen ansehen** (Auswertung → Ausführlich): eine oder mehrere Personen antippen. Bei einer Person siehst du ihren Kalender genau so, wie sie ihn ausgefüllt hat; bei mehreren, wann genau diese zusammen können. In der Teilnehmerliste geht das auch über **📅 Ansehen**. „Alle anzeigen“ hebt die Auswahl auf.
- **Schnellstart & Vorlagen:** beim neuen Event Spieleabend, Kino, Ausflug, Gruppenurlaub oder eigene Vorlagen. Unter **Mehr …** eines Events: **Nochmal mit neuem Zeitraum** oder **Als Vorlage speichern**.
- **👥 Organisatoren** (unten auf der Startseite, optional): Mitorganisatoren per Google-Adresse hinzufügen oder die Leitung übergeben.
- **Nachricht an die Gruppe:** Erinnerung oder Zwischenstand/Termin als fertiger Text für WhatsApp.
- **Frist & nachträglich öffnen:** für alle verlängern, einzelne Personen nochmal ändern lassen oder jemandem ohne Antwort einen persönlichen Link schicken.

## Passwort für einen Freund neu setzen
Wer sein Konto mit **E-Mail-Adresse** angelegt hat, setzt es selbst zurück („Passwort vergessen?“). Bei einem **Benutzernamen** machst du das:
1. Einmalig: [Node.js](https://nodejs.org) (LTS) installieren, im Treffpunkt-Ordner `npm install`. Den Admin-Schlüssel (B1) als **`admin-schluessel.json`** in den Ordner legen – geheim, nie hochladen.
2. `npm run konto -- passwort anna` → neues Zufalls-Passwort wird angezeigt → privat an Anna schicken; sie kann es in der App unter „Konto“ ändern.
   Außerdem: `npm run konto -- liste`, `… sperren anna`, `… entsperren anna`.

## Tests
- **Im Browser:** `https://DEINNAME.github.io/treffpunkt/tests/` (oder als Organisator unten „🧪 Selbsttest“) – grün = Rechen-Logik in Ordnung.
- **Auf GitHub:** mit Teil B nach jedem Hochladen unter **Actions**: Rechen-Logik, Bedienung (ein Browser klickt sich durch die Demo, inkl. Barrierefreiheit und Schutz vor eingeschleustem Code) und Sicherheitsregeln (gegen einen Test-Emulator, nie gegen deine echte Datenbank).
- **Auf dem eigenen PC:** siehe `ENTWICKLER.md`.

## Gut zu wissen
- **Mehrere Events im selben Zeitraum** in einem Link teilen – jedes wird getrennt abgestimmt.
- **Vielleicht** ist pro Person begrenzt (Standard 4); in der Auswertung zählt es erst per Häkchen mit.
- **Absage-Regel 🍻:** Wer weniger als eine Woche vorher ohne verständlichen Grund absagt, schuldet jedem einen Drink (pro Event abschaltbar).
- **Gerätewechsel:** Ohne Konto hängen Antworten an Gerät und Browser (Safari löscht sie nach längerer Pause sogar). Mit Konto oder „Mit Google verbinden“ geht es überall weiter.
- **Ohne Netz** eintragen geht auch – es wird gesendet, sobald wieder Empfang da ist.
- **Feiertage NRW** werden berechnet, **Schulferien NRW** sind bis Sommer 2030 hinterlegt (der Wartungs-Check erinnert rechtzeitig).

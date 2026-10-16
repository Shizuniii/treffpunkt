// Treffpunkt – Einstellungen
// Solange hier noch "DEIN_..." steht, läuft die App im Demo-Modus (Daten nur im eigenen Browser).
// Schritt 4 der Anleitung erklärt, woher du diese Werte bekommst.
// Wer Organisator ist, steht NICHT hier, sondern in Firestore in der Sammlung „admins“ (siehe ANLEITUNG).
// Tipp: Mit automatischem Veröffentlichen über GitHub (ANLEITUNG, Teil B) wird diese Datei beim Veröffentlichen
// aus den GitHub-Einstellungen erzeugt – dann musst du hier gar nichts eintragen.

window.TREFFPUNKT_CONFIG = {
  // Aus der Firebase-Konsole: Projekteinstellungen → Allgemein → Meine Apps → Web-App → "Konfiguration"
  firebase: {
    apiKey: "DEIN_API_KEY",
    authDomain: "DEIN-PROJEKT.firebaseapp.com",
    projectId: "DEIN-PROJEKT",
    storageBucket: "DEIN-PROJEKT.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000"
  },
  // Optional – Benachrichtigungen (ANLEITUNG, Teil C). Leer lassen = ausgeschaltet.
  discordClientId: "",   // Discord: „Application ID“ deiner Discord-App
  vapidPublicKey: "",    // Push: öffentlicher Schlüssel (npm run push-schluessel)
  calendar: false        // Kalender-Abos: true, sobald der Versand über GitHub Actions läuft
};

// Treffpunkt – Einstellungen
// Wer Organisator ist, steht NICHT hier, sondern in Firestore in der Sammlung „admins“

window.TREFFPUNKT_CONFIG = {
  // Aus der Firebase-Konsole: Projekteinstellungen → Allgemein → Meine Apps → Web-App → "Konfiguration"
  firebase: {
    apiKey: "AIzaSyDjs8PuvcoovoEVj0p-L3zQgo8UQ4WgzfI",
    authDomain: "stalker-6767.firebaseapp.com",
    projectId: "stalker-6767",
    storageBucket: "stalker-6767.firebasestorage.app",
    messagingSenderId: "1080315582208",
    appId: "1:1080315582208:web:4964ddd64cdcf2fbf545e5"
  },
  // Optional – Benachrichtigungen (ANLEITUNG, Teil C). Leer lassen = ausgeschaltet.
  discordClientId: "",   // Discord: „Application ID“ deiner Discord-App
  vapidPublicKey: "",    // Push: öffentlicher Schlüssel (npm run push-schluessel)
  calendar: false        // Kalender-Abos: true, sobald der Versand über GitHub Actions läuft
};

/* Schlüsselpaar für Push-Nachrichten erzeugen (einmalig).  Aufruf: npm run push-schluessel
   Den öffentlichen Schlüssel trägst du bei GitHub als Variable VAPID_PUBLIC_KEY ein, den privaten als Secret
   VAPID_PRIVATE_KEY (siehe ANLEITUNG, Teil C). Den privaten Schlüssel nirgends sonst speichern oder verschicken. */
const webpush = (await import('web-push')).default;
const k = webpush.generateVAPIDKeys();
console.log(`Öffentlich  (GitHub → Variable VAPID_PUBLIC_KEY):\n${k.publicKey}\n`);
console.log(`Privat      (GitHub → Secret VAPID_PRIVATE_KEY – geheim halten!):\n${k.privateKey}`);

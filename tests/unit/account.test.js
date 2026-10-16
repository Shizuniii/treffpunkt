import { suite, assert } from '../lib/mini-test.js';
import {
  ACCOUNT_DOMAIN,
  accountLabel,
  authError,
  checkPassword,
  hasContent,
  isPseudo,
  mergeChoice,
  parseLogin,
  suggestUser,
} from '../../js/core/account.js';

suite('Konten', t => {
  t('Benutzername wird zur Pseudo-Adresse', () => {
    assert.deep(parseLogin('  Anna '), { email: `anna@${ACCOUNT_DOMAIN}`, user: 'anna', real: false });
    assert.eq(parseLogin('Jörg Weiß').user, 'joerg.weiss', 'Umlaute und Leerzeichen');
  });
  t('Groß/klein ist beim Anmelden egal', () => assert.eq(parseLogin('ANNA').email, parseLogin('anna').email));
  t('echte E-Mail bleibt echt', () => {
    const r = parseLogin('Anna.M@Gmail.com');
    assert.eq(r.email, 'anna.m@gmail.com');
    assert.ok(r.real);
  });
  t('eingetippte Pseudo-Adresse = Benutzername', () => assert.eq(parseLogin(`anna@${ACCOUNT_DOMAIN}`).user, 'anna'));
  t('ungültige Eingaben', () => {
    assert.ok(parseLogin('').err, 'leer');
    assert.ok(parseLogin('ab').err, 'zu kurz');
    assert.ok(parseLogin('x'.repeat(31)).err, 'zu lang');
    assert.ok(parseLogin('anna!').err, 'Sonderzeichen');
    assert.ok(parseLogin('anna@').err, 'kaputte E-Mail');
  });
  t('Vorschlag aus dem Namen', () => {
    assert.eq(suggestUser('Anna Müller'), 'anna.mueller');
    assert.eq(suggestUser('Dana (Beispiel)'), 'dana.beispiel');
    assert.eq(suggestUser('🐸'), '', 'nichts Brauchbares');
  });
  t('Anzeige des Kontonamens', () => {
    assert.eq(accountLabel(`anna@${ACCOUNT_DOMAIN}`), 'anna');
    assert.eq(accountLabel('anna@gmail.com'), 'anna@gmail.com');
    assert.ok(isPseudo(`x@${ACCOUNT_DOMAIN}`));
    assert.no(isPseudo('x@gmail.com'));
  });
  t('Passwort mindestens 6 Zeichen', () => {
    assert.ok(checkPassword('12345'));
    assert.eq(checkPassword('123456'), null);
  });
  t('Fehlertexte', () => {
    assert.includes(authError({ code: 'auth/email-already-in-use' }), 'gibt es schon');
    assert.includes(authError({ code: 'auth/invalid-credential' }), 'stimmt nicht');
    assert.includes(authError({ code: 'auth/sonstwas' }), 'auth/sonstwas');
  });
});

suite('Konten: Antworten zusammenführen', t => {
  const r = (extra = {}) => ({ name: 'A', base: 'none', days: {}, rules: [], updatedAt: 100, ...extra });
  const day = { '2026-11-07': { s: 0, e: 1440 } };
  t('leere Antwort zählt nicht', () => {
    assert.no(hasContent(r()));
    assert.ok(hasContent(r({ days: day })));
    assert.ok(hasContent(r({ base: 'all' })), '„kann meistens“');
    assert.ok(hasContent(r({ done: true })), 'fertig ohne Tage');
  });
  t('nur das Gerät hat etwas → übernehmen', () => assert.eq(mergeChoice(r({ days: day }), null), 'take'));
  t('Gerät leer → nichts tun', () => assert.eq(mergeChoice(r(), r({ days: day })), 'none'));
  t('beide haben etwas → die neuere gewinnt', () => {
    assert.eq(mergeChoice(r({ days: day, updatedAt: 200 }), r({ days: day, updatedAt: 100 })), 'take');
    assert.eq(mergeChoice(r({ days: day, updatedAt: 100 }), r({ days: day, updatedAt: 200 })), 'keep');
  });
});

/* Echte Datenbank: Firebase Auth + Firestore. */
import { onAuthChanged } from '../app/router.js';
import { CFG, S } from '../app/state.js';

export async function makeFirebase() {
  const V = 'https://www.gstatic.com/firebasejs/12.19.0/'; // Version: Wartungs-Check auf GitHub meldet neuere
  const [A, AU, FS] = await Promise.all([
    import(V + 'firebase-app.js'),
    import(V + 'firebase-auth.js'),
    import(V + 'firebase-firestore.js'),
  ]);
  const app = A.initializeApp(CFG.firebase);
  // Offline-Cache: Antworten lassen sich auch ohne Netz eintragen und werden später gesendet.
  const makeDb = () => {
    try {
      return FS.initializeFirestore(app, {
        localCache: FS.persistentLocalCache({ tabManager: FS.persistentMultipleTabManager() }),
      });
    } catch (e) {
      console.warn('Offline-Cache nicht verfügbar', e);
      return FS.getFirestore(app);
    }
  };
  const auth = AU.getAuth(app),
    db = makeDb();
  const takeOver = async e => {
    // Google-Konto ist schon woanders verknüpft → dorthin wechseln
    const c = AU.GoogleAuthProvider.credentialFromError(e);
    if (!c) throw e;
    await AU.signInWithCredential(auth, c);
    return 'switched';
  };
  try {
    await AU.getRedirectResult(auth);
  } catch (e) {
    if (/credential-already-in-use|email-already-in-use/.test(e.code || '')) {
      try {
        await takeOver(e);
      } catch (e2) {
        console.warn(e2);
      }
    } else console.warn(e);
  }
  // Organisator = wer die Liste aller Abstimmungen lesen darf (steht in den Firestore-Regeln, nicht im öffentlichen Code)
  const checkOwner = async u => {
    if (!u || u.isAnonymous) return false;
    try {
      await FS.getDocs(FS.query(FS.collection(db, 'polls'), FS.limit(1)));
      return true;
    } catch {
      return false;
    }
  };
  await new Promise(res => {
    let first = true;
    AU.onAuthStateChanged(auth, async u => {
      S.user = u;
      S.owner = await checkOwner(u);
      if (first) {
        first = false;
        res();
      } else onAuthChanged();
    });
  });
  const google = () => {
    const p = new AU.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  };
  const me = () => auth.currentUser;
  return {
    uid: () => me() && me().uid,
    hasUser: () => !!me(),
    isAnon: () => !me() || me().isAnonymous,
    email: () => (me() && me().email) || '',
    async ensureUser() {
      if (!me()) await AU.signInAnonymously(auth);
    },
    async signInOwner() {
      try {
        await AU.signInWithPopup(auth, google());
      } catch (e) {
        if (/popup|operation-not-supported/.test(e.code || '')) await AU.signInWithRedirect(auth, google());
        else throw e;
      }
    },
    /** Anonymes Konto mit Google verbinden (gleiche Antworten auf allen Geräten). */
    async linkGoogle() {
      const u = me();
      try {
        if (u && u.isAnonymous) {
          await AU.linkWithPopup(u, google());
          S.owner = await checkOwner(me());
          return 'linked';
        }
        await AU.signInWithPopup(auth, google());
        return 'switched';
      } catch (e) {
        if (/credential-already-in-use|email-already-in-use/.test(e.code || '')) return takeOver(e);
        if (/popup-blocked|operation-not-supported/.test(e.code || '') && u && u.isAnonymous) {
          await AU.linkWithRedirect(u, google());
          return 'redirect';
        }
        throw e;
      }
    },
    signOut: () => AU.signOut(auth),
    /** Mit Google angemeldet? (Organisator oder Freund, der Google verbunden hat) */
    isGoogle: () => !!me() && me().providerData.some(p => p.providerId === 'google.com'),
    /** E-Mail bzw. Pseudo-Adresse des angemeldeten Kontos ('' ohne Konto). */
    accountEmail: () => (me() && !me().isAnonymous && me().email) || '',

    /* ---------- Konten mit Benutzername/E-Mail + Passwort ---------- */
    /** Konto anlegen. Ohne Konto auf diesem Gerät: verknüpfen, damit die interne ID (und damit alle Antworten) bleibt. */
    async createAccount(email, pw) {
      if (me() && me().isAnonymous) await AU.linkWithCredential(me(), AU.EmailAuthProvider.credential(email, pw));
      else await AU.createUserWithEmailAndPassword(auth, email, pw);
    },
    /**
     * Ein Konto „nebenbei“ öffnen, ohne dieses Gerät schon umzumelden (zweite, unsichtbare Firebase-Instanz).
     * So kann die App erst die Antworten von diesem Gerät ins Konto schreiben und danach hier aufräumen.
     * Falsches Passwort → Fehler. Am Ende immer close() aufrufen.
     */
    async openAccount(email, pw) {
      const app2 = A.initializeApp(CFG.firebase, 'konto-' + Date.now());
      try {
        const auth2 = AU.initializeAuth(app2, { persistence: AU.inMemoryPersistence });
        const { user } = await AU.signInWithEmailAndPassword(auth2, email, pw);
        const db2 = FS.getFirestore(app2);
        const respDoc = pid => FS.doc(db2, 'polls', pid, 'responses', user.uid);
        return {
          uid: user.uid,
          async getResponse(pid) {
            const s = await FS.getDoc(respDoc(pid));
            return s.exists() ? s.data() : null;
          },
          saveResponse: (pid, data) => FS.setDoc(respDoc(pid), data),
          async getMember() {
            const s = await FS.getDoc(FS.doc(db2, 'members', user.uid));
            return s.exists() ? s.data() : null;
          },
          saveMember: data => FS.setDoc(FS.doc(db2, 'members', user.uid), data, { merge: true }),
          async getNotify() {
            const s = await FS.getDoc(FS.doc(db2, 'notify', user.uid));
            return s.exists() ? s.data() : null;
          },
          saveNotify: data => FS.setDoc(FS.doc(db2, 'notify', user.uid), data),
          async close() {
            await AU.signOut(auth2).catch(() => {});
            await A.deleteApp(app2).catch(() => {});
          },
        };
      } catch (e) {
        await A.deleteApp(app2).catch(() => {});
        throw e;
      }
    },
    signInAccount: (email, pw) => AU.signInWithEmailAndPassword(auth, email, pw),
    resetPassword: email => AU.sendPasswordResetEmail(auth, email),
    changePassword: pw => AU.updatePassword(me(), pw),
    deleteMember: () => FS.deleteDoc(FS.doc(db, 'members', me().uid)),
    /* ---------- Benachrichtigungen (nur die eigenen Einstellungen) ---------- */
    async getNotify() {
      if (!me()) return null;
      const s = await FS.getDoc(FS.doc(db, 'notify', me().uid));
      return s.exists() ? s.data() : null;
    },
    saveNotify: data => FS.setDoc(FS.doc(db, 'notify', me().uid), data),
    deleteNotify: () => FS.deleteDoc(FS.doc(db, 'notify', me().uid)),
    watchPoll: (id, cb, err) =>
      FS.onSnapshot(FS.doc(db, 'polls', id), s => cb(s.exists() ? { id: s.id, ...s.data() } : null), err),
    watchPolls: (cb, err) =>
      FS.onSnapshot(FS.collection(db, 'polls'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err),
    async getPoll(id) {
      const s = await FS.getDoc(FS.doc(db, 'polls', id));
      return s.exists() ? { id: s.id, ...s.data() } : null;
    },
    savePoll: (id, data) => FS.setDoc(FS.doc(db, 'polls', id), data, { merge: true }),
    async getMine(pid) {
      if (!me()) return null;
      const s = await FS.getDoc(FS.doc(db, 'polls', pid, 'responses', me().uid));
      return s.exists() ? s.data() : null;
    },
    saveMine: (pid, data) => FS.setDoc(FS.doc(db, 'polls', pid, 'responses', me().uid), data),
    updateMine: (pid, patch) => FS.updateDoc(FS.doc(db, 'polls', pid, 'responses', me().uid), patch),
    async getPass(pid, code) {
      const s = await FS.getDoc(FS.doc(db, 'polls', pid, 'passes', code));
      return s.exists() ? s.data() : null;
    },
    watchPasses: (pid, cb, err) =>
      FS.onSnapshot(
        FS.collection(db, 'polls', pid, 'passes'),
        s => cb(s.docs.map(d => ({ code: d.id, ...d.data() }))),
        err
      ),
    savePass: (pid, code, data) => FS.setDoc(FS.doc(db, 'polls', pid, 'passes', code), data),
    deletePass: (pid, code) => FS.deleteDoc(FS.doc(db, 'polls', pid, 'passes', code)),
    async getMember() {
      if (!me()) return null;
      const s = await FS.getDoc(FS.doc(db, 'members', me().uid));
      return s.exists() ? s.data() : null;
    },
    saveMember: data => FS.setDoc(FS.doc(db, 'members', me().uid), data, { merge: true }),
    watchResponses: (pid, cb, err) =>
      FS.onSnapshot(
        FS.collection(db, 'polls', pid, 'responses'),
        s => cb(s.docs.map(d => ({ ...d.data(), uid: d.id }))),
        err
      ),
    deleteResponse: (pid, uid) => FS.deleteDoc(FS.doc(db, 'polls', pid, 'responses', uid)),
    waitForPendingWrites: () => FS.waitForPendingWrites(db),
    /** Alle Antworten eines Events einmalig laden (Organisator, für den Überblick). */
    async getResponses(pid) {
      const s = await FS.getDocs(FS.collection(db, 'polls', pid, 'responses'));
      return s.docs.map(d => ({ ...d.data(), uid: d.id }));
    },
    async countResponses(pid) {
      const s = await FS.getCountFromServer(FS.collection(db, 'polls', pid, 'responses'));
      return s.data().count;
    },
    async countRequests(pid) {
      const s = await FS.getCountFromServer(FS.collection(db, 'polls', pid, 'requests'));
      return s.data().count;
    },
    async getRequest(pid) {
      if (!me()) return null;
      const s = await FS.getDoc(FS.doc(db, 'polls', pid, 'requests', me().uid));
      return s.exists() ? s.data() : null;
    },
    sendRequest: (pid, data) => FS.setDoc(FS.doc(db, 'polls', pid, 'requests', me().uid), data),
    watchRequests: (pid, cb, err) =>
      FS.onSnapshot(
        FS.collection(db, 'polls', pid, 'requests'),
        s => cb(s.docs.map(d => ({ ...d.data(), uid: d.id }))),
        err
      ),
    deleteRequest: (pid, uid) => FS.deleteDoc(FS.doc(db, 'polls', pid, 'requests', uid)),
    /* ---------- Organisatoren & Vorlagen (nur Organisatoren) ---------- */
    myEmail: () => ((me() && me().email) || '').toLowerCase(),
    watchAdmins: (cb, err) =>
      FS.onSnapshot(FS.collection(db, 'admins'), s => cb(s.docs.map(d => ({ email: d.id, ...d.data() }))), err),
    saveAdmin: (email, data) => FS.setDoc(FS.doc(db, 'admins', email), data, { merge: true }),
    deleteAdmin: email => FS.deleteDoc(FS.doc(db, 'admins', email)),
    /** Leitung übergeben: beide Änderungen gemeinsam, damit es nie zwei oder keine Leitung gibt. */
    async transferLead(toEmail) {
      const b = FS.writeBatch(db);
      b.update(FS.doc(db, 'admins', toEmail), { role: 'owner' });
      b.update(FS.doc(db, 'admins', me().email.toLowerCase()), { role: 'co' });
      await b.commit();
    },
    watchTemplates: (cb, err) =>
      FS.onSnapshot(FS.collection(db, 'templates'), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), err),
    saveTemplate: (id, data) => FS.setDoc(FS.doc(db, 'templates', id), data),
    deleteTemplate: id => FS.deleteDoc(FS.doc(db, 'templates', id)),
    /** Alle Personen, die je in einem deiner Events geantwortet haben (nur Organisator). */
    async loadPeople() {
      const ps = await FS.getDocs(FS.collection(db, 'polls'));
      const map = {};
      await Promise.all(
        ps.docs.map(async d => {
          const rs = await FS.getDocs(FS.collection(db, 'polls', d.id, 'responses'));
          rs.docs.forEach(x => {
            const r = x.data(),
              cur = map[x.id];
            if (r.name && (!cur || (r.updatedAt || 0) > cur.at))
              map[x.id] = { uid: x.id, name: r.name, emoji: r.emoji || '', at: r.updatedAt || 0 };
          });
        })
      );
      return Object.values(map);
    },
  };
}

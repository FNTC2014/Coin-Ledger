// Your ledger in your own Firebase project: one Firestore document per coin, submission, expense,
// account and money movement, under users/<your sign-in>/. The phone keeps a copy, so it works
// offline and syncs when it's back online. Bundled into the page by tools/build-web.mjs.
import { initializeApp } from "firebase/app";
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch
} from "firebase/firestore";

const cfg = (window.LEDGER_CONFIG && window.LEDGER_CONFIG.firebase) || null;
const configured = !!(cfg && cfg.apiKey && cfg.projectId && cfg.appId);
let auth = null, fs = null, uid = null;

if (configured) {
  const app = initializeApp(cfg);
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  try {
    fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    fs = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

const codeOf = (e) => String((e && e.code) || "unavailable").replace(/^(auth|firestore)\//, "");
const fail = (e) => ({ code: codeOf(e), message: (e && e.message) || "" });

// A write lands in the phone's copy at once and is sent to Firebase when there's a connection,
// so don't hold the screen waiting for the server. A refusal that comes later is announced.
function settle(p) {
  return new Promise((resolve, reject) => {
    let done = false;
    p.then(() => { if (!done) { done = true; resolve(); } },
      (e) => {
        if (!done) { done = true; reject(fail(e)); }
        else window.dispatchEvent(new CustomEvent("ledger-sync-error", { detail: fail(e) }));
      });
    setTimeout(() => { if (!done) { done = true; resolve(); } }, 1500);
  });
}

function colRef(name) {
  if (!fs || !uid) throw { code: "unauthenticated" };
  return collection(fs, "users", uid, name);
}

const db = {
  collection(name) {
    return {
      doc(id) {
        const ref = id ? doc(colRef(name), id) : doc(colRef(name));
        return {
          id: ref.id,
          set: (data) => settle(setDoc(ref, data)),
          delete: () => settle(deleteDoc(ref))
        };
      },
      onSnapshot(next, err) {
        return onSnapshot(colRef(name),
          (snap) => next({ docs: snap.docs.map((d) => ({ id: d.id, exists: true, data: () => d.data() })) }),
          (e) => { if (err) err(fail(e)); });
      }
    };
  },
  // [op, collection, id, data] rows, written together (Firestore takes up to 500 per batch)
  async batch(list) {
    for (let i = 0; i < list.length; i += 450) {
      const b = writeBatch(fs);
      for (const [op, col, id, data] of list.slice(i, i + 450)) {
        const ref = doc(colRef(col), id);
        if (op === "del") b.delete(ref); else b.set(ref, data);
      }
      await settle(b.commit());
    }
  }
};

window.LedgerStore = {
  configured,
  db,
  onAuth(cb) {
    if (!auth) { cb(null); return () => {}; }
    return onAuthStateChanged(auth, (u) => { uid = u ? u.uid : null; cb(u ? { uid: u.uid, email: u.email || "" } : null); });
  },
  async signIn(email, password) { try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw fail(e); } },
  async signUp(email, password) { try { await createUserWithEmailAndPassword(auth, email, password); } catch (e) { throw fail(e); } },
  async reset(email) { try { await sendPasswordResetEmail(auth, email); } catch (e) { throw fail(e); } },
  async signOut() { try { await signOut(auth); } catch (e) { throw fail(e); } }
};

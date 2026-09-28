import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKAdQvIAHz0F-sCdgYT97NjZLoDv-apsQ",
  authDomain: "habit-tracker-010.firebaseapp.com",
  projectId: "habit-tracker-010",
  storageBucket: "habit-tracker-010.firebasestorage.app",
  messagingSenderId: "875350993556",
  appId: "1:875350993556:web:b4400a6e9c94227bb26281",
  measurementId: "G-NNMXQNCXRW",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

async function createProfile(user, preferredName = "") {
  const profileRef = doc(db, "users", user.uid, "profile", "account");
  const existingProfile = await getDoc(profileRef);
  if (existingProfile.exists()) return;
  const name =
    preferredName.trim() ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "DailyHabits member";
  await setDoc(profileRef, {
    name,
    email: user.email || "",
    weekStart: "monday",
    updatedAt: serverTimestamp(),
  });
}

export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await createProfile(credential.user);
  return credential.user;
}

export async function createAccountWithEmail(email, password, name) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  if (name.trim())
    await updateProfile(credential.user, { displayName: name.trim() });
  await createProfile(credential.user, name);
  return credential.user;
}

export const sendPasswordReset = (email) => sendPasswordResetEmail(auth, email);
export const signOutUser = () => signOut(auth);
export const observeAuthState = (callback) =>
  onAuthStateChanged(auth, callback);

export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "An account already uses this email.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed":
      "Check your internet connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/weak-password": "Use a stronger password with at least 8 characters.",
    "auth/user-disabled": "This account has been disabled.",
  };
  return messages[error?.code] || "Something went wrong. Please try again.";
}

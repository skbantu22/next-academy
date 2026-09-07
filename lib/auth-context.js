"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

export const ROLES = [
  "Student",
  "Volunteer",
  "Facilitator",
  "Teacher",
  "Director",
  "Admin",
];
const AuthContext = createContext(null);

function readableError(error) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/email-already-in-use":
      "An account already exists for this email. Please login instead.",
    "auth/weak-password": "Use a password with at least six characters.",
    "auth/popup-closed-by-user": "The sign-in window was closed.",
    "auth/unauthorized-domain":
      "Add this domain to Firebase Authentication settings.",
    "auth/email-not-verified": "Please verify your email before logging in.",
  };
  return (
    messages[error?.code] ||
    error?.message ||
    "Authentication failed. Please try again."
  );
}

async function createProfile(user, role = "Student") {
  if (!db) return { uid: user.uid, role };
  const profileRef = doc(db, "users", user.uid);
  const existing = await getDoc(profileRef);
  if (!existing.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { uid: user.uid, role };
  }
  return { uid: user.uid, ...existing.data() };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          setProfile(await createProfile(nextUser));
        } catch (profileError) {
          setError(readableError(profileError));
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const actions = useMemo(
    () => ({
      clearError: () => setError(""),
      async register(email, password, displayName) {
        setError("");
        if (!auth)
          throw new Error(
            "Firebase is not configured. Add values to .env.local.",
          );
        try {
          const result = await createUserWithEmailAndPassword(
            auth,
            email,
            password,
          );
          if (displayName) await updateProfile(result.user, { displayName });
          const nextProfile = await createProfile({
            ...result.user,
            displayName: displayName || result.user.displayName,
          });
          setProfile(nextProfile);
          return result.user;
        } catch (authError) {
          setError(readableError(authError));
          throw authError;
        }
      },
      async login(email, password) {
        setError("");
        if (!auth)
          throw new Error(
            "Firebase is not configured. Add values to .env.local.",
          );
        try {
          const result = await signInWithEmailAndPassword(
            auth,
            email,
            password,
          );
          return {
            user: result.user,
            requiresVerification: !result.user.emailVerified,
          };
        } catch (authError) {
          setError(readableError(authError));
          throw authError;
        }
      },
      async socialLogin(providerName) {
        setError("");
        if (!auth)
          throw new Error(
            "Firebase is not configured. Add values to .env.local.",
          );
        const provider =
          providerName === "google"
            ? new GoogleAuthProvider()
            : new FacebookAuthProvider();
        try {
          const result = await signInWithPopup(auth, provider);
          await createProfile(result.user);
          return result.user;
        } catch (authError) {
          setError(readableError(authError));
          throw authError;
        }
      },
      async resetPassword(email) {
        setError("");
        if (!auth)
          throw new Error(
            "Firebase is not configured. Add values to .env.local.",
          );
        try {
          await sendPasswordResetEmail(auth, email);
        } catch (authError) {
          setError(readableError(authError));
          throw authError;
        }
      },
      async sendVerificationCode() {
        if (!auth?.currentUser)
          throw new Error("Sign in to request a verification code.");
        setError("");
        const token = await auth.currentUser.getIdToken();
        const response = await fetch("/api/auth/send-verification-code", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          const requestError = new Error(
            payload.message || "Unable to send the verification code.",
          );
          setError(requestError.message);
          requestError.retryAfterSeconds = payload.retryAfterSeconds;
          throw requestError;
        }
        return payload;
      },
      async verifyEmailCode(code) {
        if (!auth?.currentUser)
          throw new Error("Sign in to verify your email address.");
        setError("");
        const token = await auth.currentUser.getIdToken();
        const response = await fetch("/api/auth/verify-email-code", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });
        const payload = await response.json();
        if (!response.ok) {
          const verificationError = new Error(
            payload.message || "Invalid verification code.",
          );
          setError(verificationError.message);
          throw verificationError;
        }
        await auth.currentUser.reload();
        setUser(auth.currentUser);
        return true;
      },
      async logout() {
        if (auth) await signOut(auth);
      },
    }),
    [],
  );

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, error, firebaseConfigured, ...actions }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");
  const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const dbEmulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (authEmulator || dbEmulator) {
    const loopback = /^(localhost|127\.0\.0\.1):\d+$/;
    if (process.env.VERCEL_ENV || !projectId.startsWith("demo-") ||
        !loopback.test(authEmulator ?? "") || !loopback.test(dbEmulator ?? "")) {
      throw new Error("Emulation requires a local demo project and both local emulators");
    }
    return initializeApp({ projectId });
  }

  if (process.env.VERCEL_ENV === "preview" &&
      (!process.env.FIREBASE_PRODUCTION_PROJECT_ID || projectId === process.env.FIREBASE_PRODUCTION_PROJECT_ID)) {
    throw new Error("Vercel Preview must use a separate Firebase project");
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Firebase Admin credentials are required");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function authApiUrl(service: "identitytoolkit" | "securetoken", path: string): string {
  getAdminApp();
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const origin = emulator ? `http://${emulator}/${service}.googleapis.com` : `https://${service}.googleapis.com`;
  return `${origin}/v1/${path}`;
}

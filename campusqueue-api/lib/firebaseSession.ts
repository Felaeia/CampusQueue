import { adminAuth, authApiUrl } from "./firebaseAdmin.ts";
import { ApiError, roleOf } from "./http.ts";

export function firebaseWebKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY ?? (process.env.FIREBASE_AUTH_EMULATOR_HOST ? "demo-key" : undefined);
  if (!key) throw new ApiError(503, "Firebase sign-in is not configured");
  return encodeURIComponent(key);
}

export async function newSession(uid: string, credentialVersion: number) {
  const key = firebaseWebKey();
  const token = await adminAuth().createCustomToken(uid, { cqVersion: credentialVersion });
  const response = await fetch(`${authApiUrl("identitytoolkit", "accounts:signInWithCustomToken")}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, returnSecureToken: true }),
  });
  if (response.status === 429) throw new ApiError(429, "Try again later");
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    if (details?.error?.message === "USER_DISABLED") throw new ApiError(401, "Invalid account ID or password");
    console.error("Firebase custom token exchange failed", response.status, details?.error?.status);
    throw new ApiError(503, "Firebase sign-in is temporarily unavailable");
  }
  const { idToken, refreshToken, expiresIn } = await response.json();
  return { idToken, refreshToken, expiresIn };
}

export function accountIdentity(profile: FirebaseFirestore.DocumentData, role: string) {
  return {
    account: { loginId: profile.loginId, fullName: profile.fullName },
    ...(roleOf({ role }) === "staff" ? { staff: {
      staffId: profile.staffId, staffName: profile.staffName, office: profile.office,
      officeShort: profile.officeShort, officeId: profile.officeId, defaultCounterWindow: profile.defaultCounterWindow,
      role: profile.role,
    } } : {}),
  };
}

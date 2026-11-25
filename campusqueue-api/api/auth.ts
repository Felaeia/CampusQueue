import { audit } from "../lib/audit.ts";
import { adminDb } from "../lib/firebaseAdmin.ts";
import { newSession } from "../lib/firebaseSession.ts";
import { activeAccount, ApiError, body, endpoint, key, roleOf } from "../lib/http.ts";
import { checkPassword } from "../lib/passwords.ts";

const attemptWindowMs = 5 * 60 * 1000;
const maxAttempts = 8;

export default endpoint(["POST"], async (request) => {
  const input = await body(request);
  if (input.action !== "sign-in") throw new ApiError(400, "Unknown authentication action");
  const loginId = key(input.loginId, "loginId").toLowerCase();
  const password = input.password;
  if (typeof password !== "string" || !password || password.length > 128) {
    throw new ApiError(400, "Invalid password");
  }

  const db = adminDb();
  const alias = (await db.collection("loginIds").doc(loginId).get()).data();
  const deny = () => new ApiError(401, "Invalid account ID or password");
  if (!alias) {
    await checkPassword(password, null);
    throw deny();
  }

  const uid: string = alias.uid;
  const profile = (await db.collection("users").doc(uid).get()).data();
  if (!profile || !activeAccount(profile) || !roleOf(profile)) {
    await checkPassword(password, null);
    throw deny();
  }

  const credentials = db.collection("credentials").doc(uid);
  const record = await db.runTransaction(async (tx) => {
    const current = (await tx.get(credentials)).data();
    if (!current) return undefined;
    const now = Date.now();
    const inWindow = typeof current.windowStartedAt === "number" && now - current.windowStartedAt < attemptWindowMs;
    const attempts = inWindow ? current.attempts ?? 0 : 0;
    if (attempts >= maxAttempts) throw new ApiError(429, "Too many attempts. Try again in a few minutes.");
    tx.update(credentials, { attempts: attempts + 1, windowStartedAt: inWindow ? current.windowStartedAt : now });
    return current;
  });

  if (!(await checkPassword(password, record?.passwordHash)) || !record) {
    if (record && (!record.attempts || Date.now() - (record.windowStartedAt ?? 0) >= attemptWindowMs)) {
      const batch = db.batch();
      audit(batch, { uid, role: profile.role }, "sign_in_failed", "account", uid);
      await batch.commit();
    }
    throw deny();
  }
  const currentProfile = await db.runTransaction(async (tx) => {
    const [credentialDoc, profileDoc] = await tx.getAll(credentials, db.collection("users").doc(uid));
    const current = credentialDoc.data();
    const currentProfile = profileDoc.data();
    if (!current || current.version !== record.version || !currentProfile || !roleOf(currentProfile) ||
        !activeAccount(currentProfile) || !Number.isInteger(currentProfile.credentialVersion)) throw deny();
    tx.update(credentials, { attempts: 0, windowStartedAt: 0 });
    return currentProfile;
  });
  const session = await newSession(uid, currentProfile.credentialVersion);
  const batch = db.batch();
  audit(batch, { uid, role: currentProfile.role }, "sign_in", "account", uid);
  await batch.commit();

  return {
    ...session,
    role: currentProfile.role,
    ...(roleOf(currentProfile) === "staff" ? { staff: {
      staffId: currentProfile.staffId, staffName: currentProfile.staffName, office: currentProfile.office,
      officeShort: currentProfile.officeShort, officeId: currentProfile.officeId, defaultCounterWindow: currentProfile.defaultCounterWindow, role: currentProfile.role,
    } } : {}),
  };
});

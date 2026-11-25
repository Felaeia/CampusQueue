import { adminDb } from "../lib/firebaseAdmin.ts";
import { newSession } from "../lib/firebaseSession.ts";
import { ApiError, body, endpoint, key } from "../lib/http.ts";
import { checkPassword, demoLoginAllowed } from "../lib/passwords.ts";

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
  if (!profile || profile.disabled || !demoLoginAllowed(profile) ||
      !["student", "registrar_staff"].includes(profile.role)) {
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

  if (!(await checkPassword(password, record?.passwordHash)) || !record) throw deny();
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(credentials)).data();
    if (current?.version !== record.version) throw deny();
    tx.update(credentials, { attempts: 0, windowStartedAt: 0 });
  });

  return {
    ...await newSession(uid, record.version),
    role: profile.role,
    ...(profile.role === "registrar_staff" ? { staff: {
      staffId: profile.staffId, staffName: profile.staffName, office: profile.office,
      officeShort: profile.officeShort, defaultCounterWindow: profile.defaultCounterWindow, role: profile.role,
    } } : {}),
  };
});

import { adminDb } from "../lib/firebaseAdmin.ts";
import { firebaseWebKey, newSession } from "../lib/firebaseSession.ts";
import { actor, ApiError, body, endpoint } from "../lib/http.ts";
import { checkPassword, hashPassword, validPassword } from "../lib/passwords.ts";

export default endpoint(["POST"], async (request) => {
  const { uid, profile } = await actor(request);
  firebaseWebKey();
  const { currentPassword, newPassword } = await body(request);
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128 ||
      !validPassword(newPassword)) {
    throw new ApiError(400, "Enter the current password and a new password of 8 to 128 characters");
  }

  const db = adminDb();
  const credentials = db.collection("credentials").doc(uid);
  const account = db.collection("users").doc(uid);
  const current = (await credentials.get()).data();
  if (!current || current.version !== profile.credentialVersion ||
      !(await checkPassword(currentPassword, current.passwordHash))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const passwordHash = await hashPassword(newPassword);
  const version = current.version + 1;
  await db.runTransaction(async (tx) => {
    const latest = (await tx.get(credentials)).data();
    if (latest?.version !== current.version) throw new ApiError(409, "Password already changed");
    tx.update(credentials, { passwordHash, version, attempts: 0, windowStartedAt: 0 });
    tx.update(account, { credentialVersion: version });
  });

  return newSession(uid, version);
});

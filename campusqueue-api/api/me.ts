import { adminDb } from "../lib/firebaseAdmin.ts";
import { accountIdentity } from "../lib/firebaseSession.ts";
import { actor, endpoint } from "../lib/http.ts";

export default endpoint(["GET"], async (request) => {
  const account = await actor(request);
  const { uid, profile } = account;
  await adminDb().collection("offices").limit(1).get();
  return { success: true, uid, role: profile.role, firestoreConnected: true, ...accountIdentity(profile, account.role) };
});

import { adminDb } from "../lib/firebaseAdmin.ts";
import { actor, endpoint } from "../lib/http.ts";

export default endpoint(["GET"], async (request) => {
  const { uid, profile } = await actor(request);
  await adminDb().collection("offices").limit(1).get();
  return { success: true, uid, role: profile.role, firestoreConnected: true };
});

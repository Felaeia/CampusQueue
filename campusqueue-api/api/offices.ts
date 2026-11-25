import { adminDb } from "../lib/firebaseAdmin.ts";
import { actor, endpoint } from "../lib/http.ts";

export default endpoint(["GET"], async (request) => {
  await actor(request);
  const offices = await adminDb().collection("offices").get();
  return { offices: offices.docs.map((doc) => {
    const { servingByCounter, ...office } = doc.data();
    const count = office.waitingCount ?? 0;
    return { id: doc.id, ...office, crowdBadge: count === 0 ? "Queue clear" : String(count) + " waiting" };
  }) };
});

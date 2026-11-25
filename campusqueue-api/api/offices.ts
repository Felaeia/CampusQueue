import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebaseAdmin.ts";
import { actor, endpoint, key } from "../lib/http.ts";

export default endpoint(["GET"], async (request) => {
  await actor(request);
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  const query = adminDb().collection("offices").orderBy(FieldPath.documentId());
  const offices = await (cursor ? query.startAfter(key(cursor, "cursor")) : query).limit(101).get();
  const page = offices.docs.slice(0, 100);
  return { offices: page.filter((doc) => !doc.data().archivedAt).map((doc) => {
    const { servingByCounter, services, ...office } = doc.data();
    const count = office.waitingCount ?? 0;
    return { id: doc.id, ...office, services: (services ?? []).filter((service: FirebaseFirestore.DocumentData) => !service.archivedAt && service.available !== false), crowdBadge: count === 0 ? "Queue clear" : String(count) + " waiting" };
  }), nextCursor: offices.size > 100 ? page.at(-1)?.id ?? null : null };
});

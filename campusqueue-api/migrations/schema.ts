import { readFile } from "node:fs/promises";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebaseAdmin.ts";
import { desks } from "../lib/queue.ts";

export async function applyMigrations(dryRun: boolean) {
  const db = adminDb();
  const seeds: FirebaseFirestore.DocumentData[] = JSON.parse(
    await readFile(new URL("./001-offices.json", import.meta.url), "utf8"),
  );
  const seed = await db.runTransaction(async (tx) => {
    const marker = db.collection("schemaMigrations").doc("001-offices");
    const offices = seeds.map((item) => db.collection("offices").doc(item.id));
    const counters = desks.map((id) => offices[0].collection("counters").doc(id));
    const [version, ...docs] = await tx.getAll(marker, ...offices, ...counters);
    if (version.exists) return 0;
    const missing = docs.filter((doc) => !doc.exists).length;
    if (dryRun) return missing;
    for (const [index, doc] of docs.entries()) {
      if (doc.exists) continue;
      if (index < offices.length) {
        const { id, ...data } = seeds[index];
        tx.create(doc.ref, data);
      } else {
        tx.create(doc.ref, { status: "online", ticketId: null });
      }
    }
    tx.create(marker, { appliedAt: FieldValue.serverTimestamp() });
    return missing;
  });

  const counts = { seed, offices: 0, counters: 0, accounts: 0, unresolvedAccounts: 0 };
  for (const item of seeds) {
    const ref = db.collection("offices").doc(item.id);
    const defaultCounters = item.id === "registrar" ? desks : [item.windowLabel];
    const result = await db.runTransaction(async (tx) => {
      const prefixRef = db.collection("officeCodes").doc(item.prefix);
      const [doc, prefix, ...counters] = await tx.getAll(ref, prefixRef, ...defaultCounters.map((id) => ref.collection("counters").doc(id)));
      const config = doc.data();
      if (prefix.exists && prefix.get("officeId") !== item.id) throw new Error("Seed office code is assigned to another office");
      if (!config && !dryRun) return { office: 0, counters: 0 };
      const office = config && config.acceptingTickets === undefined ? 1 : 0;
      const changes = counters.filter((counter) => !counter.exists || counter.get("officeId") === undefined);
      if (!dryRun) {
        if (office) tx.update(ref, { acceptingTickets: true });
        if (!prefix.exists) tx.create(prefixRef, { officeId: item.id });
        for (const counter of changes) {
          if (!counter.exists) tx.create(counter.ref, { officeId: item.id, name: counter.id, status: "online", ticketId: null });
          else tx.update(counter.ref, { officeId: item.id, name: counter.get("name") ?? counter.id });
        }
      }
      return { office, counters: changes.length };
    });
    counts.offices += result.office;
    counts.counters += result.counters;
  }

  let cursor: string | undefined;
  do {
    const listing = db.collection("users").orderBy(FieldPath.documentId());
    const page = await (cursor ? listing.startAfter(cursor) : listing).limit(100).get();
    for (const doc of page.docs) {
      const data = doc.data();
      if (data.role !== "registrar_staff" || data.counterIds !== undefined) continue;
      // The original provisioning code assigned this role to Registrar only.
      const id = data.defaultCounterWindow;
      if ((data.officeId != null && data.officeId !== "registrar") ||
          typeof id !== "string" || !desks.includes(id)) {
        counts.unresolvedAccounts++;
        continue;
      }
      if (dryRun) counts.accounts++;
      else counts.accounts += await db.runTransaction(async (tx) => {
        const current = (await tx.get(doc.ref)).data();
        if (!current || current.role !== "registrar_staff" || current.counterIds !== undefined ||
            current.defaultCounterWindow !== id || (current.officeId != null && current.officeId !== "registrar")) return 0;
        tx.update(doc.ref, { officeId: "registrar", counterIds: [id], updatedAt: FieldValue.serverTimestamp() });
        return 1;
      });
    }
    cursor = page.size === 100 ? page.docs.at(-1)?.id : undefined;
  } while (cursor);
  return counts;
}

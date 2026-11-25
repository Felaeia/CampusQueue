import { readFile } from "node:fs/promises";
import { adminDb } from "../lib/firebaseAdmin.ts";
import { desks } from "../lib/queue.ts";

const db = adminDb();
const offices = JSON.parse(await readFile(new URL("./001-offices.json", import.meta.url), "utf8"));
const marker = db.collection("schemaMigrations").doc("001-offices");

const applied = await db.runTransaction(async (transaction) => {
  const refs = offices.map((item: { id: string }) => db.collection("offices").doc(item.id));
  const counters = desks.map((name) => db.collection("offices").doc("registrar").collection("counters").doc(name));
  const [migration, ...documents] = await transaction.getAll(marker, ...refs, ...counters);
  if (migration.exists) return false;
  for (let index = 0; index < documents.length; index++) {
    const document = documents[index];
    if (document.exists) continue;
    if (index < offices.length) {
      const { id, ...data } = offices[index];
      transaction.create(document.ref, data);
    } else {
      transaction.create(document.ref, { status: "online", ticketId: null });
    }
  }
  transaction.create(marker, { appliedAt: new Date().toISOString() });
  return true;
});
console.log(applied ? "Office and counter migration applied." : "Office and counter migration already applied.");

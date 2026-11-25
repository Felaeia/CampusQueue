import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.ts";

export type AuditActor = { uid: string; role: string };
type Details = {
  officeId?: string;
  ticketId?: string;
  fields?: string[];
  outcome?: string;
};

export function audit(
  tx: Transaction | FirebaseFirestore.WriteBatch,
  actor: AuditActor,
  action: string,
  targetType: string,
  targetId: string,
  details: Details = {},
): void {
  tx.create(adminDb().collection("activityLogs").doc(), {
    actorId: actor.uid, actorRole: actor.role, action, targetType, targetId,
    officeId: details.officeId ?? null, ticketId: details.ticketId ?? null,
    ...(details.fields ? { fields: details.fields } : {}),
    ...(details.outcome ? { outcome: details.outcome } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });
}

import { randomBytes, timingSafeEqual } from "node:crypto";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, key, text } from "./http.ts";

export const officeIds = ["registrar", "accounting", "sao"];
export const desks = ["Window 1", "Window 2", "Window 3"];
export const now = () => new Date().toISOString();

export function officeKey(value: unknown): string {
  const id = key(value, "officeId");
  if (!officeIds.includes(id)) throw new ApiError(404, "Office not found");
  return id;
}

export const officeRef = (id: string) => adminDb().collection("offices").doc(id);
export const ticketRef = (id: string) => adminDb().collection("tickets").doc(id);
export const userRef = (uid: string) => adminDb().collection("users").doc(uid);
export const waiting = (id: string) => officeRef(id).collection("waiting");
export const history = (uid: string) => userRef(uid).collection("history");

export function notification(uid: string, title: string, message: string, ticketId: string) {
  return {
    ref: userRef(uid).collection("notifications").doc(),
    data: { title, message, ticketId, time: now(), read: false, dotColor: "#15803D" },
  };
}

export async function issueTicket(uid: string, input: Record<string, unknown>) {
  const id = officeKey(input.officeId);
  const service = text(input.serviceName, "serviceName");
  const notes = input.notes == null || input.notes === "" ? "" : text(input.notes, "notes", 500);
  const operationId = key(input.requestId, "requestId");
  const profile = userRef(uid);
  const receipt = profile.collection("requests").doc(operationId);
  const office = officeRef(id);
  const ticket = adminDb().collection("tickets").doc();
  const token = randomBytes(24).toString("base64url");

  return adminDb().runTransaction(async (tx) => {
    const [accountSnap, officeSnap, receiptSnap] = await tx.getAll(profile, office, receipt);
    if (receiptSnap.exists) {
      const previous = receiptSnap.data()!;
      if (previous.officeId !== id || previous.service !== service || previous.notes !== notes) {
        throw new ApiError(409, "Request ID already used");
      }
      const existing = await tx.get(ticketRef(previous.ticketId));
      if (!existing.exists) throw new ApiError(409, "Original ticket is unavailable");
      return { id: existing.id, ...existing.data() };
    }
    const account = accountSnap.data()!;
    const config = officeSnap.data();
    if (!config) throw new ApiError(404, "Office not found");
    if (account.activeTickets?.[id]) throw new ApiError(409, "You already have an active ticket for this office");
    const chosen = config.services?.find((item: { name: string }) => item.name === service);
    if (!chosen) throw new ApiError(400, "Service is unavailable");
    const sequence = (config.lastIssuedNumber ?? 0) + 1;
    const ticketNumber = `${config.prefix}-${String(sequence).padStart(3, "0")}`;
    const issuedAt = now();
    const data = {
      uid, sequence, ticketNumber, officeId: id, officeName: config.name,
      shortOffice: config.shortLabel, counter: config.windowLabel,
      status: "waiting", service, holderShort: account.holderShort ?? account.fullName,
      studentName: account.fullName, studentUsn: account.usn, program: account.program ?? "",
      serial: ticket.id, qrPayload: `cq:v1:${ticket.id}:${token}`, issuedAt,
      estWaitMins: ((config.waitingCount ?? 0) + 1) * chosen.duration,
      aheadCount: config.waitingCount ?? 0, nowServing: config.nowServing ?? "",
      trackNodes: [], notes, isQrVerified: false, recallCount: 0,
    };
    tx.create(ticket, data);
    tx.create(waiting(id).doc(ticket.id), { sequence });
    tx.create(receipt, { officeId: id, service, notes, ticketId: ticket.id });
    tx.update(profile, `activeTickets.${id}`, ticket.id);
    tx.update(office, { lastIssuedNumber: sequence, waitingCount: data.aheadCount + 1 });
    return { id: ticket.id, ...data };
  });
}

export async function cancelTicket(uid: string, input: Record<string, unknown>) {
  const id = key(input.ticketId, "ticketId");
  const reason = text(input.reason, "reason", 500);
  return adminDb().runTransaction(async (tx) => {
    const ticket = ticketRef(id);
    const data = (await tx.get(ticket)).data();
    if (!data || data.uid !== uid) throw new ApiError(404, "Ticket not found");
    if (data.status === "Cancelled") return { id, status: data.status };
    if (data.status !== "waiting") throw new ApiError(409, "Only waiting tickets can be cancelled");
    const office = officeRef(data.officeId);
    const config = (await tx.get(office)).data()!;
    const timestamp = now();
    tx.update(ticket, { status: "Cancelled", reason, timestamp });
    tx.delete(waiting(data.officeId).doc(id));
    tx.create(history(uid).doc(id), { timestamp });
    tx.update(userRef(uid), `activeTickets.${data.officeId}`, null);
    tx.update(office, { waitingCount: Math.max(0, config.waitingCount - 1) });
    return { id, status: "Cancelled" };
  });
}

export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

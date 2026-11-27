import { randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { audit } from "./audit.ts";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, key, requireCurrent, text, type Actor } from "./http.ts";

export const officeIds = ["registrar", "accounting", "sao"];
export const desks = ["Window 1", "Window 2", "Window 3"];
export const now = () => new Date().toISOString();

export function officeKey(value: unknown): string {
  const id = key(value, "officeId");
  if (id.startsWith("__")) throw new ApiError(400, "Invalid officeId");
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

export function nearTurnThreshold(config: FirebaseFirestore.DocumentData): number | null {
  return Number.isInteger(config.nearTurnThreshold) && config.nearTurnThreshold >= 0 && config.nearTurnThreshold <= 20
    ? config.nearTurnThreshold : null;
}

export function writeNearTurn(tx: FirebaseFirestore.Transaction, uid: string, id: string, officeName: string) {
  const alert = notification(uid, "Nearly your turn", `Your ticket for ${officeName} is near the front of the queue.`, id);
  tx.create(alert.ref, { ...alert.data, kind: "near_turn" });
}

export async function prepareNearTurn(
  tx: FirebaseFirestore.Transaction,
  officeId: string,
  config: FirebaseFirestore.DocumentData,
  excluded?: string,
): Promise<() => void> {
  const threshold = nearTurnThreshold(config);
  if (threshold === null) return () => {};
  const queue = await tx.get(waiting(officeId).orderBy("sequence").limit(threshold + (excluded ? 2 : 1)));
  const entering = queue.docs.filter((doc) => doc.id !== excluded).slice(0, threshold + 1)
    .filter((doc) => !doc.get("nearTurnNotified"));
  if (!entering.length) return () => {};
  const tickets = await tx.getAll(...entering.map((doc) => ticketRef(doc.id)));
  const eligible = tickets.filter((doc) => doc.get("status") === "waiting" && doc.get("officeId") === officeId);
  return () => {
    for (const ticket of eligible) {
      tx.update(waiting(officeId).doc(ticket.id), { nearTurnNotified: true });
      if (ticket.get("nearTurnNotified")) continue;
      tx.update(ticket.ref, { nearTurnNotified: true });
      writeNearTurn(tx, ticket.get("uid"), ticket.id, config.name);
    }
  };
}

export async function issueTicket(actor: Actor, input: Record<string, unknown>) {
  const { uid } = actor;
  const id = officeKey(input.officeId);
  const serviceId = input.serviceId == null ? null : key(input.serviceId, "serviceId");
  const service = serviceId ? null : text(input.serviceName, "serviceName");
  const notes = input.notes == null || input.notes === "" ? "" : text(input.notes, "notes", 500);
  const operationId = key(input.requestId, "requestId");
  const profile = userRef(uid);
  const receipt = profile.collection("requests").doc(operationId);
  const office = officeRef(id);
  const ticket = adminDb().collection("tickets").doc();
  const token = randomBytes(24).toString("base64url");

  return adminDb().runTransaction(async (tx) => {
    const account = await requireCurrent(tx, actor);
    const [officeSnap, receiptSnap] = await tx.getAll(office, receipt);
    const allCountersSnap = await tx.get(office.collection("counters"));
    if (receiptSnap.exists) {
      const previous = receiptSnap.data()!;
      if (previous.officeId !== id || (serviceId ? previous.serviceId !== serviceId : previous.service !== service) || previous.notes !== notes) {
        throw new ApiError(409, "Request ID already used");
      }
      const existing = await tx.get(ticketRef(previous.ticketId));
      if (!existing.exists) throw new ApiError(409, "Original ticket is unavailable");
      return { id: existing.id, ...existing.data() };
    }
    const config = officeSnap.data();
    if (!config || config.archivedAt) throw new ApiError(404, "Office not found");
    if (config.acceptingTickets === false) throw new ApiError(409, "Office is not accepting tickets");
    if (account.activeTickets?.[id]) throw new ApiError(409, "You already have an active ticket for this office");
    const chosen = config.services?.find((item: { id: string; name: string }) => serviceId ? item.id === serviceId : item.name === service);
    if (!chosen || chosen.archivedAt || chosen.available === false) throw new ApiError(400, "Service is unavailable");

    const sequence = (config.lastIssuedNumber ?? 0) + 1;
    const queueSequence = Math.max(config.lastQueueSequence ?? 0, config.lastIssuedNumber ?? 0) + 1;
    const ticketNumber = `${config.prefix}-${String(sequence).padStart(3, "0")}`;
    const issuedAt = now();

    // Auto-promote into SERVING immediately when no one is waiting and an online counter is idle
    const freeCounters = allCountersSnap.docs.filter((doc) => {
      const c = doc.data();
      return !c.archivedAt && c.status === "online" && !c.ticketId;
    });
    const preferredFreeCounter =
      freeCounters.find((doc) => doc.id === config.windowLabel) ?? freeCounters[0];
    const autoPromote = Boolean(preferredFreeCounter) && (config.waitingCount ?? 0) === 0;

    if (autoPromote && preferredFreeCounter) {
      const counterName = preferredFreeCounter.id;
      const servingByCounter = {
        ...(config.servingByCounter ?? {}),
        [counterName]: { ticketNumber, calledAt: issuedAt },
      };
      const serverNow = FieldValue.serverTimestamp();
      const data = {
        uid, sequence, queueSequence, originalQueueSequence: queueSequence, ticketNumber, officeId: id, officeName: config.name,
        shortOffice: config.shortLabel, counter: counterName,
        status: "serving", service: chosen.name, serviceId: chosen.id, officeCode: config.prefix,
        serviceSnapshot: { name: chosen.name, duration: chosen.duration, docs: chosen.docs ?? "", description: chosen.description ?? "" },
        holderShort: account.holderShort ?? account.fullName,
        studentName: account.fullName, studentUsn: account.usn, program: account.program ?? "",
        serial: ticket.id, qrPayload: `cq:v1:${ticket.id}:${token}`, issuedAt,
        calledAt: issuedAt, startedAt: issuedAt,
        estWaitMins: 0, aheadCount: 0, nowServing: ticketNumber,
        trackNodes: [], notes, isQrVerified: false, recallCount: 0, nearTurnNotified: true, requeueCount: 0,
      };
      tx.create(ticket, {
        ...data,
        issuedTimestamp: serverNow,
        calledTimestamp: serverNow,
        startedTimestamp: serverNow,
      });
      audit(tx, actor, "ticket_issued", "ticket", ticket.id, { officeId: id, ticketId: ticket.id });
      audit(tx, actor, "ticket_called", "ticket", ticket.id, { officeId: id, ticketId: ticket.id });
      audit(tx, actor, "service_started", "ticket", ticket.id, { officeId: id, ticketId: ticket.id });
      const alert = notification(uid, "It is your turn", `Please proceed to ${counterName}.`, ticket.id);
      tx.create(alert.ref, alert.data);
      tx.create(receipt, { officeId: id, service: chosen.name, serviceId: chosen.id, notes, ticketId: ticket.id });
      tx.update(profile, `activeTickets.${id}`, ticket.id);
      tx.update(preferredFreeCounter.ref, { ticketId: ticket.id, updatedAt: serverNow });
      tx.update(office, {
        lastIssuedNumber: sequence,
        lastQueueSequence: queueSequence,
        waitingCount: 0,
        servingByCounter,
        nowServing: ticketNumber,
      });
      return { id: ticket.id, ...data };
    }

    const threshold = nearTurnThreshold(config);
    const nearTurnNotified = threshold !== null && (config.waitingCount ?? 0) <= threshold;
    const data = {
      uid, sequence, queueSequence, originalQueueSequence: queueSequence, ticketNumber, officeId: id, officeName: config.name,
      shortOffice: config.shortLabel, counter: config.windowLabel,
      status: "waiting", service: chosen.name, serviceId: chosen.id, officeCode: config.prefix,
      serviceSnapshot: { name: chosen.name, duration: chosen.duration, docs: chosen.docs ?? "", description: chosen.description ?? "" },
      holderShort: account.holderShort ?? account.fullName,
      studentName: account.fullName, studentUsn: account.usn, program: account.program ?? "",
      serial: ticket.id, qrPayload: `cq:v1:${ticket.id}:${token}`, issuedAt,
      estWaitMins: ((config.waitingCount ?? 0) + 1) * chosen.duration,
      aheadCount: config.waitingCount ?? 0, nowServing: config.nowServing ?? "",
      trackNodes: [], notes, isQrVerified: false, recallCount: 0, nearTurnNotified, requeueCount: 0,
    };
    tx.create(ticket, { ...data, issuedTimestamp: FieldValue.serverTimestamp() });
    audit(tx, actor, "ticket_issued", "ticket", ticket.id, { officeId: id, ticketId: ticket.id });
    tx.create(waiting(id).doc(ticket.id), { sequence: queueSequence, nearTurnNotified });
    if (nearTurnNotified) writeNearTurn(tx, uid, ticket.id, config.name);
    tx.create(receipt, { officeId: id, service: chosen.name, serviceId: chosen.id, notes, ticketId: ticket.id });
    tx.update(profile, `activeTickets.${id}`, ticket.id);
    tx.update(office, { lastIssuedNumber: sequence, lastQueueSequence: queueSequence, waitingCount: data.aheadCount + 1 });
    return { id: ticket.id, ...data };
  });
}

export async function cancelTicket(actor: Actor, input: Record<string, unknown>) {
  const { uid } = actor;
  const id = key(input.ticketId, "ticketId");
  const reason = text(input.reason, "reason", 500);
  return adminDb().runTransaction(async (tx) => {
    await requireCurrent(tx, actor);
    const ticket = ticketRef(id);
    const data = (await tx.get(ticket)).data();
    if (!data || data.uid !== uid) throw new ApiError(404, "Ticket not found");
    if (data.status === "Cancelled") return { id, status: data.status };
    if (data.status !== "waiting") throw new ApiError(409, "Only waiting tickets can be cancelled");
    const office = officeRef(data.officeId);
    const config = (await tx.get(office)).data()!;
    const notify = await prepareNearTurn(tx, data.officeId, config, id);
    const timestamp = now();
    tx.update(ticket, { status: "Cancelled", reason, timestamp, closedTimestamp: FieldValue.serverTimestamp() });
    audit(tx, actor, "ticket_cancelled", "ticket", id, { officeId: data.officeId, ticketId: id });
    tx.delete(waiting(data.officeId).doc(id));
    tx.create(history(uid).doc(id), { timestamp });
    tx.update(userRef(uid), `activeTickets.${data.officeId}`, null);
    tx.update(office, { waitingCount: Math.max(0, config.waitingCount - 1) });
    notify();
    return { id, status: "Cancelled" };
  });
}

export async function acknowledgeTicket(actor: Actor, input: Record<string, unknown>) {
  const id = key(input.ticketId, "ticketId");
  return adminDb().runTransaction(async (tx) => {
    await requireCurrent(tx, actor);
    const ref = ticketRef(id);
    const ticket = (await tx.get(ref)).data();
    if (!ticket || ticket.uid !== actor.uid) throw new ApiError(404, "Ticket not found");
    if (!["called", "serving"].includes(ticket.status)) throw new ApiError(409, "Ticket has not been called or is closed");
    if (ticket.acknowledgedAt) return { ticketId: id, acknowledgedAt: ticket.acknowledgedAt };
    const acknowledgedAt = now();
    tx.update(ref, { acknowledgedAt, acknowledgmentTimestamp: FieldValue.serverTimestamp() });
    audit(tx, actor, "student_acknowledged", "ticket", id, { officeId: ticket.officeId, ticketId: id });
    return { ticketId: id, acknowledgedAt };
  });
}

export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

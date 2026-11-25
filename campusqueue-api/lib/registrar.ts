import { randomBytes } from "node:crypto";
import { audit } from "./audit.ts";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, activeAccount, key, requireCurrent, text, type Actor } from "./http.ts";
import { equalSecret, history, nearTurnThreshold, notification, now, officeRef, prepareNearTurn, ticketRef, userRef, waiting, writeNearTurn } from "./queue.ts";

function scope(profile: FirebaseFirestore.DocumentData, value: unknown, requestedOffice: unknown) {
  const officeId = key(profile.officeId, "assigned office");
  if (requestedOffice != null && requestedOffice !== officeId) throw new ApiError(403, "Office access required");
  const allowed = profile.counterIds ?? (profile.role === "registrar_staff" && profile.defaultCounterWindow ? [profile.defaultCounterWindow] : []);
  const name = text(value ?? profile.defaultCounterWindow, "counter", 80);
  if (!/^[a-zA-Z0-9_ -]+$/.test(name) || name.startsWith("__") || !allowed.includes(name)) {
    throw new ApiError(403, "Counter access required");
  }
  const office = officeRef(officeId);
  return { name, officeId, office, desk: office.collection("counters").doc(name), shiftLogs: office.collection("logs") };
}

export function staffScope(actor: Actor, inputs: Record<string, unknown>, legacy: boolean) {
  if (legacy && actor.profile.officeId !== "registrar") throw new ApiError(403, "Registrar access required");
  return scope(actor.profile, inputs.counter, inputs.officeId);
}

export async function listStaffCounters(actor: Actor, requestedOffice: unknown) {
  const profile = actor.profile;
  const officeId = key(profile.officeId, "assigned office");
  if (requestedOffice != null && requestedOffice !== officeId) throw new ApiError(403, "Office access required");
  const allowed: string[] = profile.counterIds ??
    (profile.role === "registrar_staff" && profile.defaultCounterWindow ? [profile.defaultCounterWindow] : []);
  const office = officeRef(officeId);
  const [officeDoc, ...counters] = await adminDb().getAll(
    office, ...allowed.map((id) => office.collection("counters").doc(id)),
  );
  if (!officeDoc.exists || officeDoc.get("archivedAt")) throw new ApiError(404, "Assigned office is unavailable");
  return {
    officeId, defaultCounter: profile.defaultCounterWindow ?? null,
    counters: counters.filter((doc) => doc.exists && !doc.get("archivedAt")).map((doc) => ({
      id: doc.id, name: doc.get("name") ?? doc.id, status: doc.get("status"),
    })),
  };
}

export function staffTicket(id: string, ticket: FirebaseFirestore.DocumentData) {
  return {
    id, ticketNumber: ticket.ticketNumber, studentName: ticket.studentName,
    usn: ticket.studentUsn, program: ticket.program, serviceType: ticket.service,
    waitMinutes: Math.max(0, Math.floor((Date.now() - Date.parse(ticket.issuedAt)) / 60000)),
    issuedAt: ticket.issuedAt, calledAt: ticket.calledAt ?? null, notes: ticket.notes,
    isQrVerified: ticket.isQrVerified, recallCount: ticket.recallCount, status: ticket.status,
    startedAt: ticket.startedAt ?? null, acknowledgedAt: ticket.acknowledgedAt ?? null,
  };
}

export async function staffState(actor: Actor, input: Record<string, unknown>, legacy: boolean) {
  const { name, officeId, office, desk: deskRef, shiftLogs } = staffScope(actor, input, legacy);
  const local = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const startOfShift = new Date(local + "T00:00:00+08:00").toISOString();
  const [desk, queue, logs, officeSnap] = await Promise.all([
    deskRef.get(), waiting(officeId).orderBy("sequence").limit(100).get(),
    input.includeLogs === "false" ? null : shiftLogs.where("closedAt", ">=", startOfShift).orderBy("closedAt", "desc").limit(250).get(), office.get(),
  ]);
  const data = desk.data();
  if (!data || data.archivedAt || !officeSnap.exists || officeSnap.data()?.archivedAt) throw new ApiError(404, "Counter is unavailable");
  const serving = data.ticketId ? await ticketRef(data.ticketId).get() : null;
  const waitingTickets = queue.empty ? [] : await adminDb().getAll(...queue.docs.map((doc) => ticketRef(doc.id)));
  return {
    officeId, counter: name, deskStatus: data.status,
    servingTicket: serving?.exists ? staffTicket(serving.id, serving.data()!) : null,
    waitingQueue: waitingTickets.filter((doc) => doc.data()?.status === "waiting").map((doc) => staffTicket(doc.id, doc.data()!)),
    transactions: (logs?.docs ?? []).map((doc) => {
      const { staffUid, ...transaction } = doc.data();
      return { ...transaction, id: doc.id, isMine: staffUid === actor.uid };
    }),
  };
}

export async function changeDesk(actor: Actor, input: Record<string, unknown>, legacy: boolean) {
  staffScope(actor, input, legacy);
  const uid = actor.uid;
  const action = input.action;
  if (!["status", "call-next", "start", "complete", "skip", "no-show", "recall", "requeue"].includes(String(action))) {
    throw new ApiError(400, "Unknown staff action");
  }
  return adminDb().runTransaction(async (tx) => {
    const profile = await requireCurrent(tx, actor);
    const { name, officeId, office, desk, shiftLogs } = scope(profile, input.counter, input.officeId);
    const [deskSnap, officeSnap] = await tx.getAll(desk, office);
    const data = deskSnap.data();
    const config = officeSnap.data();
    if (!data || data.archivedAt || !config || config.archivedAt) throw new ApiError(404, "Counter is unavailable");
    const staffName = profile.staffName ?? profile.fullName;
    if (action === "status") {
      const status = text(input.status, "status");
      if (!["online", "break", "closed"].includes(status)) throw new ApiError(400, "Invalid desk status");
      if (status === "closed" && data.ticketId) throw new ApiError(409, "Finish the current ticket first");
      tx.update(desk, { status, updatedAt: FieldValue.serverTimestamp() });
      audit(tx, actor, "counter_status_changed", "counter", name, { officeId, outcome: status });
      return { status };
    }

    if (action === "requeue") {
      const id = key(input.ticketId, "ticketId");
      const ref = ticketRef(id);
      const ticket = (await tx.get(ref)).data();
      if (!ticket || ticket.officeId !== officeId) throw new ApiError(404, "Ticket not found");
      if (ticket.status !== "no_show") throw new ApiError(409, "Only a no-show ticket can be requeued");
      if (!Number.isInteger(config.requeueLimit) || !["tail", "original"].includes(config.requeuePlacement)) {
        throw new ApiError(409, "Requeue limit and placement must be configured");
      }
      const count = ticket.requeueCount ?? 0;
      if (count >= config.requeueLimit) throw new ApiError(409, "Requeue limit reached");
      const owner = userRef(ticket.uid);
      const ownerData = (await tx.get(owner)).data();
      if (!ownerData || !activeAccount(ownerData) || ownerData.activeTickets?.[officeId]) {
        throw new ApiError(409, "Student is unavailable or already holds an active ticket");
      }
      const last = Math.max(config.lastQueueSequence ?? 0, config.lastIssuedNumber ?? 0);
      const queueSequence = config.requeuePlacement === "original" ? ticket.originalQueueSequence ?? ticket.sequence : last + 1;
      const threshold = nearTurnThreshold(config);
      const canNotify = threshold !== null && !ticket.nearTurnNotified;
      let notify = false;
      if (canNotify) {
        const ahead = config.requeuePlacement === "tail" ? config.waitingCount ?? 0 :
          (await tx.get(waiting(officeId).where("sequence", "<", queueSequence).limit(threshold + 1))).size;
        notify = ahead <= threshold;
      }
      const requeuedAt = now();
      const nearTurnNotified = Boolean(ticket.nearTurnNotified) || notify;
      tx.update(ref, {
        status: "waiting", queueSequence, requeuedAt, requeueCount: count + 1, nearTurnNotified,
        calledAt: null, calledTimestamp: null, startedAt: null, startedTimestamp: null,
        acknowledgedAt: null, acknowledgmentTimestamp: null, timestamp: null, closedTimestamp: null,
        reason: null, verifiedAt: null, verificationMethod: null, isQrVerified: false, recallCount: 0,
        qrPayload: "cq:v1:" + id + ":" + randomBytes(24).toString("base64url"),
      });
      tx.create(waiting(officeId).doc(id), { sequence: queueSequence, nearTurnNotified });
      if (notify) writeNearTurn(tx, ticket.uid, id, config.name);
      tx.update(owner, "activeTickets." + officeId, id);
      tx.update(office, { lastQueueSequence: Math.max(last, queueSequence), waitingCount: (config.waitingCount ?? 0) + 1 });
      audit(tx, actor, "ticket_requeued", "ticket", id, { officeId, ticketId: id });
      return { ticketId: id, requeueCount: count + 1, status: "waiting" };
    }

    const current = data.ticketId ? await tx.get(ticketRef(data.ticketId)) : null;
    const currentData = current?.data();
    if (action === "call-next") {
      if (data.ticketId) throw new ApiError(409, "Finish the current ticket first");
    } else if (!current || !currentData || !["called", "serving"].includes(currentData.status) || currentData.officeId !== officeId || currentData.counter !== name ||
               current.id !== key(input.ticketId, "ticketId")) {
      throw new ApiError(409, "The serving ticket changed");
    }

    if (action === "start" && current && currentData) {
      if (currentData.status !== "called") throw new ApiError(409, "Only a called ticket can start service");
      const startedAt = now();
      tx.update(current.ref, { status: "serving", startedAt, startedTimestamp: FieldValue.serverTimestamp() });
      audit(tx, actor, "service_started", "ticket", current.id, { officeId, ticketId: current.id });
      return { ticketId: current.id, status: "serving", startedAt };
    }
    if (!legacy && action === "complete" && currentData?.status !== "serving") {
      throw new ApiError(409, "Start service before completing this ticket");
    }
    const noShow = action === "no-show" || (action === "skip" && (!legacy || config.graceMinutes != null));
    if (noShow) {
      if (currentData?.status !== "called") throw new ApiError(409, "Only a called ticket can be marked as a no-show");
      if (!Number.isInteger(config.graceMinutes) || config.graceMinutes < 1) {
        throw new ApiError(409, "No-show grace period must be configured");
      }
      const elapsed = Date.now() - Date.parse(currentData.calledAt);
      if (!Number.isFinite(elapsed) || elapsed < config.graceMinutes * 60_000) {
        throw new ApiError(409, "No-show grace period has not elapsed");
      }
    }
    if (action === "recall" && current && currentData) {
      const recallCount = currentData.recallCount ?? 0;
      if (recallCount >= 3) throw new ApiError(409, "Recall limit reached");
      if (input.recallCount !== recallCount) throw new ApiError(409, "Recall count changed");
      const alert = notification(currentData.uid, "Ticket recalled", `Please proceed to ${name}.`, current.id);
      tx.update(current.ref, { recallCount: recallCount + 1 });
      tx.create(alert.ref, alert.data);
      audit(tx, actor, "ticket_recalled", "ticket", current.id, { officeId, ticketId: current.id });
      return { recallCount: recallCount + 1 };
    }

    if (action === "call-next" && data.status !== "online") {
      throw new ApiError(409, "Counter must be online");
    }
    const shouldAdvance = data.status === "online" &&
      (action === "call-next" || (legacy && action === "skip") || input.advance === true);
    const nextEntry = shouldAdvance ? (await tx.get(waiting(officeId).orderBy("sequence").limit(1))).docs[0] : undefined;
    const next = nextEntry ? await tx.get(ticketRef(nextEntry.id)) : undefined;
    if (action === "call-next" && !next) return { ticketId: null, ticket: null };
    const notify = next ? await prepareNearTurn(tx, officeId, config, next.id) : () => {};
    const timestamp = now();
    const servingByCounter = { ...config.servingByCounter };
    delete servingByCounter[name];

    if (current && currentData) {
      const status = action === "complete" ? "Completed" : noShow ? "no_show" : "Skipped";
      const rawRemarks = action === "complete" ? input.remarks : input.reason;
      const remarks = rawRemarks == null || rawRemarks === "" ? "" : text(rawRemarks, "remarks", 500);
      const elapsed = Math.max(0, Math.floor((Date.parse(timestamp) - Date.parse(currentData.startedAt ?? currentData.calledAt)) / 1000)) || 0;
      tx.update(current.ref, { status, timestamp, reason: remarks, closedTimestamp: FieldValue.serverTimestamp(),
        ...(status === "no_show" ? { noShowCount: FieldValue.increment(1) } : {}),
      });
      tx.update(userRef(currentData.uid), `activeTickets.${officeId}`, null);
      const entryId = status === "no_show" ? current.id + "-no-show-" + (currentData.requeueCount ?? 0) : current.id;
      const ticketSnapshot = {
        ticketNumber: currentData.ticketNumber, officeId, officeName: currentData.officeName,
        service: currentData.service, status, counter: name, issuedAt: currentData.issuedAt,
        calledAt: currentData.calledAt, timestamp, reason: remarks,
      };
      tx.create(history(currentData.uid).doc(entryId), { timestamp, ticketSnapshot });
      tx.create(shiftLogs.doc(entryId), {
        ticketNumber: currentData.ticketNumber, studentName: currentData.studentName, usn: currentData.studentUsn,
        serviceType: currentData.service, outcome: status === "no_show" ? "Skipped" : status, lifecycleStatus: status, counterWindow: name, staffName, staffUid: uid,
        issuedAt: currentData.issuedAt, calledAt: currentData.calledAt, closedAt: timestamp,
        ...(currentData.verifiedAt ? { verifiedAt: currentData.verifiedAt } : {}),
        durationSeconds: elapsed, durationFormatted: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`, remarks,
      });
      audit(tx, actor, status === "Completed" ? "service_completed" : status === "no_show" ? "ticket_no_show" : "ticket_skipped", "ticket", current.id, { officeId, ticketId: current.id });
      const alert = notification(currentData.uid, `Ticket ${status.toLowerCase()}`, currentData.ticketNumber, current.id);
      tx.create(alert.ref, alert.data);
    }

    let assigned: ReturnType<typeof staffTicket> | null = null;
    if (next && nextEntry) {
      const ticket = next.data();
      if (ticket?.status !== "waiting" || ticket.officeId !== officeId) throw new ApiError(409, "Waiting queue changed");
      tx.delete(nextEntry.ref);
      const alert = notification(ticket.uid, "It is your turn", `Please proceed to ${name}.`, next.id);
      tx.update(next.ref, { status: "called", calledAt: timestamp, counter: name, calledTimestamp: FieldValue.serverTimestamp() });
      assigned = staffTicket(next.id, { ...ticket, status: "called", calledAt: timestamp });
      audit(tx, actor, "ticket_called", "ticket", next.id, { officeId, ticketId: next.id });
      tx.create(alert.ref, alert.data);
      servingByCounter[name] = { ticketNumber: ticket.ticketNumber, calledAt: timestamp };
    }
    const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
    serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));
    tx.update(office, {
      servingByCounter, nowServing: serving[0]?.ticketNumber ?? "",
      waitingCount: Math.max(0, config.waitingCount - (next ? 1 : 0)),
    });

    tx.update(desk, { ticketId: next?.id ?? null, assignedStaffUid: next ? uid : null });
    notify();
    return { ticketId: next?.id ?? null, ticket: assigned };
  });
}

export async function verifyTicket(actor: Actor, input: Record<string, unknown>, legacy: boolean) {
  staffScope(actor, input, legacy);
  const method = input.qrPayload == null ? "manual_usn_check" : "qr_scan";
  const qr = method === "qr_scan" ? text(input.qrPayload, "qrPayload") : null;
  const ticketNumber = qr ? null : text(input.ticketNumber, "ticketNumber", 40).toUpperCase();
  const suffix = qr ? null : text(input.usnSuffix, "usnSuffix", 4);
  if (suffix && !/^\d{4}$/.test(suffix)) throw new ApiError(400, "Enter four student number digits");

  return adminDb().runTransaction(async (tx) => {
    const profile = await requireCurrent(tx, actor);
    const { name, officeId, desk, office } = scope(profile, input.counter, input.officeId);
    const [deskSnap, officeSnap] = await tx.getAll(desk, office);
    const data = deskSnap.data();
    if (data?.archivedAt || !officeSnap.exists || officeSnap.data()?.archivedAt) throw new ApiError(404, "Counter is unavailable");
    if (!data?.ticketId) throw new ApiError(404, "No ticket is being served at this counter");
    const snap = await tx.get(ticketRef(data.ticketId));
    const ticket = snap.data();
    if (!ticket || !["called", "serving"].includes(ticket.status) || ticket.officeId !== officeId || ticket.counter !== name ||
        (qr ? typeof ticket.qrPayload !== "string" || !equalSecret(qr, ticket.qrPayload) :
          ticket.ticketNumber !== ticketNumber || !ticket.studentUsn.endsWith(suffix))) {
      throw new ApiError(404, "No matching ticket at this counter");
    }
    if (ticket.isQrVerified && !legacy) throw new ApiError(409, "Ticket already verified");
    if (!ticket.isQrVerified) {
      const verifiedAt = now();
      const startsService = legacy && ticket.status === "called";
      tx.update(snap.ref, { isQrVerified: true, verifiedAt, verificationMethod: method,
        ...(startsService ? { status: "serving", startedAt: verifiedAt, startedTimestamp: FieldValue.serverTimestamp() } : {}),
      });
      if (startsService) audit(tx, actor, "service_started", "ticket", snap.id, { officeId, ticketId: snap.id });
      audit(tx, actor, "ticket_verified", "ticket", snap.id, { officeId, ticketId: snap.id });
    }
    return { ...staffTicket(snap.id, ticket), isQrVerified: true, method };
  });
}

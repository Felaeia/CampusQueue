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

async function autoPromoteToDesk(
  actor: Actor,
  officeId: string,
  name: string,
  office: FirebaseFirestore.DocumentReference,
  desk: FirebaseFirestore.DocumentReference,
): Promise<ReturnType<typeof staffTicket> | null> {
  return adminDb().runTransaction(async (tx) => {
    const [deskSnap, officeSnap, nextSnap] = await Promise.all([
      tx.get(desk),
      tx.get(office),
      tx.get(waiting(officeId).orderBy("sequence").limit(1)),
    ]);
    const deskData = deskSnap.data();
    const config = officeSnap.data();
    const nextEntry = nextSnap.docs[0];
    if (!deskData || deskData.archivedAt || deskData.status !== "online" || deskData.ticketId || !config || config.archivedAt || !nextEntry) {
      return null;
    }
    const nextDoc = await tx.get(ticketRef(nextEntry.id));
    const ticket = nextDoc.data();
    if (!ticket || ticket.status !== "waiting" || ticket.officeId !== officeId) {
      if (!ticket || ticket.status !== "waiting") tx.delete(nextEntry.ref);
      return null;
    }
    const notify = await prepareNearTurn(tx, officeId, config, nextDoc.id);
    const timestamp = now();
    const serverNow = FieldValue.serverTimestamp();
    const servingByCounter = {
      ...(config.servingByCounter ?? {}),
      [name]: { ticketNumber: ticket.ticketNumber, calledAt: timestamp },
    };
    const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
    serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));

    tx.delete(nextEntry.ref);
    tx.update(nextDoc.ref, {
      status: "serving",
      calledAt: timestamp,
      startedAt: timestamp,
      counter: name,
      calledTimestamp: serverNow,
      startedTimestamp: serverNow,
    });
    const alert = notification(ticket.uid, "It is your turn", `Please proceed to ${name}.`, nextDoc.id);
    tx.create(alert.ref, alert.data);
    audit(tx, actor, "ticket_called", "ticket", nextDoc.id, { officeId, ticketId: nextDoc.id });
    audit(tx, actor, "service_started", "ticket", nextDoc.id, { officeId, ticketId: nextDoc.id });
    tx.update(office, {
      servingByCounter,
      nowServing: serving[0]?.ticketNumber ?? ticket.ticketNumber,
      waitingCount: Math.max(0, (config.waitingCount ?? 1) - 1),
    });
    tx.update(desk, { ticketId: nextDoc.id, assignedStaffUid: actor.uid, updatedAt: serverNow });
    notify();

    return staffTicket(nextDoc.id, {
      ...ticket,
      status: "serving",
      calledAt: timestamp,
      startedAt: timestamp,
      counter: name,
    });
  });
}

export async function staffState(actor: Actor, input: Record<string, unknown>, legacy: boolean) {
  const { name, officeId, office, desk: deskRef, shiftLogs } = staffScope(actor, input, legacy);
  const local = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const startOfShift = new Date(local + "T00:00:00+08:00").toISOString();
  let [desk, queue, logs, officeSnap] = await Promise.all([
    deskRef.get(), waiting(officeId).orderBy("sequence").limit(100).get(),
    input.includeLogs === "false" ? null : shiftLogs.where("closedAt", ">=", startOfShift).orderBy("closedAt", "desc").limit(250).get(), office.get(),
  ]);
  let data = desk.data();
  if (!data || data.archivedAt || !officeSnap.exists || officeSnap.data()?.archivedAt) throw new ApiError(404, "Counter is unavailable");

  // Auto-promote the earliest waiting ticket to SERVING if this online counter is idle
  let autoPromoted: ReturnType<typeof staffTicket> | null = null;
  if (data.status === "online" && !data.ticketId && !queue.empty) {
    autoPromoted = await autoPromoteToDesk(actor, officeId, name, office, deskRef);
    if (autoPromoted) {
      [desk, queue] = await Promise.all([
        deskRef.get(),
        waiting(officeId).orderBy("sequence").limit(100).get(),
      ]);
      data = desk.data()!;
    }
  }

  const serving = autoPromoted ? null : data.ticketId ? await ticketRef(data.ticketId).get() : null;
  const waitingTickets = queue.empty ? [] : await adminDb().getAll(...queue.docs.map((doc) => ticketRef(doc.id)));
  return {
    officeId, counter: name, deskStatus: data.status,
    servingTicket: autoPromoted ?? (serving?.exists ? staffTicket(serving.id, serving.data()!) : null),
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
  if (!["status", "call-next", "start", "complete", "skip", "no-show", "cancel", "recall", "requeue"].includes(String(action))) {
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
      let promoted: ReturnType<typeof staffTicket> | null = null;
      const serverNow = FieldValue.serverTimestamp();
      if (status === "online" && !data.ticketId) {
        const nextEntry = (await tx.get(waiting(officeId).orderBy("sequence").limit(1))).docs[0];
        const next = nextEntry ? await tx.get(ticketRef(nextEntry.id)) : undefined;
        const nextTicket = next?.data();
        if (next && nextEntry && nextTicket?.status === "waiting" && nextTicket.officeId === officeId) {
          const notify = await prepareNearTurn(tx, officeId, config, next.id);
          const timestamp = now();
          const servingByCounter = {
            ...(config.servingByCounter ?? {}),
            [name]: { ticketNumber: nextTicket.ticketNumber, calledAt: timestamp },
          };
          const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
          serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));
          tx.delete(nextEntry.ref);
          tx.update(next.ref, {
            status: "serving", calledAt: timestamp, startedAt: timestamp, counter: name,
            calledTimestamp: serverNow, startedTimestamp: serverNow,
          });
          const alert = notification(nextTicket.uid, "It is your turn", `Please proceed to ${name}.`, next.id);
          tx.create(alert.ref, alert.data);
          audit(tx, actor, "ticket_called", "ticket", next.id, { officeId, ticketId: next.id });
          audit(tx, actor, "service_started", "ticket", next.id, { officeId, ticketId: next.id });
          tx.update(office, {
            servingByCounter,
            nowServing: serving[0]?.ticketNumber ?? nextTicket.ticketNumber,
            waitingCount: Math.max(0, (config.waitingCount ?? 1) - 1),
          });
          tx.update(desk, { status, ticketId: next.id, assignedStaffUid: uid, updatedAt: serverNow });
          notify();
          promoted = staffTicket(next.id, { ...nextTicket, status: "serving", calledAt: timestamp, startedAt: timestamp, counter: name });
        } else {
          tx.update(desk, { status, updatedAt: serverNow });
        }
      } else {
        tx.update(desk, { status, updatedAt: serverNow });
      }
      audit(tx, actor, "counter_status_changed", "counter", name, { officeId, outcome: status });
      return { status, ...(promoted ? { ticketId: promoted.id, ticket: promoted } : {}) };
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
      if (currentData.status === "serving") {
        return { ticketId: current.id, status: "serving", startedAt: currentData.startedAt ?? now() };
      }
      if (currentData.status !== "called") throw new ApiError(409, "Only a called ticket can start service");
      const startedAt = now();
      tx.update(current.ref, { status: "serving", startedAt, startedTimestamp: FieldValue.serverTimestamp() });
      audit(tx, actor, "service_started", "ticket", current.id, { officeId, ticketId: current.id });
      return { ticketId: current.id, status: "serving", startedAt };
    }

    const noShow = action === "no-show" || action === "skip";
    const isCancel = action === "cancel";

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
    // Always auto-promote the next waiting ticket when counter is online (unless explicitly advance: false)
    const shouldAdvance = data.status === "online" &&
      (action === "call-next" || input.advance !== false);
    const nextEntry = shouldAdvance ? (await tx.get(waiting(officeId).orderBy("sequence").limit(1))).docs[0] : undefined;
    const next = nextEntry ? await tx.get(ticketRef(nextEntry.id)) : undefined;
    if (action === "call-next" && !next) return { ticketId: null, ticket: null };
    const notify = next ? await prepareNearTurn(tx, officeId, config, next.id) : () => {};
    const timestamp = now();
    const serverNow = FieldValue.serverTimestamp();
    const servingByCounter = { ...config.servingByCounter };
    delete servingByCounter[name];

    let closedStatus: string | undefined;
    if (current && currentData) {
      const status = action === "complete" ? "Completed" : isCancel ? "Cancelled" : noShow ? "no_show" : "Skipped";
      closedStatus = status;
      const rawRemarks = action === "complete" ? (input.remarks ?? input.reason) : (input.reason ?? input.remarks);
      const remarks = rawRemarks == null || rawRemarks === "" ? "" : text(rawRemarks, "remarks", 500);
      const elapsed = Math.max(0, Math.floor((Date.parse(timestamp) - Date.parse(currentData.startedAt ?? currentData.calledAt ?? currentData.issuedAt)) / 1000)) || 0;
      tx.update(current.ref, {
        status,
        timestamp,
        reason: remarks,
        closedTimestamp: serverNow,
        ...(status === "no_show" ? { noShowCount: FieldValue.increment(1) } : {}),
      });
      tx.update(userRef(currentData.uid), `activeTickets.${officeId}`, null);
      const entryId = status === "no_show" ? current.id + "-no-show-" + (currentData.requeueCount ?? 0) : current.id;
      const ticketSnapshot = {
        ticketNumber: currentData.ticketNumber, officeId, officeName: currentData.officeName,
        service: currentData.service, status, counter: name, issuedAt: currentData.issuedAt,
        calledAt: currentData.calledAt ?? timestamp, timestamp, reason: remarks,
      };
      tx.create(history(currentData.uid).doc(entryId), { timestamp, ticketSnapshot });
      tx.create(shiftLogs.doc(entryId), {
        ticketNumber: currentData.ticketNumber, studentName: currentData.studentName, usn: currentData.studentUsn,
        serviceType: currentData.service, outcome: status === "no_show" ? "Skipped" : status, lifecycleStatus: status, counterWindow: name, staffName, staffUid: uid,
        issuedAt: currentData.issuedAt, calledAt: currentData.calledAt ?? timestamp, closedAt: timestamp,
        ...(currentData.verifiedAt ? { verifiedAt: currentData.verifiedAt } : {}),
        durationSeconds: elapsed, durationFormatted: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`, remarks,
      });
      const auditAction =
        status === "Completed"
          ? "service_completed"
          : status === "Cancelled"
            ? "ticket_cancelled"
            : status === "no_show"
              ? "ticket_no_show"
              : "ticket_skipped";
      audit(tx, actor, auditAction, "ticket", current.id, { officeId, ticketId: current.id, outcome: status });
      const alertTitle =
        status === "Completed"
          ? "Ticket completed"
          : status === "Cancelled"
            ? "Ticket cancelled"
            : "Ticket marked no-show";
      const alert = notification(currentData.uid, alertTitle, `${currentData.ticketNumber} (${currentData.officeName})`, current.id);
      tx.create(alert.ref, alert.data);
    }

    let assigned: ReturnType<typeof staffTicket> | null = null;
    if (next && nextEntry) {
      const ticket = next.data();
      if (ticket?.status !== "waiting" || ticket.officeId !== officeId) throw new ApiError(409, "Waiting queue changed");
      tx.delete(nextEntry.ref);
      const alert = notification(ticket.uid, "It is your turn", `Please proceed to ${name}.`, next.id);
      tx.update(next.ref, {
        status: "serving",
        calledAt: timestamp,
        startedAt: timestamp,
        counter: name,
        calledTimestamp: serverNow,
        startedTimestamp: serverNow,
      });
      assigned = staffTicket(next.id, { ...ticket, status: "serving", calledAt: timestamp, startedAt: timestamp, counter: name });
      audit(tx, actor, "ticket_called", "ticket", next.id, { officeId, ticketId: next.id });
      audit(tx, actor, "service_started", "ticket", next.id, { officeId, ticketId: next.id });
      tx.create(alert.ref, alert.data);
      servingByCounter[name] = { ticketNumber: ticket.ticketNumber, calledAt: timestamp };
    }
    const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
    serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));
    tx.update(office, {
      servingByCounter, nowServing: serving[0]?.ticketNumber ?? "",
      waitingCount: Math.max(0, (config.waitingCount ?? 0) - (next ? 1 : 0)),
    });

    tx.update(desk, { ticketId: next?.id ?? null, assignedStaffUid: next ? uid : null, updatedAt: serverNow });
    notify();
    return { ticketId: next?.id ?? null, ticket: assigned, ...(closedStatus ? { closedStatus } : {}) };
  });
}

export async function verifyTicket(actor: Actor, input: Record<string, unknown>, legacy: boolean) {
  staffScope(actor, input, legacy);
  const method = input.qrPayload == null ? "manual_usn_check" : "qr_scan";
  const qr = method === "qr_scan" ? text(input.qrPayload, "qrPayload", 256) : null;
  const ticketNumber = qr ? null : text(input.ticketNumber, "ticketNumber", 40).toUpperCase();
  const suffix = qr ? null : text(input.usnSuffix, "usnSuffix", 4);
  if (suffix && !/^\d{4}$/.test(suffix)) throw new ApiError(400, "Enter four student number digits");

  let parsedQrTicketId: string | null = null;
  if (qr) {
    const match = /^cq:v1:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/.exec(qr);
    if (!match) {
      throw new ApiError(400, "Invalid CampusQueue QR code format.");
    }
    parsedQrTicketId = match[1];
  }

  return adminDb().runTransaction(async (tx) => {
    const profile = await requireCurrent(tx, actor);
    const { name, officeId, desk, office } = scope(profile, input.counter, input.officeId);
    const [deskSnap, officeSnap] = await tx.getAll(desk, office);
    const data = deskSnap.data();
    const config = officeSnap.data();
    if (!data || data.archivedAt || !config || config.archivedAt) throw new ApiError(404, "Counter is unavailable");

    // Resolve the target ticket directly when QR payload carries ticketId (enables clear wrong-office / completed / waiting errors)
    let targetSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (parsedQrTicketId) {
      targetSnap = await tx.get(ticketRef(parsedQrTicketId));
      if (!targetSnap.exists) {
        throw new ApiError(404, "QR code is invalid or expired.");
      }
      const scanned = targetSnap.data()!;
      if (typeof scanned.qrPayload !== "string" || !equalSecret(qr!, scanned.qrPayload)) {
        throw new ApiError(404, "QR code is invalid or expired.");
      }
      if (scanned.officeId !== officeId) {
        throw new ApiError(
          403,
          `Wrong office: ticket ${scanned.ticketNumber} belongs to ${scanned.officeName ?? scanned.officeId}.`,
        );
      }
      if (!["waiting", "called", "serving"].includes(scanned.status)) {
        const label = scanned.status === "no_show" ? "marked as no-show" : String(scanned.status).toLowerCase();
        throw new ApiError(409, `Ticket ${scanned.ticketNumber} is already ${label}.`);
      }
      // If ticket is still waiting for this office and this online counter is free, promote it to SERVING right away
      if (scanned.status === "waiting") {
        if (data.ticketId && data.ticketId !== targetSnap.id) {
          const activeDoc = await tx.get(ticketRef(data.ticketId));
          const activeNum = activeDoc.data()?.ticketNumber ?? "another ticket";
          throw new ApiError(409, `Ticket ${scanned.ticketNumber} is still waiting. Finish ${activeNum} first.`);
        }
        if (data.status !== "online") {
          throw new ApiError(409, "Set your counter to Online before scanning waiting tickets.");
        }
        const timestamp = now();
        const serverNow = FieldValue.serverTimestamp();
        const servingByCounter = {
          ...(config.servingByCounter ?? {}),
          [name]: { ticketNumber: scanned.ticketNumber, calledAt: timestamp },
        };
        const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
        serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));
        tx.delete(waiting(officeId).doc(targetSnap.id));
        tx.update(targetSnap.ref, {
          status: "serving",
          counter: name,
          calledAt: timestamp,
          startedAt: timestamp,
          calledTimestamp: serverNow,
          startedTimestamp: serverNow,
          isQrVerified: true,
          verifiedAt: timestamp,
          verificationMethod: method,
        });
        tx.update(office, {
          servingByCounter,
          nowServing: serving[0]?.ticketNumber ?? scanned.ticketNumber,
          waitingCount: Math.max(0, (config.waitingCount ?? 1) - 1),
        });
        tx.update(desk, { ticketId: targetSnap.id, assignedStaffUid: actor.uid, updatedAt: serverNow });
        audit(tx, actor, "ticket_called", "ticket", targetSnap.id, { officeId, ticketId: targetSnap.id });
        audit(tx, actor, "service_started", "ticket", targetSnap.id, { officeId, ticketId: targetSnap.id });
        audit(tx, actor, "ticket_verified", "ticket", targetSnap.id, { officeId, ticketId: targetSnap.id });
        return {
          ...staffTicket(targetSnap.id, { ...scanned, status: "serving", calledAt: timestamp, startedAt: timestamp, counter: name }),
          isQrVerified: true,
          method,
        };
      }
      if (scanned.counter && scanned.counter !== name) {
        throw new ApiError(409, `Ticket ${scanned.ticketNumber} is assigned to ${scanned.counter}.`);
      }
      if (data.ticketId && data.ticketId !== targetSnap.id) {
        throw new ApiError(409, `Counter ${name} is currently serving a different ticket.`);
      }
    } else {
      // Manual lookup: check current counter ticket, or promote matching waiting ticket if counter is idle
      if (!data.ticketId) {
        throw new ApiError(404, "No ticket is currently being served at this counter.");
      }
      targetSnap = await tx.get(ticketRef(data.ticketId));
      const ticket = targetSnap.data();
      if (!ticket || !["called", "serving"].includes(ticket.status) || ticket.officeId !== officeId || ticket.counter !== name ||
          ticket.ticketNumber !== ticketNumber || !ticket.studentUsn.endsWith(suffix!)) {
        throw new ApiError(404, "Ticket number or USN last 4 digits do not match the currently serving pass.");
      }
    }

    const ticket = targetSnap.data()!;
    const verifiedAt = ticket.verifiedAt ?? now();
    const serverNow = FieldValue.serverTimestamp();
    const needsStart = ticket.status === "called";
    if (!ticket.isQrVerified || needsStart) {
      tx.update(targetSnap.ref, {
        isQrVerified: true,
        verifiedAt,
        verificationMethod: ticket.verificationMethod ?? method,
        ...(needsStart ? { status: "serving", startedAt: verifiedAt, startedTimestamp: serverNow } : {}),
      });
      if (needsStart) audit(tx, actor, "service_started", "ticket", targetSnap.id, { officeId, ticketId: targetSnap.id });
      if (!ticket.isQrVerified) audit(tx, actor, "ticket_verified", "ticket", targetSnap.id, { officeId, ticketId: targetSnap.id });
    }
    return {
      ...staffTicket(targetSnap.id, { ...ticket, status: "serving", startedAt: ticket.startedAt ?? verifiedAt }),
      isQrVerified: true,
      method,
    };
  });
}

import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, key, text } from "./http.ts";
import { desks, equalSecret, history, notification, now, officeRef, ticketRef, userRef, waiting } from "./queue.ts";

const office = () => officeRef("registrar");
const counter = (name: string) => office().collection("counters").doc(name);
const shiftLogs = () => office().collection("logs");

function deskName(value: unknown) {
  const name = text(value, "counter");
  if (!desks.includes(name)) throw new ApiError(400, "Unknown counter");
  return name;
}

export function staffTicket(id: string, ticket: FirebaseFirestore.DocumentData) {
  return {
    id, ticketNumber: ticket.ticketNumber, studentName: ticket.studentName,
    usn: ticket.studentUsn, program: ticket.program, serviceType: ticket.service,
    waitMinutes: Math.max(0, Math.floor((Date.now() - Date.parse(ticket.issuedAt)) / 60000)),
    issuedAt: ticket.issuedAt, calledAt: ticket.calledAt ?? null, notes: ticket.notes,
    isQrVerified: ticket.isQrVerified, recallCount: ticket.recallCount,
  };
}

export async function staffState(uid: string, value: unknown) {
  const name = deskName(value);
  const local = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const startOfShift = new Date(local + "T00:00:00+08:00").toISOString();
  const [desk, queue, logs] = await Promise.all([
    counter(name).get(), waiting("registrar").orderBy("sequence").limit(100).get(),
    shiftLogs().where("closedAt", ">=", startOfShift).orderBy("closedAt", "desc").limit(250).get(),
  ]);
  const data = desk.data();
  if (!data) throw new ApiError(404, "Counter is unavailable");
  const serving = data.ticketId ? await ticketRef(data.ticketId).get() : null;
  const waitingTickets = queue.empty ? [] : await adminDb().getAll(...queue.docs.map((doc) => ticketRef(doc.id)));
  return {
    counter: name, deskStatus: data.status,
    servingTicket: serving?.exists ? staffTicket(serving.id, serving.data()!) : null,
    waitingQueue: waitingTickets.filter((doc) => doc.data()?.status === "waiting").map((doc) => staffTicket(doc.id, doc.data()!)),
    transactions: logs.docs.map((doc) => {
      const { staffUid, ...transaction } = doc.data();
      return { ...transaction, id: doc.id, isMine: staffUid === uid };
    }),
  };
}

export async function changeDesk(uid: string, staffName: string, input: Record<string, unknown>) {
  const name = deskName(input.counter);
  const desk = counter(name);
  const action = input.action;
  if (!["status", "call-next", "complete", "skip", "recall"].includes(String(action))) {
    throw new ApiError(400, "Unknown staff action");
  }
  return adminDb().runTransaction(async (tx) => {
    const data = (await tx.get(desk)).data();
    if (!data) throw new ApiError(404, "Counter is unavailable");
    if (action === "status") {
      const status = text(input.status, "status");
      if (!["online", "break", "closed"].includes(status)) throw new ApiError(400, "Invalid desk status");
      if (status === "closed" && data.ticketId) throw new ApiError(409, "Finish the current ticket first");
      tx.update(desk, { status });
      return { status };
    }

    const current = data.ticketId ? await tx.get(ticketRef(data.ticketId)) : null;
    const currentData = current?.data();
    if (action === "call-next") {
      if (data.ticketId) throw new ApiError(409, "Finish the current ticket first");
    } else if (!current || !currentData || currentData.status !== "serving" ||
               current.id !== key(input.ticketId, "ticketId")) {
      throw new ApiError(409, "The serving ticket changed");
    }

    if (action === "recall" && current && currentData) {
      const recallCount = currentData.recallCount ?? 0;
      if (recallCount >= 3) throw new ApiError(409, "Recall limit reached");
      if (input.recallCount !== recallCount) throw new ApiError(409, "Recall count changed");
      const alert = notification(currentData.uid, "Ticket recalled", `Please proceed to ${name}.`, current.id);
      tx.update(current.ref, { recallCount: recallCount + 1 });
      tx.create(alert.ref, alert.data);
      return { recallCount: recallCount + 1 };
    }

    if (action === "call-next" && data.status !== "online") {
      throw new ApiError(409, "Counter must be online");
    }
    const shouldAdvance = data.status === "online" &&
      (action === "call-next" || action === "skip" || input.advance === true);
    const nextEntry = shouldAdvance ? (await tx.get(waiting("registrar").orderBy("sequence").limit(1))).docs[0] : undefined;
    const next = nextEntry ? await tx.get(ticketRef(nextEntry.id)) : undefined;
    const config = (await tx.get(office())).data()!;
    const timestamp = now();
    const servingByCounter = { ...config.servingByCounter };
    delete servingByCounter[name];

    if (current && currentData) {
      const status = action === "complete" ? "Completed" : "Skipped";
      const rawRemarks = action === "skip" ? input.reason : input.remarks;
      const remarks = rawRemarks == null || rawRemarks === "" ? "" : text(rawRemarks, "remarks", 500);
      const elapsed = Math.max(0, Math.floor((Date.parse(timestamp) - Date.parse(currentData.calledAt)) / 1000));
      tx.update(current.ref, { status, timestamp, reason: remarks });
      tx.update(userRef(currentData.uid), "activeTickets.registrar", null);
      tx.create(history(currentData.uid).doc(current.id), { timestamp });
      tx.create(shiftLogs().doc(current.id), {
        ticketNumber: currentData.ticketNumber, studentName: currentData.studentName, usn: currentData.studentUsn,
        serviceType: currentData.service, outcome: status, counterWindow: name, staffName, staffUid: uid,
        issuedAt: currentData.issuedAt, calledAt: currentData.calledAt, closedAt: timestamp,
        ...(currentData.verifiedAt ? { verifiedAt: currentData.verifiedAt } : {}),
        durationSeconds: elapsed, durationFormatted: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`, remarks,
      });
      const alert = notification(currentData.uid, `Ticket ${status.toLowerCase()}`, currentData.ticketNumber, current.id);
      tx.create(alert.ref, alert.data);
    }

    if (next && nextEntry) {
      const ticket = next.data();
      if (ticket?.status !== "waiting") throw new ApiError(409, "Waiting queue changed");
      tx.delete(nextEntry.ref);
      const alert = notification(ticket.uid, "It is your turn", `Please proceed to ${name}.`, next.id);
      tx.update(next.ref, { status: "serving", calledAt: timestamp, counter: name });
      tx.create(alert.ref, alert.data);
      servingByCounter[name] = { ticketNumber: ticket.ticketNumber, calledAt: timestamp };
    }
    const serving = Object.values(servingByCounter) as { ticketNumber: string; calledAt: string }[];
    serving.sort((a, b) => b.calledAt.localeCompare(a.calledAt));
    tx.update(office(), {
      servingByCounter, nowServing: serving[0]?.ticketNumber ?? "",
      waitingCount: Math.max(0, config.waitingCount - (next ? 1 : 0)),
    });

    tx.update(desk, { ticketId: next?.id ?? null });
    return { ticketId: next?.id ?? null };
  });
}

export async function verifyTicket(input: Record<string, unknown>) {
  const name = deskName(input.counter);
  const method = input.qrPayload == null ? "manual_usn_check" : "qr_scan";
  const qr = method === "qr_scan" ? text(input.qrPayload, "qrPayload") : null;
  const ticketNumber = qr ? null : text(input.ticketNumber, "ticketNumber", 40).toUpperCase();
  const suffix = qr ? null : text(input.usnSuffix, "usnSuffix", 4);
  if (suffix && !/^\d{4}$/.test(suffix)) throw new ApiError(400, "Enter four student number digits");

  return adminDb().runTransaction(async (tx) => {
    const data = (await tx.get(counter(name))).data();
    if (!data?.ticketId) throw new ApiError(404, "No ticket is being served at this counter");
    const snap = await tx.get(ticketRef(data.ticketId));
    const ticket = snap.data();
    if (!ticket || ticket.status !== "serving" || ticket.officeId !== "registrar" ||
        (qr ? !equalSecret(qr, ticket.qrPayload) :
          ticket.ticketNumber !== ticketNumber || !ticket.studentUsn.endsWith(suffix))) {
      throw new ApiError(404, "No matching ticket at this counter");
    }
    if (!ticket.isQrVerified) tx.update(snap.ref, { isQrVerified: true, verifiedAt: now(), verificationMethod: method });
    return { ...staffTicket(snap.id, ticket), isQrVerified: true, method };
  });
}

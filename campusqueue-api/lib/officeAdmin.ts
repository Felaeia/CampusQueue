import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { audit } from "./audit.ts";
import { ApiError, key, requireCurrent, text, type Actor } from "./http.ts";
import { officeRef, officeKey } from "./queue.ts";
import { adminDb } from "./firebaseAdmin.ts";

export function counterKey(value: unknown): string {
  const id = text(value, "counterId", 80);
  if (!/^[a-zA-Z0-9_ -]+$/.test(id) || id.startsWith("__")) throw new ApiError(400, "Invalid counterId");
  return id;
}

export function flag(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ApiError(400, `Invalid ${field}`);
  return value;
}

export function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value;
}

function optionalText(value: unknown, field: string, max: number): string {
  return value === "" ? "" : text(value, field, max);
}

export async function browse(query: FirebaseFirestore.Query, params: URLSearchParams, include: (doc: FirebaseFirestore.DocumentData) => boolean) {
  const limit = integer(Number(params.get("limit") ?? 25), "limit", 1, 100);
  const cursor = params.get("cursor");
  const ordered = query.orderBy(FieldPath.documentId());
  const results = await (cursor ? ordered.startAfter(text(cursor, "cursor", 128)) : ordered).limit(limit + 1).get();
  const page = results.docs.slice(0, limit);
  return {
    items: page.filter((doc) => include(doc.data())).map((doc) => ({ ...doc.data(), id: doc.id })),
    nextCursor: results.size > limit ? page.at(-1)?.id ?? null : null,
  };
}

function officeFields(input: Record<string, unknown>, create: boolean) {
  const out: Record<string, unknown> = {};
  for (const field of ["name", "shortLabel", "description", "windowLabel", "officerName"]) {
    if (field in input) out[field] = optionalText(input[field], field, field === "description" ? 1000 : 120);
  }
  if (create && !out.name) throw new ApiError(400, "Office name is required");
  if (create) out.prefix = key(input.prefix, "prefix").toUpperCase();
  if (!create && "prefix" in input) throw new ApiError(400, "Office code is fixed after creation");
  if ("acceptingTickets" in input) out.acceptingTickets = flag(input.acceptingTickets, "acceptingTickets");
  for (const [field, min, max] of [
    ["nearTurnThreshold", 0, 20], ["graceMinutes", 1, 1440], ["requeueLimit", 0, 20],
  ] as const) {
    if (field in input) out[field] = input[field] === null ? null : integer(input[field], field, min, max);
  }
  if ("requeuePlacement" in input) {
    if (input.requeuePlacement !== null && !["tail", "original"].includes(String(input.requeuePlacement))) {
      throw new ApiError(400, "Invalid requeuePlacement");
    }
    out.requeuePlacement = input.requeuePlacement;
  }
  return out;
}

function serviceFields(input: Record<string, unknown>, create: boolean) {
  const fields: Record<string, unknown> = {};
  if (create || "name" in input) fields.name = text(input.name, "name", 160);
  if (create || "duration" in input) fields.duration = integer(input.duration, "duration", 1, 480);
  for (const field of ["description", "docs"]) {
    if (field in input) fields[field] = optionalText(input[field], field, 1000);
  }
  if ("available" in input) fields.available = flag(input.available, "available");
  return fields;
}

function activeOffice(config: FirebaseFirestore.DocumentData | undefined) {
  if (!config) throw new ApiError(404, "Office not found");
  if (config.archivedAt) throw new ApiError(409, "Restore the office first");
  return config;
}

const resourceActions = ["create", "update", "archive", "restore"];

export async function officesAdmin(admin: Actor, params: URLSearchParams, input?: Record<string, unknown>) {
  const db = adminDb();
  if (!input) {
    const id = params.get("id");
    if (id) {
      const doc = await officeRef(officeKey(id)).get();
      if (!doc.exists) throw new ApiError(404, "Office not found");
      return { office: { ...doc.data(), id: doc.id } };
    }
    return browse(db.collection("offices"), params, (office) => params.get("archived") === "true" || !office.archivedAt);
  }
  const id = officeKey(input.id);
  const ref = officeRef(id);
  const action = input.action;
  if (typeof action !== "string" || !resourceActions.includes(action)) throw new ApiError(400, "Invalid office action");
  const fields = officeFields(input, action === "create");
  return db.runTransaction(async (tx) => {
    await requireCurrent(tx, admin);
    const doc = await tx.get(ref);
    const current = doc.data();
    const updatedAt = FieldValue.serverTimestamp();
    if (action === "create") {
      const prefix = String(fields.prefix);
      const samePrefix = await tx.get(db.collection("offices").where("prefix", "==", prefix).limit(1));
      const prefixRef = db.collection("officeCodes").doc(prefix);
      const reservation = await tx.get(prefixRef);
      if (doc.exists || !samePrefix.empty || reservation.exists) throw new ApiError(409, "Office ID or code already exists");
      tx.create(prefixRef, { officeId: id });
      tx.create(ref, {
        shortLabel: fields.name, windowLabel: "", officerName: "", description: "",
        themeColor: "#196447", crowdPillBg: "#ECF5EF", crowdPillText: "#196447",
        acceptingTickets: true, services: [], waitingCount: 0, lastIssuedNumber: 0, nowServing: "",
        ...fields, archivedAt: null, createdAt: updatedAt, updatedAt,
      });
    } else {
      if (!current) throw new ApiError(404, "Office not found");
      if (action === "archive" && !current.archivedAt) {
        const serving = await tx.get(ref.collection("counters").where("ticketId", "!=", null).limit(1));
        if (current.waitingCount || !serving.empty) throw new ApiError(409, "Resolve active tickets before archiving this office");
      }
      if (action === "update" && !Object.keys(fields).length) throw new ApiError(400, "No office changes supplied");
      tx.update(ref, {
        ...(action === "update" ? fields : {}),
        ...(action === "archive" ? { archivedAt: current.archivedAt ?? updatedAt, acceptingTickets: false } : {}),
        ...(action === "restore" ? { archivedAt: null } : {}),
        updatedAt,
      });
    }
    audit(tx, admin, `office_${action}`, "office", id, { officeId: id, fields: Object.keys(fields) });
    return { id };
  });
}

export async function countersAdmin(admin: Actor, params: URLSearchParams, input?: Record<string, unknown>) {
  const officeId = officeKey(input?.officeId ?? params.get("officeId"));
  const office = officeRef(officeId);
  const counters = office.collection("counters");
  if (!input) {
    if (!(await office.get()).exists) throw new ApiError(404, "Office not found");
    const id = params.get("id");
    if (id) {
      const doc = await counters.doc(counterKey(id)).get();
      if (!doc.exists) throw new ApiError(404, "Counter not found");
      return { counter: { ...doc.data(), id: doc.id, officeId } };
    }
    return browse(counters, params, (counter) => params.get("archived") === "true" || !counter.archivedAt);
  }
  const id = counterKey(input.id);
  const ref = counters.doc(id);
  const action = input.action;
  if (typeof action !== "string" || !resourceActions.includes(action)) throw new ApiError(400, "Invalid counter action");
  const status = input.status == null ? undefined : text(input.status, "status");
  if (status && !["online", "break", "closed"].includes(status)) throw new ApiError(400, "Invalid counter status");
  const name = input.name == null ? undefined : text(input.name, "name", 100);
  return adminDb().runTransaction(async (tx) => {
    await requireCurrent(tx, admin);
    const [officeDoc, counterDoc] = await tx.getAll(office, ref);
    activeOffice(officeDoc.data());
    const current = counterDoc.data();
    const updatedAt = FieldValue.serverTimestamp();
    if (action === "create") {
      if (current) throw new ApiError(409, "Counter already exists");
      tx.create(ref, { officeId, name: name ?? id, status: status ?? "closed", ticketId: null, archivedAt: null, createdAt: updatedAt, updatedAt });
    } else {
      if (!current) throw new ApiError(404, "Counter not found");
      if (current.ticketId && (action === "archive" || status === "closed")) {
        throw new ApiError(409, "Resolve the serving ticket before closing the counter");
      }
      if (action === "update" && !name && !status) throw new ApiError(400, "No counter changes supplied");
      if (action === "update" && current.archivedAt) throw new ApiError(409, "Restore the counter first");
      tx.update(ref, {
        ...(action === "update" && name ? { name } : {}),
        ...(action === "update" && status ? { status } : {}),
        ...(action === "archive" ? { archivedAt: current.archivedAt ?? updatedAt, status: "closed" } : {}),
        ...(action === "restore" ? { archivedAt: null } : {}),
        updatedAt,
      });
    }
    audit(tx, admin, `counter_${action}`, "counter", id, { officeId });
    return { id, officeId };
  });
}

export async function servicesAdmin(admin: Actor, params: URLSearchParams, input?: Record<string, unknown>) {
  const officeId = officeKey(input?.officeId ?? params.get("officeId"));
  const office = officeRef(officeId);
  if (!input) {
    const config = (await office.get()).data();
    if (!config) throw new ApiError(404, "Office not found");
    const all: FirebaseFirestore.DocumentData[] = config.services ?? [];
    const id = params.get("id");
    const item = id ? all.find((service) => service.id === id) : undefined;
    if (id && !item) throw new ApiError(404, "Request type not found");
    return id ? { requestType: item } : { items: all.filter((service) => params.get("archived") === "true" || !service.archivedAt) };
  }
  const id = key(input.id, "request type ID");
  const action = input.action;
  if (typeof action !== "string" || !resourceActions.includes(action)) throw new ApiError(400, "Invalid request type action");
  const fields = serviceFields(input, action === "create");
  return adminDb().runTransaction(async (tx) => {
    await requireCurrent(tx, admin);
    const config = activeOffice((await tx.get(office)).data());
    const all: FirebaseFirestore.DocumentData[] = config.services ?? [];
    const current = all.find((service) => service.id === id);
    if (action === "create" && (current || all.length >= 50)) throw new ApiError(409, "Request type already exists or office catalogue is at capacity");
    if (action !== "create" && !current) throw new ApiError(404, "Request type not found");
    if (action === "update" && !Object.keys(fields).length) throw new ApiError(400, "No request type changes supplied");
    if (fields.name && all.some((service) => service.id !== id && !service.archivedAt &&
        service.name.toLowerCase() === String(fields.name).toLowerCase())) throw new ApiError(409, "Request type name already exists");
    if (action === "restore" && all.some((service) => service.id !== id && !service.archivedAt &&
        service.name.toLowerCase() === current?.name.toLowerCase())) throw new ApiError(409, "Request type name already exists");
    if (action === "archive") {
      const tickets = adminDb().collection("tickets").where("officeId", "==", officeId)
        .where("status", "in", ["waiting", "called", "serving"]);
      const [stable, legacy] = await Promise.all([
        tx.get(tickets.where("serviceId", "==", id).limit(1)),
        tx.get(tickets.where("service", "==", current!.name).limit(1)),
      ]);
      if (!stable.empty || !legacy.empty) throw new ApiError(409, "Resolve active tickets for this request type first");
    }
    const timestamp = new Date().toISOString();
    const data = {
      ...(current ?? { id, officeId, available: true, description: "", docs: "", archivedAt: null, createdAt: timestamp }),
      ...fields,
      ...(action === "archive" ? { archivedAt: current?.archivedAt ?? timestamp, available: false } : {}),
      ...(action === "restore" ? { archivedAt: null } : {}),
      updatedAt: timestamp,
    };
    const services = current ? all.map((item) => item.id === id ? data : item) : [...all, data];
    tx.update(office, { services, updatedAt: FieldValue.serverTimestamp() });
    audit(tx, admin, `request_type_${action}`, "request_type", id, { officeId, fields: Object.keys(fields) });
    return { officeId, id };
  });
}

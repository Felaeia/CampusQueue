import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { audit } from "./audit.ts";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, key, requireCurrent, roleOf, text, type Actor } from "./http.ts";
import { browse, counterKey } from "./officeAdmin.ts";
import { hashPassword, validPassword } from "./passwords.ts";
import { desks, officeRef, userRef } from "./queue.ts";

type AccountRole = "student" | "staff" | "registrar_staff" | "admin";
type ManagedRole = "student" | "staff";
const contactFields = ["firstName", "middleName", "lastName", "email", "program", "yearLevel",
  "holderShort", "institution", "campusShort", "studentId", "jobTitle"] as const;

export function loginKey(value: unknown) {
  const id = text(value, "loginId", 40);
  if (!/^[a-zA-Z0-9_-]{2,40}$/.test(id) || id.startsWith("__")) throw new ApiError(400, "Invalid loginId");
  return id;
}

function profileChanges(input: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  for (const field of contactFields) {
    if (field in input) {
      fields[field] = input[field] === "" ? "" : text(input[field], field, 160);
      if (field === "email" && fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
        throw new ApiError(400, "Invalid email");
      }
    }
  }
  if ("fullName" in input) {
    fields.fullName = text(input.fullName, "fullName");
    fields.firstName ??= fields.fullName.split(/\s+/)[0];
    fields.firstLetter = fields.firstName[0];
  }
  return fields;
}

async function assignment(tx: FirebaseFirestore.Transaction, input: Record<string, unknown>, role: AccountRole) {
  if (role !== "staff" && role !== "registrar_staff") return {};
  const officeId = key(input.officeId ?? (role === "registrar_staff" ? "registrar" : undefined), "officeId");
  const office = officeRef(officeId);
  const config = (await tx.get(office)).data();
  if (!config || config.archivedAt) throw new ApiError(404, "Assigned office is unavailable");
  const counters = office.collection("counters");
  const fallback = input.defaultCounterWindow ?? (role === "registrar_staff" ? "Window 2" : undefined);
  if (input.counterIds != null && (!Array.isArray(input.counterIds) || input.counterIds.length > 20)) {
    throw new ApiError(400, "Invalid counterIds");
  }
  const requested = input.counterIds ?? (role === "registrar_staff" ? desks : fallback == null ? [] : [fallback]);
  const counterIds = [...new Set((requested as unknown[]).map(counterKey))];
  const defaultCounterWindow = fallback == null ? counterIds[0] ?? null : counterKey(fallback);
  if (defaultCounterWindow && !counterIds.includes(defaultCounterWindow)) throw new ApiError(400, "Default counter is outside the assignment");
  if (counterIds.length) {
    const docs = await tx.getAll(...counterIds.map((id) => counters.doc(id)));
    if (docs.some((doc) => !doc.exists || doc.data()?.archivedAt)) throw new ApiError(404, "An assigned counter is unavailable");
  }
  return { officeId, counterIds, defaultCounterWindow, office: config.name, officeShort: config.shortLabel ?? config.name };
}

export async function provision(
  input: Record<string, unknown>,
  options: { reset: boolean; demo: boolean; createOnly?: boolean; changeRole?: boolean; admin?: Actor } = { reset: false, demo: false },
) {
  const loginId = loginKey(input.loginId);
  const role = input.role as AccountRole;
  if (!["student", "staff", "registrar_staff", "admin"].includes(role)) throw new ApiError(400, "Invalid role");
  if (!validPassword(input.password)) throw new ApiError(400, "Password must contain 8 to 128 characters");
  if (role === "admin" && options.demo) throw new ApiError(400, "Administrator demo accounts are unsupported");
  if (options.changeRole && (!options.reset || options.admin)) throw new ApiError(400, "Role changes require the trusted provisioning command and a fresh password");
  const fields = profileChanges(input);
  if (!options.reset && !fields.fullName) throw new ApiError(400, "Full name is required");
  if (input.uid != null && (options.admin || typeof input.uid !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.uid))) {
    throw new ApiError(400, "Invalid Firebase UID");
  }

  const passwordHash = await hashPassword(input.password);
  const db = adminDb();
  const alias = db.collection("loginIds").doc(loginId.toLowerCase());
  const proposedUid = typeof input.uid === "string" ? input.uid : randomUUID();
  const operator = options.admin ?? { uid: "provisioning", role: "system" };

  return db.runTransaction(async (tx) => {
    if (options.admin) await requireCurrent(tx, options.admin);
    const existing = (await tx.get(alias)).data();
    if (existing && (options.createOnly || (input.uid && existing.uid !== input.uid))) throw new ApiError(409, "Login ID is already assigned");
    const uid: string = existing?.uid ?? proposedUid;
    const account = userRef(uid);
    const credential = db.collection("credentials").doc(uid);
    const [accountDoc, credentialDoc] = await tx.getAll(account, credential);
    const saved = accountDoc.data();
    const roleChanged = saved && roleOf(saved) !== roleOf({ role });
    if (saved && ((roleChanged && !options.changeRole) || Boolean(saved.demoAccount) !== options.demo)) {
      throw new ApiError(409, "Existing account role or demo status differs");
    }
    const id = saved?.loginId ?? saved?.staffId ?? saved?.usn;
    if (typeof id === "string" && id.toLowerCase() !== loginId.toLowerCase()) {
      throw new ApiError(409, "Existing account has a different login ID");
    }
    if (!saved && options.reset) throw new ApiError(404, "Cannot reset a password for an unknown account");
    if (saved && credentialDoc.exists && !options.reset) return { uid, changed: false };
    if (roleChanged && await hasAssignments(tx, uid, saved!)) throw new ApiError(409, "Resolve active tickets or counter assignments first");
    const staffFields = saved && !roleChanged ? {} : await assignment(tx, input, role);
    const version = Math.max(saved?.credentialVersion ?? 0, credentialDoc.data()?.version ?? 0) + 1;
    const when = FieldValue.serverTimestamp();
    if (!existing) tx.create(alias, { uid });
    if (saved) tx.update(account, {
      credentialVersion: version, updatedAt: when,
      ...(roleChanged ? {
        role, loginId,
        ...staffFields,
        ...(role === "student" ? { usn: loginId, studentId: saved.studentId ?? loginId } : {}),
        ...(roleOf({ role }) === "staff" ? { staffId: loginId, staffName: saved.fullName } : {
          officeId: FieldValue.delete(), counterIds: FieldValue.delete(), defaultCounterWindow: FieldValue.delete(),
        }),
      } : {}),
    });
    else tx.create(account, {
      role, loginId, accountStatus: "active", demoAccount: options.demo,
      credentialVersion: version, createdAt: when, updatedAt: when, archivedAt: null, ...fields,
      ...(role === "student" ? {
        usn: loginId, studentId: fields.studentId ?? loginId, holderShort: fields.holderShort ?? fields.fullName,
        program: fields.program ?? "", institution: fields.institution ?? "", campusShort: fields.campusShort ?? "",
        email: fields.email ?? "", pushAlerts: true, soundAndHaptics: true,
      } : role === "admin" ? {} : { staffId: loginId, staffName: fields.fullName, ...staffFields }),
    });
    tx.set(credential, { passwordHash, version, attempts: 0, windowStartedAt: 0 });
    audit(tx, operator, saved ? "password_reset" : "account_created", "account", uid, {
      officeId: saved?.officeId ?? staffFields.officeId,
    });
    if (roleChanged) audit(tx, operator, "role_changed", "account", uid, { outcome: role });
    return { uid, changed: true };
  });
}

function view(account: FirebaseFirestore.DocumentData) {
  const allowed = ["id", "loginId", "usn", "staffId", "fullName", ...contactFields, "officeId", "counterIds",
    "defaultCounterWindow", "createdAt", "updatedAt", "archivedAt"];
  return {
    ...Object.fromEntries(allowed.filter((field) => field in account).map((field) => [field, account[field]])),
    role: roleOf(account), accountStatus: account.accountStatus ?? (account.disabled ? "disabled" : "active"),
  };
}

async function hasAssignments(tx: FirebaseFirestore.Transaction, uid: string, profile: FirebaseFirestore.DocumentData) {
  if (Object.values(profile.activeTickets ?? {}).some(Boolean)) return true;
  if (roleOf(profile) !== "staff" || !profile.officeId) return false;
  const counters = officeRef(profile.officeId).collection("counters");
  const serving = await tx.get(counters.where("ticketId", "!=", null));
  const allowed = profile.counterIds ?? (profile.role === "registrar_staff" && profile.defaultCounterWindow ? [profile.defaultCounterWindow] : []);
  return serving.docs.some((doc) => {
    const desk = doc.data();
    return desk.assignedStaffUid === uid || (!desk.assignedStaffUid && allowed.includes(doc.id));
  });
}

export async function accountsAdmin(admin: Actor, role: ManagedRole, params: URLSearchParams, input?: Record<string, unknown>) {
  const db = adminDb();
  if (!input) {
    const id = params.get("id");
    const search = params.get("search")?.trim().toLowerCase();
    if (id) {
      const doc = await userRef(key(id, "account ID")).get();
      const account = doc.data();
      if (!account || roleOf(account) !== role) throw new ApiError(404, "Account not found");
      return { account: view({ ...account, id: doc.id }) };
    }
    const all = db.collection("users").where("role", "in", role === "staff" ? ["staff", "registrar_staff"] : ["student"]);
    const list = await browse(all, params, (account) =>
      (params.get("archived") === "true" || account.accountStatus !== "archived") &&
      (!search || [account.loginId, account.usn, account.staffId, account.fullName, account.email]
        .some((value) => typeof value === "string" && value.toLowerCase().includes(search))));
    return { ...list, items: list.items.map(view) };
  }
  if (input.action === "create") {
    const result = await provision({ ...input, role }, { reset: false, demo: false, createOnly: true, admin });
    return { id: result.uid };
  }
  const uid = key(input.id, "account ID");
  const ref = userRef(uid);
  const action = input.action;
  if (!["update", "archive", "restore", "reset-password"].includes(String(action))) throw new ApiError(400, "Invalid account action");
  if ("role" in input || "loginId" in input) throw new ApiError(400, "Role and login ID are fixed in account management");
  const edits = action === "update" ? profileChanges(input) : {};
  const changesAssignment = role === "staff" && action === "update" &&
    ["officeId", "counterIds", "defaultCounterWindow"].some((field) => field in input);
  let passwordHash: string | null = null;
  if (action === "reset-password") {
    if (!validPassword(input.password)) throw new ApiError(400, "Password must contain 8 to 128 characters");
    passwordHash = await hashPassword(input.password);
  }
  return db.runTransaction(async (tx) => {
    await requireCurrent(tx, admin);
    const profile = (await tx.get(ref)).data();
    if (!profile || roleOf(profile) !== role) throw new ApiError(404, "Account not found");
    if (action === "update" && !changesAssignment && !Object.keys(edits).length) throw new ApiError(400, "No account changes supplied");
    if ((action === "archive" || changesAssignment) && await hasAssignments(tx, uid, profile)) {
      throw new ApiError(409, "Resolve active tickets or counter assignments first");
    }
    const movedOffice = changesAssignment && input.officeId != null && input.officeId !== profile.officeId;
    const placement = changesAssignment ? await assignment(tx, {
      officeId: input.officeId ?? profile.officeId,
      counterIds: input.counterIds ?? (movedOffice ? undefined : profile.counterIds),
      defaultCounterWindow: input.defaultCounterWindow ?? (movedOffice || input.counterIds ? undefined : profile.defaultCounterWindow),
    }, "staff") : {};
    const version = (profile.credentialVersion ?? 0) + 1;
    const when = FieldValue.serverTimestamp();
    tx.update(ref, {
      ...edits, ...placement, ...(role === "staff" && edits.fullName ? { staffName: edits.fullName } : {}),
      ...(action === "archive" ? { accountStatus: "archived", archivedAt: profile.archivedAt ?? when } : {}),
      ...(action === "restore" ? { accountStatus: "active", disabled: false, archivedAt: null } : {}),
      ...(action !== "update" || changesAssignment ? { credentialVersion: version } : {}),
      updatedAt: when,
    });
    if (passwordHash) tx.set(db.collection("credentials").doc(uid), { passwordHash, version, attempts: 0, windowStartedAt: 0 });
    audit(tx, admin, action === "reset-password" ? "password_reset" :
      action === "archive" ? "account_archived" : action === "restore" ? "account_restored" : "account_updated",
      "account", uid, { officeId: placement.officeId ?? profile.officeId, fields: Object.keys(edits) });
    if (changesAssignment) audit(tx, admin, "office_assignment_changed", "account", uid, { officeId: placement.officeId });
    return { id: uid };
  });
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let endedQuote = false;
  for (let offset = 0; offset < csv.length; offset++) {
    const character = csv[offset];
    if (quoted) {
      if (character === '"' && csv[offset + 1] === '"') { cell += '"'; offset++; }
      else if (character === '"') { quoted = false; endedQuote = true; }
      else cell += character;
    } else if (character === "," || character === "\n" || character === "\r") {
      row.push(cell);
      cell = "";
      endedQuote = false;
      if (character !== ",") {
        if (character === "\r" && csv[offset + 1] === "\n") offset++;
        rows.push(row);
        row = [];
      }
    } else if (character === '"' && !cell && !endedQuote) quoted = true;
    else {
      if (endedQuote || character === '"') throw new ApiError(400, "Invalid CSV quoting");
      cell += character;
    }
  }
  if (quoted) throw new ApiError(400, "Unclosed CSV field");
  if (cell || row.length || endedQuote) rows.push([...row, cell]);
  return rows;
}

export async function importAccounts(admin: Actor, role: ManagedRole, csv: string) {
  if (Buffer.byteLength(csv, "utf8") > 32_768) throw new ApiError(413, "CSV exceeds 32 KiB");
  const [header, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const names = header?.map((name) => name.trim()) ?? [];
  const required = ["loginId", "fullName", "password", ...(role === "staff" ? ["officeId"] : [])];
  const permitted = [...required, ...contactFields, ...(role === "staff" ? ["counterIds", "defaultCounterWindow"] : [])];
  if (!required.every((name) => names.includes(name)) || new Set(names).size !== names.length ||
      names.some((name) => !permitted.includes(name))) throw new ApiError(400, "Invalid or missing CSV headers");
  if (!rows.length || rows.length > 30) throw new ApiError(400, "CSV must contain 1 to 30 rows");
  const seen = new Set<string>();
  const results = [];
  for (const [index, row] of rows.entries()) {
    let loginId: string | undefined;
    try {
      if (row.length !== names.length) throw new ApiError(400, "Column count does not match the header");
      const input: Record<string, unknown> = Object.fromEntries(row.map((value, column) =>
        [names[column], names[column] === "password" ? value : value.trim()]));
      loginId = loginKey(input.loginId);
      if (seen.has(loginId.toLowerCase())) throw new ApiError(409, "Duplicate login ID in this file");
      seen.add(loginId.toLowerCase());
      if (typeof input.counterIds === "string") input.counterIds = input.counterIds.split(";").map((id) => id.trim()).filter(Boolean);
      if (input.defaultCounterWindow === "") delete input.defaultCounterWindow;
      const { uid } = await provision({ ...input, role }, { reset: false, demo: false, createOnly: true, admin });
      results.push({ row: index + 2, loginId, id: uid, success: true });
    } catch (error) {
      // Only return an identifier after it passes validation. Never echo input rows.
      results.push({ row: index + 2, ...(loginId ? { loginId } : {}), success: false,
        error: error instanceof ApiError ? error.message : "Account could not be created" });
    }
  }
  const imported = results.filter((result) => result.success).length;
  return { total: rows.length, imported, failed: rows.length - imported, results };
}

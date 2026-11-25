import { randomUUID } from "node:crypto";
import { adminDb } from "../lib/firebaseAdmin.ts";
import { hashPassword, validPassword } from "../lib/passwords.ts";
import { desks } from "../lib/queue.ts";

export async function provision(input: Record<string, unknown>, options = { reset: false, demo: false }) {
  const { loginId, role, fullName, password } = input;
  if (typeof loginId !== "string" || !/^[A-Za-z0-9_-]{2,40}$/.test(loginId)) throw new Error("Invalid loginId");
  if (role !== "student" && role !== "registrar_staff") throw new Error("Invalid role");
  if (typeof fullName !== "string" || !fullName.trim()) throw new Error("Missing fullName");
  if (!validPassword(password)) throw new Error("Password must contain 8 to 128 characters");
  const window = input.defaultCounterWindow ?? "Window 2";
  if (role === "registrar_staff" && (typeof window !== "string" || !desks.includes(window))) {
    throw new Error("Unknown Registrar counter");
  }
  if (input.uid != null && (typeof input.uid !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.uid))) {
    throw new Error("Invalid Firebase UID");
  }
  for (const field of ["email", "studentId", "holderShort", "program", "institution", "campusShort", "office", "officeShort"]) {
    if (input[field] != null && typeof input[field] !== "string") throw new Error(`Invalid ${field}`);
  }

  const passwordHash = await hashPassword(password);
  const db = adminDb();
  const alias = db.collection("loginIds").doc(loginId.toLowerCase());
  const proposedUid = input.uid ?? randomUUID();
  const profile = {
    role, fullName, demoAccount: options.demo,
    ...(role === "student" ? {
      usn: loginId, studentId: input.studentId ?? loginId,
      firstName: fullName.trim().split(/\s+/)[0], firstLetter: fullName.trim()[0],
      holderShort: input.holderShort ?? fullName, program: input.program ?? "",
      institution: input.institution ?? "", campusShort: input.campusShort ?? "",
      email: input.email ?? "", pushAlerts: true, soundAndHaptics: true,
    } : {
      staffId: loginId, staffName: fullName, officeId: "registrar",
      office: input.office ?? "Registrar", officeShort: input.officeShort ?? "Registrar",
      defaultCounterWindow: window,
    }),
  };

  return db.runTransaction(async (tx) => {
    const existing = (await tx.get(alias)).data();
    if (existing && input.uid && existing.uid !== input.uid) throw new Error("Login ID is already assigned");
    const uid: string = existing?.uid ?? proposedUid;
    const account = db.collection("users").doc(uid);
    const credential = db.collection("credentials").doc(uid);
    const [accountDoc, credentialDoc] = await tx.getAll(account, credential);
    const saved = accountDoc.data();
    if (saved && (saved.role !== role || Boolean(saved.demoAccount) !== options.demo)) {
      throw new Error("Existing account role or demo status differs");
    }
    const existingLoginId = saved?.staffId ?? saved?.usn;
    if (typeof existingLoginId === "string" && existingLoginId.toLowerCase() !== loginId.toLowerCase()) {
      throw new Error("Existing account has a different login ID");
    }
    if (!accountDoc.exists && options.reset) throw new Error("Cannot reset a password for an unknown account");
    if (!existing) tx.create(alias, { uid });
    if (credentialDoc.exists && !options.reset) return false;

    const version = (credentialDoc.data()?.version ?? 0) + 1;
    if (accountDoc.exists) tx.update(account, { credentialVersion: version });
    else tx.create(account, { ...profile, credentialVersion: version });
    tx.set(credential, { passwordHash, version, attempts: 0, windowStartedAt: 0 });
    return true;
  });
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createApiClient, ApiResponseError } from "../../campusqueue-mobile/src/context/apiClient.ts";
import { applyMigrations } from "../migrations/schema.ts";
import { provision } from "../lib/accountsAdmin.ts";
import { adminDb } from "../lib/firebaseAdmin.ts";
import health from "../api/health.ts";
import auth from "../api/auth.ts";
import me from "../api/me.ts";
import session from "../api/session.ts";
import student from "../api/student.ts";
import staff from "../api/staff.ts";
import offices from "../api/offices.ts";
import password from "../api/password.ts";
import admin from "../api/admin.ts";

const project = "demo-campusqueue-integration";
assert.equal(process.env.FIREBASE_PROJECT_ID, project, "Use a disposable local emulator project.");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8085");
assert.ok(!process.env.VERCEL_ENV, "This suite may only run locally.");

const handlers = { health, auth, me, session, student, staff, offices, password, admin };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", "http://localhost");
    const handler = handlers[url.pathname.slice("/api/".length) as keyof typeof handlers];
    const method = incoming.method ?? "GET";
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const request = new Request(url, {
      method, headers,
      ...(!["GET", "HEAD"].includes(method) ? { body: Readable.toWeb(incoming), duplex: "half" } : {}),
    } as RequestInit);
    const response = handler ? await handler.fetch(request) : Response.json({ error: "Not found" }, { status: 404 });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end();
  }
});

let api: ReturnType<typeof createApiClient>;
const suffix = randomUUID().slice(0, 8);
const studentId = "student-" + suffix;
const employeeId = "staff-" + suffix;
const adminId = "admin-" + suffix;
const secondStudentId = "student-two-" + suffix;
const secondStaffId = "staff-two-" + suffix;
const secret = randomUUID();
const counter = "Window 1";
const registrar = () => adminDb().collection("offices").doc("registrar");
const setRegistrarCounters = async (status: "online" | "break") => {
  const batch = adminDb().batch();
  for (const id of ["Window 1", "Window 2", "Window 3"]) {
    batch.update(registrar().collection("counters").doc(id), { status });
  }
  await batch.commit();
};
type Tokens = { idToken: string; refreshToken: string; role: string };

before(async () => {
  await applyMigrations(false);
  for (const [loginId, role, assignedCounter] of [
    [studentId, "student"], [employeeId, "staff", counter], [adminId, "admin"],
    [secondStudentId, "student"], [secondStaffId, "staff", "Window 3"],
  ]) {
    await provision({
      loginId, role, fullName: "Integration Test", password: secret, email: loginId + "@example.test",
      ...(role === "staff" ? { officeId: "registrar", counterIds: [assignedCounter], defaultCounterWindow: assignedCounter } : {}),
    }, { reset: false, demo: false });
  }
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  api = createApiClient("http://127.0.0.1:" + address.port, true);
});

after(async () => {
  if (server.listening) await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()));
});

const rejectsStatus = (status: number) => (error: unknown) =>
  error instanceof ApiResponseError && error.status === status;
const login = (loginId: string, password = secret) => api<Tokens>("auth", {
  data: { action: "sign-in", loginId, password },
});

test("login, scoped queue lifecycle, reports, and session revocation", async () => {
  await assert.rejects(login(studentId, "incorrect-password"), rejectsStatus(401));
  await assert.rejects(api("student"), rejectsStatus(401));
  assert.equal((await api<{ success: boolean }>("health")).success, true);
  const [learner, employee, administrator] = await Promise.all([login(studentId), login(employeeId), login(adminId)]);
  assert.equal(learner.role, "student");
  assert.equal(employee.role, "staff");
  assert.equal(administrator.role, "admin");

  const token = learner.idToken;
  const staffToken = employee.idToken;
  const adminToken = administrator.idToken;
  const restored = await api<Tokens>("session", { data: { refreshToken: learner.refreshToken } });
  const identity = await api<{ uid: string; role: string; account: { loginId: string } }>("me", { token: restored.idToken });
  assert.equal(identity.account.loginId, studentId);
  assert.equal(identity.role, "student");
  assert.equal((await api<{ staff: { officeId: string } }>("me", { token: staffToken })).staff.officeId, "registrar");

  const directory = await api<{ offices: { id: string; services: { name: string }[] }[] }>("offices", { token });
  assert.ok(["accounting", "registrar", "sao"].every((id) => directory.offices.some((office) => office.id === id)));
  const serviceName = directory.offices.find((office) => office.id === "registrar")?.services[0]?.name;
  assert.ok(serviceName);
  type Ticket = { id: string; ticketNumber: string; qrPayload: string; lifecycleStatus: string };
  type StudentState = { activeTickets: Ticket[]; historyTickets: { status: string }[]; notifications: { id: string; read: boolean }[]; profile: { pushAlerts: boolean } };
  const studentView = () => api<StudentState>("student", { token });
  assert.deepEqual((await studentView()).activeTickets, []);
  await api("student", { token, data: { action: "preferences", pushAlerts: false } });
  assert.equal((await studentView()).profile.pushAlerts, false);
  const issue = (requestId: string) => api<{ ticket: Ticket }>("student", {
    token, data: { action: "issue", officeId: "registrar", serviceName, requestId },
  });
  await setRegistrarCounters("break");
  const sameRequest = randomUUID();
  const duplicate = await Promise.all([issue(sameRequest), issue(sameRequest)]);
  const { ticket } = duplicate[0];
  assert.equal(ticket.id, duplicate[1].ticket.id);
  await assert.rejects(issue(randomUUID()), rejectsStatus(409));
  assert.equal((await studentView()).activeTickets[0]?.id, ticket.id);

  const staffCounters = await api<{ counters: { id: string }[] }>("staff?view=counters", { token: staffToken });
  assert.deepEqual(staffCounters.counters.map((item) => item.id), [counter]);
  await assert.rejects(api("staff?officeId=accounting", { token: staffToken }), rejectsStatus(403));
  await assert.rejects(api("staff?counter=Window%202", { token: staffToken }), rejectsStatus(403));
  await assert.rejects(api("admin?resource=offices", { token }), rejectsStatus(403));
  const deskAction = (action: string, extra: object = {}) => api<{ ticketId: string; recallCount?: number }>("staff", {
    token: staffToken, data: { action, counter, ...extra },
  });
  assert.equal((await deskAction("status", { status: "online" })).ticketId, ticket.id);
  const active = await api<{ activeTickets: Ticket[] }>("student?view=active", { token });
  assert.equal(active.activeTickets[0]?.lifecycleStatus, "serving");
  assert.equal("historyTickets" in active, false);
  assert.equal((await deskAction("recall", { ticketId: ticket.id, recallCount: 0 })).recallCount, 1);
  await api("student", { token, data: { action: "acknowledge", ticketId: ticket.id } });
  await api("staff", { token: staffToken, data: { action: "verify", counter, qrPayload: ticket.qrPayload } });
  await api("staff", { token: staffToken, data: { action: "verify", counter, qrPayload: ticket.qrPayload } });
  await deskAction("start", { ticketId: ticket.id });
  await deskAction("complete", { ticketId: ticket.id, advance: false });
  assert.equal((await studentView()).historyTickets[0]?.status, "Completed");
  const notification = (await studentView()).notifications[0];
  assert.ok(notification);
  await api("student", { token, data: { action: "read-notification", id: notification.id } });
  await api("student", { token, data: { action: "read-all" } });
  assert.ok((await studentView()).notifications.every((item) => item.read));

  await setRegistrarCounters("break");
  const second = await issue(randomUUID());
  await api("student", { token, data: { action: "cancel", ticketId: second.ticket.id, reason: "Integration test" } });
  assert.ok((await studentView()).historyTickets.some((item) => item.status === "Cancelled"));
  const otherStudent = await login(secondStudentId);
  const otherStaff = await login(secondStaffId);
  const [left, right] = await Promise.all([
    issue(randomUUID()),
    api<{ ticket: Ticket }>("student", { token: otherStudent.idToken,
      data: { action: "issue", officeId: "registrar", serviceName, requestId: randomUUID() },
    }),
  ]);
  const otherDeskAction = (action: string, ticketId?: string) =>
    api<{ ticketId: string }>("staff", { token: otherStaff.idToken,
      data: { action, counter: "Window 3", ...(ticketId ? { ticketId } : {}) },
    });
  await setRegistrarCounters("online");
  const [leftCall, rightCall] = await Promise.all([deskAction("call-next"), otherDeskAction("call-next")]);
  assert.notEqual(leftCall.ticketId, rightCall.ticketId);
  assert.deepEqual(new Set([leftCall.ticketId, rightCall.ticketId]), new Set([left.ticket.id, right.ticket.id]));
  await deskAction("start", { ticketId: leftCall.ticketId });
  await deskAction("complete", { ticketId: leftCall.ticketId, advance: false });
  await otherDeskAction("start", rightCall.ticketId);
  await otherDeskAction("complete", rightCall.ticketId);

  await setRegistrarCounters("break");
  await deskAction("status", { status: "online" });
  const promoted = await issue(randomUUID());
  assert.equal((await api<{ servingTicket: Ticket }>("staff", { token: staffToken })).servingTicket.id, promoted.ticket.id);
  await assert.rejects(deskAction("no-show", { ticketId: promoted.ticket.id }), rejectsStatus(409));
  await deskAction("cancel", { ticketId: promoted.ticket.id, reason: "Cancelled by staff", advance: false });
  assert.ok((await studentView()).historyTickets.some((item) => item.status === "Cancelled"));
  await assert.rejects(api("staff", { token: staffToken, data: {
    action: "verify", counter, qrPayload: promoted.ticket.qrPayload,
  } }), rejectsStatus(409));

  const requeue = await issue(randomUUID());
  await registrar().update({ graceMinutes: 1, requeueLimit: 1, requeuePlacement: "tail" });
  await adminDb().collection("tickets").doc(requeue.ticket.id).update({
    calledAt: new Date(Date.now() - 120_000).toISOString(),
  });
  await deskAction("no-show", { ticketId: requeue.ticket.id, advance: false });
  await deskAction("requeue", { ticketId: requeue.ticket.id });
  const queuedAgain = (await studentView()).activeTickets[0];
  assert.equal(queuedAgain?.id, requeue.ticket.id);
  assert.notEqual(queuedAgain?.qrPayload, requeue.ticket.qrPayload);
  await assert.rejects(api("staff", { token: staffToken, data: {
    action: "verify", counter, qrPayload: requeue.ticket.qrPayload,
  } }), rejectsStatus(404));
  // A read must not advance a requeued ticket, allowing an explicit scan or call.
  assert.equal((await api<{ servingTicket: Ticket | null }>("staff", { token: staffToken })).servingTicket, null);
  assert.ok(queuedAgain);
  await api("staff", { token: staffToken, data: { action: "verify", counter, qrPayload: queuedAgain.qrPayload } });
  await deskAction("complete", { ticketId: queuedAgain.id, advance: false });

  const officeId = "integration-" + suffix;
  await api("admin?resource=offices", { token: adminToken, data: {
    action: "create", id: officeId, name: "Integration Office", prefix: ("T" + suffix).toUpperCase(),
  } });
  await api("admin?resource=counters", { token: adminToken, data: {
    action: "create", officeId, id: "Desk-A", name: "Desk A",
  } });
  await api("admin?resource=request-types", { token: adminToken, data: {
    action: "create", officeId, id: "integration-service", name: "Integration Service", duration: 5,
  } });
  const types = await api<{ items: { id: string }[] }>("admin?resource=request-types&officeId=" + officeId, { token: adminToken });
  assert.equal(types.items[0]?.id, "integration-service");
  await api("admin?resource=offices", { token: adminToken, data: { action: "archive", id: officeId } });

  const date = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  for (const format of ["csv", "pdf"]) {
    const params = new URLSearchParams({ format, startDate: date, endDate: date });
    const staffReport = await api<{ bytes: Uint8Array }>("staff?" + params, { token: staffToken, download: true });
    assert.ok(staffReport.bytes.byteLength > 20);
    const adminReport = await api<{ bytes: Uint8Array }>("admin?resource=analytics&" + params, {
      token: adminToken, download: true,
    });
    assert.ok(adminReport.bytes.byteLength > 20);
  }

  const updated = await api<Tokens>("password", { token, data: { currentPassword: secret, newPassword: randomUUID() } });
  await assert.rejects(api("student", { token }), rejectsStatus(401));
  const uid = identity.uid;
  await adminDb().collection("users").doc(uid).update({ accountStatus: "archived" });
  await assert.rejects(api("student", { token: updated.idToken }), rejectsStatus(403));
});

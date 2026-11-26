const session = {
  idToken: "<Firebase ID token>",
  refreshToken: "<refresh token>",
  expiresIn: "3600",
};

const desk = {
  counter: "Window 2",
  deskStatus: "online",
  servingTicket: null,
  waitingQueue: [],
  transactions: [],
};

const assignedTicket = { ticketId: null, ticket: null };
const replacementPassword = { currentPassword: "<current password>", newPassword: "<new password>" };
const list = { items: [], nextCursor: null };
const ticketId = "<ticket ID>";
const timestamp = "<ISO timestamp>";
const success = { success: true };

function action(name, actionName, fields, response, responseNote) {
  return { method: "POST", name, body: { action: actionName, ...fields }, response, responseNote, writes: true };
}

function reportFormats(name, reportTitle) {
  return ["csv", "pdf"].map((format) => ({
    method: "GET",
    name: `${name} (${format.toUpperCase()})`,
    query: `format=${format}`,
    response: `${reportTitle} · ${format.toUpperCase()} download`,
    responseType: format === "pdf" ? "application/pdf" : "text/csv",
  }));
}

function staffDesk(path, access) {
  return [
    { method: "GET", name: "Read desk", query: "includeLogs=false", response: { ...desk, officeId: "registrar" } },
    {
      method: "GET", name: "List assigned counters", query: "view=counters",
      response: { officeId: "registrar", defaultCounter: "Window 2", counters: [{ id: "Window 2", name: "Window 2", status: "online" }] },
    },
    ...reportFormats("Download shift report", "CampusQueue shift report"),
    action("Update counter status", "status", { status: "online" }, { status: "online" }),
    action("Call the next ticket", "call-next", {}, assignedTicket, "When a ticket is waiting, the response includes the assigned ticket and its ID."),
    action("Verify by QR", "verify", { qrPayload: "<ticket QR payload>" }, {
      ticket: { id: ticketId, isQrVerified: true, method: "qr_scan" },
    }),
    action("Verify manually", "verify", { ticketNumber: "<ticket number>", usnSuffix: "<last four USN digits>" }, {
      ticket: { id: ticketId, isQrVerified: true, method: "manual_usn_check" },
    }),
    action("Start service", "start", { ticketId }, { ticketId, status: "serving", startedAt: timestamp }),
    action("Recall student", "recall", { ticketId, recallCount: 0 }, { recallCount: 1 }),
    action("Complete service", "complete", { ticketId, advance: false }, assignedTicket),
    action("Mark no-show", "no-show", { ticketId, advance: false }, assignedTicket),
    action("Skip ticket", "skip", { ticketId }, assignedTicket, "If the counter advances, the response includes the next ticket."),
    action("Requeue ticket", "requeue", { ticketId }, { ticketId, requeueCount: 1, status: "waiting" }),
  ].map((item) => ({ ...item, path, access }));
}

function adminGroup(name, resource, presets) {
  return {
    name,
    endpoints: presets.map((item) => ({
      ...item, path: "/api/admin", access: "Admin",
      query: [`resource=${resource}`, item.query].filter(Boolean).join("&"),
    })),
  };
}

function managementTests(record, detail, create, update, listResponse = list) {
  const { id, officeId } = record;
  const officeQuery = officeId ? `officeId=${encodeURIComponent(officeId)}` : "";
  const recordQuery = [officeQuery, `id=${encodeURIComponent(id)}`].filter(Boolean).join("&");
  return [
    { method: "GET", name: "List records", query: officeQuery, response: listResponse },
    { method: "GET", name: "Read record", query: recordQuery, response: detail },
    action("Create record", "create", create, { ...record, id: create.id ?? id }),
    action("Update record (POST)", "update", { ...record, ...update }, record),
    { method: "PATCH", name: "Update record (PATCH)", body: { ...record, ...update }, response: record, writes: true },
    action("Archive record", "archive", record, record),
    action("Restore record", "restore", record, record),
  ];
}

function accountTests(role) {
  const id = "<account ID>";
  const loginId = role === "staff" ? "<staff ID>" : "<USN>";
  const password = "<initial password>";
  const fullName = role === "staff" ? "Example Staff Member" : "Example Student";
  const assignment = role === "staff" ? { officeId: "registrar", counterIds: ["Window 2"] } : {};
  const detail = { account: { id, loginId, fullName, role, accountStatus: "active", ...assignment } };
  const create = { loginId, fullName, password, ...assignment };
  const header = ["loginId", "fullName", "password"];
  const values = [loginId, fullName, password];
  if (role === "staff") {
    header.push("officeId", "counterIds");
    values.push(assignment.officeId, assignment.counterIds.join(";"));
  }
  const csv = [header.join(","), values.join(",")].join("\n");
  const importResult = { total: 1, imported: 1, failed: 0, results: [{ row: 2, id, loginId, success: true }] };
  return [
    ...managementTests({ id }, detail, create, { fullName: "Updated Name" }),
    action("Reset account password", "reset-password", { id, password: "<new password>" }, { id }),
    {
      method: "POST", name: "Import accounts (CSV body)", body: csv, requestType: "text/csv",
      response: importResult, writes: true,
    },
    action("Import accounts (JSON body)", "import", { csv }, importResult),
  ];
}

export const groups = [
  {
    name: "Health & authentication",
    endpoints: [
      {
        method: "GET", path: "/api/health", access: "Public", name: "Check API health",
        response: { success: true, message: "CampusQueue API is running", version: "0.0.1" },
      },
      {
        method: "POST", path: "/api/auth", access: "Public", name: "Sign in",
        body: { action: "sign-in", loginId: "<USN or staff ID>", password: "<password>" },
        response: { ...session, role: "student" },
        responseNote: "Staff sign-in also returns a staff profile.",
        sessionResponse: true,
      },
      {
        method: "POST", path: "/api/session", access: "Refresh token", name: "Refresh session",
        body: { refreshToken: "<refresh token>" }, response: session, sessionResponse: true,
      },
      {
        method: "GET", path: "/api/me", access: "Signed in", name: "Check current session",
        response: { success: true, uid: "<account ID>", role: "student", firestoreConnected: true },
      },
      {
        method: "POST", path: "/api/password", access: "Signed in", name: "Change password",
        body: replacementPassword, response: session, writes: true, sessionResponse: true,
      },
    ],
  },
  {
    name: "Student queue",
    endpoints: [
      {
        method: "GET", path: "/api/offices", access: "Signed in", name: "List offices",
        response: { offices: [], nextCursor: null },
      },
      ...[
        {
          method: "GET", name: "Read student dashboard",
          response: { profile: { fullName: "Example Student" }, activeTickets: [], historyTickets: [], notifications: [] },
        },
        action("Issue a ticket", "issue", { officeId: "registrar", serviceId: "reg-tor", requestId: "<unique request ID>" },
          { ticket: { id: ticketId, ticketNumber: "REG-001", status: "waiting" } }, "The ticket object includes additional fields."),
        action("Cancel a ticket", "cancel", { ticketId, reason: "Plans changed" }, { ticket: { id: ticketId, status: "Cancelled" } }),
        action("Acknowledge a call", "acknowledge", { ticketId }, { ticketId, acknowledgedAt: timestamp }),
        action("Save notification preferences", "preferences", { pushAlerts: true, soundAndHaptics: true }, success),
        action("Mark a notification read", "read-notification", { id: "<notification ID>" }, success),
        action("Mark all notifications read", "read-all", {}, { success: true, more: false }),
      ].map((item) => ({ ...item, path: "/api/student", access: "Student" })),
    ],
  },
  { name: "Staff desk", endpoints: staffDesk("/api/staff", "Staff") },
  { name: "Registrar desk", endpoints: staffDesk("/api/registrar", "Registrar staff") },
  adminGroup("Admin · Student accounts", "students", accountTests("student")),
  adminGroup("Admin · Staff accounts", "staff", accountTests("staff")),
  adminGroup("Admin · Offices", "offices", managementTests(
    { id: "<office ID>" }, { office: { id: "<office ID>", name: "<office name>", prefix: "<office prefix>" } },
    { id: "test-office", name: "Test Office", prefix: "TEST" }, { name: "Updated Office" },
  )),
  adminGroup("Admin · Counters", "counters", managementTests(
    { id: "<counter ID>", officeId: "registrar" },
    { counter: { id: "<counter ID>", officeId: "registrar", name: "<counter name>", status: "closed" } },
    { id: "test-counter", officeId: "registrar", name: "Test Counter" }, { name: "Updated Counter" },
  )),
  adminGroup("Admin · Request types", "request-types", managementTests(
    { id: "<request type ID>", officeId: "registrar" },
    { requestType: { id: "<request type ID>", name: "<request type name>", duration: 15 } },
    { id: "test-service", officeId: "registrar", name: "Test Service", duration: 15 }, { duration: 20 },
    { items: [] },
  )),
  adminGroup("Admin · Activity logs", "activity-logs", [
    { method: "GET", name: "List activity logs", query: "limit=10", response: list },
  ]),
  adminGroup("Admin · Analytics", "analytics", [
    {
      method: "GET", name: "Read analytics", response: {
        filters: { startDate: "<date>", endDate: "<date>", officeId: null, serviceId: null, counter: null, status: null },
        generatedAt: timestamp,
        timezone: "Asia/Manila",
        summary: { issued: 0, completed: 0, cancelled: 0, noShow: 0 },
        groups: { office: [], requestType: [], date: [], counter: [] },
      },
      responseNote: "The summary also includes rates, ticket status counts, and timing metrics.",
    },
    ...reportFormats("Download analytics", "CampusQueue analytics"),
  ]),
];

import { adminDb } from "../lib/firebaseAdmin.ts";
import { actor, ApiError, body, endpoint, key } from "../lib/http.ts";
import { cancelTicket, history, issueTicket, ticketRef, userRef, waiting } from "../lib/queue.ts";

export default endpoint(["GET", "POST"], async (request) => {
  const { uid, profile } = await actor(request, "student");
  const user = userRef(uid);
  const inbox = user.collection("notifications");
  if (request.method === "GET") {
    const activeRefs = Object.values(profile.activeTickets ?? {}).filter((id): id is string => typeof id === "string").map(ticketRef);
    const [active, archived, notifications] = await Promise.all([
      activeRefs.length ? adminDb().getAll(...activeRefs) : [],
      history(uid).orderBy("timestamp", "desc").limit(100).get(),
      inbox.orderBy("time", "desc").limit(50).get(),
    ]);
    const activeTickets = await Promise.all(active.filter((doc) => doc.exists).map(async (doc) => {
      const ticket = doc.data()!;
      const office = adminDb().collection("offices").doc(ticket.officeId);
      const [config, ahead] = await Promise.all([
        office.get(),
        ticket.status === "waiting"
          ? waiting(ticket.officeId).where("sequence", "<", ticket.sequence).count().get()
          : null,
      ]);
      const aheadCount = ahead?.data().count ?? 0;
      const duration = config.data()?.services?.find((service: { name: string }) => service.name === ticket.service)?.duration ?? 0;
      return {
        ...ticket, id: doc.id, aheadCount, nowServing: config.data()?.nowServing ?? "",
        estWaitMins: ticket.status === "serving" ? 0 : (aheadCount + 1) * duration,
      };
    }));
    const past = archived.empty ? [] : await adminDb().getAll(...archived.docs.map((doc) => ticketRef(doc.id)));
    return {
      profile: Object.fromEntries(
        ["fullName", "firstName", "firstLetter", "holderShort", "usn", "studentId", "program",
          "institution", "campusShort", "email", "pushAlerts", "soundAndHaptics"]
          .filter((field) => profile[field] !== undefined).map((field) => [field, profile[field]]),
      ),
      activeTickets,
      historyTickets: past.filter((doc) => doc.exists).map((doc) => {
        const item = doc.data()!;
        const minutes = Math.max(0, Math.floor((Date.parse(item.calledAt ?? item.timestamp) - Date.parse(item.issuedAt)) / 60000));
        return {
          id: doc.id, ticketNumber: item.ticketNumber, officeId: item.officeId, officeName: item.officeName,
          service: item.service, status: item.status, counter: item.counter, issuedAt: item.issuedAt,
          calledAt: item.calledAt ?? "", timestamp: item.timestamp, waitDuration: `${minutes} min`,
          ...(item.reason ? { reason: item.reason } : {}),
        };
      }),
      notifications: notifications.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  }
  const data = await body(request);
  switch (data.action) {
    case "issue":
      return { ticket: await issueTicket(uid, data) };
    case "cancel":
      return { ticket: await cancelTicket(uid, data) };
    case "preferences": {
      const updates: Record<string, boolean> = {};
      for (const name of ["pushAlerts", "soundAndHaptics"]) {
        if (!(name in data)) continue;
        const value = data[name];
        if (typeof value !== "boolean") throw new ApiError(400, `Invalid ${name}`);
        updates[name] = value;
      }
      if (!Object.keys(updates).length) throw new ApiError(400, "No preferences supplied");
      await user.update(updates);
      return { success: true };
    }
    case "read-notification": {
      const ref = inbox.doc(key(data.id, "id"));
      if (!(await ref.get()).exists) throw new ApiError(404, "Notification not found");
      await ref.update({ read: true });
      return { success: true };
    }
    case "read-all": {
      const batch = adminDb().batch();
      const notifications = await inbox.where("read", "==", false).limit(500).get();
      for (const doc of notifications.docs) batch.update(doc.ref, { read: true });
      await batch.commit();
      return { success: true, more: notifications.size === 500 };
    }
    default:
      throw new ApiError(400, "Unknown student action");
  }
});

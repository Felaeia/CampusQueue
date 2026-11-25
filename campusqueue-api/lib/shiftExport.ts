import { dateRange } from "./activityLogs.ts";
import { ApiError, type Actor } from "./http.ts";
import { staffScope } from "./registrar.ts";
import { download } from "./reports.ts";

export async function shiftExport(actor: Actor, params: URLSearchParams, legacy: boolean) {
  const { name, officeId, desk, office, shiftLogs } = staffScope(actor, Object.fromEntries(params), legacy);
  const { start, end, startDate, endDate } = dateRange(params, 31);
  const [deskDoc, officeDoc] = await Promise.all([desk.get(), office.get()]);
  if (!officeDoc.exists || officeDoc.get("archivedAt") || !deskDoc.exists || deskDoc.get("archivedAt")) {
    throw new ApiError(404, "Counter is unavailable");
  }
  const rows = await shiftLogs.where("counterWindow", "==", name)
    .where("closedAt", ">=", start.toISOString()).where("closedAt", "<", end.toISOString())
    .orderBy("closedAt", "desc").limit(501)
    .select("ticketNumber", "serviceType", "lifecycleStatus", "outcome", "closedAt", "durationFormatted").get();
  if (rows.size > 500) throw new ApiError(422, "Shift export exceeds 500 entries. Narrow the date range.");
  return download({
    title: "CampusQueue shift report", filename: "campusqueue-shift-" + startDate,
    filters: { startDate, endDate, officeId, counter: name, timezone: "Asia/Manila" },
    generatedAt: new Date().toISOString(),
    headers: ["Ticket", "Service", "Outcome", "Closed (UTC)", "Service time"],
    rows: rows.docs.map((doc) => [
      doc.get("ticketNumber"), doc.get("serviceType"), doc.get("lifecycleStatus") ?? doc.get("outcome"),
      doc.get("closedAt"), doc.get("durationFormatted"),
    ]),
  }, params.get("format") ?? "");
}

import { dateRange } from "./activityLogs.ts";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError, key, text } from "./http.ts";
import { download, type Report } from "./reports.ts";

export const statuses = ["waiting", "called", "serving", "completed", "cancelled", "no_show", "skipped"] as const;
type Status = typeof statuses[number];

export interface MetricTicket {
  officeId: string;
  officeName?: string;
  serviceId?: string;
  service: string;
  counter?: string;
  status: string;
  issuedAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  timestamp?: string | null;
  noShowCount?: number;
}

function minutes(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return null;
  const delta = (Date.parse(to) - Date.parse(from)) / 60_000;
  return Number.isFinite(delta) && delta >= 0 ? delta : null;
}

export function metrics(tickets: MetricTicket[]) {
  const byStatus: Record<Status, number> = {
    waiting: 0, called: 0, serving: 0, completed: 0, cancelled: 0, no_show: 0, skipped: 0,
  };
  let waitSum = 0, serviceSum = 0, waitSamples = 0, serviceSamples = 0, noShowEvents = 0;
  for (const ticket of tickets) {
    const status = ticket.status.toLowerCase() as Status;
    if (statuses.includes(status)) byStatus[status]++;
    noShowEvents += ticket.noShowCount ?? (status === "no_show" ? 1 : 0);
    const wait = minutes(ticket.issuedAt, ticket.startedAt);
    const service = status === "completed" ? minutes(ticket.startedAt, ticket.timestamp) : null;
    if (wait !== null) { waitSum += wait; waitSamples++; }
    if (service !== null) { serviceSum += service; serviceSamples++; }
  }
  const mean = (sum: number, count: number) => count ? Number((sum / count).toFixed(2)) : null;
  return {
    issued: tickets.length, completed: byStatus.completed, cancelled: byStatus.cancelled,
    noShow: byStatus.no_show, noShowEvents, legacySkipped: byStatus.skipped, waiting: byStatus.waiting,
    called: byStatus.called, serving: byStatus.serving, waitSamples, serviceSamples,
    averageWaitMinutes: mean(waitSum, waitSamples), averageServiceMinutes: mean(serviceSum, serviceSamples),
    completionRate: mean(byStatus.completed * 100, tickets.length),
    cancellationRate: mean(byStatus.cancelled * 100, tickets.length),
    noShowRate: mean(byStatus.no_show * 100, tickets.length),
  };
}

function breakdown(tickets: MetricTicket[], group: (ticket: MetricTicket) => [string, string]) {
  const groups = new Map<string, { label: string; tickets: MetricTicket[] }>();
  for (const ticket of tickets) {
    const [id, label] = group(ticket);
    const saved = groups.get(id);
    if (saved) saved.tickets.push(ticket);
    else groups.set(id, { label, tickets: [ticket] });
  }
  return [...groups].map(([id, group]) => ({ id, label: group.label, ...metrics(group.tickets) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

export async function analytics(params: URLSearchParams) {
  const { start, end, startDate, endDate } = dateRange(params, 31);
  const officeId = params.has("officeId") ? key(params.get("officeId"), "officeId") : null;
  const serviceId = params.has("serviceId") ? key(params.get("serviceId"), "serviceId") : null;
  const counter = params.has("counter") ? text(params.get("counter"), "counter", 80) : null;
  const status = params.get("status")?.toLowerCase() ?? null;
  if (status !== null && !statuses.includes(status as Status)) throw new ApiError(400, "Invalid ticket status filter");
  const filters = { startDate, endDate, officeId, serviceId, counter, status };
  const firestore = adminDb();
  let query: FirebaseFirestore.Query = firestore.collection("tickets").where("issuedAt", ">=", start.toISOString())
    .where("issuedAt", "<", end.toISOString()).orderBy("issuedAt");
  if (officeId) query = query.where("officeId", "==", officeId);
  if (serviceId) query = query.where("serviceId", "==", serviceId);
  const snapshot = await query.select("officeId", "officeName", "serviceId", "service", "counter", "status", "issuedAt",
    "calledAt", "startedAt", "timestamp", "noShowCount").limit(1501).get();
  if (snapshot.size > 1500) throw new ApiError(422, "Report exceeds 1500 tickets. Narrow the date range or select an office or request type.");
  const tickets = snapshot.docs.map((doc) => doc.data() as MetricTicket).filter((ticket) =>
    (!counter || (ticket.calledAt && ticket.counter === counter)) &&
    (!status || ticket.status.toLowerCase() === status));
  const summary = metrics(tickets);
  const groups = {
    office: breakdown(tickets, (ticket) => [ticket.officeId, ticket.officeName || ticket.officeId]),
    requestType: breakdown(tickets, (ticket) => [ticket.officeId + "/" + (ticket.serviceId ?? ticket.service), ticket.service]),
    date: breakdown(tickets, (ticket) => {
      const day = new Date(Date.parse(ticket.issuedAt) + 28800000).toISOString().slice(0, 10);
      return [day, day];
    }),
    counter: breakdown(tickets.filter((ticket) => Boolean(ticket.calledAt && ticket.counter)), (ticket) =>
      [ticket.officeId + "/" + ticket.counter, ticket.counter ?? ""]),
  };
  const generatedAt = new Date().toISOString();
  const timezone = "Asia/Manila";
  const format = params.get("format");
  if (!format) return { filters, generatedAt, timezone, summary, groups };
  const row = (dimension: string, label: string, entry: ReturnType<typeof metrics>) => [
    dimension, label, entry.issued, entry.completed, entry.cancelled, entry.noShow, entry.waiting,
    entry.averageWaitMinutes, entry.averageServiceMinutes,
  ];
  const report: Report = {
    title: "CampusQueue analytics", filename: "campusqueue-analytics-" + startDate,
    filters: { ...filters, timezone }, generatedAt,
    headers: ["Group", "Label", "Issued", "Done", "Cancelled", "No-show", "Waiting", "Wait min", "Service min"],
    rows: [row("Total", "All", summary), ...Object.entries(groups).flatMap(([dimension, group]) =>
      group.map((entry) => row(dimension, entry.label, entry)))],
  };
  return download(report, format);
}

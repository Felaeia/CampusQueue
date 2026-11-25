import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin.ts";
import { ApiError } from "./http.ts";
import { integer } from "./officeAdmin.ts";

export function manilaDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "Use YYYY-MM-DD for dates");
  const date = new Date(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(date.valueOf()) || new Date(date.valueOf() + 28800000).toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "Invalid reporting date");
  }
  return date;
}

export function dateRange(params: URLSearchParams, maxDays: number) {
  const today = new Date(Date.now() + 28800000).toISOString().slice(0, 10);
  const start = manilaDay(params.get("startDate") ?? today);
  const endDate = params.get("endDate") ?? params.get("startDate") ?? today;
  const end = new Date(manilaDay(endDate).valueOf() + 86400000);
  if (end <= start || end.valueOf() - start.valueOf() > maxDays * 86400000) {
    throw new ApiError(400, `Date range must span 1 to ${maxDays} days`);
  }
  return { start, end, startDate: params.get("startDate") ?? today, endDate };
}

export async function activityLogs(params: URLSearchParams) {
  const { start, end } = dateRange(params, 31);
  const limit = integer(Number(params.get("limit") ?? 25), "limit", 1, 100);
  const filters = ["actorId", "action", "officeId", "targetId", "ticketId"]
    .flatMap((field) => params.has(field) ? [[field, params.get(field)!] as const] : []);
  if (filters.some(([, value]) => !value || value.length > 128)) throw new ApiError(400, "Invalid activity filter");
  let query: FirebaseFirestore.Query = adminDb().collection("activityLogs")
    .where("createdAt", ">=", Timestamp.fromDate(start)).where("createdAt", "<", Timestamp.fromDate(end));
  const primary = filters[0];
  if (primary) query = query.where(primary[0], "==", primary[1]);
  query = query.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  const cursor = params.get("cursor");
  if (cursor) {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!Array.isArray(decoded) || !Number.isInteger(decoded[0]) || !Number.isInteger(decoded[1]) ||
          typeof decoded[2] !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded[2])) throw new Error();
      query = query.startAfter(new Timestamp(decoded[0], decoded[1]), decoded[2]);
    } catch {
      throw new ApiError(400, "Invalid activity cursor");
    }
  }
  const result = await query.limit(limit + 1).get();
  const scanned = result.docs.slice(0, limit);
  const last = scanned.at(-1);
  const date: Timestamp | undefined = last?.get("createdAt");
  return {
    items: scanned.filter((doc) => filters.every(([field, value]) => doc.get(field) === value))
      .map((doc) => ({ ...doc.data(), id: doc.id, createdAt: (doc.get("createdAt") as Timestamp).toDate().toISOString() })),
    nextCursor: result.size > limit && date && last
      ? Buffer.from(JSON.stringify([date.seconds, date.nanoseconds, last.id])).toString("base64url") : null,
  };
}

import { adminAuth, adminDb } from "./firebaseAdmin.ts";
import { demoLoginAllowed } from "./passwords.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function text(value: unknown, field: string, max = 160): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value.trim();
}

export function key(value: unknown, field: string): string {
  const result = text(value, field, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(result) || result.startsWith("__")) throw new ApiError(400, `Invalid ${field}`);
  return result;
}

export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new ApiError(413, "Request body too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const buffers: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new ApiError(413, "Request body too large");
      }
      buffers.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(buffers).toString("utf8");
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const raw = await readBody(request, 8192);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Return the same error for malformed JSON and unsupported JSON values.
  }
  throw new ApiError(400, "Expected a JSON object");
}

export type Role = "student" | "staff" | "admin";
export function roleOf(profile: FirebaseFirestore.DocumentData): Role | undefined {
  const role = profile.role === "registrar_staff" ? "staff" : profile.role;
  return role === "student" || role === "staff" || role === "admin" ? role : undefined;
}

export function activeAccount(profile: FirebaseFirestore.DocumentData): boolean {
  return !profile.disabled && profile.accountStatus !== "archived" && demoLoginAllowed(profile);
}

export type Actor = { uid: string; role: Role; profile: FirebaseFirestore.DocumentData; version: number };

export async function requireCurrent(tx: FirebaseFirestore.Transaction, actor: Actor) {
  const profile = (await tx.get(adminDb().collection("users").doc(actor.uid))).data();
  if (!profile || !activeAccount(profile) || roleOf(profile) !== actor.role ||
      profile.credentialVersion !== actor.version) throw new ApiError(403, "Account access changed");
  return profile;
}

export async function actor(request: Request, role?: Role): Promise<Actor> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Authentication required");
  return verifiedAccount(header.slice(7).trim(), role);
}

export async function verifiedAccount(idToken: string, role?: Role): Promise<Actor> {
  const auth = adminAuth();
  const token = await auth.verifyIdToken(idToken, true).catch(() => {
    throw new ApiError(401, "Invalid or expired token");
  });
  const profile = (await adminDb().collection("users").doc(token.uid).get()).data();
  const effective = profile ? roleOf(profile) : undefined;
  if (!profile || !effective || (role && effective !== role) || !activeAccount(profile)) {
    throw new ApiError(403, "Account is not authorized");
  }
  if (!Number.isInteger(profile.credentialVersion) || token.cqVersion !== profile.credentialVersion) {
    throw new ApiError(401, "Session expired. Sign in again.");
  }
  return { uid: token.uid, role: effective, profile, version: profile.credentialVersion };
}

export function endpoint(
  methods: string[],
  handler: (request: Request) => Promise<unknown>,
) {
  return {
    async fetch(request: Request): Promise<Response> {
      const origin = request.headers.get("origin");
      const allowed = (process.env.ALLOWED_WEB_ORIGINS ?? "").split(",").map((value) => value.trim());
      const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
      if (origin && allowed.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        headers.set("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
      }
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (!methods.includes(request.method)) {
        headers.set("Allow", methods.join(", "));
        return Response.json({ error: "Method not allowed" }, { status: 405, headers });
      }
      try {
        const result = await handler(request);
        if (result instanceof Response) {
          for (const [key, value] of headers.entries()) result.headers.set(key, value);
          return result;
        }
        return Response.json(result, { headers });
      } catch (error) {
        if (error instanceof ApiError) {
          return Response.json({ error: error.message }, { status: error.status, headers });
        }
        const code = (error as { code?: unknown } | null)?.code;
        console.error("CampusQueue request failed", typeof code === "number" ? code : "internal");
        return Response.json({ error: "Request could not be completed" }, { status: 500, headers });
      }
    },
  };
}


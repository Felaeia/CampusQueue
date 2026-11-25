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
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new ApiError(400, `Invalid ${field}`);
  return result;
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 8192) throw new ApiError(413, "Request body too large");
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

export async function actor(request: Request, role?: "student" | "registrar_staff") {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Authentication required");
  return verifiedAccount(header.slice(7).trim(), role);
}

export async function verifiedAccount(idToken: string, role?: "student" | "registrar_staff") {
  const auth = adminAuth();
  const token = await auth.verifyIdToken(idToken, true).catch(() => {
    throw new ApiError(401, "Invalid or expired token");
  });
  const profile = (await adminDb().collection("users").doc(token.uid).get()).data();
  if (!profile || !["student", "registrar_staff"].includes(profile.role) ||
      (role && profile.role !== role) || profile.disabled === true || !demoLoginAllowed(profile)) {
    throw new ApiError(403, "Account is not authorized");
  }
  if (!Number.isInteger(profile.credentialVersion) || token.cqVersion !== profile.credentialVersion) {
    throw new ApiError(401, "Session expired. Sign in again.");
  }
  return { uid: token.uid, profile };
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
        return Response.json(await handler(request), { headers });
      } catch (error) {
        if (error instanceof ApiError) {
          return Response.json({ error: error.message }, { status: error.status, headers });
        }
        console.error("CampusQueue request failed", error);
        return Response.json({ error: "Request could not be completed" }, { status: 500, headers });
      }
    },
  };
}


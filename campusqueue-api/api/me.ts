import { adminAuth, adminDb } from "../lib/firebaseAdmin";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const header = request.headers.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const token = header.slice(7).trim();

    let user;

    try {
      user = await adminAuth().verifyIdToken(token);
    } catch (error) {
      console.error("Firebase token verification failed:", error);

      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    try {
      // Confirm that Firestore is reachable.
      await adminDb().collection("offices").limit(1).get();
    } catch {
      return Response.json({ error: "Database unavailable" }, { status: 503 });
    }

    return Response.json({
      success: true,
      uid: user.uid,
      role: user.role ?? "student",
      firestoreConnected: true,
    });
  },
};

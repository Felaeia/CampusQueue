import { actor, ApiError, body, endpoint } from "../lib/http.ts";
import { changeDesk, staffState, verifyTicket } from "../lib/registrar.ts";

export default endpoint(["GET", "POST"], async (request) => {
  const { uid, profile } = await actor(request, "registrar_staff");
  if (profile.officeId !== "registrar") throw new ApiError(403, "Registrar access required");
  if (request.method === "GET") {
    return staffState(uid, new URL(request.url).searchParams.get("counter") ?? profile.defaultCounterWindow);
  }
  const input = await body(request);
  input.counter ??= profile.defaultCounterWindow;
  if (input.action === "verify") return { ticket: await verifyTicket(input) };
  return changeDesk(uid, profile.staffName, input);
});

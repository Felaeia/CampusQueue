import { shiftExport } from "../lib/shiftExport.ts";
import { actor, ApiError, body, endpoint } from "../lib/http.ts";
import { changeDesk, listStaffCounters, staffState, verifyTicket } from "../lib/registrar.ts";

export function staffEndpoint(legacy: boolean) {
  return endpoint(["GET", "POST"], async (request) => {
    const staff = await actor(request, "staff");
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      if (params.get("view") === "counters") {
        if (legacy && staff.profile.officeId !== "registrar") throw new ApiError(403, "Registrar access required");
        return listStaffCounters(staff, params.get("officeId"));
      }
      if (params.has("format")) return shiftExport(staff, params, legacy);
      return staffState(staff, Object.fromEntries(params), legacy);
    }
    const input = await body(request);
    if (input.action === "verify") return { ticket: await verifyTicket(staff, input, legacy) };
    return changeDesk(staff, input, legacy);
  });
}

export default staffEndpoint(true);

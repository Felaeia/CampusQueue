import { analytics } from "../lib/analytics.ts";
import { accountsAdmin, importAccounts } from "../lib/accountsAdmin.ts";
import { activityLogs } from "../lib/activityLogs.ts";
import { actor, ApiError, body, endpoint, readBody } from "../lib/http.ts";
import { countersAdmin, officesAdmin, servicesAdmin } from "../lib/officeAdmin.ts";

export default endpoint(["GET", "POST", "PATCH"], async (request) => {
  const admin = await actor(request, "admin");
  const params = new URL(request.url).searchParams;
  const resource = params.get("resource");
  if (resource === "analytics") {
    if (request.method !== "GET") throw new ApiError(405, "Analytics is read-only");
    return analytics(params);
  }
  if (resource === "activity-logs") {
    if (request.method !== "GET") throw new ApiError(405, "Activity logs are read-only");
    return activityLogs(params);
  }
  if (resource === "students" || resource === "staff") {
    const role = resource === "students" ? "student" : "staff";
    if (request.method === "POST" && request.headers.get("content-type")?.split(";")[0] === "text/csv") {
      return importAccounts(admin, role, await readBody(request, 32_768));
    }
    const input = request.method === "GET" ? undefined : await body(request);
    if (input?.action === "import") {
      if (typeof input.csv !== "string") throw new ApiError(400, "Expected CSV text");
      return importAccounts(admin, role, input.csv);
    }
    if (input && request.method === "PATCH") input.action = "update";
    return accountsAdmin(admin, role, params, input);
  }
  const handler = resource === "offices" ? officesAdmin : resource === "counters" ? countersAdmin :
    resource === "request-types" ? servicesAdmin : null;
  if (!handler) throw new ApiError(404, "Administrative resource not found");
  const input = request.method === "GET" ? undefined : await body(request);
  if (input && request.method === "PATCH") input.action = "update";
  return handler(admin, params, input);
});

# CampusQueue API guide for frontend developers

The deployed backend is [campusqueue-api.vercel.app](https://campusqueue-api.vercel.app/). All endpoints in this guide start with `/api`. Use [the health endpoint](https://campusqueue-api.vercel.app/api/health) for a public smoke check.

## Deployment status

Checked on **26 November 2026 at 03:36 SGT** using read-only and invalid-input probes. The tables below describe the backend contract. A success example shows the expected shape when the deployment is configured and the caller has the required role.

| Deployed check | Observed response | Impact on frontend work |
| --- | --- | --- |
| `GET /api/health` | `200` with `success: true` and `version: "0.0.1"` | The API is reachable. This check does not exercise authentication or Firestore. |
| `POST /api/session` with `{}` | `503` with `{"error":"Firebase sign-in is not configured"}` | The deployment reports a sign-in configuration issue before it validates the refresh token. Ask the backend owner to check `FIREBASE_WEB_API_KEY` in Vercel. |
| `GET /api/me` with an invalid bearer token | `500` with `{"error":"Request could not be completed"}` | Expected `401`. The response does not identify the cause. Ask the backend owner to inspect the Vercel function logs and Firebase Admin environment. |
| `OPTIONS /api/auth` from `http://localhost:8081` | `204` with no `Access-Control-Allow-Origin` for that origin | The tested Expo web origin cannot call the API from a browser. The backend owner must configure the exact frontend origin in `ALLOWED_WEB_ORIGINS`. |

Live authenticated workflows were not verified in this check. Use the local emulator setup to develop against the API while the deployment is being configured. [Local backend setup](README.md#local-verification-and-vercel)

## Connect the frontend

For Expo, set the following in `campusqueue-mobile/.env` and restart the Expo server. Leave off `/api` because the existing client adds it.

```dotenv
EXPO_PUBLIC_CAMPUSQUEUE_API_URL=https://campusqueue-api.vercel.app
```

If the variable is unset, the existing Expo app uses demo data. Use the [existing API client](../campusqueue-mobile/src/context/useLiveQueue.ts) when extending that app. For another frontend, follow these request conventions.

- Send `Content-Type: application/json` for JSON bodies. For CSV imports send `text/csv` with the CSV itself as the body.
- Send `Authorization: Bearer <idToken>` on protected routes. Store session tokens using the platform's secure storage where persistence is needed. Keep tokens, passwords, and QR payloads out of logs and analytics.
- URL-encode query values such as `counter=Window 2` and pagination cursors. Treat IDs as opaque strings. For example, retain leading zeros in a USN.
- Check the HTTP status before using the body. API errors generally return `{"error":"…"}`. Unmatched routes and platform failures may return plain text.
- Use JSON parsing for ordinary responses. For CSV and PDF downloads, read the response as a file after checking its status.

Example authenticated request

```ts
const apiBase = "https://campusqueue-api.vercel.app";
const response = await fetch(`${apiBase}/api/offices`, {
  headers: { Authorization: `Bearer ${idToken}` },
});
const data = await response.json().catch(() => null);
if (!response.ok) {
  throw new Error(data?.error ?? `CampusQueue request failed (${response.status})`);
}
const { offices, nextCursor } = data;
```

## Authentication and role routing

| Endpoint | Access | Request and response |
| --- | --- | --- |
| `GET /api/health` | Public | Returns `success`, `message`, and `version`. |
| `POST /api/auth` | Public | Send `action: "sign-in"`, `loginId` (student USN or staff ID), and `password`. Returns `idToken`, `refreshToken`, `expiresIn`, and `role`. Staff responses also include a `staff` object with office and default counter information. |
| `POST /api/session` | Refresh token in the JSON body | Send `{ "refreshToken": "…" }`. Returns a new `idToken`, `refreshToken`, and `expiresIn`. Replace both stored tokens. |
| `GET /api/me` | Authenticated | Returns `{ success, uid, role, firestoreConnected }`. |
| `POST /api/password` | Authenticated | Send `currentPassword` and `newPassword`. The new password is 8–128 characters. Replace both tokens with the returned session because the old sessions are invalidated. |

```json
{
  "action": "sign-in",
  "loginId": "YOUR_PROVISIONED_USN_OR_STAFF_ID",
  "password": "YOUR_PASSWORD"
}
```

The token expiry is in seconds. Convert it with `Number(expiresIn)` before calculating expiry. Refresh once when a protected request fails because the session expired. If refresh fails with `401` or `403`, clear the session and show sign-in. Avoid automatically replaying a mutation unless the operation supports safe retry. A wrong current password on `/api/password` is a form error, even when it returns `401`. Signing out clears local session state. There is currently no logout endpoint.

Route `student` to the student portal, `staff` and legacy `registrar_staff` to the staff desk, and `admin` to the admin interface. Use the role for navigation only. The API also checks roles, account status, and office assignments on the server.

## Student portal

### Office selection and student data

| Endpoint | What the UI can read |
| --- | --- |
| `GET /api/offices` | `offices[]` and `nextCursor`. Use each office's `id`, `name`, `acceptingTickets`, `nowServing`, `waitingCount`, and `services[]`. Services include `id`, `name`, `duration` in minutes, and `docs`. A legacy office can omit `acceptingTickets`. Omission uses the backend's default of accepting requests. |
| `GET /api/student` | The signed-in student's `profile`, `activeTickets[]`, `historyTickets[]` (up to 100), and `notifications[]` (up to 50). Active passes include `id`, `ticketNumber`, `officeId`, `counter`, `service`, `qrPayload`, `aheadCount`, and `estWaitMins`. |

Display the returned queue position and wait estimate. Keep the Firestore ticket `id` for API calls and show `ticketNumber` to the user. Render the returned `qrPayload` as-is. Fetch it again after a requeue because the old QR becomes invalid.

### Student actions

Send one of the following actions to `POST /api/student` using the student's ID token.

| Action | Other JSON fields | Result |
| --- | --- | --- |
| `issue` | `officeId`, `serviceId` (preferred) or `serviceName`, `requestId`, optional `notes` | Returns `{ ticket }`. A student can hold one active ticket per office. |
| `cancel` | `ticketId`, `reason` | Returns `{ ticket: { id, status } }`. Only a waiting ticket can be cancelled. |
| `acknowledge` | `ticketId` | Returns `{ ticketId, acknowledgedAt }`. Valid for a called or serving ticket. Repeating the operation returns the same timestamp. |
| `preferences` | `pushAlerts` and/or `soundAndHaptics` as booleans | Saves the provided preferences and returns `{ success: true }`. |
| `read-notification` | `id` from the student's notification list | Marks one item read. Returns `{ success: true }`. |
| `read-all` | None | Returns `{ success, more }`. Call again while `more` is true to clear remaining entries. |

Example issue request body

```json
{
  "action": "issue",
  "officeId": "registrar",
  "serviceId": "reg-tor",
  "requestId": "a-unique-id-for-this-request"
}
```

Generate a new request ID for each intended ticket. Reuse the same ID and payload for a retry so a timeout does not create another ticket. Refresh the student snapshot and office list after a successful change.

Use `lifecycleStatus` for screen labels and action availability. The compatibility field `status` maps `called` to `serving` on active tickets and `no_show` to `Skipped` in history. When a student taps **I’m on my way**, call `acknowledge`. This action informs staff without starting service. Notifications are available in the in-app inbox. A preference called `pushAlerts` does not imply background push delivery.

## Staff desk

Use `/api/staff` for new work. The existing Registrar screen still uses `/api/registrar`, which is restricted to Registrar and retains some legacy lifecycle behavior.

1. Call `GET /api/staff?view=counters` after sign-in. It returns `officeId`, `defaultCounter`, and `counters[]` with each assigned counter's `id`, `name`, and `status`.
2. Call `GET /api/staff?counter=Window%202&includeLogs=false` for a desk refresh. It returns `officeId`, `counter`, `deskStatus`, `servingTicket` (or null), `waitingQueue[]`, and `transactions[]`. Omit `includeLogs=false` when opening the shift log. The queue has up to 100 entries, and the shift log has up to 250. Each log row includes `isMine`.
3. Pass the assigned counter ID as `counter` in actions, or omit it to use the account default. The API rejects other offices and unassigned counters. Staff ticket fields include `id`, `ticketNumber`, `status`, `isQrVerified`, `recallCount`, `startedAt`, and `acknowledgedAt`.

Send these actions to `POST /api/staff`.

| Action | Other JSON fields | Result |
| --- | --- | --- |
| `status` | `status` of `online`, `break`, or `closed` | Sets the counter's status. The API rejects closing a counter with an active ticket. |
| `call-next` | Optional `counter` | Calls the oldest waiting ticket at an empty, online counter. Returns `{ ticketId, ticket }`, with nulls for an empty queue. |
| `verify` | `qrPayload`, or `ticketNumber` plus four-digit `usnSuffix` | Returns `{ ticket }` with the verification result. A duplicate verification returns `409` on the shared staff route. |
| `start` | `ticketId` | Starts service for the called ticket and returns `ticketId`, `status`, and `startedAt`. |
| `recall` | `ticketId` and current `recallCount` | Returns the new recall count. A ticket has up to three recalls. |
| `complete` | `ticketId`, optional `remarks` and boolean `advance` | Completes a serving ticket. With `advance: true`, an online counter calls the next ticket. The response `ticketId` identifies the newly called ticket or is null. |
| `no-show` | `ticketId`, optional `reason` and boolean `advance` | Closes a called ticket when the office's configured grace period has elapsed. `skip` is an alias on `/api/staff`. |
| `requeue` | `ticketId` | Returns an eligible no-show ticket to the queue under the office policy, with `ticketId`, `requeueCount`, and `status`. The student must fetch the replacement QR. |

After a staff action, reload the desk before showing the next eligible actions. If a concurrent change produces `409`, reload before retrying. Poll only while the desk screen is active and request logs separately. Show the student's acknowledgment using `acknowledgedAt`; staff still need to start service.

## Admin interface and reports

Admin operations use `/api/admin?resource=<name>` with an admin token. This API is available to build an admin screen. The existing Expo UI has no admin dashboard.

| Resource | Frontend integration |
| --- | --- |
| `students`, `staff` | GET lists accounts and accepts `id` for detail, plus `search`, `archived=true`, `cursor`, and `limit` for lists. POST supports `create`, `update`, `archive`, `restore`, and `reset-password`. Account creation uses `loginId`, `fullName`, and `password`. Include `officeId` and assigned `counterIds` for staff. |
| `offices` | GET lists offices or takes `id` for detail. POST supports `create`, `update`, `archive`, and `restore`. To create, send `id`, `name`, and unique `prefix`. Other fields include `acceptingTickets`, `nearTurnThreshold`, `graceMinutes`, `requeueLimit`, and `requeuePlacement`. |
| `counters` | List by `officeId`, or add `id` for detail. Create or update with `officeId`, `id`, and a display `name` or `status`. Archive and restore use the same IDs. |
| `request-types` | List by `officeId`, or add `id` for detail. Create with `officeId`, `id`, `name`, and `duration` in minutes. Optional `description`, `docs`, and `available` fields support the student request form. |
| `activity-logs` | GET supports `startDate`, `endDate`, `actorId`, `action`, `officeId`, `targetId`, `ticketId`, `cursor`, and `limit`. Display it as a read-only activity feed. |
| `analytics` | GET returns `filters`, `generatedAt`, `timezone`, `summary`, and `groups`. Filter with `startDate`, `endDate`, `officeId`, `serviceId`, `counter`, and `status`. Add `format=csv` or `format=pdf` to download the report. |

List responses use `items` and `nextCursor` where pagination applies. Some filters can produce a short or empty page with a cursor. Continue until `nextCursor` is null. Use the account record `id` for edit or archive actions. Archived accounts remain available to admin filters and cannot sign in. The API can refuse archival while active tickets or counter assignments remain unresolved.

For CSV imports, send `POST` with `Content-Type: text/csv` to the `students` or `staff` resource. Use the headers `loginId,fullName,password` and add `officeId` for staff. The limit is 30 rows and 32 KiB. The response contains `total`, `imported`, `failed`, and `results[]` with row-level outcomes. Display partial success and let the operator fix failed rows.

Reports use **Asia/Manila** calendar dates in `YYYY-MM-DD` form. The default is the current Manila day, and the maximum date range is 31 days. Analytics group tickets by issuance date. Timing means can be null when the data lacks usable timestamps. The API returns `422` for overly broad exports. For staff reports, use `GET /api/staff?format=csv&counter=Window%202` or set `format=pdf`.

For downloads, check `Content-Type` (`text/csv` or `application/pdf`). Read the body as a file and use `Content-Disposition` for its name when available. Keep a fallback filename because the browser API may not expose that header on a cross-origin response.

## Error handling checklist

| Status | Recommended UI behavior |
| --- | --- |
| `400` | Show the validation message next to the relevant form or field. |
| `401` | Show a sign-in error for credentials, or refresh an expired protected session once. |
| `403` | Show an access or assignment message. Avoid retrying with the same session. |
| `404` | Show the missing or unavailable item and refresh the appropriate queue or catalogue. |
| `409` | Reload the affected state before offering a retry. Ticket conflicts can mean it was already assigned, already verified, or no longer eligible. |
| `413` / `422` | Ask the user to reduce the upload or narrow the report filters. |
| `429` | Pause repeated sign-in attempts and let the user try later. |
| `500` / `503` | Show a service error. For failed ticket issuance, reuse the original `requestId` only when retrying the same payload. |

For deployment and Firebase setup, see the [backend README](README.md). For the full unauthenticated probe responses, see the [deployed API test report](DEPLOYED_API_TEST_REPORT.md).

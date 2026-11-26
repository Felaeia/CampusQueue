# CampusQueue live backend

The Vercel project uses the repository's `campusqueue-api` directory. Use Node.js 24 or later for the local migration scripts. `npm run migrate` previews schema changes. Apply them only to the intended project using the explicit command under [Database migration](#database-migration).

| Firestore path | Contents |
| --- | --- |
| `offices/{officeId}` | Service catalogue, ticket sequence, and queue counters |
| `offices/{officeId}/waiting/{ticketId}` | Ordered waiting queue |
| `offices/{officeId}/counters/{counterId}` | Counter status, serving ticket, and staff member who called it |
| `offices/{officeId}/logs/{entryId}` | Completed, skipped, and no-show shift entries |
| `tickets/{ticketId}` | Ticket lifecycle, student owner, and QR proof |
| `users/{uid}` | Provisioned role, profile, preferences, and active tickets |
| `users/{uid}/history/{ticketId}` | Ordered student archive |
| `users/{uid}/notifications/{id}` | In-app alerts and read status |
| `users/{uid}/requests/{requestId}` | Ticket issuance idempotency records |
| `loginIds/{normalizedId}` | Mapping from staff ID or USN to Firebase Auth UID |
| `credentials/{uid}` | Salted password hash, credential version, and sign-in limits |
| `officeCodes/{prefix}` | Transactional reservation of a queue-number prefix |
| `activityLogs/{eventId}` | Administrative audit trail with server timestamps and allowlisted metadata |
| `schemaMigrations/{version}` | Applied migrations |

The files in `api/` contain HTTP handlers. Domain logic, authorization, reporting, and Firestore queries live in `lib/`. The files in `migrations/` are operator commands. Request types live in the existing office service catalogue, which is capped at 50 entries. Ticket issues snapshot the office name and code and the request type name, description, documents, and duration. Direct client access to Firestore is denied by the supplied rules. The Vercel API validates Firebase ID tokens against the current account profile, including its role, status, and credential version.

## Configure sign-in

1. Set the Admin variables from `.env.example` and `FIREBASE_WEB_API_KEY` for the API in Vercel and in the local API `.env`. Set `ALLOWED_WEB_ORIGINS` to the exact Expo web origins you use, such as `http://localhost:8081`.
2. Save each private account JSON outside the repository and run `npm run provision -- C:/path/to/profile.json` from `campusqueue-api`. To attach a pre-existing account, provide its optional Firebase `uid`. Otherwise, Firebase creates its Auth user on first sign-in.
3. Users sign in with a USN or staff ID and password. The API verifies a salted scrypt hash and exchanges a Firebase custom token for a session. Firebase Email/Password can stay disabled.

Example Registrar profile file

```json
{
  "password": "Set a unique initial password",
  "loginId": "STAFF_ID",
  "fullName": "Staff member name",
  "role": "registrar_staff",
  "defaultCounterWindow": "Window 2"
}
```

A student profile uses `role: "student"` and the student's USN as `loginId`. Optional student fields include `studentId`, `holderShort`, `program`, `institution`, `campusShort`, and a contact `email`.

Signed-in users can change their own password. For a forgotten password, an administrator updates the private account JSON with a new password and reruns `npm run provision -- C:/path/to/profile.json --reset-password`. Add `--demo` when resetting a demo account. A password change invalidates previous CampusQueue sessions.

### Demo accounts

In a development environment, set `ENABLE_DEMO_LOGIN=true` and run `npm run seed:demo`. This provisions `EMP-1042`, `EMP-1043`, and `23000440130` using their existing frontend credentials. Reruns preserve changed passwords. Only the explicitly seeded demo accounts require this setting.

## Connect the frontend

Set `EXPO_PUBLIC_CAMPUSQUEUE_API_URL` in the mobile app's local `.env` to the Vercel base URL, without `/api`. For a local API use `http://localhost:3000` on web or a network-reachable host on a physical device. Restart Expo after changing the variable. With an API URL, the app requires a provisioned Firebase account, signs in with a USN or staff ID, and polls the API every five seconds. Without an API URL, it runs the existing demo.

The existing Expo staff screen uses the legacy Registrar route. The shared staff API serves Accounting, Student Affairs, and any configured office. See [Frontend integration](#frontend-integration) for the screens that need to adopt the new functions. Session tokens are held in memory. Alerts are available through the in-app inbox.

## API functions

Open `/api-tester.html` on the backend origin, for example `http://localhost:3000/api-tester.html` with `vercel dev` running. Search for a route or action and select a preset to edit its query, JSON or CSV body, and bearer token. Each run checks the HTTP status and content type and displays the actual response alongside the example. Protected presets require a token for the indicated role. Queue and admin actions that change data also require records in the appropriate state. The page keeps tokens from successful sign-in, refresh, and password-change requests in memory for the current page.

Send JSON with `Content-Type: application/json` for POST requests. Protected routes also require `Authorization: Bearer <idToken>` with the token returned by sign-in or refresh. Successful requests return HTTP `200` with JSON.

### Sign-in and shared routes

| Route | Access | What it does |
| --- | --- | --- |
| `GET /api/health` | Public | Confirms the API process is responding. Returns `success`, `message`, and `version`. |
| `POST /api/auth` | Public | Accepts `action: "sign-in"`, `loginId` (USN or staff ID), and `password`. Returns `idToken`, `refreshToken`, `expiresIn` in seconds, and `role`. Registrar staff also receive a `staff` profile. Repeated attempts can return `429`. |
| `POST /api/session` | Refresh token in the body | Accepts `refreshToken` and returns a fresh `idToken`, `refreshToken`, and `expiresIn`. Use the returned tokens for subsequent requests. |
| `POST /api/password` | Student or Registrar staff | Accepts `currentPassword` and `newPassword` (8–128 characters). Changes the signed-in user's password, invalidates their previous sessions, and returns a fresh token pair and `expiresIn`. |
| `GET /api/me` | Student or Registrar staff | Returns `uid`, `role`, `success`, and `firestoreConnected` after verifying the session and reading Firestore. |
| `GET /api/offices` | Student or Registrar staff | Returns `offices` with each office's ID, available services, current ticket, and waiting count. Use the service name from this response when requesting a ticket. |

### Student tickets and notifications

Both student routes require the `student` role. `GET /api/student` returns the signed-in student's `profile`, `activeTickets`, `historyTickets` (latest 100), and `notifications` (latest 50). Waiting tickets include the number of tickets ahead and an estimated wait. The response includes `lifecycleStatus` and keeps `status: "serving"` for a called ticket so older Expo versions still open the turn alert. Ticket history includes completed, skipped, and cancelled tickets.

Send an `action` field with one of the following values to `POST /api/student`.

| Action | Other JSON fields | Effect |
| --- | --- | --- |
| `issue` | `officeId`, `serviceId` or `serviceName`, `requestId`, optional `notes` | Adds a waiting ticket and returns it under `ticket`. A student can hold one active ticket per office. Reuse the same `requestId` and fields when retrying the original request. Use a new ID for a new ticket. |
| `cancel` | `ticketId`, `reason` | Cancels the student's waiting ticket, removes it from the queue, and adds it to history. Returns `ticket` with its `id` and status. |
| `acknowledge` | `ticketId` | Records that the student is on their way for a called or serving ticket. Retries return the original acknowledgment timestamp. |
| `preferences` | `pushAlerts` and/or `soundAndHaptics` as booleans | Saves the provided preferences and returns `success`. |
| `read-notification` | `id` | Marks one of the student's inbox entries as read and returns `success`. |
| `read-all` | None | Marks up to 500 unread inbox entries as read. Returns `success` and `more`. If `more` is true, call it again to clear any remaining entries. |

Example request body for issuing a Registrar ticket

```json
{
  "action": "issue",
  "officeId": "registrar",
  "serviceName": "TOR Request",
  "requestId": "a-unique-request-id"
}
```

### Legacy Registrar desk and shift log

Both Registrar routes require a staff account assigned to Registrar. The existing `registrar_staff` profile role is accepted for compatibility. `GET /api/registrar?counter=Window%202` returns `counter`, `deskStatus`, `servingTicket`, `waitingQueue`, and `transactions` for the current shift. The queue is shared across Registrar counters, and the shift log identifies the signed-in staff member's entries with `isMine`.

For `POST /api/registrar`, send an `action` and the fields below. You can send a `counter` of `Window 1`, `Window 2`, or `Window 3`. Both methods use the staff account's default counter when this field is omitted.

| Action | Other JSON fields | Effect |
| --- | --- | --- |
| `status` | `status` set to `online`, `break`, or `closed` | Updates and returns the counter status. Finish the serving ticket before closing the counter. |
| `call-next` | None | Calls the oldest waiting ticket at an online, empty counter and sends the student an in-app alert. Returns `ticketId`, or `null` if the queue is empty. |
| `recall` | `ticketId`, current `recallCount` from the desk response | Alerts the student again and returns the updated `recallCount`. A serving ticket can be recalled up to three times. |
| `complete` | `ticketId`, optional `remarks` and boolean `advance` | Completes the serving ticket and records it in the student history and shift log. With `advance: true`, an online counter also calls the next ticket. Returns the newly called `ticketId` or `null`. |
| `skip` | `ticketId`, optional `reason` | Records a legacy skip, or applies the no-show rules if the office has configured a grace period. When online, the counter also calls the next ticket if one is waiting. |
| `verify` | `qrPayload` from a scan, or `ticketNumber` and four-digit `usnSuffix` | Verifies the ticket currently being served at the selected counter and returns it under `ticket` with the verification result and method. |

For `recall`, `complete`, and `skip`, use the serving ticket's `id` as `ticketId`. Manual verification uses the displayed `ticketNumber` instead.

### Common errors

Error responses include an `error` message. Use `400` to identify missing or invalid fields, `401` for failed authentication, and `403` when the signed-in account lacks access. A `404` means the requested item was unavailable. A `409` means the action conflicts with the current state. A `422` can indicate that a report needs a narrower date range or filter. For queue actions, reload the relevant view before retrying.

### Multi-office staff API

The shared endpoint is `GET /api/staff` and `POST /api/staff`. Both use the authenticated staff account's current office assignment. A supplied `officeId` must match that assignment. A supplied `counter` must be assigned to the account. Omit it to use the default counter. Use `GET /api/staff?view=counters` to discover the assigned counters. The desk GET accepts `includeLogs=false` for polling without the shift log.

The shared endpoint supports the legacy action names with the following lifecycle rules.

| Action | Fields besides `action` | Result |
| --- | --- | --- |
| `call-next` | Optional `counter` | Changes the oldest waiting ticket to `called`. Returns `ticketId` and a staff ticket view, or nulls if the queue is empty. |
| `start` | `ticketId`, optional `counter` | Moves a called ticket to `serving` and records when service began. |
| `complete` | `ticketId`, optional `advance` and `remarks` | Completes a serving ticket. Set `advance: true` to call the next ticket at an online counter. |
| `no-show` | `ticketId`, optional `advance` and `reason` | Closes a called ticket once the configured grace period has elapsed. `skip` is an alias on the shared route. |
| `requeue` | `ticketId` | Returns an eligible no-show ticket to the configured position, keeps the ticket number, and replaces its QR token. The earlier no-show remains in the shift log and student history. |
| `verify` | `qrPayload`, or `ticketNumber` and `usnSuffix` | Verifies the active ticket at the assigned counter. A repeated verification returns `409` without another side effect. |

The legacy Registrar client can still complete a called ticket and its first successful scan starts service. Both routes enforce a configured grace period for no-show handling. Where no grace period is configured, the legacy Registrar route retains its earlier manual skip behavior. `GET /api/staff?format=csv` or `format=pdf` downloads the assigned counter's shift report. Include `startDate`, `endDate`, and optionally `counter`.

Calls and state changes recheck account authorization inside the Firestore transaction. Calling a ticket updates the queue entry, ticket, counter, alert, and audit entry together. Firestore retries conflicts between concurrent requests. The counter and ticket checks run again before any retry can commit.

Set `nearTurnThreshold` on an office to the maximum number of tickets ahead for a near-turn alert. A value of zero alerts the first waiting ticket, and null disables the feature. Issuance, cancellation, calling, and requeueing evaluate eligibility. A persistent ticket flag prevents repeat alerts across retries and requeues. Students can acknowledge a called or serving ticket through the student action, and staff see `acknowledgedAt` in the desk response. Acknowledgment records intent and leaves the grace period and service state as they were.

### Administrator API

All administrator functions use `/api/admin?resource=<resource>` with an admin bearer token. Use GET to list or retrieve. Send POST with an `action` for mutations. PATCH performs an update and takes the record ID in the JSON body.

| Resource | GET options | POST actions |
| --- | --- | --- |
| `students`, `staff` | `id` for detail, or list with `search`, `archived=true`, `cursor`, and `limit` | `create`, `update`, `archive`, `restore`, `reset-password`, or CSV import |
| `offices` | `id` for detail or a paginated list | `create`, `update`, `archive`, `restore` |
| `counters` | `officeId` and optional `id`, or a paginated list | `create`, `update`, `archive`, `restore` |
| `request-types` | `officeId` and optional `id` | `create`, `update`, `archive`, `restore` |
| `activity-logs` | `startDate`, `endDate`, `actorId`, `action`, `officeId`, `targetId`, `ticketId`, `cursor`, `limit` | Read-only |
| `analytics` | `startDate`, `endDate`, `officeId`, `serviceId`, `counter`, `status`, optional `format=csv` or `format=pdf` | Read-only |

Lists return `items` and `nextCursor` where pagination is available. Search, archival and secondary audit filters can produce a short or empty page; continue until `nextCursor` is null. `archived=true` includes archived records. Dates use `YYYY-MM-DD`.

A new office requires `id`, `name`, and a unique `prefix`. Optional policy fields are `nearTurnThreshold`, `graceMinutes`, `requeueLimit`, and `requeuePlacement` (`tail` or `original`). A counter requires `officeId` and `id`, and accepts a display `name` and operational `status`. A new request type requires `officeId`, `id`, `name`, and `duration` in minutes, and accepts `description`, `docs`, and `available`. Restoring an office or request type leaves ticket issuance disabled until an administrator reopens it. Archival rejects unresolved queue or counter assignments. Disabling new ticket issuance lets existing tickets finish.

For account creation, supply `loginId`, `fullName`, and `password`. Staff also require `officeId`; pass `counterIds` and optionally `defaultCounterWindow` to assign counters. The endpoint determines the role from the resource. Use the provisioning command with `--reset-password --change-role` for an intentional role change. Ordinary admin endpoints manage student and staff accounts and do not grant admin roles or operate staff counters. Roles and office assignments come from Firestore, never from the role claimed by a client request.

For CSV import, POST `text/csv` to the student or staff resource. Required headers are `loginId,fullName,password` plus `officeId` for staff. Optional fields include `firstName`, `middleName`, `lastName`, `email`, `program`, and `yearLevel`. Staff can include `counterIds` separated by semicolons and `defaultCounterWindow`. Imports accept up to 30 rows and 32 KiB. The response includes `total`, `imported`, `failed`, and a result for each row. A failed row leaves the successful rows in place.

### Analytics definitions

Reports use Asia/Manila calendar days and select a cohort by ticket issuance date. Filters accept a 31-day range, one office ID, one service ID, an assigned counter, or a status. Reports include totals, rates, and groups by office, request type, day, and counter. Queue volume and current waiting counts describe the selected cohort. The counter filter requires that a ticket was called, so waiting tickets do not appear under a display-only default counter.

- Waiting time is the interval from original issuance to actual service start. Service time runs from actual service start to completion. Records without valid timestamps are excluded from these means. Sample counts accompany the means in JSON.
- Completion, cancellation, and no-show rates use the ticket's current outcome divided by the number issued in the cohort. Rates are percentages and return null for an empty cohort.
- A requeued ticket stays in its original issuance cohort. Its final status is counted once. The separate `noShowEvents` metric counts qualifying no-show events even when a ticket was later served. Historical manual skips remain a separate outcome.
- Older tickets can lack a request type ID or start time. Their historic names are displayed where available. ID-specific filters omit tickets without a known ID, and timing reports exclude samples without actual start timestamps.
- To bound Firestore reads and export size, narrow reports above 1,500 tickets or shift exports above 500 entries.

## Database migration

On Windows, run `.migrate-firestore.bat` from `campusqueue-api`. The batch file uses `FIREBASE_PROJECT_ID` from the API environment, displays a dry run, and applies changes only after you type the exact displayed ID. Press Enter to cancel. This works with a single production Firebase project from a local terminal.

You can run the same workflow on any platform with `npm run migrate -- --interactive`. For a read-only preview or a non-production apply without a prompt, use the commands below.

```sh
npm run migrate -- --dry-run
npm run migrate -- --apply YOUR_STAGING_FIREBASE_PROJECT_ID
```

The migration adds missing counters for Accounting and Student Affairs, records office-code reservations, and backfills eligible Registrar staff with their known default counter. It keeps existing IDs, QR payloads, queue numbers, and history. Legacy staff with an unknown assignment are reported for manual review. Existing tickets are not rewritten. The compatibility API reads historical records without inventing dates or request type IDs.

Use `firestore.indexes.json` for the composite indexes used by audit filters, service archival, analytics, and shift export. Use `firestore.rules` for deployments that access Firestore exclusively through this API. Once you have confirmed the target is the intended staging project, deploy and wait for indexes to finish building.

```sh
firebase deploy --only firestore:rules,firestore:indexes --project YOUR_STAGING_FIREBASE_PROJECT_ID
```

Take an approved snapshot of impacted documents before a migration if rollback is required. The migration is additive. Roll back code first once in-flight requests have finished, then review affected data before reverting individual configuration fields. An older backend will not understand new called or no-show states, so rolling it back after new lifecycle writes requires draining or reconciling affected queues.

## Local verification and Vercel

Run `npm run typecheck` from `campusqueue-api`. For local Firebase development, start the Firebase Local Emulator Suite with Java and the Firebase CLI installed.

```sh
firebase emulators:start --only auth,firestore --project demo-campusqueue
```

In a second PowerShell session in the same directory, configure the API to use both emulators.

```powershell
$env:FIREBASE_PROJECT_ID = 'demo-campusqueue'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
```

The API requires a `demo-` project and loopback hosts when using the emulators. Run `npx vercel build` for a local build of the Vercel functions. For a staging deployment, configure the API project with the `campusqueue-api` root and the environment variables in `.env.example`. Set `FIREBASE_PRODUCTION_PROJECT_ID` on Vercel Preview so the backend can reject Preview requests that target the production Firestore project. Use separate Firebase service accounts and Web API keys for staging and production.

The backend runs in Vercel Functions with no resident worker. Near-turn messages are written to the in-app inbox during queue operations. No background push sending or automatic expiration is configured. Account lists, shift reports, and analytics are bounded to conserve the Spark read/write budget. The Expo client's existing five-second polling can use staff `includeLogs=false` during desk refreshes, with logs fetched when their screen opens.

## Frontend integration

- Continue using `/api/student` and `/api/registrar` for the existing student and Registrar screens. Connect **I'm on my way** to the student `acknowledge` action and display `lifecycleStatus` when adopting the richer states.
- Route `staff` and legacy `registrar_staff` logins to the shared staffed interface, and route `admin` to a new admin interface. Load assigned counters from the staff API rather than showing a fixed list. Send `start`, `no-show`, and `requeue` on the shared staff endpoint.
- Use IDs returned by the office catalog. Staff and office selections must support newly created IDs. Use the response's actual MIME type and download filename when replacing the existing plain-text shift share with file exports.
- Define institutional grace periods, requeue limits, and queue placement before using no-show or requeue at an office. Student self-registration still requires a project decision and an approved roster. Push notifications remain a separate decision if alerts must reach closed apps.

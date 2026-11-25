# CampusQueue live backend

The Vercel project uses the repository's `campusqueue-api` directory. Use Node.js 24 or later for the local migration scripts. `npm run migrate` seeds the configured Firestore database and can be rerun safely. It creates records only where they are absent.

| Firestore path | Contents |
| --- | --- |
| `offices/{officeId}` | Service catalogue, ticket sequence, and queue counters |
| `offices/{officeId}/waiting/{ticketId}` | Ordered waiting queue |
| `offices/registrar/counters/{window}` | Desk status and currently serving ticket |
| `offices/registrar/logs/{ticketId}` | Completed and skipped shift transactions |
| `tickets/{ticketId}` | Ticket lifecycle, student owner, and QR proof |
| `users/{uid}` | Provisioned role, profile, preferences, and active tickets |
| `users/{uid}/history/{ticketId}` | Ordered student archive |
| `users/{uid}/notifications/{id}` | In-app alerts and read status |
| `users/{uid}/requests/{requestId}` | Ticket issuance idempotency records |
| `loginIds/{normalizedId}` | Mapping from staff ID or USN to Firebase Auth UID |
| `credentials/{uid}` | Salted password hash, credential version, and sign-in limits |
| `schemaMigrations/{version}` | Applied migrations |

Queue and history documents support single-field Firestore indexes. All changes to ticket ownership, queue order, desk state, archive entries and alerts use server-side transactions. Client access goes through Vercel Functions using Firebase ID tokens and roles from provisioned Firestore profiles. Keep direct Firestore client access restricted.

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

The live desk serves Registrar tickets. Accounting and Student Affairs have service catalogues and can accept student ticket requests, but their staff desks are outside the current frontend. Session tokens are held in memory. Alerts appear in the in-app inbox. The shift share action still shares text.

## API functions

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

Both student routes require the `student` role. `GET /api/student` returns the signed-in student's `profile`, `activeTickets`, `historyTickets` (latest 100), and `notifications` (latest 50). Waiting tickets include the number of tickets ahead and an estimated wait. Ticket history includes completed, skipped, and cancelled tickets.

Send an `action` field with one of the following values to `POST /api/student`.

| Action | Other JSON fields | Effect |
| --- | --- | --- |
| `issue` | `officeId`, `serviceName`, `requestId`, optional `notes` | Adds a waiting ticket and returns it under `ticket`. A student can hold one active ticket per office. Reuse the same `requestId` and fields when retrying the original request. Use a new ID for a new ticket. |
| `cancel` | `ticketId`, `reason` | Cancels the student's waiting ticket, removes it from the queue, and adds it to history. Returns `ticket` with its `id` and status. |
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

### Registrar desk and shift log

Both Registrar routes require the `registrar_staff` role assigned to the Registrar office. `GET /api/registrar?counter=Window%202` returns `counter`, `deskStatus`, `servingTicket`, `waitingQueue`, and `transactions` for the current shift. The queue is shared across Registrar counters, and the shift log identifies the signed-in staff member's entries with `isMine`.

For `POST /api/registrar`, send an `action` and the fields below. You can send a `counter` of `Window 1`, `Window 2`, or `Window 3`. Both methods use the staff account's default counter when this field is omitted.

| Action | Other JSON fields | Effect |
| --- | --- | --- |
| `status` | `status` set to `online`, `break`, or `closed` | Updates and returns the counter status. Finish the serving ticket before closing the counter. |
| `call-next` | None | Calls the oldest waiting ticket at an online, empty counter and sends the student an in-app alert. Returns `ticketId`, or `null` if the queue is empty. |
| `recall` | `ticketId`, current `recallCount` from the desk response | Alerts the student again and returns the updated `recallCount`. A serving ticket can be recalled up to three times. |
| `complete` | `ticketId`, optional `remarks` and boolean `advance` | Completes the serving ticket and records it in the student history and shift log. With `advance: true`, an online counter also calls the next ticket. Returns the newly called `ticketId` or `null`. |
| `skip` | `ticketId`, optional `reason` | Records the serving ticket as skipped and, when the counter is online, calls the next ticket. Returns the newly called `ticketId` or `null`. |
| `verify` | `qrPayload` from a scan, or `ticketNumber` and four-digit `usnSuffix` | Verifies the ticket currently being served at the selected counter and returns it under `ticket` with the verification result and method. |

For `recall`, `complete`, and `skip`, use the serving ticket's `id` as `ticketId`. Manual verification uses the displayed `ticketNumber` instead.

### Common errors

Error responses include an `error` message. Use `400` to identify missing or invalid fields, `401` for failed authentication, and `403` when the signed-in account lacks access. A `404` means the requested item was unavailable. A `409` means the action conflicts with the current state. For queue actions, reload the relevant view before retrying.

# CampusQueue merge verification

## A. Merge summary

| Item | Result |
| --- | --- |
| Destination | `codex/mobile-backend-integration` at `5a528d1` |
| Source | `origin/staging` at `a6387f9` |
| Common ancestor | `ec3e736` |
| Operation | Continued the ordinary two-parent merge already in progress |
| Initial conflicts | 28 files, including two modify/delete conflicts |
| Backup refs | `codex/backup-mobile-before-merge` and `codex/backup-staging-merge-input` |
| Local change | The unrelated root `.env.example` edit was excluded from the merge |
| Added during resolution | Backend-only demo seed fixture, expanded Firebase emulator regression test, wait-time tests, this report |
| Distribution | Local merge only, with no push or deployment |

Use `git log --merges --first-parent -1 --format="%H %P"` on the destination branch to see the resulting merge commit and its parents.

## B. Conflict resolution

Paths in this table are relative to `campusqueue-mobile/src`.

| File | Destination intent | Staging intent | Resolution |
| --- | --- | --- | --- |
| `app/admin/_layout.tsx` | Role guard while restoring | Live route guard with loading feedback | Kept staging screen with the shared secure-session state. |
| `app/admin/dashboard.tsx` | Live analytics and unsupported broadcast feedback | Focus refresh, skeletons, and telemetry | Kept staging UI and live contract. Labeled the chart by the API's daily grouping. |
| `app/admin/offices.tsx` | Office route focus and live mutation handling | Scoped sync errors, retry and skeleton | Combined. Deep-linked expansion can be toggled, and office errors retain the previous catalog. |
| `app/admin/reports.tsx` | Server-filtered activity and binary export | Dedicated logs loading, scoped retry and filters | Combined. Query results are versioned and independent of dashboard polling. Exports remain actual CSV/PDF files. |
| `app/auth/login.tsx` | Validated sign-in, retry saved session, secure native remember option | Keep-signed-in and restored role routing | Selected the destination login form with the merged session facade. |
| `app/staff/_layout.tsx` | Both staff roles and session guard | Restoring-session feedback | Combined through shared state. |
| `app/staff/logs.tsx` | Scoped binary shift export | Readable live logs, search, filters and requeue | Combined. Prefer the returned ticket ID, with support for historical log IDs. |
| `app/staff/registrar.tsx` | Assigned counters, separate start and complete actions | Multi-office desk, final outcomes and advance controls | Combined with focus-bound requests, real counter IDs, and backend outcome policies. |
| `app/staff/scanner.tsx` | Single verification per scan and explicit desk navigation | Scanner outcome selector and remarks | Combined. Finalization checks that the verified pass is still at the selected counter. |
| `app/student/_layout.tsx` | Student role guard | Restoring-session feedback | Combined through shared state. |
| `app/student/history.tsx` | Real receipts and request-again action | Scoped refresh, timestamps and empty/error states | Kept staging view wired to the merged student requests. |
| `app/student/home.tsx` | API office availability, active conflict checks and refresh | Catalog selection by service ID and persistent operation ID | Combined with focus-bound polling and the server's issue contract. |
| `app/student/profile.tsx` | Real password change and preferences | Shared validation and live profile | Kept staging UI and confirmed-write preference feedback. |
| `app/student/ticket.tsx` | Server status, waiting-only cancellation and real QR | Normalized ticket display, sync status and formatted times | Combined. Server values take precedence for position and estimates. |
| `components/TicketBarcode.tsx` | Pure SVG offset calculation | Require an explicit barcode pattern | Combined. |
| `components/TurnCalledAlertModal.tsx` | Acknowledge only on server success | Acknowledgment spinner | Combined. Closing the modal does not send acknowledgment. |
| `components/admin/EditUserRoleAndOfficeModal.tsx` | Real counter IDs, validation and pending/error handling | Counter selection from offices | Kept the ID-based form and omitted guessed counter labels. |
| `components/admin/ProvisionStaffOrAdminModal.tsx` | Pending/error handling and operator-supplied password | Live provisioning and updated placeholders | Kept the pending form with the real staging provisioning contract. |
| `components/admin/ResetUserPasswordModal.tsx` | Secure new password entry and in-form status | Live reset validation | Kept the explicit-password form. |
| `components/home/RequestTicketSheet.tsx` | Reset form per office and block repeated submissions | Service IDs and reusable operation ID | Combined. The key stays stable for retries of an unchanged request. |
| `components/login/FirstLoginPasswordModal.tsx` | Already disconnected demo form | Removed the demo form | Accepted deletion. Real password changes use `/api/password`. |
| `components/login/ForgotPasswordModal.tsx` | Already disconnected simulated recovery | Removed the demo form | Accepted deletion. Login directs users to an administrator for recovery. |
| `context/AdminContext.tsx` | Binary downloads, real identifiers and activity records | Scoped admin errors, pagination and background sync | Combined. Separate request versions keep date-filtered audit results from being overwritten. |
| `context/QueueContext.tsx` | Focus-bound sync, confirmed writes, byte downloads | Shared constants and staff outcomes | Combined with one live client and session lifecycle. |
| `context/StaffQueueContext.tsx` | Scoped desk and report state | Cancellation, requeue and scanner facade | Kept staging facade using the merged queue provider. |
| `context/useLiveQueue.ts` | Native SecureStore, refresh token only, serialized writes, reduced polling reads | Counter outcomes, normalization, poll backoff and role/loading feedback | Reconciled around the existing token and transport contract. Added staged capabilities without storing bearer tokens in browser storage. |
| `types/queue.ts` | Backend-authoritative queue fields | Lifecycle, service ID, operation ID and notification metadata | Kept staging superset and compatibility fields. |
| `types/staff.ts` | Real staff roles and counter state | Cancellation, requeue metadata and verified pass ID | Combined, with optional `ticketId` on shift records for older deployments. |

The cleanly merged backend changes were reviewed too. Automatic service starts on issue, counter activation, and an advancing write. Desk GET remains read-only so a refresh cannot take an action or override `advance:false`. A waiting QR can start the next eligible ticket at a free online counter, but cannot jump an earlier ticket. No-show closes still enforce configured grace rules, even when a ticket was automatically marked serving. Manual and QR verification remain scoped to the staff member's assigned office and counter. Duplicate client implementations and the raw JWT decoder were excluded because the merged app already gets token TTL and account identity from authenticated responses.

## C. Significant commit updates

| Commits | Update and final implementation | Verification |
| --- | --- | --- |
| `5a528d1`, `cc4bd09`, `7db2069`, `f01c076`, `ce05ce2` | One environment-configured JSON/binary client with deadlines, normalized errors and authorized requests. Staging's variable alias is supported. No silent production-origin fallback. | Transport unit tests, browser offline recovery, Vercel smoke and emulator authorization |
| `0ed26a8`, `e4ff0d6` | Preserve native remember and restore. The API returns TTL and role, native storage is origin-bound and browser sessions remain in memory. | Refresh/role verified against emulators. Native restart remains unverified. |
| `5162442` | Foreground polling is serialized with backoff. Larger history/shift reads only run when relevant. Admin uses bounded telemetry polling and scoped audit retrieval. | Static review, browser role routing, emulator closure history |
| `2c2c635`, `36d4e32`, `fcc363e`, `ad0ece2`, `49c08f2` | Keep mock branches and default QR fallbacks out of runtime. Preserve explicitly enabled backend demo tooling with a backend-only fixture. | Runtime imports and conflict-marker scans, browser/API flows |
| `6b53094`, `d1bdbd9`, `153d9e8`, `9a7ee4d` | Live catalog, issue/cancel, notification and history displays, Manila times, and estimated waits. Staging per-office estimates supplement missing estimates without changing server position. | Wait-time unit tests, emulator lifecycle and browser student flow |
| `df46d20`, `dfcd4a5`, `0dae1da` | Multi-office staff desk, verification, requeue and real shift exports. | Emulator counter scope, QR and requeue, report bytes, browser desk/logs/scanner navigation |
| `aaee52f`, `6e253aa`, `39a26fe`, `c03e9a8`, `b81e18c` | Staging admin UI, scoped retry and live forms, combined with binary downloads and real counter IDs. | Browser admin tabs, emulator office/counter/service operations and export bytes. Some admin form mutations still need dedicated checks. |
| `243a074`, `8f485a2`, `f5bc2a5` | Auto-start on explicit writes, scope-aware rescans and queue ordering retained. Read-triggered mutation excluded. | Emulator automatic service, rescans, stale QR rejection and concurrent counters |
| `204722c`, `c1b8bcf`, `9f71f10` | Staff cancellation and final outcome control, including scanner outcome remarks. | Staff cancellation and history verified on emulator. Native scan/outcome UI remains unverified. |

## D. Backend integration

| Functionality | Actual endpoint | Result |
| --- | --- | --- |
| Login, refresh, identity and password | `POST /api/auth`, `POST /api/session`, `GET /api/me`, `POST /api/password` | Connected. Emulator auth, restore contract and credential invalidation passed. |
| Catalog | `GET /api/offices` | Connected. Registrar, Accounting and Student Affairs returned. |
| Student queue, history, notifications and preferences | `GET/POST /api/student`, including `view=active` | Connected. Emulator writes, active lookup, history and inbox reads passed. |
| Staff verification, queue, counter status and outcomes | `GET/POST /api/staff`, including `view=counters` | Connected. Emulator lifecycle, policy and scoped authorization passed. |
| Staff and admin CSV/PDF | `GET /api/staff?format=…`, `GET /api/admin?resource=analytics&format=…` | Connected. Emulator returned non-empty bytes for both formats. |
| Admin office, counter, service, users and activity | `/api/admin` corresponding resources | Connected. Office/counter/service API tests and browser tab navigation verified. |

The documented Vercel deployment returned HTTP 200 with JSON from `/api/health`. Unauthenticated GETs to `/api/me`, `/api/staff?view=counters` and `/api/student?view=active` returned JSON HTTP 401. Without dedicated remote staging credentials, those checks establish availability and the auth boundary only. The authenticated merge-specific response fields and outcomes were verified against the merged handlers and Firebase emulators. Deploy the API and app together to an approved staging project to verify deployment parity.

## E. Functional verification

| Test | Expected | Observed |
| --- | --- | --- |
| Mobile unit suite | Correct deadlines, error parsing, scope of estimates and position | Six API client and wait-time tests passed. |
| Firebase Auth/Firestore HTTP integration | Real persisted queue lifecycle, duplicate rejection, session and office scope | Passed issue/cancel, active lookup, staff status auto-promotion and issue auto-promotion, verify/rescan, completion, staff cancellation, grace rejection, no-show/requeue QR rotation, two counters calling concurrently, preference/notification persistence, report bytes and archival rejection. |
| Expo web smoke at 390 × 844 | Protected route guards, sign-in, offline recovery and role navigation | Against the emulators, student/staff/admin valid and invalid sign-in, student issue/cancel and offline recovery, and staff/admin navigation passed. |
| Demo seed CLI | Backend-only fixture still provisions demo accounts when explicitly enabled | Provisioned three disposable accounts in the emulator. |
| Static verification | No TypeScript errors, lint warnings, broken dependencies or conflict markers | Both type checks, mobile Expo lint with zero warnings, package resolution checks, and Git whitespace/marker checks passed. |
| Expo export | Android, iOS and web JS bundles | All three bundles were exported successfully. Device installation was a separate, blocked check. |

## F. Remaining limits

- Signed native builds, native SecureStore process restart, camera permission and scan, OS file sharing, and lifecycle behavior on a device remain unverified in this Windows workspace. Expo export does not produce a signed APK or IPA.
- There are no authenticated remote staging test accounts configured for this merge. No production records or remote environment configuration were modified.
- Broadcasts, sequence reset, self-service registration/recovery, and background push delivery remain backend contract gaps. Unverified admin mutations and device-only flows remain staging acceptance items.

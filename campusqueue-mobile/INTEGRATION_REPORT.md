# CampusQueue mobile integration

Branch `codex/mobile-backend-integration`. Verification started on 27 November 2026 (Singapore).

## Implementation

- The app uses one HTTP client for student, staff, admin, and report requests. It checks the configured origin, attaches bearer tokens, times out after 12 seconds, and distinguishes rejected requests, malformed responses, and transport failures.
- Native sign-in can save a refresh token in SecureStore. The app binds the saved token to the API origin, verifies the restored session through the backend, refreshes expiring tokens, and clears the session at logout. The browser preview keeps its session in memory. Role guards require authentication before mounting protected routes.
- Students use the backend office directory and ticket state. Staff use their assigned counter IDs and the same staff API for Registrar, Accounting, and Student Affairs. Confirmed writes refresh the affected view. Polling runs on focused student screens and the desk when foregrounded. The student polling request omits history reads, and the staff polling request omits shift logs.
- Runtime imports of the student, staff, and admin fixtures were removed. The original mobile fixtures remain recoverable from Git. The backend’s development seeding CLI now reads a small, backend-only demo fixture. The previous simulated code remains available in Git history. The app reports configuration and API errors instead of opening a demo session.
- Reports use the backend's file bytes, MIME type, and filename. Browser previews download the file and native builds use the platform share sheet. The admin audit screen uses backend activity events with date and office filtering. Missing transaction fields and times are shown as unavailable.
- Staff provisioning and password resets require an operator-supplied password. The app contains no Firebase Admin keys or backend credentials. Server-side authorization, transaction writes, and Firestore access remain in Vercel. The changes introduce no Cloud Functions.

### Changed files

| Area | Modified | Added |
| --- | --- | --- |
| Configuration and documentation | Root `readme.md`, API `README.md`, mobile `app.json`, package manifests and mobile lockfile | Mobile `.env.example`, `eslint.config.js`, this report |
| Client and state | `src/context/{QueueContext,StaffQueueContext,AdminContext,useLiveQueue}` and mobile domain types | `src/context/{apiClient,sessionStorage,shareReport}.ts` |
| Screens and forms | Role layouts, login, student home/ticket/history/profile, staff desk/scanner/logs, admin dashboard/offices/reports, and the affected ticket and admin forms | None |
| Backend | `api/{auth,me,student}.ts`, `lib/{firebaseSession,http}.ts` | `tests/integration.test.ts` |
| Mobile test | None | `tests/apiClient.test.mjs` |

## API integration matrix

| Feature | Endpoint | Method | Integration | Test evidence |
| --- | --- | --- | --- | --- |
| Student, staff, admin login | `/api/auth`, `sign-in` | POST | Connected | Valid and invalid credentials on emulator |
| Restore and renew session | `/api/session`, `/api/me` | POST, GET | Connected, native secure storage | Token refresh and identity passed; native restart pending |
| Logout and role guards | Local session clear and server enforcement on protected routes | Local, GET/POST | Connected | Deep-link guard in browser; native storage deletion pending |
| Change password | `/api/password` | POST | Connected | New and invalidated old tokens verified |
| Offices and available services | `/api/offices` | GET | Connected, closed and unavailable state shown | Registrar, Accounting, and Student Affairs returned on emulator |
| Issue or request the same service again | `/api/student`, `issue` | POST | Connected, operation ID and submission lock | Concurrent duplicate and active-office conflict verified |
| Profile, active ticket, history, notifications | `/api/student`, optional `view=active` | GET | Connected, backend position, estimate and QR | Empty and populated responses, called state and history verified |
| Cancel ticket | `/api/student`, `cancel` | POST | Connected for waiting tickets | Cancelled receipt verified |
| Acknowledge called ticket | `/api/student`, `acknowledge` | POST | Connected | Emulator passed |
| Preferences and notification controls | `/api/student`, `preferences`, `read-notification`, `read-all` | POST | Connected | Saved preference and inbox read state verified |
| Assigned staff counters and desk | `/api/staff?view=counters`, `/api/staff` | GET | Connected | Assignment, scope rejection and desk reads verified |
| Call, recall, start, complete, skip and counter status | `/api/staff` action body | POST | Connected, skip uses configured no-show policy | Call, recall, start, complete and two-counter concurrency verified; skip and status mutations were not in the automated run |
| Manual and QR verification | `/api/staff`, `verify` | POST | Connected | QR verification route passed; camera and manual entry pending on device |
| Staff logs and real CSV/PDF | `/api/staff`, `format=csv\|pdf` for files | GET | Connected, export is scoped to the selected counter | CSV and PDF bytes both passed; native share pending |
| Admin office and service listing and mutations | `/api/admin?resource=offices\|counters\|request-types` | GET/POST | Connected. Office creation requests configured counters, and the app reports partial success if counter creation fails. | Office, counter and service creation, service listing and office archival passed on emulator |
| Admin account directory, staff provisioning/assignment, password reset, archive/restore | `/api/admin?resource=staff\|students` | GET/POST | Connected for supported role/actions | Admin authorization checked; form mutations still need dedicated checks |
| Admin KPIs, activity records and files | `/api/admin?resource=analytics\|activity-logs` | GET | Connected. The export applies date and office filters to backend analytics. | Analytics CSV/PDF passed; activity screen has browser smoke coverage |
| Campus broadcast, sequence reset, self-service registration or recovery | No current mobile API contract | — | Unavailable. The controls or copy explain the supported workflow. | Blocked by backend contract |

## Functional verification

| Scenario | Expected | Observed | Result |
| --- | --- | --- | --- |
| Client request construction and response parsing | Valid URLs and serialization; rejection of malformed or non-JSON responses | Four Node client tests passed, including offline and timeout normalization | Pass |
| Auth and role/office scoping | Invalid login and unassigned requests rejected; valid sessions restored | Verified using disposable Auth and Firestore emulator data | Pass |
| Queue lifecycle and concurrency | A real ticket moves through issue, call, acknowledge, verify, start and complete; cancellations reach history | Emulator journey passed. An idempotent duplicate returned the same ID. Two assigned counters calling concurrently received different tickets. | Pass |
| Session invalidation | Password changes invalidate old credentials; archived accounts lose access | Emulator returned 401 for the old token and 403 for archived access | Pass |
| Artifacts | Staff and admin exports return actual CSV and PDF bytes | Both routes returned non-empty file payloads | Pass |
| Browser at 390 × 844 | Protected redirects, login, network recovery, role screens, issuing and cancelling a real ticket | Chromium passed student/staff/admin login and protected entry redirects, invalid credentials, student offline recovery and issue/cancel, staff logs/scanner/back navigation, and admin offices/users/reports navigation. Browser requests were forwarded to the local emulator-backed handlers. | Pass |
| Static checks and bundling | Mobile lint, client and API type-check, Expo bundles | Lint and both type-checks passed. Expo bundled Android, iOS, and web. | Pass |
| Mobile development and staging install | Install on Android and iOS, verify native persistence, foreground refresh, scanner and sharing | Native device and signing verification pending | Blocked in this workspace |

## Remaining work and limitations

- Mobile dependency audit reported three moderate advisories involving Expo and its dependency tree, with zero high or critical findings. A forced dependency upgrade was outside this integration.
- Native APK/IPA compilation and install, signed staging builds, device camera verification, native share sheets, and SecureStore persistence across process restart need an Android/iOS build environment or an EAS project with signing access. Expo bundle exports alone do not establish those outcomes.
- The local tests used a disposable project with the same handlers and Firebase emulator data. This work did not deploy to Vercel or verify against an authenticated remote staging environment. Stage the API and app changes together because restored account identity and lightweight student polling use the updated backend.
- The backend has no resource for campus broadcasts, queue sequence resets, self-service registration or recovery, general student profile editing, push delivery, or office daily capacity. Student profile preferences are supported. The app does not simulate success for unavailable operations. Administrator creation and administrator password resets use the privileged backend CLI.
- Admin audit events do not carry a full transaction receipt or all student/staff details and lifecycle times. The UI presents available event fields. Analytics exports use backend-supported date and office filters. Office prefix is immutable and editing the office does not archive or resize existing counters.
- Queue no-show transitions need office policy settings in staging, including grace periods and any requeue rules. The server will reject incompatible requests.
- When reproducing locally, `.env.example` at repository root was a pre-existing separate edit. Expo reads the actual app configuration from `campusqueue-mobile/.env`. The local file was initially empty and is now set to the verified Vercel origin. Use a separately approved staging origin for staging sign-ins.

## Setup

From `campusqueue-mobile`, install dependencies with `npm ci`, copy `.env.example` to `.env`, and set `EXPO_PUBLIC_CAMPUSQUEUE_API_URL` to the approved API origin without the `/api` suffix. Run `npm start` and scan from a compatible Expo Go client, or use `npm run android`, `npm run ios`, or `npm run web`. For Expo web, configure the exact frontend origin in backend `ALLOWED_WEB_ORIGINS`. HTTP API origins are accepted only in Expo development mode.

Run `npm test`, `npm run typecheck`, and `npm run lint` from the mobile directory. Run `npm run typecheck` from `campusqueue-api`. For the local integration suite, start the Firebase CLI with Java and configure the API test process as follows.

```powershell
# Terminal 1, from campusqueue-api
firebase emulators:start --only auth,firestore --project demo-campusqueue-integration

# Terminal 2, from campusqueue-api
$env:FIREBASE_PROJECT_ID = 'demo-campusqueue-integration'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085'
npm run test:integration
```

Run `npx expo export --platform all` to verify JavaScript bundling. For staging or production, set the approved HTTPS origin in the corresponding EAS build environment, link the Expo project, and build Android and iOS with the organization's profiles and signing. After installation, run the student and staff queue journeys on two devices, close and reopen each app, verify offline recovery and camera scanning, and open a downloaded staff and admin CSV/PDF. Use test accounts and an isolated staging Firebase project.

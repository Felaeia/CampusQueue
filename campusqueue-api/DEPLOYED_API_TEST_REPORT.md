# CampusQueue deployed API test report

Target [CampusQueue Vercel API](https://campusqueue-api.vercel.app/)

Run started at `2026-11-25T19:03:51.825Z` and ended at `2026-11-25T19:04:01.896Z`. Timestamps are UTC.

The route inventory came from local commit `b461035`. The health response has no commit field, so the deployed revision was not independently identified.

## Summary

- **32 of 35 checks matched the expected status and, for the health check, the expected success flag.**
- Coverage includes all 10 API routes in the local repository. Most checks verified that protected endpoints reject requests without a bearer token.
- The base URL returned the Vercel 404 response. Use `/api/health` to check whether the API process responds.
- Browser preflight returned HTTP 204. The response did not allow the tested Expo localhost origin. No other origin was tested.

## Deployment findings

1. **Session refresh reports missing configuration.** Both refresh requests returned HTTP `503` with `{"error":"Firebase sign-in is not configured"}`. The backend checks `FIREBASE_WEB_API_KEY` before it validates the request token. Verify the variable on the active Vercel deployment, then rerun the missing-token and invalid-token requests. [Session handler](api/session.ts) · [Firebase session configuration](lib/firebaseSession.ts)
2. **Invalid ID tokens return a server error.** `GET /api/me` returned HTTP `500` with `{"error":"Request could not be completed"}`, where a configured API should return `401`. The public response does not identify the cause. Check the Vercel function logs and verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` for the active deployment. [Identity handler](api/me.ts) · [Authorization middleware](lib/http.ts) · [Firebase Admin setup](lib/firebaseAdmin.ts)
3. **Expo localhost preflight did not grant browser access.** The `OPTIONS` response returned `204`, but contained no `Access-Control-Allow-Origin` header for `http://localhost:8081`. If you intend to run the Expo web app against this deployment, add its exact origin to `ALLOWED_WEB_ORIGINS` and rerun the preflight. The report does not establish whether other origins are allowed. [CORS middleware](lib/http.ts)

## Coverage limits

This run used no account credentials or valid session tokens. Requests that name a write action omitted authentication and the required mutation fields. Successful login, authenticated Firestore reads and writes, office scoping, report contents, and the ticket lifecycle require a separate run with designated test accounts. The health check verifies process availability.

## Results at a glance

| # | Check | Method and path | Expected | Observed | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Base URL | `GET /` | 404 | 404 | Pass |
| 2 | Public health check | `GET /api/health` | 200 | 200 | Pass |
| 3 | Unsupported health method | `POST /api/health` | 405 | 405 | Pass |
| 4 | Unsupported sign-in method | `GET /api/auth` | 405 | 405 | Pass |
| 5 | Unknown sign-in action | `POST /api/auth` | 400 | 400 | Pass |
| 6 | Missing sign-in password | `POST /api/auth` | 400 | 400 | Pass |
| 7 | Malformed sign-in JSON | `POST /api/auth` | 400 | 400 | Pass |
| 8 | Missing refresh token | `POST /api/session` | 400 | 503 | Investigate |
| 9 | Invalid refresh token | `POST /api/session` | 401 | 503 | Investigate |
| 10 | Password change without bearer token | `POST /api/password` | 401 | 401 | Pass |
| 11 | Profile without bearer token | `GET /api/me` | 401 | 401 | Pass |
| 12 | Profile with invalid bearer token | `GET /api/me` | 401 | 500 | Investigate |
| 13 | Office catalogue | `GET /api/offices` | 401 | 401 | Pass |
| 14 | Student snapshot | `GET /api/student` | 401 | 401 | Pass |
| 15 | Ticket issuance requires authentication | `POST /api/student` | 401 | 401 | Pass |
| 16 | Ticket cancellation requires authentication | `POST /api/student` | 401 | 401 | Pass |
| 17 | Student acknowledgment requires authentication | `POST /api/student` | 401 | 401 | Pass |
| 18 | Legacy Registrar desk | `GET /api/registrar` | 401 | 401 | Pass |
| 19 | Registrar ticket verification requires authentication | `POST /api/registrar` | 401 | 401 | Pass |
| 20 | Shared staff desk | `GET /api/staff` | 401 | 401 | Pass |
| 21 | Assigned counters | `GET /api/staff?view=counters` | 401 | 401 | Pass |
| 22 | Call next requires authentication | `POST /api/staff` | 401 | 401 | Pass |
| 23 | Shift CSV download requires authentication | `GET /api/staff?format=csv` | 401 | 401 | Pass |
| 24 | Shift PDF download requires authentication | `GET /api/staff?format=pdf` | 401 | 401 | Pass |
| 25 | Admin students requires authentication | `GET /api/admin?resource=students` | 401 | 401 | Pass |
| 26 | Admin staff requires authentication | `GET /api/admin?resource=staff` | 401 | 401 | Pass |
| 27 | Admin offices requires authentication | `GET /api/admin?resource=offices` | 401 | 401 | Pass |
| 28 | Admin counters requires authentication | `GET /api/admin?resource=counters` | 401 | 401 | Pass |
| 29 | Admin request-types requires authentication | `GET /api/admin?resource=request-types` | 401 | 401 | Pass |
| 30 | Admin activity-logs requires authentication | `GET /api/admin?resource=activity-logs` | 401 | 401 | Pass |
| 31 | Admin analytics requires authentication | `GET /api/admin?resource=analytics` | 401 | 401 | Pass |
| 32 | Admin CSV export requires authentication | `GET /api/admin?resource=analytics&format=csv` | 401 | 401 | Pass |
| 33 | Admin PDF export requires authentication | `GET /api/admin?resource=analytics&format=pdf` | 401 | 401 | Pass |
| 34 | Admin write requires authentication | `POST /api/admin?resource=offices` | 401 | 401 | Pass |
| 35 | CORS preflight from Expo localhost | `OPTIONS /api/auth` | 204 | 204 | Pass |

## Response details

### 1. Base URL

- Request `GET /`
- Expected HTTP `404` and observed `404`
- Response headers `content-type: text/plain; charset=utf-8`

```text
The page could not be found

NOT_FOUND

sin1::scsrx-1795633432279-5e3a79688e32
```

### 2. Public health check

- Request `GET /api/health`
- Expected HTTP `200` and observed `200`
- Response headers `content-type: application/json`

```json
{"success":true,"message":"CampusQueue API is running","version":"0.0.1"}
```

### 3. Unsupported health method

- Request `POST /api/health`
- Expected HTTP `405` and observed `405`
- Response headers `content-type: application/json`, `allow: GET`

```json
{"error":"Method not allowed"}
```

### 4. Unsupported sign-in method

- Request `GET /api/auth`
- Expected HTTP `405` and observed `405`
- Response headers `content-type: application/json`, `allow: POST`, `vary: Origin`

```json
{"error":"Method not allowed"}
```

### 5. Unknown sign-in action

- Request `POST /api/auth`
- Expected HTTP `400` and observed `400`
- Request body `{"action":"unsupported"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Unknown authentication action"}
```

### 6. Missing sign-in password

- Request `POST /api/auth`
- Expected HTTP `400` and observed `400`
- Request body `{"action":"sign-in","loginId":"smoke-test"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Invalid password"}
```

### 7. Malformed sign-in JSON

- Request `POST /api/auth`
- Expected HTTP `400` and observed `400`
- Request body `{"action":`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Expected a JSON object"}
```

### 8. Missing refresh token

- Request `POST /api/session`
- Expected HTTP `400` and observed `503`
- Request body `{}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Firebase sign-in is not configured"}
```

### 9. Invalid refresh token

- Request `POST /api/session`
- Expected HTTP `401` and observed `503`
- Request body `{"refreshToken":"not-a-real-smoke-test-token"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Firebase sign-in is not configured"}
```

### 10. Password change without bearer token

- Request `POST /api/password`
- Expected HTTP `401` and observed `401`
- Request body `{}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 11. Profile without bearer token

- Request `GET /api/me`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 12. Profile with invalid bearer token

- Request `GET /api/me`
- Expected HTTP `401` and observed `500`
- Request headers `{"Authorization":"Bearer not-a-real-smoke-test-token"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Request could not be completed"}
```

### 13. Office catalogue

- Request `GET /api/offices`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 14. Student snapshot

- Request `GET /api/student`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 15. Ticket issuance requires authentication

- Request `POST /api/student`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"issue"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 16. Ticket cancellation requires authentication

- Request `POST /api/student`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"cancel"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 17. Student acknowledgment requires authentication

- Request `POST /api/student`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"acknowledge"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 18. Legacy Registrar desk

- Request `GET /api/registrar`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 19. Registrar ticket verification requires authentication

- Request `POST /api/registrar`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"verify"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 20. Shared staff desk

- Request `GET /api/staff`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 21. Assigned counters

- Request `GET /api/staff?view=counters`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 22. Call next requires authentication

- Request `POST /api/staff`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"call-next"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 23. Shift CSV download requires authentication

- Request `GET /api/staff?format=csv`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 24. Shift PDF download requires authentication

- Request `GET /api/staff?format=pdf`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 25. Admin students requires authentication

- Request `GET /api/admin?resource=students`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 26. Admin staff requires authentication

- Request `GET /api/admin?resource=staff`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 27. Admin offices requires authentication

- Request `GET /api/admin?resource=offices`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 28. Admin counters requires authentication

- Request `GET /api/admin?resource=counters`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 29. Admin request-types requires authentication

- Request `GET /api/admin?resource=request-types`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 30. Admin activity-logs requires authentication

- Request `GET /api/admin?resource=activity-logs`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 31. Admin analytics requires authentication

- Request `GET /api/admin?resource=analytics`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 32. Admin CSV export requires authentication

- Request `GET /api/admin?resource=analytics&format=csv`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 33. Admin PDF export requires authentication

- Request `GET /api/admin?resource=analytics&format=pdf`
- Expected HTTP `401` and observed `401`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 34. Admin write requires authentication

- Request `POST /api/admin?resource=offices`
- Expected HTTP `401` and observed `401`
- Request body `{"action":"create"}`
- Response headers `content-type: application/json`, `vary: Origin`

```json
{"error":"Authentication required"}
```

### 35. CORS preflight from Expo localhost

- Request `OPTIONS /api/auth`
- Expected HTTP `204` and observed `204`
- Request headers `{"Origin":"http://localhost:8081","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization,content-type"}`
- Response headers `vary: Origin`
- `Access-Control-Allow-Origin` was absent.

_Empty response body._

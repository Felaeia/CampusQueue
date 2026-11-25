# CampusQueue local setup

CampusQueue has two npm projects. `campusqueue-mobile` is an Expo app with student and Registrar staff screens. `campusqueue-api` is a Vercel backend that uses Firebase Authentication for sessions and Cloud Firestore for queue and account data.

## What the API supports

- Students can sign in with a USN, browse office services, take or cancel a waiting ticket, and view their ticket history and in-app alerts.
- Registrar staff can sign in with a staff ID, manage counter status, call and verify tickets, recall students, and complete or skip service. The shift log records completed and skipped tickets.
- Both roles can renew a session or change their password. Sign-in uses a CampusQueue ID and password.

See the [API function reference](campusqueue-api/README.md#api-functions) for routes, required fields, responses, and errors.

## Technologies used

| Technology | Role in CampusQueue |
| --- | --- |
| Node.js and npm | Run the development tools and install dependencies from each project's lockfile. |
| Expo SDK 58 and Metro | Configure the mobile app and serve its JavaScript during development. |
| React 19.3 and React Native 0.88 | Render the mobile UI. Expo Router screens live under `campusqueue-mobile/src/app/`. |
| TypeScript | Powers both projects. Both projects use TypeScript 6. |
| Vercel Functions and Vercel CLI | Run the HTTP handlers under `campusqueue-api/api/` locally with `vercel dev`. |
| Firebase Admin SDK 14.5 | Verifies Firebase Authentication ID tokens and queries Cloud Firestore from the API. |

## 1. Install the prerequisites and dependencies

1. Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/en/download) with npm. Use Node.js **24.3 or later in the 24.x series**, or **26.x**. Both match the Node.js requirements in the checked-in lockfiles.
2. For mobile testing, install an Expo Go version compatible with SDK 58 on a supported device, or set up an Android emulator in Android Studio. The iOS Simulator requires macOS and Xcode. On Windows, use a physical device or an Android emulator. [Expo environment setup](https://docs.expo.dev/get-started/set-up-your-environment/)
3. Check your tools and clone the repository. If you already have it open locally, start from the repository root and skip the clone.

```sh
git --version
node --version
npm --version
git clone https://github.com/Felaeia/CampusQueue.git
cd CampusQueue
```

Install dependencies in both project folders. The Vercel and Expo CLIs are included in the project dependencies.

```sh
cd campusqueue-api
npm ci
cd ../campusqueue-mobile
npm ci
cd ..
```

If PowerShell blocks the `npm.ps1` or `npx.ps1` launcher, use `npm.cmd` or `npx.cmd` in place of `npm` or `npx`.

## 2. Configure Firebase for the authenticated API

Live API workflows need Firebase credentials. The health check and the mobile demo can run on their own.

1. Open or create a development project in the [Firebase console](https://console.firebase.google.com/).
2. Under **Firestore Database**, create the default database if it does not exist. The API queries the `offices` collection to verify connectivity. An empty database is enough for that check. [Firestore setup](https://firebase.google.com/docs/firestore/quickstart-server)
3. In **Project settings → Service accounts**, obtain a Firebase Admin service-account JSON key for the development project. Keep the downloaded key outside the repository. [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
4. Copy [the API environment template](campusqueue-api/.env.example) to `campusqueue-api/.env`. From the repository root, use:

   ```powershell
   Copy-Item campusqueue-api/.env.example campusqueue-api/.env
   ```

   On macOS or Linux, run:

   ```sh
   cp campusqueue-api/.env.example campusqueue-api/.env
   ```

5. Replace the placeholders using fields from the service-account JSON.

   | Variable | JSON field |
   | --- | --- |
   | `FIREBASE_PROJECT_ID` | `project_id` |
   | `FIREBASE_CLIENT_EMAIL` | `client_email` |
   | `FIREBASE_PRIVATE_KEY` | `private_key` |

   Keep the private key in double quotes on one line, with the literal `\n` sequences from the JSON value. Keep these credentials in the API environment file, which Git ignores.

## 3. Run and verify the API

In a terminal opened at the repository root:

```sh
cd campusqueue-api
npx vercel dev --listen 3000
```

On the first run, sign in to Vercel if prompted and link to the team's API project or create a development project through the setup prompts. Use `campusqueue-api` as the working directory so Vercel finds the `api/` folder. If prompted for a framework preset when setting up a new project, choose **Other**. Leave this terminal running. [Vercel CLI documentation](https://vercel.com/docs/cli/dev)

In another terminal, in PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

On macOS or Linux:

```sh
curl -i http://localhost:3000/api/health
```

Expect HTTP `200` and this response:

```json
{"success":true,"message":"CampusQueue API is running","version":"0.0.1"}
```

### Verify Firebase Authentication and Firestore

1. Set `FIREBASE_WEB_API_KEY` in the API environment using the Web API Key from Firebase **Project settings → General**. CampusQueue uses Firebase custom tokens and signs users in by USN or staff ID and password.
2. From `campusqueue-api`, run `.migrate-firestore.bat` on Windows or `npm run migrate -- --interactive` on any platform. Review the dry run and confirm the displayed Firebase project ID. Follow the [backend setup guide](campusqueue-api/README.md) to provision an account or seed the development demo accounts.
3. Send a JSON `POST` request to `http://localhost:3000/api/auth` with the sign-in ID and its password.

   ```json
   {"action":"sign-in","loginId":"YOUR_USN_OR_STAFF_ID","password":"YOUR_ACCOUNT_PASSWORD"}
   ```

4. Use the returned `idToken` to verify your identity and Firestore connectivity. In PowerShell:

   ```powershell
   Invoke-RestMethod http://localhost:3000/api/me -Headers @{ Authorization = "Bearer YOUR_ID_TOKEN" }
   ```

Expect HTTP `200`, `success: true`, your Firebase `uid`, `firestoreConnected: true`, and the provisioned role. A request without the Bearer header returns HTTP `401`.

## 4. Run and verify the Expo app

Open a separate terminal at the repository root:

```sh
cd campusqueue-mobile
npm start
```

- **Physical device.** Put your phone and computer on the same network and scan the terminal QR code with a compatible Expo Go installation.
- **Android emulator.** Start the emulator in Android Studio, then press `a` in the Expo terminal. You can also start Expo and open the emulator with `npm run android`.
- **iOS Simulator.** On macOS, press `i` in the Expo terminal or start it with `npm run ios`. [Expo device and simulator instructions](https://docs.expo.dev/get-started/start-developing/)
- **Optional browser preview.** The repository has a web script. Install Expo's additional web dependencies from `campusqueue-mobile` first with `npx expo install react-dom react-native-web @expo/metro-runtime`, then run `npm run web`. Installing these packages updates the mobile package files. [Expo web setup](https://docs.expo.dev/workflow/web/)

The app opens the CampusQueue sign-in screen. Set `EXPO_PUBLIC_CAMPUSQUEUE_API_URL` in the mobile environment file and restart Expo to use the live API. With the URL unset, the app uses its demo data. Use `Ctrl+C` in each terminal to stop its server.

## Check your setup and troubleshoot

| Task or symptom | What to run or check |
| --- | --- |
| Type-check the API | Run `npm run typecheck` from `campusqueue-api`. |
| Type-check the mobile app | Run `npx tsc --noEmit` from `campusqueue-mobile`. |
| npm cannot reach the registry | Check network or proxy access to `registry.npmjs.org`, then retry `npm ci` in the affected folder. |
| API health check returns `404` | Confirm you ran Vercel from `campusqueue-api` and are requesting `/api/health` on the port Vercel printed. |
| `/api/me` returns `401` | Use a fresh Firebase ID token from the same project as the Admin credentials. Check the API terminal for Firebase configuration or token verification errors. |
| `/api/me` returns `500` | Check the API logs and verify that the service account can read the default Firestore database. |
| Expo QR code opens but the device cannot connect | Check the shared network. If needed, try `npm start -- --tunnel` from `campusqueue-mobile` and scan the new code. |
| Expo reports an SDK mismatch | Check that the installed Expo Go supports SDK 58. Run `npx expo-doctor` from `campusqueue-mobile` to check dependencies and configuration. |

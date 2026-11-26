# CampusQueue Mobile (Expo)

Expo SDK 58 mobile application for the **CampusQueue — ACLC College of Mandaue Student Services** portal, migrated from `campusqueue_mobile_ui_ux_prototype` using Expo Router, TypeScript, `react-native-svg`, `@expo/vector-icons`, and centralized JSON mock data.

## Backend integration

For the deployed backend URL, role routing, endpoint examples, and known deployment issues, see the [Frontend API guide](../campusqueue-api/FRONTEND_API_GUIDE.md).

## Architecture Overview

- **Routing (`src/app/`)** — Expo Router file-based routes matching the prototype flow:
  - `/auth/login` — Unified student sign-in (empty initial inputs, `FirstLoginPasswordModal`, `ForgotPasswordModal`)
  - `/student/home` — Student dashboard header, Live Active Ticket banner, 3 Campus Office cards, `RequestTicketSheet`, `ActiveConflictModal`, `NotificationDrawer`
  - `/student/ticket` — Perforated boarding-pass stub, `LiveQueueTrack`, vector `TactileQRCode` + `FullScreenQRModal`, `TicketBarcode`, `LeaveQueueModal`, and compact Queue Simulator controls
  - `/student/history` — Filterable die-cut paper receipt stubs, `ReceiptDetailModal`, and `RequeueConfirmModal`
  - `/student/profile` — Obsidian Student ID card, Notification Preferences toggles, `ChangePasswordModal`, and `LogoutConfirmModal`
- **Centralized Mock Data (`src/data/mockData.json`)** — All seed credentials, student profile fields, campus offices, services, active/history tickets, notifications, cancel reasons, filter options, and barcode patterns are loaded dynamically via `QueueContext`.
- **Design System (`src/theme/tokens.ts`)** — "Warm Campus Utility" palette (`#F5F3EE` Warm Alabaster canvas, `#121417` Obsidian Ink, `#B8F23A` Acid Matcha, office accents) with Plus Jakarta Sans, Inter, and JetBrains Mono fonts.

## Demo Sign-In Credentials (from `src/data/mockData.json`)

- **USN:** `23000440130`
- **Default Password:** `student123` (triggers the first-login password update modal)

## Local Development & Verification

```sh
cd campusqueue-mobile
npm ci
npm start
```

Type-check and verify configuration:

```sh
npm run typecheck
npx expo-doctor
```

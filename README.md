# immigration platform app – Mobile App

Status Performance Security Platform

> React Native + Expo client powering the Patrick Digital Services immigration platform.
>
> **Actively Developed** | **Performance Optimised** | **iOS & Android Ready** | **GDPR Compliant**

## Overview
The mobile app enables clients to:

* Track immigration cases across every stage
* Upload, preview, and manage supporting documents
* Chat securely with legal advisors
* Receive push notifications with deep links
* Monitor payments and billing history
* Access FAQs, support contacts, and legal resources

## Recent Updates (November 2025)
* Fully transparent bottom tab bar with shared styling across tabs
* Modernised change password flow aligned with profile design system
* Themed placeholder colours and input surfaces for a contemporary look
* Hardened Firebase auth initialisation and bottom sheet modal provider logic

## Feature Set

### Authentication & Security
* Email/password sign-in via Firebase Auth
* Session persistence with secure token storage
* Password reset, change password, and logout workflows
* GDPR-ready consent wording and legal screens

### Dashboard & Cases
* Home dashboard with memoised KPIs and quick actions
* Case list with normalised statuses and filters
* Case detail timeline and related document access

### Document Management
* Upload wizard supporting camera and library sources
* File metadata preview and server-side validation
* Templates library for repeatable document types

### Messaging & Notifications
* In-app chat powered by Firebase
* Push notifications (FCM) bridged to deep links
* Toasts and bottom-sheet alerts for contextual updates

### Profile & Settings
* Editable profile information with dirty state detection
* Change password with real-time validation feedback
* Data export, account deletion, and support contact options

### Payments
* Payment history screen with receipt details
* Integration hooks for Stripe-backed flows

## Quick Start

### Prerequisites
* Node.js 18+
* pnpm (`npm install -g pnpm`)
* Expo CLI (bundled via `npx expo`)
* Xcode for iOS simulator (macOS) / Android Studio for Android emulator

### Install
```bash
pnpm install
```

### Configure
Populate Expo config extras (`app.config.ts`) and Firebase settings (`lib/firebase/config.ts`). Required values include:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=
```

Confirm push notification credentials in `lib/services/pushNotifications.ts` and Stripe keys inside `docs/STRIPE_SETUP_GUIDE.md`.

### Run
```
pnpm start        # Expo dev server
pnpm ios          # run on iOS simulator
pnpm android      # run on Android emulator
pnpm web          # run in browser
```

## Tech Stack

| Layer        | Technology                          |
| ------------ | ------------------------------------ |
| Framework    | React Native + Expo SDK              |
| Navigation   | Expo Router 2                        |
| State        | Zustand                              |
| Data Fetch   | React Query (TanStack Query)         |
| Auth         | Firebase Authentication              |
| Storage      | Expo Secure Store, Async Storage     |
| HTTP         | Axios with interceptors              |
| UI           | Custom design system + Expo Symbols  |
| Language     | TypeScript                           |

## Project Structure
```
app/                 # Expo Router route tree (auth, tabs, modals)
components/          # Shared UI components (tab bar, inputs, alerts, toasts)
contexts/            # Providers (scroll, widget, bottom sheet)
docs/                # Platform documentation and integration guides
lib/                 # Hooks, services, Firebase config, utilities
stores/              # Zustand stores per domain (auth, cases, profile, etc.)
styles/              # Theme definitions and shared style helpers
assets/              # Fonts, icons, images
```

## Development
```
pnpm lint            # run ESLint
pnpm typecheck       # run TypeScript (if script defined)
pnpm format          # apply Prettier formatting (if configured)
```

Guidelines:
* Reuse components in `components/` and theme tokens from `styles/theme.ts`
* Centralise strings via `lib/i18n/locales`
* Keep domain logic inside `lib/services` backed by respective Zustand stores

## Builds (EAS)
```
eas build --profile preview --platform ios
eas build --profile preview --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```
Before building, verify configuration values (`app.config.ts`) and credentials for push notifications, Firebase, and Stripe.

## Security & Compliance
* HTTPS-only API communication enforced by Axios client
* Tokens stored via `expo-secure-store`
* Firebase security rules aligned with authenticated UID usage
* GDPR assets: privacy policy, terms, consent logging

## Key Documentation
* Stripe setup: `docs/STRIPE_SETUP_GUIDE.md`
* Payment integration overview: `docs/PAYMENT_INTEGRATION_OVERVIEW.md`
* Go-live checklist: `docs/GO_LIVE_CHECKLIST.md`
* Implementation summary: `docs/IMPLEMENTATION_SUMMARY.md`

## Troubleshooting
* **Firebase initialisation fails** – ensure config values exist and `initializeAuth` guards against hot reloads.
* **Bottom sheet context error** – `BottomSheetModalProvider` wrapped conditionally in `components/BottomSheetAlert.tsx`.
* **Duplicate tab bar on profile** – profile screen now relies solely on shared tab layout.
* **Metro cache issues** – run `npx expo start -c`.

## Implementation Status
### Core Domains (13/15 – in progress)
- [x] Authentication & onboarding
- [x] Dashboard metrics and quick actions
- [x] Case management screens
- [x] Document upload and preview flows
- [x] Messaging and notifications
- [x] Profile edit and change password
- [x] Payment history
- [x] Data export / delete account
- [x] Toast and bottom sheet alert system
- [x] Themable design system (light/dark)
- [ ] Advanced analytics tile set
- [ ] In-app guided tour

### Screens (completed vs planned)
- [x] Onboarding, login, register, forgot password
- [x] Dashboard `(tabs)/(home)`
- [x] Cases list, case detail
- [x] Documents list, upload
- [x] Notifications center
- [x] Messages screen, chat view
- [x] Profile main, personal info, change password
- [ ] Additional analytics and admin tools

## Git Workflow
1. Branch from `feature/app-updates`:
   ```bash
   git checkout -b feature/short-description
   ```
2. Stage and commit using conventional messages:
   ```bash
   git add .
   git commit -m "feat: update profile tab styling"
   ```
3. Rebase with upstream frequently:
   ```bash
   git fetch origin
   git rebase origin/feature/app-updates
   ```
4. Push and open a pull request:
   ```bash
   git push -u origin feature/short-description
   ```
5. Include testing notes and screenshots for UI changes in PR descriptions.

### Feature Branches to Review
1. `feature/auth-refresh` – authentication flows parity
2. `feature/home-metrics` – dashboard KPI memoisation
3. `feature/document-uploads` – document upload improvements
4. `feature/profile-refresh` – profile tab styling & logout button
5. `fix/bottom-sheet-context` – provider guard for BottomSheetModal

### Next Steps
1. Merge outstanding feature branches and resolve conflicts
2. Run smoke tests on physical devices (iOS and Android)
3. Finalise analytics/insights screen backlog
4. Conduct beta testing with partner cohort
5. Prepare release notes and store assets
6. Submit builds to App Store Connect and Google Play Console

Built and maintained by the Patrick Digital Services engineering team. Reach out via the project channel for support or onboarding requests.

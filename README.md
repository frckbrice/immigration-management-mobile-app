# immigration Travel Agency – Mobile Platform

> **Modern React Native application** powering an end-to-end immigration and travel services platform. Built with **Expo SDK 54**, **TypeScript**, and **React 19**, featuring real-time communication, secure document management, and seamless payment integration.

[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)

---

## Overview

A production-ready mobile application that streamlines the immigration and travel services workflow. Clients can track cases, manage documents, communicate with advisors in real-time, and process payments—all within a polished, performant, and secure mobile experience.

### Key Capabilities

**Case Management** – Track immigration cases with real-time status updates  
**Document Hub** – Upload, preview, and organize supporting documents with offline caching  
**Real-time Chat** – Secure messaging powered by Firebase Realtime Database  
**Push Notifications** – FCM-based notifications with deep linking  
**Payment Integration** – Stripe-powered transactions with receipt management  
**i18n Ready** – Full internationalization support (EN/FR)  
**Adaptive Design** – Light/dark mode with system-aware theming  

---

## Architecture

Built with modern best practices and a scalable, maintainable architecture:

### Core Stack

- **Framework**: React Native 0.81.5 + Expo SDK 54 (New Architecture enabled)
- **Language**: TypeScript with strict mode
- **Navigation**: Expo Router 6 (file-based routing with typed routes)
- **State Management**: Zustand (domain-driven stores)
- **Data Fetching**: TanStack Query v5 with caching & optimistic updates
- **Authentication**: Firebase Authentication with secure token storage
- **Real-time**: Firebase Realtime Database
- **Payments**: Stripe React Native SDK
- **Localization**: i18next with dynamic language switching

### Architecture Patterns

- **Domain-Driven Design** – Organized stores and services by business domain
- **Service Layer** – Clean separation between UI, state, and API logic
- **Error Boundaries** – Comprehensive error handling with graceful degradation
- **Type Safety** – End-to-end TypeScript coverage with strict checks
- **Performance** – Memoization, lazy loading, and optimized re-renders

### Project Structure

```
app/                    # Expo Router file-based routes
├── (tabs)/            # Tab navigation screens
├── legal/             # Terms & Privacy policies
├── documents/         # Document management flows
└── ...

stores/                 # Zustand state management
├── auth/              # Authentication state
├── cases/             # Case management state
├── documents/         # Document state & caching
└── ...

lib/
├── services/          # API integration layer
├── hooks/             # Custom React hooks
├── utils/             # Shared utilities
└── api/               # Axios client with interceptors

components/            # Reusable UI components
contexts/              # React contexts (Theme, Scroll, etc.)
styles/                # Design system & theming
```

---

## Quick Start

### Prerequisites

- **Node.js** 22+ and **pnpm**
- **Expo CLI** (via `npx expo`)
- **iOS**: Xcode 15+ (macOS only)
- **Android**: Android Studio with SDK 33+

### Installation

```bash
# Clone repository
git clone <repository-url>
cd "patrick mobile 2"

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Firebase, Stripe, and API keys
```

### Configuration

Set required environment variables in `app.config.ts` or `.env`:

```env
EXPO_PUBLIC_API_PROD_URL=https://api.production.com
EXPO_PUBLIC_FIREBASE_API_KEY=your_key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_key
# ... additional config
```

### Development

```bash
# Start Expo dev server
pnpm dev

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Run in web browser
pnpm web
```

---

## Development Workflow

### Code Quality

```bash
pnpm lint              # ESLint checks
pnpm type-check        # TypeScript validation
pnpm format            # Prettier formatting
```

### Building

Using **EAS Build** for cloud builds:

```bash
# Development build
pnpm build:dev:android
pnpm build:dev:ios

# Preview/Staging build
pnpm build:preview:android
pnpm build:preview:ios

# Production build
pnpm build:prod:android
pnpm build:prod:ios
```

---

## Technical Highlights

### State Management
- **Zustand** with persistence middleware for offline-first experience
- Domain-specific stores for modular state (auth, cases, documents, etc.)
- Optimized selectors to minimize re-renders

### Data Fetching
- **TanStack Query** for server state with automatic caching
- Optimistic updates for instant UI feedback
- Background refetching and stale-while-revalidate patterns

### Real-time Features
- Firebase Realtime Database for live chat and presence
- FCM push notifications with deep linking
- Optimistic UI updates with conflict resolution

### Security
- Secure token storage via Expo SecureStore
- HTTPS-only API communication with interceptors
- Firebase Security Rules aligned with authenticated sessions
- GDPR-compliant data handling

### Performance
- React 19 concurrent features (Suspense, transitions)
- Memoization with `useMemo` and `useCallback`
- Image optimization and lazy loading
- Efficient list rendering with FlatList optimizations

### Developer Experience
- **TypeScript strict mode** for maximum type safety
- **Expo Router** with typed routes for navigation
- Hot reloading and fast refresh
- Comprehensive error logging and monitoring

---

## Features

### User-Facing
- Secure authentication with email/password and social login
- Dashboard with case overview and quick actions
- Case management with timeline tracking
- Document upload, preview, and download with offline support
- Real-time messaging with advisors
- Push notifications with action handling
- Payment processing and history
- Profile management with image upload
- FAQ and support contact integration
- Legal document viewing (Terms, Privacy)

### Developer Features
- System-aware dark/light theme
- Consistent design system with reusable components
- Pull-to-refresh on data screens
- Offline-first architecture with caching
- Full i18n support (English/French)
- Accessibility considerations
- Error tracking and logging

---

## Testing & Quality

- TypeScript compilation checks
- ESLint with React Native and Expo rules
- Error boundaries for crash prevention
- Logging service for production debugging

---

## Deployment

The app is configured for deployment via **Expo Application Services (EAS)**:

- **Development**: Internal distribution for testing
- **Preview**: Staging builds for QA
- **Production**: App Store and Play Store releases

Runtime versioning policy ensures smooth OTA updates via Expo Updates.

---

## Security & Compliance

- Secure token storage
- Firebase Authentication with session persistence
- Certificate pinning (configurable)
- GDPR-compliant data handling
- PCI-DSS compliant payment processing via Stripe

---

## Contributing

This project follows conventional commit messages and feature branch workflow. Please ensure:

1. TypeScript compilation passes
2. ESLint checks pass
3. Manual testing on target platforms
4. PR descriptions include testing notes and screenshots for UI changes

---

## License

MIT

---

## Author

**Avom Brice**  
[Portfolio](https://maebrieporfolio.vercel.app)

---

*Built with React Native and Expo*

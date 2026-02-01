# UTx - Setup Status

**Last Updated:** February 1, 2026

## Project Overview

UTx is a mobile rowing training app built with:
- **Mobile:** Expo/React Native (SDK 54, React Native 0.81.5)
- **Backend:** Node.js/Fastify with PostgreSQL
- **Auth:** Firebase Authentication via Firebase JS SDK + Expo auth modules

## Current State

### Completed
- [x] Monorepo structure setup (`apps/mobile`, `apps/backend`)
- [x] Mobile app screens (auth, onboarding, feed, workouts, camera)
- [x] Backend API routes (auth, workouts, clubs, leaderboards, AI coaching)
- [x] Firebase project created (`utxx-e4caa`)
- [x] Firebase Auth methods enabled (Apple, Google, Phone)
- [x] Firebase Admin SDK credentials for backend
- [x] **Migrated from @react-native-firebase to Firebase JS SDK** (Feb 1, 2026)
- [x] iOS build succeeds (75 pods, no native Firebase issues)
- [x] App runs in simulator

### In Progress
- [ ] Testing Firebase Auth flow in simulator/device

### Not Started
- [ ] Database setup (PostgreSQL)
- [ ] Backend deployment
- [ ] Strava OAuth integration
- [ ] OpenAI Vision OCR for workout photos
- [ ] File storage (Cloudflare R2/S3)

## Firebase Configuration

**Project ID:** `utxx-e4caa`
**Bundle ID:** `com.utx.app`

### Auth Methods Enabled
- Apple Sign-In (via `expo-apple-authentication`)
- Google Sign-In (via `expo-auth-session`)
- Phone/SMS (via Firebase JS SDK)

### Architecture Change (Feb 1, 2026)

Migrated from `@react-native-firebase` to Firebase JS SDK to avoid native build issues with Firebase 11.x + Xcode 17.

**Old approach (removed):**
- `@react-native-firebase/app`
- `@react-native-firebase/auth`
- Native Firebase pods (caused Swift header issues)

**New approach:**
- `firebase` (JS SDK)
- `expo-auth-session` (Google OAuth)
- `expo-apple-authentication` (Apple Sign-In)
- `expo-crypto` (nonce generation)

### Required Files (Not in Git)

1. **Backend:** `apps/backend/.env`
   - Copy from `.env.example` and fill in Firebase service account credentials
   - Get service account key from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

## How to Restore / Setup

### 1. Clone and Install
```bash
git clone https://github.com/stevemilton/utx.git
cd utx
npm install
```

### 2. Backend Environment
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your Firebase service account credentials
```

### 3. Build Mobile App
```bash
cd apps/mobile
npm install
npx expo prebuild --clean
cd ios && pod install && cd ..
xcodebuild -workspace ios/utx.xcworkspace -scheme utx -sdk iphonesimulator build
# Or open ios/utx.xcworkspace in Xcode and press Cmd+R
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/mobile/src/services/firebase.ts` | Firebase JS SDK auth service |
| `apps/mobile/src/screens/auth/*.tsx` | Auth screens |
| `apps/backend/src/routes/auth.ts` | Backend auth routes |
| `apps/backend/src/middleware/auth.ts` | Firebase token validation |

## Notes

- Apple Sign-In requires a physical device for full testing (works in simulator for UI flow)
- Google Sign-In uses expo-auth-session with OAuth flow
- Phone/SMS auth may show reCAPTCHA on first use (Firebase JS SDK behavior)
- Firebase Console: https://console.firebase.google.com/project/utxx-e4caa
- Google Cloud Console: https://console.cloud.google.com (project: utxx-e4caa)

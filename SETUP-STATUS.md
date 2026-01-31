# UTx - Setup Status

**Last Updated:** January 31, 2026

## Project Overview

UTx is a mobile rowing training app built with:
- **Mobile:** Expo/React Native (SDK 54, React Native 0.81.5)
- **Backend:** Node.js/Fastify with PostgreSQL
- **Auth:** Firebase Authentication (Apple Sign-In, Google Sign-In, Phone/SMS)

## Current State

### Completed
- [x] Monorepo structure setup (`apps/mobile`, `apps/backend`)
- [x] Mobile app screens (auth, onboarding, feed, workouts, camera)
- [x] Backend API routes (auth, workouts, clubs, leaderboards, AI coaching)
- [x] Firebase project created (`utxx-e4caa`)
- [x] Firebase Auth methods enabled (Apple, Google, Phone)
- [x] Firebase iOS config (`GoogleService-Info.plist`)
- [x] Firebase Admin SDK credentials for backend
- [x] Expo prebuild completed
- [x] CocoaPods dependencies installed (92 pods)
- [x] Xcode workspace generated

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
- Apple Sign-In
- Google Sign-In
- Phone/SMS

### Required Files (Not in Git)

These files contain API keys/secrets and must be obtained from Firebase Console:

1. **iOS:** `apps/mobile/GoogleService-Info.plist`
   - Download from: Firebase Console → Project Settings → Your Apps → iOS app → Download GoogleService-Info.plist

2. **Android:** `apps/mobile/google-services.json`
   - Download from: Firebase Console → Project Settings → Your Apps → Android app → Download google-services.json

3. **Backend:** `apps/backend/.env`
   - Copy from `.env.example` and fill in Firebase service account credentials
   - Get service account key from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

## How to Restore / Setup

### 1. Clone and Install
```bash
git clone https://github.com/stevemilton/utx.git
cd utx
npm install
```

### 2. Firebase Config Files
- Get `GoogleService-Info.plist` from Firebase Console
- Place in `apps/mobile/GoogleService-Info.plist`
- Get `google-services.json` from Firebase Console
- Place in `apps/mobile/google-services.json`

### 3. Backend Environment
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your Firebase service account credentials
```

### 4. Build Mobile App
```bash
cd apps/mobile
npm install
npx expo prebuild --clean
cd ios && pod install && cd ..
open ios/UTx.xcworkspace
# Build and run in Xcode (Cmd+R)
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/mobile/src/services/firebase.ts` | Firebase auth service |
| `apps/mobile/src/screens/auth/*.tsx` | Auth screens |
| `apps/backend/src/routes/auth.ts` | Backend auth routes |
| `apps/backend/src/services/firebase-admin.ts` | Firebase Admin SDK |

## Notes

- Apple Sign-In requires a physical device for full testing
- Firebase Console: https://console.firebase.google.com/project/utxx-e4caa
- Google Cloud Console: https://console.cloud.google.com (project: utxx-e4caa)

# UTx - Setup Status

**Last Updated:** February 1, 2026

## Current State: Ready for TestFlight

### Production Infrastructure
| Service | URL / Status |
|---------|-------------|
| Backend | `https://utx-production.up.railway.app` (online) |
| Database | Railway PostgreSQL (migrated) |
| Auth | Firebase (`utxx-e4caa`) |
| EAS | Configured, `GOOGLE_SERVICES_PLIST` secret uploaded |

### What's Working
- [x] Firebase Auth (Apple, Google, Phone via JS SDK)
- [x] Backend deployed to Railway
- [x] Database migrated (Prisma)
- [x] All MVP routes (workouts, feed, pbs, clubs, leaderboards, strava)
- [x] All screens implemented
- [x] Mobile app pointing to production API

### What's Next
- [ ] Run `eas build --platform ios --profile production`
- [ ] Test on TestFlight
- [ ] Submit to App Store

---

## Quick Start

### Resume Development
```bash
cd /Users/stevemilton/utx
npm install
cd apps/mobile && npx expo start
```

### Build for TestFlight
```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios
```

---

## Project Structure

```
utx/
├── apps/
│   ├── mobile/              # Expo/React Native
│   │   ├── app.config.js    # Dynamic config (EAS secrets)
│   │   ├── eas.json         # EAS build config
│   │   └── src/
│   │       ├── screens/     # All screens complete
│   │       ├── services/    # api.ts, firebase.ts
│   │       └── constants/   # api.ts (prod URL)
│   └── backend/             # Fastify/Prisma
│       ├── src/routes/      # All MVP routes
│       └── prisma/          # Database schema
└── SETUP-STATUS.md
```

---

## Key Configuration

### Mobile API
`apps/mobile/src/constants/api.ts`:
- Production: `https://utx-production.up.railway.app`

### Firebase
- Project: `utxx-e4caa`
- Bundle ID: `com.utx.app`
- Auth: Apple, Google, Phone (JS SDK)

### EAS
- Project ID: `e091f145-3f0a-459a-990d-bd18db0d747d`
- Apple Team: `6FK49H335R`
- Secret: `GOOGLE_SERVICES_PLIST`

---

## Continuation Prompt

Use this to resume development:

```
Continue UTx development. Current state:
- Backend: https://utx-production.up.railway.app (online)
- Database: Railway PostgreSQL (migrated)
- Mobile: Expo/React Native, all screens complete
- Auth: Firebase JS SDK (Apple, Google, Phone)
- EAS: Configured with GOOGLE_SERVICES_PLIST secret

Run `eas build --platform ios --profile production` for TestFlight.
PRD is the source of truth. Keep it simple.
```

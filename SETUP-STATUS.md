# UTx - Setup Status

**Last Updated:** February 1, 2026

## Current State: ON TESTFLIGHT 🚀

App successfully built and submitted to TestFlight!
- **TestFlight:** https://appstoreconnect.apple.com/apps/6758580968/testflight/ios
- **App ID:** 6758580968

### Production Infrastructure
| Service | Status |
|---------|--------|
| Backend | `https://utx-production.up.railway.app` ✅ |
| Database | Railway PostgreSQL ✅ |
| Auth | Firebase (Apple, Google, Phone) ✅ |
| Mobile | TestFlight ✅ |

### What's Done
- [x] Backend deployed to Railway
- [x] Database migrated
- [x] All screens implemented
- [x] EAS build successful
- [x] Submitted to TestFlight

### What's Next
- [ ] Test on physical device via TestFlight
- [ ] Fix any bugs found in testing
- [ ] Submit to App Store

---

## Quick Reference

### Build & Submit
```bash
cd apps/mobile
eas build --platform ios --profile production
eas submit --platform ios
```

### Local Development
```bash
cd /Users/stevemilton/utx
npm install
cd apps/mobile && npx expo start
```

---

## Continuation Prompt

```
Continue UTx development. Current state:
- App is ON TESTFLIGHT
- Backend: https://utx-production.up.railway.app
- TestFlight: https://appstoreconnect.apple.com/apps/6758580968/testflight/ios

Test on device, fix bugs, submit to App Store.
PRD is source of truth. Keep it simple.
```

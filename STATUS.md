# UTx Development Status

**Last Updated:** 2 February 2026, 1:45 PM
**Current Build:** 27 (in TestFlight)
**Branch:** `loving-visvesvaraya`

---

## Build 27 - Full Light Mode Redesign ✅

**Status:** Submitted to TestFlight
**Build ID:** `43f26ba4-e3dd-4e84-b99f-46d25f5f0de1`
**Commit:** `6a6c9b1` - "Full light mode redesign with Ionicons"

### Major Changes
- **Complete light mode redesign** across all 25+ screens
- **Primary color changed** to Petrol Blue (`#0D4F4F`)
- **All emojis replaced** with Ionicons throughout the app
- **Premium Whoop/Strava-style UI** - clean, light backgrounds
- **White splash screen** and adaptive icon backgrounds

### Files Modified (25 files)
| Category | Files |
|----------|-------|
| Theme | `theme.ts` |
| Main Screens | `FeedScreen`, `ProfileScreen`, `WorkoutsScreen`, `LeaderboardScreen` |
| Workout | `WorkoutDetailScreen`, `WorkoutCard`, `AddWorkoutScreen`, `WorkoutEditScreen` |
| Camera | `CameraScreen` |
| Social | `CommentsScreen`, `ClubDetailScreen`, `SquadDetailScreen`, `UserProfileScreen` |
| Profile | `EditProfileScreen` |
| Auth | `AuthScreen`, `PhoneAuthScreen`, `VerifyCodeScreen` |
| Onboarding | `TutorialScreen`, `ProfileSetupScreen`, `ProfilePhysicalScreen`, `HRSetupScreen`, `JoinClubScreen` |
| Config | `app.config.js` (splash/icon backgrounds → white) |

---

## What to Test in Build 27

1. **Visual** - All screens should be light mode (white backgrounds, Petrol Blue primary)
2. **Icons** - No emojis anywhere, all Ionicons
3. **Feed** - Workout cards with premium styling
4. **Workout Detail** - Clean light design with proper metrics
5. **Onboarding** - All screens in light mode with icon-based tutorial slides
6. **Camera** - Light themed capture screen
7. **Profile** - Clean edit profile with proper styling

---

## Previous Builds

### Build 26
- Not built (EAS quota exceeded before upgrade)

### Build 25
- v3 design with orange primary color
- Bug fixes for workout detail crash, HR setup keyboard, OCR camera guidelines

### Build 24
- Fixed workout detail crash (formatNumber null checks)
- Fixed workout type badges

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| OCR via Camera timeout | Needs investigation | Gallery works, camera may send larger images |
| Phone auth | Disabled | Expo managed workflow limitation - use Apple/Google |

---

## Quick Commands

```bash
# Navigate to project
cd /Users/stevemilton/.claude-worktrees/utx/loving-visvesvaraya

# Run new build
cd apps/mobile && eas build --platform ios --profile production --auto-submit

# Test backend health
curl https://utx-production.up.railway.app/health

# Check build status
cd apps/mobile && eas build:list --limit 1
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| PRD (source of truth) | `UTx PRD v2.pdf` |
| Theme | `apps/mobile/src/constants/theme.ts` |
| WorkoutCard | `apps/mobile/src/components/WorkoutCard.tsx` |
| Backend routes | `apps/backend/src/routes/*.ts` |
| Mobile screens | `apps/mobile/src/screens/*.tsx` |
| Navigation | `apps/mobile/src/navigation/` |
| Auth store | `apps/mobile/src/stores/authStore.ts` |
| API service | `apps/mobile/src/services/api.ts` |

---

## Links

- **TestFlight:** https://appstoreconnect.apple.com/apps/6758580968/testflight/ios
- **EAS Dashboard:** https://expo.dev/accounts/stevemilton/projects/utx/builds
- **Build IPA:** https://expo.dev/artifacts/eas/9oDeL5tSG7z9iwn59BaeUM.ipa

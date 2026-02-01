# UTx Development Status

**Last Updated:** 1 February 2026, 9:30 PM
**Current Build:** 18 (building on EAS, auto-submitting to TestFlight)
**Branch:** `mystifying-keller` (merged to `main`)

---

## What Was Done Today

### Bug Fixes
- ✅ Fixed `formatTime` null check crash in WorkoutsScreen
- ✅ Fixed OCR timeout (increased from 30s to 60s for GPT-4o Vision)
- ✅ Added better error messages for OCR failures (timeout, network)
- ✅ Fixed date picker visibility on onboarding (added `themeVariant="dark"`)

### New Features
- ✅ **Username/Nickname** - Users can set @username for discovery
  - Backend: `username` field in Prisma schema (unique, optional)
  - Backend: Validation (3-20 chars, lowercase alphanumeric + underscore)
  - Backend: Search by name OR username in `/users/search`
  - Mobile: EditProfileScreen with username field
  - Mobile: AthleteSearchScreen displays usernames

- ✅ **Profile Privacy** - Public/private toggle
  - Backend: `isPublic` field in Prisma schema (default: true)
  - Backend: Search only returns public profiles
  - Mobile: Toggle in Settings > Privacy section

- ✅ **Athlete Search** - Find and follow other rowers
  - New `AthleteSearchScreen.tsx`
  - Search by name or @username
  - Follow/unfollow with optimistic updates
  - Shows workout count, follower count

- ✅ **Edit Profile Screen** - Full profile editing
  - New `EditProfileScreen.tsx`
  - Change avatar (camera or gallery)
  - Edit name, username, height, weight, max HR

- ✅ **Settings Reorganized**
  - Added Privacy section with public profile toggle
  - Added Social section with "Find Athletes"
  - Added Club section with "Change Club"
  - Icons throughout using @expo/vector-icons

- ✅ **Tab Bar Icons** - Added Ionicons to bottom navigation

### Files Created
- `apps/mobile/src/screens/AthleteSearchScreen.tsx`
- `apps/mobile/src/screens/EditProfileScreen.tsx`
- `apps/mobile/src/screens/ClubSearchScreen.tsx`

### Files Modified
- `apps/backend/prisma/schema.prisma` - Added `username`, `isPublic`
- `apps/backend/src/routes/users.ts` - Username validation, search by username
- `apps/mobile/src/stores/authStore.ts` - Added `username`, `isPublic` to UserProfile
- `apps/mobile/src/services/api.ts` - Added timeout option, 60s OCR timeout
- `apps/mobile/src/screens/SettingsScreen.tsx` - New sections
- `apps/mobile/src/screens/CameraScreen.tsx` - Better error handling
- `apps/mobile/src/screens/main/WorkoutsScreen.tsx` - formatTime null fix
- `apps/mobile/src/navigation/*` - Registered new screens

---

## Current State

### Deployment
- **GitHub:** Code pushed to `main`
- **Railway:** Backend deployed with new schema (username, isPublic fields migrated)
- **EAS/TestFlight:** Build 18 in progress, will auto-submit

### What to Test When Build 18 Arrives
1. Sign in with Apple/Google
2. Complete onboarding (check date picker is visible)
3. Go to Settings > Edit Profile - test username field
4. Go to Settings > Privacy - toggle public/private
5. Go to Settings > Social > Find Athletes - search and follow
6. Add Workout > Take Photo - test OCR (should have 60s timeout now)
7. Check all tab icons display correctly

---

## MVP Checklist (from PRD)

### ✅ Must Have (Launch) - DONE
- [x] Photo capture and AI data extraction (OCR)
- [x] Training log with workout history
- [x] Workout Report with HR analysis
- [x] Effort Score calculation
- [x] PB tracking and notifications
- [x] AI coaching insights (post-workout)
- [x] User profiles with physical stats
- [x] Firebase auth (Apple, Google)
- [x] Strava export
- [x] Clubs and Squads with roles (data model)
- [x] Squad feed
- [x] Basic leaderboards

### ⚠️ Should Have (Fast Follow) - PARTIAL
- [x] Following/followers and social feed
- [x] Reactions and comments (backend done)
- [x] Username for discovery
- [x] Profile privacy toggle
- [ ] Club-wide feed opt-in
- [ ] Weekly trend insights from AI
- [ ] Push notifications

### ❌ Known Issues
- **Phone auth disabled** - Expo managed workflow limitation, users must use Apple/Google
- **OCR needs real-world testing** - Increased timeout, but need to verify accuracy
- **Club join flow** - ClubSearchScreen exists but needs polish

---

## Next Session Priorities

1. **Test Build 18** - Verify all new features work on device
2. **Fix any bugs found** in testing
3. **Polish Club flow** - ClubSearchScreen needs work
4. **Consider:** Reactions/comments UI on feed cards

---

## Quick Commands

```bash
# Navigate to project
cd /Users/stevemilton/.claude-worktrees/utx/mystifying-keller

# Check build status
cd apps/mobile && eas build:list --limit 1

# Run new build
cd apps/mobile && eas build --platform ios --profile production --auto-submit

# Check Railway logs
# (use Railway dashboard)

# TypeScript check
cd apps/mobile && npx tsc --noEmit
cd apps/backend && npx tsc --noEmit
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| PRD (source of truth) | `UTx PRD v2.pdf` |
| Backend routes | `apps/backend/src/routes/*.ts` |
| Prisma schema | `apps/backend/prisma/schema.prisma` |
| Mobile screens | `apps/mobile/src/screens/*.tsx` |
| Navigation | `apps/mobile/src/navigation/` |
| Auth store | `apps/mobile/src/stores/authStore.ts` |
| API service | `apps/mobile/src/services/api.ts` |
| Theme | `apps/mobile/src/constants/theme.ts` |

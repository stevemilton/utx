# UTx Development Status

**Last Updated:** 2 February 2026, 6:30 PM
**Current Build:** 29 (building)
**Branch:** `ecstatic-satoshi`

---

## Build 29 - Strava Auto-Sync Integration

**Status:** Building on EAS
**Build URL:** https://expo.dev/accounts/stevemilton/projects/utx/builds/34e4ee81-2fd0-496b-b147-380a14f43b5e

### Strava Integration (Complete)

| Feature | Description |
|---------|-------------|
| **Auto-sync on workout creation** | Workouts automatically push to Strava when user has it connected |
| **OAuth flow with backend redirect** | `/strava/mobile-callback` redirects to `utx://strava-callback` |
| **Deep link handling** | App handles `utx://strava-callback?code=...` on return from OAuth |
| **Auto-sync toggle** | Users can enable/disable auto-sync in Settings |
| **Connection status API** | `GET /strava/status` returns `{ connected, autoSync }` |

### Files Modified/Created

| File | Changes |
|------|---------|
| `schema.prisma` | Added `stravaAutoSync` field to User model |
| `strava.ts` (routes) | Added `/mobile-callback`, `/status`, `PATCH /settings` endpoints |
| `workouts.ts` (routes) | Calls `autoSyncToStrava()` after workout creation |
| `stravaSync.ts` (NEW) | Utility for auto-syncing workouts to Strava |
| `App.tsx` | Deep link handling for Strava OAuth callback |
| `SettingsScreen.tsx` | Strava connection UI with auto-sync toggle |
| `api.ts` | Added `getStravaStatus()`, `updateStravaSettings()` methods |
| `api.ts` (constants) | Added `/strava/status`, `/strava/settings` endpoints |

### Environment Variables Required (Railway)

```
STRAVA_CLIENT_ID=<your_client_id>
STRAVA_CLIENT_SECRET=<your_client_secret>
STRAVA_REDIRECT_URI=https://utx-production.up.railway.app/strava/mobile-callback
```

### Strava API Settings

- **Authorization Callback Domain:** `utx-production.up.railway.app`

---

## Club Join Request System (Build 28)

Implemented dual-flow club joining:
- **Invite codes** - Instant join with code
- **Request to join** - Admin approval workflow

| Endpoint | Description |
|----------|-------------|
| `POST /clubs/:id/request` | Submit join request |
| `GET /clubs/:id/requests` | Get pending requests (admin) |
| `POST /clubs/:id/requests/:requestId/approve` | Approve request |
| `POST /clubs/:id/requests/:requestId/reject` | Reject request |
| `DELETE /clubs/:id/requests/:requestId` | Cancel own request |
| `GET /clubs/my-requests` | Get user's pending requests |

---

## Workout Detail Screen Redesign (Build 28)

Whoop/Strava-inspired design with:
- Hero section with large split time
- Effort Ring (circular gauge 0-10)
- HR Zone breakdown bar
- Comparison vs last similar workout
- PB gap indicator
- AI coaching insights

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
cd /Users/stevemilton/.claude-worktrees/utx/ecstatic-satoshi

# Run iOS Simulator
cd apps/mobile && npx expo start

# Run new build
cd apps/mobile && eas build --platform ios --profile production --auto-submit

# Test backend health
curl https://utx-production.up.railway.app/health

# Check build status
cd apps/mobile && eas build:list --limit 1
```

---

## Links

- **TestFlight:** https://appstoreconnect.apple.com/apps/6758580968/testflight/ios
- **EAS Dashboard:** https://expo.dev/accounts/stevemilton/projects/utx/builds

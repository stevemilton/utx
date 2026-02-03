# UTx Handoff - 3 February 2026

## COMPLETED THIS SESSION

### 1. Profile Support Section + Reset Password Modal ✅
**All code committed and pushed**

- **Commit:** `7dc50bc` - "Add Profile Support section with Reset Password modal"
- **Branch:** `affectionate-williams`
- **Pushed to GitHub:** Yes

**Files modified:**
| File | Changes |
|------|---------|
| `apps/mobile/src/screens/main/ProfileScreen.tsx` | Added maskEmail helper (L46-53), reset password state (L65-68), handlers (L228-252), Support section URLs (L474-506), Reset Password Modal (L597-662), modal styles (L1009-1069) |
| `apps/mobile/src/stores/authStore.ts` | Added `email?: string` to UserProfile interface (L10) |
| `CLAUDE.md` | Updated with Railway deployment info |

### 2. iOS Build 31 ✅
**Successfully submitted to TestFlight**

- **Build ID:** `217537fb-0d37-455e-9d58-c3fa3f7ba76d`
- **Build Logs:** https://expo.dev/accounts/stevemilton/projects/utx/builds/217537fb-0d37-455e-9d58-c3fa3f7ba76d
- **IPA:** https://expo.dev/artifacts/eas/58CrzXQitxkngiRreGTMYi.ipa

### 3. Railway Investigation ✅
**Root cause identified - deployment method was wrong**

Discovered that Railway is configured for **GitHub auto-deploy**, NOT CLI:
- Service name: `utx` (not "api" as previously documented)
- Root directory: `apps/backend` (configured in Railway dashboard)
- Branch: `main` (auto-deploys on push)
- CLI `railway up` fails with: `Could not find root directory: apps/backend`

---

## IN PROGRESS

### Backend Deployment
**Status:** NOT deployed (but not needed for Build 31)

The Profile Support changes are **frontend-only**. The backend `/auth/request-reset` endpoint already exists and is working on the current production deployment.

If backend changes are needed in the future:
```bash
git checkout main
git merge affectionate-williams
git push origin main
# Railway auto-deploys within ~2 minutes
```

---

## BROKEN/BLOCKED

### Railway CLI Deployment ❌
**DO NOT USE `railway up`** - it doesn't work for this project.

The documented command in STATUS.md is wrong:
```bash
# WRONG - This fails:
railway up --service api --detach
# Error: Could not find root directory: apps/backend
```

Railway is set up for GitHub auto-deploy only. The service watches the `main` branch.

### iOS Simulator
**Not tested this session** - was instructed to focus on Railway investigation first.

There was a conflict with another Expo server running on port 8081 from a different worktree.

---

## RESUME

### To Test Build 31 in Simulator
```bash
cd /Users/stevemilton/.claude-worktrees/utx/affectionate-williams

# Kill any existing Expo processes
pkill -f "expo" || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Start fresh
cd apps/mobile
npx expo start --ios
```

### To Verify Backend Health
```bash
curl https://utx-production.up.railway.app/health
```

### To Check Build 31 Status
```bash
cd /Users/stevemilton/.claude-worktrees/utx/affectionate-williams/apps/mobile
eas build:list --limit 3
```

### To Deploy Backend (when needed)
```bash
cd /Users/stevemilton/.claude-worktrees/utx/affectionate-williams
git checkout main
git merge affectionate-williams
git push origin main
# Railway auto-deploys from main branch
```

---

## NEXT TASKS

1. **Wait for TestFlight** - Build 31 should appear within 30-60 minutes
2. **Test on device** - Verify Profile Support section:
   - Help & FAQ → Opens Notion page
   - Contact Support → Opens mailto:support@polarindustries.co
   - Reset Password → Modal (only for email/password users)
   - Privacy Policy → Opens Notion page
   - Terms of Service → Opens Notion page
3. **Test Reset Password flow** - For email auth users:
   - Tap Reset Password
   - See masked email
   - Tap Send Reset Link
   - See loading → success state
   - Tap Done

---

## KEY URLS

| Resource | URL |
|----------|-----|
| Railway Dashboard | https://railway.com/project/02eb8439-e51a-4d38-8dca-4358a8a67046 |
| Railway Service Name | `utx` (NOT "api") |
| Backend Health | https://utx-production.up.railway.app/health |
| EAS Builds | https://expo.dev/accounts/stevemilton/projects/utx/builds |
| Build 31 | https://expo.dev/accounts/stevemilton/projects/utx/builds/217537fb-0d37-455e-9d58-c3fa3f7ba76d |
| TestFlight | https://appstoreconnect.apple.com/apps/6758580968/testflight/ios |

---

## DOCUMENTATION FIXES APPLIED

Updated `CLAUDE.md` with correct Railway deployment info:
- Railway uses GitHub auto-deploy, not CLI
- Service name is `utx`, not `api`
- Must push to `main` branch to trigger deploy

**STATUS.md still has incorrect info** (lines 72-77) - should be updated separately.

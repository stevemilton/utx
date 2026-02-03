# UTx Development Status

**Last Updated:** 3 February 2026, 11:00 AM
**Current Build:** 31 (building → TestFlight)
**Branch:** `affectionate-williams`

---

## Build 31 - Email Auth + Profile Support Section 🔄

**Status:** Building (auto-submit to TestFlight enabled)
**Build ID:** `217537fb-0d37-455e-9d58-c3fa3f7ba76d`
**Commit:** `7dc50bc` - "Add Profile Support section with Reset Password modal"

### Build Links
- **Build Logs:** https://expo.dev/accounts/stevemilton/projects/utx/builds/217537fb-0d37-455e-9d58-c3fa3f7ba76d
- **Submission:** https://expo.dev/accounts/stevemilton/projects/utx/submissions/897999ee-0092-4dbc-be06-4b32bfdaa28f

### Changes in Build 31
1. **Profile Support Section Updates**
   - Help & FAQ → Opens Notion help page
   - Contact Support → Opens mailto:support@polarindustries.co
   - Reset Password → In-app modal (email/password users only)
   - Privacy Policy → Opens Notion privacy policy
   - Terms of Service → Opens Notion terms page

2. **Reset Password Modal**
   - Shows masked email for privacy (s***e@example.com)
   - Loading state while sending
   - Success state with checkmark
   - Uses existing `/auth/request-reset` endpoint

### Build 30 Changes (Prior Commit)
- Full email/password authentication system
- Sign-up with email validation and password strength
- Login with rate limiting (5 attempts → 15min lockout)
- Email verification via Resend
- Password reset flow via Resend
- 6 new backend auth endpoints
- 5 new mobile auth screens

### Build 30 Earlier Changes
- UI fixes: date picker modal, gender button layout
- Effort score centered in ring on workout analysis
- White text on unit toggle buttons

---

## Git Worktrees

This project uses multiple git worktrees for parallel development:

| Worktree | Branch | Status | Last Build |
|----------|--------|--------|------------|
| `affectionate-williams` | affectionate-williams | **ACTIVE** | Build 31 (in progress) |
| `ecstatic-satoshi` | ecstatic-satoshi | Archived | Build 29 |
| `loving-visvesvaraya` | loving-visvesvaraya | Archived | Build 27 |
| `mystifying-keller` | mystifying-keller | Archived | Earlier |

**Current Active Branch:** `affectionate-williams`

---

## Deployment

### Railway Backend
- **Project:** `zonal-reverence`
- **Dashboard:** https://railway.com/project/02eb8439-e51a-4d38-8dca-4358a8a67046
- **URL:** https://utx-production.up.railway.app
- **Service:** `api`

```bash
# Deploy Backend
cd apps/backend
railway link --project zonal-reverence --environment production
railway up --service api --detach
```

### EAS / TestFlight
- **EAS Project ID:** e091f145-3f0a-459a-990d-bd18db0d747d
- **App Store Connect App ID:** 6758580968
- **Bundle ID:** com.utx.app

```bash
# Build & Auto-Submit to TestFlight
cd apps/mobile
eas build --platform ios --profile production --non-interactive --auto-submit
```

---

## Authentication System

The app now supports THREE auth methods:

| Method | Implementation | Status |
|--------|---------------|--------|
| Apple Sign-In | `expo-apple-authentication` | ✅ Working |
| Google Sign-In | `expo-auth-session` | ✅ Working |
| Email/Password | Custom with Resend emails | ✅ New in Build 31 |
| Phone Auth | N/A | ❌ Disabled (Expo limitation) |

### Email Auth Endpoints (Backend)
- `POST /auth/register-email` - Sign up
- `POST /auth/login-email` - Login
- `POST /auth/verify-email` - Verify email token
- `POST /auth/request-reset` - Request password reset
- `POST /auth/reset-password` - Reset with token
- `POST /auth/resend-verification` - Resend verification

### Email Auth Screens (Mobile)
- `EmailLoginScreen.tsx` - Login form
- `EmailSignupScreen.tsx` - Registration form
- `VerifyEmailScreen.tsx` - Check your email screen
- `ForgotPasswordScreen.tsx` - Request reset
- `ResetPasswordScreen.tsx` - New password form

---

## Support URLs

| Link | URL |
|------|-----|
| Help & FAQ | https://kind-lotus-435.notion.site/Help-2fcfeff7be008050ba24dc0ab0b51a5e |
| Privacy Policy | https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d |
| Terms of Service | https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde |
| Contact Support | support@polarindustries.co |

---

## Environment Variables

### Backend (Railway)
| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Session JWT signing |
| `DATABASE_URL` | PostgreSQL (auto-set) |
| `RESEND_API_KEY` | Transactional emails |
| `FIREBASE_PROJECT_ID` | Firebase project |
| `FIREBASE_CLIENT_EMAIL` | Service account |
| `FIREBASE_PRIVATE_KEY` | Service account key |

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| OCR Camera timeout | Open | Gallery works, camera may send larger images |
| Phone auth | Disabled | Expo managed workflow limitation |

---

## Build History

| Build | Date | Branch | Key Changes |
|-------|------|--------|-------------|
| 31 | 3 Feb 2026 | affectionate-williams | Email auth, Profile support section, Reset Password modal |
| 30 | 2 Feb 2026 | affectionate-williams | Recovered algorithms, HRA code, security fixes |
| 29 | 1 Feb 2026 | ecstatic-satoshi | OCR improvements, form validation |
| 28 | 31 Jan 2026 | ecstatic-satoshi | Bug fixes |
| 27 | 31 Jan 2026 | loving-visvesvaraya | Full light mode redesign |

---

## Key Files Reference

| Purpose | File |
|---------|------|
| PRD | `UTx PRD v2.pdf` |
| Theme | `apps/mobile/src/constants/theme.ts` |
| Auth Store | `apps/mobile/src/stores/authStore.ts` |
| API Service | `apps/mobile/src/services/api.ts` |
| Email Service | `apps/backend/src/services/email.ts` |
| Auth Routes | `apps/backend/src/routes/auth.ts` |
| DB Schema | `apps/backend/prisma/schema.prisma` |
| Profile Screen | `apps/mobile/src/screens/main/ProfileScreen.tsx` |

---

## Quick Commands

```bash
# Navigate to active worktree
cd /Users/stevemilton/.claude-worktrees/utx/affectionate-williams

# Check git status
git status && git log --oneline -5

# Test backend health
curl https://utx-production.up.railway.app/health

# Check build status
cd apps/mobile && eas build:list --limit 3

# TypeScript check
cd apps/mobile && npx tsc --noEmit

# Deploy backend
cd apps/backend && railway up --service api --detach

# Build iOS
cd apps/mobile && eas build --platform ios --profile production --auto-submit
```

---

## Links

- **TestFlight:** https://appstoreconnect.apple.com/apps/6758580968/testflight/ios
- **EAS Dashboard:** https://expo.dev/accounts/stevemilton/projects/utx/builds
- **Railway Dashboard:** https://railway.com/project/02eb8439-e51a-4d38-8dca-4358a8a67046
- **GitHub:** https://github.com/stevemilton/utx

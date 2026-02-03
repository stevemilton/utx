# UTx Development Notes

## Quick Reference

### Deployment Commands
```bash
# Backend Deploy (Railway) - AUTO-DEPLOYS FROM GITHUB
# Railway watches the `main` branch and auto-deploys when pushed
# Service name is "utx" (not "api")
# Root directory configured as "apps/backend" in Railway dashboard
git checkout main
git merge <feature-branch>
git push origin main
# Railway will auto-deploy within ~2 minutes

# Manual redeploy (if needed):
# Go to Railway Dashboard → utx service → Deployments → Redeploy

# iOS Build & TestFlight Submit
cd apps/mobile
eas build --platform ios --profile production --non-interactive --auto-submit
```

### CRITICAL: Railway Deployment
**DO NOT use `railway up` CLI command** - it fails with "Could not find root directory: apps/backend"

Railway is configured for **GitHub auto-deploy**:
- Watches `main` branch on `stevemilton/utx` repo
- Root directory: `apps/backend` (configured in Railway dashboard)
- Service name: `utx` (NOT "api")
- Auto-deploys when `main` is pushed

### Key URLs
- **Railway Dashboard**: https://railway.com/project/02eb8439-e51a-4d38-8dca-4358a8a67046
- **Railway Project Name**: `zonal-reverence`
- **Backend URL**: https://utx-production.up.railway.app
- **EAS Builds**: https://expo.dev/accounts/stevemilton/projects/utx/builds
- **TestFlight App ID**: 6758580968
- **EAS Project ID**: e091f145-3f0a-459a-990d-bd18db0d747d

### Git Worktrees
This project uses multiple git worktrees for parallel development:
- `loving-visvesvarata` - Earlier feature branch
- `ecstatic-satoshi` - Earlier feature branch
- `affectionate-williams` - Current active branch (Build 31+)

---

## CRITICAL: Authentication in React Native / Expo

**STOP. Before implementing auth, read this.**

### The Golden Rule
**Never use Firebase JS SDK (`firebase/auth`) in Expo or React Native.** It requires native modules and will fail with cryptic errors like "Component auth has not been registered yet".

### The Correct Approach for Expo Managed Workflow

```
Mobile App                         Backend
    |                                  |
    |-- Get token from Apple/Google -->|
    |   (expo-apple-authentication)    |
    |   (expo-auth-session)            |
    |                                  |
    |<-- Verify token, return JWT -----|
    |    (Firebase Admin SDK or        |
    |     direct provider verification)|
    |                                  |
    |-- Use JWT for all API calls ---->|
```

### Implementation Checklist
1. **Mobile**: Use `expo-apple-authentication` for Apple Sign-In
2. **Mobile**: Use `expo-auth-session` for Google Sign-In
3. **Mobile**: Send raw provider tokens to your backend
4. **Backend**: Verify Apple tokens via JWKS (appleid.apple.com/auth/keys)
5. **Backend**: Verify Google tokens via tokeninfo endpoint
6. **Backend**: Issue your own JWT for session management
7. **Phone Auth**: NOT POSSIBLE in Expo managed workflow - use Twilio or skip it

### What NOT To Do
- ❌ `import { getAuth } from 'firebase/auth'` - Will crash
- ❌ `signInWithCredential()` - Requires native modules
- ❌ `@react-native-firebase/auth` without ejecting - Won't work
- ❌ Phone auth in Expo managed workflow - Impossible

---

## Current Auth Implementation

The app supports THREE auth methods:
1. **Apple Sign-In**: Uses `expo-apple-authentication` to get identity token
2. **Google Sign-In**: Uses `expo-auth-session` to get ID token
3. **Email/Password**: Full flow with email verification and password reset via Resend

### Email/Password Auth (Added Build 31)
- **Sign-up**: Email validation, password strength requirements (8+ chars, uppercase, lowercase, number)
- **Login**: Rate limiting (5 failed attempts → 15min lockout)
- **Email Verification**: 24-hour expiry tokens sent via Resend
- **Password Reset**: Secure tokens, 1-hour expiry, sent via Resend
- **Password Hashing**: bcrypt with cost factor 12

### Backend Auth Endpoints
- `POST /auth/register-email` - Register with email/password
- `POST /auth/login-email` - Login with email/password
- `POST /auth/verify-email` - Verify email with token
- `POST /auth/request-reset` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/resend-verification` - Resend verification email

---

## Project Structure

- `/apps/mobile` - Expo React Native app
- `/apps/backend` - Node.js backend on Railway
- PRD is source of truth: `UTx PRD v2.pdf`

### Key Mobile Files
- `src/screens/auth/` - Auth screens (EmailLogin, EmailSignup, ForgotPassword, ResetPassword, VerifyEmail)
- `src/screens/main/ProfileScreen.tsx` - Profile with Reset Password modal
- `src/screens/ClubDetailScreen.tsx` - Club view with admin features
- `src/screens/ClubSearchScreen.tsx` - Search clubs, join by invite code
- `src/screens/CreateClubScreen.tsx` - Create new club flow
- `src/stores/authStore.ts` - Zustand auth state management
- `src/services/api.ts` - API service with all endpoints
- `src/utils/validation.ts` - Email/password validation utilities

### Key Backend Files
- `src/routes/auth.ts` - All auth endpoints
- `src/routes/clubs.ts` - Club CRUD, membership, join requests
- `src/routes/admin.ts` - Platform admin routes (club verification)
- `src/services/email.ts` - Resend email service (auth + club notifications)
- `prisma/schema.prisma` - Database schema with auth fields

---

## Environment Variables

### Backend (Railway)
- `JWT_SECRET` - Secret for signing session JWTs
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `RESEND_API_KEY` - Resend API key for transactional emails
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Railway)
- `ADMIN_API_KEY` - Secret key for platform admin endpoints
- `ADMIN_EMAIL` - Email for club creation notifications (default: clubs@polarindustries.co)

### Mobile (EAS)
- Environment variables configured in EAS dashboard for production builds

---

## Support URLs (Profile Screen)
- **Help & FAQ**: https://kind-lotus-435.notion.site/Help-2fcfeff7be008050ba24dc0ab0b51a5e
- **Privacy Policy**: https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d
- **Terms of Service**: https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde
- **Contact Support**: support@polarindustries.co

---

## Club Management System (Build 32)

### Club Lifecycle
1. User creates club → Status: `unverified`
2. Email sent to admin (clubs@polarindustries.co)
3. Admin verifies via `POST /admin/clubs/:id/verify`
4. Creator receives email with invite code
5. Members can join via invite code or request to join

### Club Endpoints
- `POST /clubs` - Create club (starts unverified)
- `GET /clubs/:id` - Get club details
- `PATCH /clubs/:id` - Update club (admin only)
- `DELETE /clubs/:id` - Delete club (admin only)
- `POST /clubs/join` - Join by invite code
- `POST /clubs/:id/request` - Request to join
- `GET /clubs/:id/members` - List members (member only)
- `DELETE /clubs/:id/members/:userId` - Remove member (admin only)
- `PATCH /clubs/:id/members/:userId` - Change role (admin only)
- `POST /clubs/:id/regenerate-code` - New invite code (admin only)

### Platform Admin Endpoints
Requires `x-admin-key` header matching `ADMIN_API_KEY` env var:
- `GET /admin/clubs/pending` - List unverified clubs
- `POST /admin/clubs/:id/verify` - Verify club
- `POST /admin/clubs/:id/reject` - Reject and delete club
- `GET /admin/clubs` - List all clubs with filters

### Club Roles
- `admin` - Can manage members, edit club, regenerate code
- `member` - Can view club, see invite code, leave

---

## Machine Type Support (Build 33)

### Database
- `MachineType` enum: `row`, `bike`, `ski`
- Default value: `row`
- Field added to Workout model

### Backend
- `mapMachineType()` helper in `apps/backend/src/routes/workouts.ts`
- Handled in both create (`POST /workouts`) and update (`PATCH /workouts/:id`)

### Mobile
- Machine type selector in AddWorkoutScreen (between Privacy toggle and Save button)
- Machine type indicator on WorkoutDetailScreen (below workout type badge)
- Icons: boat-outline (row), bicycle-outline (bike), snow-outline (ski)

---

## UI Decisions (Build 33)

### Disabled Features
- **Take Photo**: Greyed out and disabled on AddWorkoutScreen, shows "Coming soon"
  - Was too buggy for TestFlight release
  - Can be re-enabled by changing `View` back to `TouchableOpacity` and removing disabled styles

### Removed Features
- **Bell Icon**: Removed from FeedScreen header (was non-functional placeholder)
- **Personal Bests Section**: Removed from ProfileScreen entirely

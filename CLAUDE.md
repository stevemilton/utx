# UTx Development Notes

## Quick Reference

### Deployment Commands
```bash
# Backend Deploy (Railway)
cd apps/backend
railway link --project zonal-reverence --environment production
railway up --service api --detach

# iOS Build & TestFlight Submit
cd apps/mobile
eas build --platform ios --profile production --non-interactive --auto-submit
```

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
- `src/stores/authStore.ts` - Zustand auth state management
- `src/services/api.ts` - API service with all endpoints
- `src/utils/validation.ts` - Email/password validation utilities

### Key Backend Files
- `src/routes/auth.ts` - All auth endpoints
- `src/services/email.ts` - Resend email service
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

### Mobile (EAS)
- Environment variables configured in EAS dashboard for production builds

---

## Support URLs (Profile Screen)
- **Help & FAQ**: https://kind-lotus-435.notion.site/Help-2fcfeff7be008050ba24dc0ab0b51a5e
- **Privacy Policy**: https://kind-lotus-435.notion.site/Privacy-Policy-2fcfeff7be0080718fccc8b94e22580d
- **Terms of Service**: https://kind-lotus-435.notion.site/Terms-and-Conditions-2fcfeff7be0080a986f2c832b177ddde
- **Contact Support**: support@polarindustries.co

# UTx Development Notes

## Important Lessons Learned

### Firebase Auth in Expo Managed Workflow

**DO NOT use Firebase JS SDK (`firebase/auth`) for authentication in Expo managed workflow.**

The Firebase JS SDK v9+ requires native modules that don't work in Expo managed workflow. You'll get errors like:
- "Component auth has not been registered yet"
- Various native module linking errors

**Solutions:**
1. **Recommended for MVP**: Skip Firebase Auth on the client. Get Apple/Google tokens directly using `expo-apple-authentication` and `expo-auth-session`, then send them to your backend. The backend can verify tokens using Firebase Admin SDK.

2. **For full Firebase Auth**: Use `@react-native-firebase/auth` which requires ejecting to a bare workflow or using Expo Dev Client with custom native code.

3. **For phone auth specifically**: This is not possible in Expo managed workflow without native modules. Consider backend-based OTP via Twilio or similar.

### Current Auth Implementation

The app uses a simplified auth flow:
- Apple Sign-In: Uses `expo-apple-authentication` to get identity token
- Google Sign-In: Uses `expo-auth-session` to get ID token
- Tokens are sent directly to the backend for verification
- Phone auth is disabled (shows error message directing users to Apple/Google)

## Project Structure

- `/apps/mobile` - Expo React Native app
- `/apps/backend` - Node.js backend on Railway
- PRD is source of truth: `UTx PRD v2.pdf`

## Deployment

- Backend: https://utx-production.up.railway.app
- TestFlight: App ID 6758580968
- EAS Project ID: e091f145-3f0a-459a-990d-bd18db0d747d

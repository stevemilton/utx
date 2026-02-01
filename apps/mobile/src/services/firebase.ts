import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Complete pending auth sessions - wrap in try-catch to prevent crash on startup
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  console.warn('WebBrowser.maybeCompleteAuthSession failed:', e);
}

// Google OAuth client IDs
const GOOGLE_IOS_CLIENT_ID = '939602682205-l5fpnegg1c7icsj7inhsr7f7gum3dnnf.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '939602682205-l5fpnegg1c7icsj7inhsr7f7gum3dnnf.apps.googleusercontent.com';

// Types - simplified without Firebase User type
export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
  isNewUser?: boolean;
  displayName?: string;
  email?: string;
}

export interface PhoneVerificationResult {
  success: boolean;
  verificationId?: string;
  error?: string;
}

/**
 * Simplified Auth Service for Expo Managed Workflow
 *
 * Instead of using Firebase Auth SDK (which requires native modules),
 * we get tokens from Apple/Google and send them directly to the backend.
 * The backend handles Firebase Admin SDK verification.
 */
class AuthService {
  // Sign in with Apple - returns Apple's identity token directly
  async signInWithApple(): Promise<AuthResult> {
    try {
      // Check if Apple Auth is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Apple Sign-In is not available on this device',
        };
      }

      // Request credentials from Apple
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName, email } = appleCredential;

      if (!identityToken) {
        return {
          success: false,
          error: 'No identity token received from Apple',
        };
      }

      // Build display name from Apple's full name
      let displayName: string | undefined;
      if (fullName) {
        displayName = [fullName.givenName, fullName.familyName]
          .filter(Boolean)
          .join(' ') || undefined;
      }

      // Return the Apple identity token - backend will verify it
      return {
        success: true,
        token: identityToken,
        isNewUser: true, // Backend will determine this
        displayName,
        email: email ?? undefined,
      };
    } catch (error: any) {
      // User cancelled
      if (error.code === 'ERR_CANCELED') {
        return {
          success: false,
          error: 'Sign in cancelled',
        };
      }

      console.error('Apple Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed',
      };
    }
  }

  // Sign in with Google - returns Google's ID token directly
  async signInWithGoogle(idToken: string): Promise<AuthResult> {
    // The idToken comes from expo-auth-session
    // Just pass it through - backend will verify it
    return {
      success: true,
      token: idToken,
      isNewUser: true, // Backend will determine this
    };
  }

  // Get Google auth config for expo-auth-session hook
  getGoogleAuthConfig() {
    return {
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
    };
  }

  // Phone auth is not supported in Expo managed workflow without Firebase native modules
  // The backend would need to handle this via a REST API
  async sendPhoneVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
    return {
      success: false,
      error: 'Phone authentication is not available. Please use Apple or Google sign-in.',
    };
  }

  async verifyPhoneCode(code: string): Promise<AuthResult> {
    return {
      success: false,
      error: 'Phone authentication is not available. Please use Apple or Google sign-in.',
    };
  }

  // These are no-ops since we're not maintaining Firebase state
  async signOut(): Promise<void> {
    // No-op - auth state is managed by the app's authStore
  }

  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    // This would need to be handled by the backend
    return {
      success: false,
      error: 'Account deletion must be requested through the backend'
    };
  }

  // No-op methods for compatibility
  getCurrentUser() {
    return null;
  }

  async getIdToken(): Promise<string | null> {
    return null;
  }

  onAuthStateChanged(callback: (user: null) => void) {
    return () => {};
  }
}

export const firebaseAuth = new AuthService();

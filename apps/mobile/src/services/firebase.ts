import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  OAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  User,
  ConfirmationResult,
  Auth,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

// Complete pending auth sessions - wrap in try-catch to prevent crash on startup
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  console.warn('WebBrowser.maybeCompleteAuthSession failed:', e);
}

// Firebase configuration from GoogleService-Info.plist
const firebaseConfig = {
  apiKey: 'AIzaSyDAbCxgo5jde0HPCdkKjydi9UF07O1MyGM',
  authDomain: 'utxx-e4caa.firebaseapp.com',
  projectId: 'utxx-e4caa',
  storageBucket: 'utxx-e4caa.firebasestorage.app',
  messagingSenderId: '939602682205',
  appId: '1:939602682205:ios:9a8034530d287d67cb88b4',
};

// Google OAuth client IDs
const GOOGLE_IOS_CLIENT_ID = '939602682205-l5fpnegg1c7icsj7inhsr7f7gum3dnnf.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '939602682205-l5fpnegg1c7icsj7inhsr7f7gum3dnnf.apps.googleusercontent.com'; // Use same for web

// Types
export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  isNewUser?: boolean;
}

export interface PhoneVerificationResult {
  success: boolean;
  verificationId?: string;
  confirmationResult?: ConfirmationResult;
  error?: string;
}

class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private confirmationResult: ConfirmationResult | null = null;
  private initError: Error | null = null;

  constructor() {
    try {
      // Initialize Firebase
      if (getApps().length === 0) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }
      this.auth = getAuth(this.app);
    } catch (error) {
      console.error('Firebase initialization error:', error);
      this.initError = error instanceof Error ? error : new Error('Firebase initialization failed');
    }
  }

  private ensureInitialized(): void {
    if (this.initError) {
      throw this.initError;
    }
    if (!this.app || !this.auth) {
      throw new Error('Firebase not initialized');
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    if (!this.auth) return null;
    return this.auth.currentUser;
  }

  // Get ID token for API calls
  async getIdToken(): Promise<string | null> {
    if (!this.auth) return null;
    const user = this.auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    if (!this.auth) {
      // Return a no-op unsubscribe function
      console.warn('Firebase not initialized, cannot listen to auth state');
      return () => {};
    }
    return this.auth.onAuthStateChanged(callback);
  }

  // Sign in with Apple
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

      // Generate nonce for security
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(36).substring(2, 15)
      );

      // Request credentials from Apple
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, authorizationCode } = appleCredential;

      if (!identityToken) {
        return {
          success: false,
          error: 'No identity token received from Apple',
        };
      }

      // Create Firebase credential using OAuthProvider
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: nonce,
      });

      // Sign in to Firebase
      this.ensureInitialized();
      const userCredential = await signInWithCredential(this.auth!, credential);
      const token = await userCredential.user.getIdToken();

      // Check if this is a new user
      const isNewUser = userCredential.operationType === 'signIn' && !userCredential.user.displayName;

      // Update display name if provided
      if (appleCredential.fullName) {
        const displayName = [appleCredential.fullName.givenName, appleCredential.fullName.familyName]
          .filter(Boolean)
          .join(' ');

        if (displayName && !userCredential.user.displayName) {
          // Note: updateProfile would need to be imported and used here
          // For now, we'll handle this on the backend
        }
      }

      return {
        success: true,
        user: userCredential.user,
        token,
        isNewUser,
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

  // Sign in with Google using expo-auth-session
  async signInWithGoogle(idToken: string): Promise<AuthResult> {
    try {
      // Create Firebase credential from Google ID token
      const credential = GoogleAuthProvider.credential(idToken);

      // Sign in to Firebase
      this.ensureInitialized();
      const userCredential = await signInWithCredential(this.auth!, credential);
      const token = await userCredential.user.getIdToken();

      return {
        success: true,
        user: userCredential.user,
        token,
        isNewUser: userCredential.operationType === 'signIn' && !userCredential.user.displayName,
      };
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Google Sign-In failed',
      };
    }
  }

  // Get Google auth config for expo-auth-session hook
  getGoogleAuthConfig() {
    return {
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
    };
  }

  // Send phone verification code
  async sendPhoneVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
    try {
      // Ensure phone number is in E.164 format
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      // For React Native, we need to use signInWithPhoneNumber
      // This will trigger Firebase's built-in reCAPTCHA verification
      this.ensureInitialized();
      const confirmationResult = await signInWithPhoneNumber(
        this.auth!,
        formattedNumber
      );

      // Store the confirmation result for later verification
      this.confirmationResult = confirmationResult;

      return {
        success: true,
        confirmationResult,
      };
    } catch (error: any) {
      console.error('Phone verification error:', error);

      let errorMessage = 'Failed to send verification code';

      switch (error.code) {
        case 'auth/invalid-phone-number':
          errorMessage = 'Invalid phone number format';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 'auth/quota-exceeded':
          errorMessage = 'SMS quota exceeded. Please try again later.';
          break;
        case 'auth/captcha-check-failed':
          errorMessage = 'Captcha verification failed. Please try again.';
          break;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Verify phone code and sign in
  async verifyPhoneCode(code: string): Promise<AuthResult> {
    try {
      if (!this.confirmationResult) {
        return {
          success: false,
          error: 'No verification in progress. Please request a new code.',
        };
      }

      const userCredential = await this.confirmationResult.confirm(code);
      const token = await userCredential.user.getIdToken();

      // Clear the confirmation result
      this.confirmationResult = null;

      return {
        success: true,
        user: userCredential.user,
        token,
        isNewUser: !userCredential.user.displayName,
      };
    } catch (error: any) {
      console.error('Phone verification error:', error);

      let errorMessage = 'Invalid verification code';

      switch (error.code) {
        case 'auth/invalid-verification-code':
          errorMessage = 'Invalid code. Please check and try again.';
          break;
        case 'auth/code-expired':
          errorMessage = 'Code has expired. Please request a new one.';
          break;
        case 'auth/session-expired':
          errorMessage = 'Session expired. Please request a new code.';
          break;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    if (this.auth) {
      await this.auth.signOut();
    }
    this.confirmationResult = null;
  }

  // Delete account
  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.auth) {
        return { success: false, error: 'Firebase not initialized' };
      }
      const user = this.auth.currentUser;
      if (!user) {
        return { success: false, error: 'No user signed in' };
      }

      await user.delete();
      return { success: true };
    } catch (error: any) {
      // May need to re-authenticate
      if (error.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error: 'Please sign in again before deleting your account',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to delete account',
      };
    }
  }

  // Helper: Format phone number to E.164
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If no country code, assume US (+1)
    if (!cleaned.startsWith('+')) {
      // Remove leading 1 if present (US format)
      if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = cleaned.substring(1);
      }
      cleaned = '+1' + cleaned;
    }

    return cleaned;
  }
}

export const firebaseAuth = new FirebaseAuthService();

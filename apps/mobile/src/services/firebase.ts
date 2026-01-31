import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

// Types
export interface AuthResult {
  success: boolean;
  user?: FirebaseAuthTypes.User;
  token?: string;
  error?: string;
  isNewUser?: boolean;
}

export interface PhoneVerificationResult {
  success: boolean;
  verificationId?: string;
  error?: string;
}

class FirebaseAuthService {
  // Get current user
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  // Get ID token for API calls
  async getIdToken(): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void) {
    return auth().onAuthStateChanged(callback);
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

      // Request credentials from Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create Firebase credential
      const { identityToken, authorizationCode } = credential;

      if (!identityToken) {
        return {
          success: false,
          error: 'No identity token received from Apple',
        };
      }

      // Sign in to Firebase
      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        authorizationCode ?? undefined
      );

      const userCredential = await auth().signInWithCredential(appleCredential);
      const token = await userCredential.user.getIdToken();

      // Check if this is a new user
      const isNewUser = userCredential.additionalUserInfo?.isNewUser ?? false;

      // Update display name if provided and new user
      if (isNewUser && credential.fullName) {
        const displayName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');

        if (displayName) {
          await userCredential.user.updateProfile({ displayName });
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

  // Sign in with Google
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      // Note: expo-google-sign-in is deprecated
      // For production, use @react-native-google-signin/google-signin
      // This is a placeholder that shows the pattern

      // For now, return an error indicating setup needed
      return {
        success: false,
        error: 'Google Sign-In requires additional setup. Please use Apple or Phone auth.',
      };

      // When properly configured, it would look like:
      // const { idToken } = await GoogleSignin.signIn();
      // const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      // const userCredential = await auth().signInWithCredential(googleCredential);
      // const token = await userCredential.user.getIdToken();
      // return { success: true, user: userCredential.user, token };
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Google Sign-In failed',
      };
    }
  }

  // Send phone verification code
  async sendPhoneVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
    try {
      // Ensure phone number is in E.164 format
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);

      return {
        success: true,
        verificationId: confirmation.verificationId,
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
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Verify phone code and sign in
  async verifyPhoneCode(verificationId: string, code: string): Promise<AuthResult> {
    try {
      const credential = auth.PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await auth().signInWithCredential(credential);
      const token = await userCredential.user.getIdToken();

      return {
        success: true,
        user: userCredential.user,
        token,
        isNewUser: userCredential.additionalUserInfo?.isNewUser ?? false,
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
    await auth().signOut();
  }

  // Delete account
  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = auth().currentUser;
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

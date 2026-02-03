// Email validation regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /\d/,
};

/**
 * Validate email format
 * @returns Error message or null if valid
 */
export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Validate password strength
 * @returns Error message or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`;
  }
  if (!PASSWORD_REQUIREMENTS.hasUppercase.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!PASSWORD_REQUIREMENTS.hasLowercase.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!PASSWORD_REQUIREMENTS.hasNumber.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

/**
 * Validate password confirmation matches
 * @returns Error message or null if valid
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}

/**
 * Validate name
 * @returns Error message or null if valid
 */
export function validateName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Name is required';
  }
  if (name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  return null;
}

/**
 * Check individual password requirements for UI feedback
 */
export function getPasswordStrength(password: string): {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
} {
  const hasMinLength = password.length >= PASSWORD_REQUIREMENTS.minLength;
  const hasUppercase = PASSWORD_REQUIREMENTS.hasUppercase.test(password);
  const hasLowercase = PASSWORD_REQUIREMENTS.hasLowercase.test(password);
  const hasNumber = PASSWORD_REQUIREMENTS.hasNumber.test(password);

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber,
  };
}

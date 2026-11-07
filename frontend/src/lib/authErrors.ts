// Mistakes a user can make while verifying a phone number. Firebase reports these as errors, but
// they are expected, so they get a plain message and are not logged as crashes.
const USER_MESSAGES: Record<string, string> = {
  "auth/invalid-verification-code": "That code is not correct. Please try again.",
  "auth/code-expired": "That code has expired. Please request a new one.",
  "auth/session-expired": "That code has expired. Please request a new one.",
  "auth/invalid-phone-number": "Please enter a valid mobile number.",
  "auth/missing-phone-number": "Please enter your mobile number.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/quota-exceeded": "We cannot send more codes right now. Please try again later.",
  "auth/network-request-failed": "Network problem. Please check your connection and try again.",
  "auth/captcha-check-failed": "Verification check failed. Please refresh the page and try again.",
  "auth/requires-recent-login": "For your security, please log out and log in again before changing your number.",
  "auth/credential-already-in-use": "This number already belongs to another account.",
  "auth/account-exists-with-different-credential": "This number already belongs to another account.",
};

type AuthError = { code?: string; message?: string; response?: { data?: { message?: string } } };

export const isExpectedAuthError = (error: unknown): boolean =>
  Boolean((error as AuthError | undefined)?.code && USER_MESSAGES[(error as AuthError).code!]);

export const describeAuthError = (error: unknown, fallback: string): string => {
  const err = error as AuthError | undefined;
  if (err?.code && USER_MESSAGES[err.code]) return USER_MESSAGES[err.code];
  // Any other Firebase error has a message meant for developers, like "Firebase: Error (auth/...)".
  if (err?.code?.startsWith("auth/")) return fallback;
  return err?.response?.data?.message || err?.message || fallback;
};

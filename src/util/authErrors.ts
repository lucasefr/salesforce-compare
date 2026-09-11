/**
 * Detects Salesforce CLI / API authentication failures that require re-login.
 *
 * @param message - Error message or CLI JSON text.
 * @returns True when the user should re-authorize the Org.
 */
export function isAuthenticationError(message: string): boolean {
  const normalized = message.toLowerCase();
  const markers = [
    'invalid_session',
    'invalid session',
    'session expired',
    'refresh_token',
    'refreshtoken',
    'expired access/refresh token',
    'not authenticated',
    'authentication failure',
    'auth failure',
    'authorization error',
    'login required',
    'cannot find org',
    'no authorization information found',
    'namedorgnotfound',
    'orgauthinfoerror',
    'requesting for auth',
    'unauthorized',
    'oauth',
    'failed to authenticate',
    'authinfo',
    'enotfound: getaddrinfo',
  ];
  return markers.some((marker) => normalized.includes(marker));
}

/**
 * Error thrown when retrieve fails due to auth and recovery should happen
 * outside of any `withProgress` notification.
 */
export class AuthenticationRequiredError extends Error {
  /**
   * Creates an authentication-required error.
   *
   * @param message - Original CLI/API error text.
   * @param orgAlias - Org alias that needs re-authorization, when known.
   */
  constructor(
    message: string,
    public readonly orgAlias?: string
  ) {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

/**
 * Login instance presets matching Salesforce Extension Pack "Authorize an Org".
 */
export const LOGIN_INSTANCE_PRESETS = {
  production: 'https://login.salesforce.com',
  sandbox: 'https://test.salesforce.com',
} as const;

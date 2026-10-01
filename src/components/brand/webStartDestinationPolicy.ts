export type WebStartLocation = {
  pathname: string;
  search?: string;
  hash?: string;
};

const AUTH_PARAMETER_KEYS = [
  'code',
  'access_token',
  'refresh_token',
  'token_hash',
  'error',
  'error_code',
  'error_description',
] as const;

const AUTH_ACTION_TYPES = new Set([
  'recovery',
  'invite',
  'signup',
  'magiclink',
  'email_change',
]);

function containsAuthParameters(value: string | undefined): boolean {
  if (!value) return false;
  const parameters = new URLSearchParams(value.replace(/^[?#]/, ''));
  return AUTH_PARAMETER_KEYS.some((key) => parameters.has(key))
    || AUTH_ACTION_TYPES.has(parameters.get('type') ?? '');
}

/**
 * The destination choice belongs only to a plain document entry at home.
 * Deep links and authentication callbacks retain their existing route owners.
 * This helper neither consumes callback values nor changes the browser URL.
 */
export function shouldOfferWebStartChoice(location: WebStartLocation): boolean {
  if (location.pathname !== '/' && location.pathname !== '') return false;
  return !containsAuthParameters(location.search)
    && !containsAuthParameters(location.hash);
}

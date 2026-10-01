/** Native builds do not participate in the browser-only TV pairing flow. */
export function rememberTvLoginReturn(_code: string, _role: string, _expiresAt: string): boolean { return false; }
export function clearTvLoginReturn(): void {}
export function getTvLoginReturnPath(): string | null { return null; }
export function resolveTvLoginReturn(fallback: string): string { return fallback; }

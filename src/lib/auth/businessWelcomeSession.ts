/** Set after each successful Verwaltung / business login — cleared when welcome modal closes. */
let pendingBusinessWelcome = false;

export function markBusinessWelcomePending(): void {
  pendingBusinessWelcome = true;
}

export function isBusinessWelcomePending(): boolean {
  return pendingBusinessWelcome;
}

export function clearBusinessWelcomePending(): void {
  pendingBusinessWelcome = false;
}

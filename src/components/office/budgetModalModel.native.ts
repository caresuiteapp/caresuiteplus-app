// Generated native presentation from src/components/office/budgetModalModel.web.ts. Update through scripts/port-native-workspaces.mjs.
/** Accept exact euro amounts, never parseFloat prefixes, exponents or rounded fractions. */
export function parseBudgetModalAmount(value: string): number | null {
    const text = value.trim();
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)
        && !/^[+-]?\d+\.\d{1,2}$/.test(text))
        return null;
    const normalized = text.includes(',') || /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(text)
        ? text.replace(/\./g, '').replace(',', '.') : text;
    const amount = Math.round(Number(normalized) * 100);
    return Number.isSafeInteger(amount) && Math.abs(amount) <= 2147483647 ? amount : null;
}
export function isBudgetModalDate(value: string): boolean {
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function budgetModalToday(): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value).join('-');
}
export function budgetModalReasonError(reason: string): string | undefined {
    return !reason.trim() ? 'Bitte den Anlass der Änderung angeben.' : reason.trim().length > 2000 ? 'Die Begründung darf höchstens 2.000 Zeichen enthalten.' : undefined;
}

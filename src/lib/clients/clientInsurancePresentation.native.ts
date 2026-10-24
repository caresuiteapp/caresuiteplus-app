// Generated native presentation from src/lib/clients/clientInsurancePresentation.web.ts. Update through scripts/port-native-workspaces.mjs.
type ClientInsuranceSource = {
    insuranceNumber?: string | null;
    core?: {
        insuranceNumber?: string | null;
    } | null;
};
/** Use the existing client number only; billing references and historic fund IDs are not interchangeable. */
export function resolveClientInsuranceDisplay(client: ClientInsuranceSource | null | undefined, canViewSensitive: boolean): string {
    const stored = client?.core?.insuranceNumber?.trim() || client?.insuranceNumber?.trim();
    if (!stored)
        return 'Nicht hinterlegt';
    // A masked core value must never be replaced by an unmasked legacy value.
    if (!canViewSensitive || /[•●*…]|geschützt|masked/i.test(stored))
        return '••• Geschützt';
    return stored;
}

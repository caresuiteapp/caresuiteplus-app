// Generated native presentation from src/lib/assist/replacementReadinessAuthorityBoundary.web.ts. Update through scripts/port-native-workspaces.mjs.
export type ReplacementReadinessAuthorityBoundaryWeb = Readonly<{
    capability: 'absence_availability_replacement_and_standby_records';
    absencePeriod: 'provided';
    availabilityPeriod: 'provided';
    replacementPersonRelation: 'provided_partial';
    standbyTimeRecord: 'provided_partial';
    reachableContactChannel: 'not_provided';
    temporaryAuthorityScope: 'not_provided';
    authorityExpiry: 'not_provided';
    replacementInheritsPermissions: 'forbidden';
    appendOnlyCoverageHistory: 'not_enforced';
    sourceQuality: 'prepared_schema_and_partial_route_workflow';
}>;
const BOUNDARY: ReplacementReadinessAuthorityBoundaryWeb = Object.freeze({
    capability: 'absence_availability_replacement_and_standby_records',
    absencePeriod: 'provided',
    availabilityPeriod: 'provided',
    replacementPersonRelation: 'provided_partial',
    standbyTimeRecord: 'provided_partial',
    reachableContactChannel: 'not_provided',
    temporaryAuthorityScope: 'not_provided',
    authorityExpiry: 'not_provided',
    replacementInheritsPermissions: 'forbidden',
    appendOnlyCoverageHistory: 'not_enforced',
    sourceQuality: 'prepared_schema_and_partial_route_workflow',
});
/** States the boundary between planned coverage and separately granted rights. */
export function getReplacementReadinessAuthorityBoundaryWeb(): ReplacementReadinessAuthorityBoundaryWeb {
    return BOUNDARY;
}

import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';

/** The complete submitted content, including administrative fields and attachment references. */
export function buildVisitDocumentationContent(doc: EmployeePortalDocumentationInput) {
  return {
    short_description: doc.shortDescription.trim(),
    special_notes: doc.specialNotes?.trim() || null,
    deviations: doc.deviations?.trim() || null,
    deviation_justification: doc.deviationJustification?.trim() || null,
    referral_required: doc.referralRequired,
    emergency_or_problem: doc.emergencyOrProblem,
    sis_notes: doc.sisNotes?.trim() ?? null,
    vitals_summary: doc.vitalsSummary?.trim() ?? null,
    body_map_notes: doc.bodyMapNotes?.trim() ?? null,
    medication_notes: doc.medicationNotes?.trim() ?? null,
    care_report_notes: doc.careReportNotes?.trim() ?? null,
    photo_references: doc.photoReferences ?? [],
  };
}

export type VisitDocumentationContent = ReturnType<typeof buildVisitDocumentationContent>;

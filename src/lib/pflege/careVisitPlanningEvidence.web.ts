export type CareVisitPlanningTour = Readonly<{
  status: string;
  stops: readonly Readonly<{ status: string }>[];
}>;

export type CareVisitPlanningEvidence = Readonly<{
  tourCounts: Readonly<{
    draft: number;
    published: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    unknown: number;
  }>;
  stopCount: number;
  regularAppointmentCount: null;
  resourceAdmissionFiltered: false;
  draftAdmissionChecked: false;
  publicationAdmissionGuardPresent: true;
  startAdmissionGuardPresent: true;
  needPlanBound: false;
  frequencyBound: false;
  serviceTypeIdsBound: false;
  carePlanVersionBound: false;
  actualCareInferred: false;
  missingEvidence: readonly string[];
}>;

const MISSING_EVIDENCE = Object.freeze([
  'datumsspezifisch aktive Aufnahme bereits in Ressourcenliste und Entwurfserstellung',
  'versionierter Versorgungsbedarf und vereinbarte Besuchsfrequenz',
  'strukturierte Leistungsarten statt ausschließlich freier Leistungszusammenfassung',
  'gebundene Pflegeplan- oder Vereinbarungsversion mit vollständiger Originalhistorie',
]);

/** Read-only Web/Desktop boundary for the delivered tour list.
 * A tour status is not converted into an appointment, care-plan or execution fact. */
export function buildCareVisitPlanningEvidence(tours: readonly CareVisitPlanningTour[]): CareVisitPlanningEvidence {
  const counts = { draft: 0, published: 0, inProgress: 0, completed: 0, cancelled: 0, unknown: 0 };
  let stopCount = 0;
  for (const tour of tours) {
    stopCount += tour.stops.length;
    if (tour.status === 'draft') counts.draft += 1;
    else if (tour.status === 'published') counts.published += 1;
    else if (tour.status === 'in_progress') counts.inProgress += 1;
    else if (tour.status === 'completed') counts.completed += 1;
    else if (tour.status === 'cancelled') counts.cancelled += 1;
    else counts.unknown += 1;
  }
  return Object.freeze({
    tourCounts: Object.freeze(counts),
    stopCount,
    regularAppointmentCount: null,
    resourceAdmissionFiltered: false,
    draftAdmissionChecked: false,
    publicationAdmissionGuardPresent: true,
    startAdmissionGuardPresent: true,
    needPlanBound: false,
    frequencyBound: false,
    serviceTypeIdsBound: false,
    carePlanVersionBound: false,
    actualCareInferred: false,
    missingEvidence: MISSING_EVIDENCE,
  });
}

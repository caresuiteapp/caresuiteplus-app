import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

export function buildVisitProgress(input: {
  status: AssignmentStatus; serviceEnded: boolean; documentationComplete: boolean;
  requiresSignature: boolean; signatureCaptured: boolean;
}) {
  const complete = input.status === 'abgeschlossen';
  const arrived = ['angekommen', 'gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(input.status);
  const steps = [
    { label: 'Anfahrt', done: arrived },
    { label: 'Einsatz', done: input.serviceEnded || complete },
    { label: 'Doku', done: input.documentationComplete || complete },
    ...(input.requiresSignature ? [{ label: 'Unterschrift', done: input.signatureCaptured || complete }] : []),
    { label: 'Abschluss', done: complete },
  ];
  const current = ['storniert', 'nicht_erschienen'].includes(input.status) ? -1 : steps.findIndex((step) => !step.done);
  return { steps, current };
}

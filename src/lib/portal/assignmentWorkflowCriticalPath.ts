/**
 * Critical path for assignment execution (Mitarbeiterportal + Assist Durchführung).
 * Used by regression gate tests — keep in sync when workflow files move.
 */
export const ASSIGNMENT_WORKFLOW_PHASES = [
  'consent',
  'travel_selection',
  'travel_recording',
  'travel_confirmation',
  'arrive',
  'start_service',
  'service_trips',
  'tasks',
  'end_service',
  'documentation',
  'signature',
  'completion_destination',
  'completion_travel',
  'completion_confirmation',
  'completed',
] as const;

export type AssignmentWorkflowPhase = (typeof ASSIGNMENT_WORKFLOW_PHASES)[number];

/** Files that must remain end-to-end executable; treat edits as RED ZONE. */
export const ASSIGNMENT_WORKFLOW_CRITICAL_FILES = [
  'app/portal/employee/assignments/[id]/execute.tsx',
  'app/assist/assignments/[id]/execute.tsx',
  'src/screens/portal/EmployeePortalVisitExecutionScreen.tsx',
  'src/hooks/useEmployeePortalVisitExecution.ts',
  'src/features/employeeExecutionCore/model.ts',
  'src/features/employeeExecutionCore/reducer.ts',
  'src/lib/runtime/runtimeSafeCollections.ts',
  'src/components/portal/EmployeePortalVisitLogbookCard.tsx',
  'src/components/portal/EmployeePortalReturnTripModal.tsx',
  'src/components/portal/EmployeePortalExecutionSectionBoundary.tsx',
  'src/components/portal/EmployeePortalVisitTasksPanel.tsx',
  'src/components/portal/EmployeePortalVisitDocumentationPanel.tsx',
  'src/components/portal/EmployeePortalVisitSignaturePanel.tsx',
  'src/components/portal/EmployeePortalVisitBottomBar.tsx',
  'src/components/portal/EmployeePortalVisitLiveDashboard.tsx',
  'src/components/portal/EmployeePortalVisitCompletionPanel.tsx',
  'src/components/portal/PortalSignatureCapturePanel.tsx',
  'src/components/inputs/CareSignatureModal.tsx',
  'src/components/inputs/CareSignatureCanvas.tsx',
  'src/components/inputs/signatureCanvasCoords.ts',
  'src/components/signatures/SignatureDisplay.tsx',
  'src/components/ui/FullscreenOverlay.tsx',
  'src/lib/portal/resolveVisitExecutionPhase.ts',
  'src/lib/portal/resolveVisitExecutionUiState.ts',
  'src/lib/portal/employeePortalExecutionLiveService.ts',
  'src/lib/portal/employeePortalVisitTrackingPersistence.ts',
  'src/lib/portal/visitExecutionRoute.ts',
  'src/lib/signatures/normalizeSignatureCapture.ts',
  'src/lib/signatures/signatureOrientation.ts',
  'src/lib/assist/assistProofPdfService.ts',
  'src/lib/assist/assistProofPortalDocumentService.ts',
  'src/lib/dom/releaseSignatureCaptureEnvironment.ts',
  'src/features/liveTracking/startEmployeeLiveTracking.ts',
  'src/features/assistWorkflow/workflowRecoveryVerification.ts',
  'src/features/assistWorkflow/calculateVisitTimes.ts',
  'src/features/assistWorkflow/getVisitTimeSegments.ts',
  'src/features/assistWorkflow/markArrived.ts',
  'src/features/assistWorkflow/startPause.ts',
  'src/features/assistWorkflow/endPause.ts',
  'src/features/assistWorkflow/endService.ts',
  'src/features/assistWorkflow/saveVisitTimeEvent.ts',
  'src/features/assistWorkflow/reportNoShow.ts',
  'src/features/assistWorkflow/saveTaskResultsBatch.ts',
  'src/features/assistWorkflow/saveVisitDocumentation.ts',
  'src/features/assistWorkflow/saveClientSignature.ts',
  'src/features/assistWorkflow/finalizeVisit.ts',
  'src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts',
  'src/features/assistWorkflow/generateServiceRecord.ts',
] as const;

export type AssignmentWorkflowCriticalFile = (typeof ASSIGNMENT_WORKFLOW_CRITICAL_FILES)[number];

export type AssignmentWorkflowInvariant = {
  id: string;
  files: readonly AssignmentWorkflowCriticalFile[];
  /** Must match in at least one of the listed files (unless matchAllFiles). */
  mustContain: string | RegExp;
  /** When true, every listed file must match mustContain. */
  matchAllFiles?: boolean;
  /** When set, none of the listed files may match. */
  mustNotContain?: string | RegExp;
  reason: string;
};

/** Structural invariants that prevent known production breakages (tablet, modal, signature). */
export const ASSIGNMENT_WORKFLOW_INVARIANTS: AssignmentWorkflowInvariant[] = [
  {
    id: 'logbook-failure-isolation',
    files: ['src/screens/portal/EmployeePortalVisitExecutionScreen.tsx'],
    mustContain: '<EmployeePortalExecutionSectionBoundary assignmentId={visit.assignmentId} section="Fahrtenbuch">',
    reason: 'A Fahrtenbuch render failure must not take the complete assignment workflow offline.',
  },
  {
    id: 'runtime-neutral-execution-time-calculation',
    files: [
      'src/features/assistWorkflow/calculateVisitTimes.ts',
      'src/features/assistWorkflow/getVisitTimeSegments.ts',
    ],
    mustContain: 'lastItem(',
    matchAllFiles: true,
    mustNotContain: '.at(',
    reason: 'Node-only prototype support must not crash the Android execution context after sync.',
  },
  {
    id: 'tasks-single-modal',
    files: ['src/components/portal/EmployeePortalVisitTasksPanel.tsx'],
    mustContain: '{statusPicker ? statusPickerBody : body}',
    mustNotContain: /statusModal\s*=\s*statusPicker[\s\S]*<PlatformModal/,
    reason: 'Nested Aufgabenstatus modals block tablet touch.',
  },
  {
    id: 'signature-touch-guard',
    files: ['src/components/inputs/CareSignatureCanvas.tsx'],
    mustContain: 'touchInputActiveRef',
    reason: 'Tablet touch + pointer double-input causes erratic signature strokes.',
  },
  {
    id: 'signature-overlay-cleanup-on-mount',
    files: ['src/screens/portal/EmployeePortalVisitExecutionScreen.tsx'],
    mustContain: /useEffect\(\(\) => \{\s*releaseSignatureCaptureEnvironment\(\);\s*\}, \[\]\)/,
    reason: 'Leaked fullscreen overlay blocks all taps after signature.',
  },
  {
    id: 'fullscreen-overlay-transparent-host',
    files: ['src/components/ui/FullscreenOverlay.tsx'],
    mustContain: "host.style.backgroundColor = 'transparent'",
    mustNotContain: /applyWebPortalHostStyles[\s\S]*host\.style\.backgroundColor = '#fff'/,
    reason: 'White portal host causes full-screen freeze on tablet.',
  },
  {
    id: 'signature-no-browser-fullscreen',
    files: ['src/components/inputs/CareSignatureModal.tsx'],
    mustContain: 'tryFullscreenOnRequest: false',
    mustNotContain: 'tryFullscreen: true',
    reason: 'Browser fullscreen on mobile causes white-screen signature failures.',
  },
  {
    id: 'document-signature-no-browser-fullscreen',
    files: ['src/components/portal/PortalSignatureCapturePanel.tsx'],
    mustContain: '<CareSignatureModal',
    mustNotContain: 'tryFullscreen: true',
    reason: 'Portal document signatures must use the responsive modal without browser fullscreen.',
  },
  {
    id: 'execution-screen-shell-import',
    files: ['src/screens/portal/EmployeePortalVisitExecutionScreen.tsx'],
    mustContain: "import { PortalTabScreen } from '@/screens/portal/PortalTabScreen'",
    reason: 'Missing portal shell import causes an immediate execution white screen.',
  },
  {
    id: 'employee-execute-route',
    files: ['app/portal/employee/assignments/[id]/execute.tsx'],
    mustContain: 'EmployeePortalVisitExecutionScreen',
    reason: 'Employee execute route must render the visit execution screen.',
  },
];

export const ASSIGNMENT_WORKFLOW_GATE_TEST_GLOBS = [
  'src/__tests__/portal/assignmentWorkflowRegressionGate.test.ts',
  'src/__tests__/portal/employeePortalTabletTouchFix.test.ts',
  'src/__tests__/portal/visitExecutionWhiteScreenFix.test.ts',
  'src/__tests__/portal/deferredSignatureWhiteScreenFix.test.ts',
  'src/__tests__/portal/employeePortalMobileAcceptance.test.ts',
  'src/__tests__/assistWorkflow/workflowRecoveryVerification.test.ts',
  'src/__tests__/assistWorkflow/workflowCriticalPersistence.test.ts',
  'src/__tests__/liveTracking/startEmployeeLiveTrackingPersistence.test.ts',
  'src/__tests__/inputs/signatureCanvasCoords.test.ts',
  'src/__tests__/signatures/signatureOrientation.test.ts',
  'src/__tests__/signatures/signatureDisplay.test.ts',
] as const;

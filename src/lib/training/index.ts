export {
  ACADEMY_INTEGRATION_NOTICE,
  ACADEMY_INTEGRATION_REGISTRY,
  assertAcademyIntegrationAllowed,
  getAcademyIntegration,
  isAcademyIntegrationLive,
} from './academyIntegrationPrepared';
export type { AcademyIntegrationEntry, AcademyIntegrationProvider, AcademyIntegrationStatus } from './academyIntegrationPrepared';
export { isCertificateValidForDeployment, verifyEmployeeCertificate } from './certificateService';
export {
  canViewCertificate,
  canViewEmployeeTrainingRecords,
  canViewTrainingAdminDashboard,
  canVerifyCertificate,
  filterCertificatesForActor,
  filterTrainingRecordsForActor,
  TRAINING_ADMIN_ROLES,
  TRAINING_CERTIFICATE_REVIEW_ROLES,
  TRAINING_CLIENT_BLOCKED_ROLES,
} from './trainingAccessGuard';
export type { TrainingAccessDecision } from './trainingAccessGuard';
export {
  checkAssignmentTrainingEligibility,
  filterEmployeesEligibleForAssignment,
  shouldSuggestAlternativeEmployees,
  trainingIssuesToAssignmentConflicts,
} from './trainingAssignmentIntegration';
export { buildTrainingDashboardTiles } from './trainingDashboardStats';
export {
  countTrainingLiveFlipBlockersRemaining,
  getTrainingLiveFlipBlockers,
  isTrainingLiveReady,
  isTrainingWiringPrepared,
  TRAINING_LIVE_WIRING_MIGRATION,
  TRAINING_PREPARED_MESSAGE,
  TRAINING_UI_ROUTE,
  TRAINING_VIEW_ROUTES,
} from './trainingModuleConfig';
export type { TrainingLiveFlipBlocker } from './trainingModuleConfig';
export {
  DEFAULT_MANDATORY_TRAINING_BY_MODULE,
  DEFAULT_MANDATORY_TRAINING_BY_ROLE,
  resolveMandatoryCourseKeys,
  resolveRequiredCoursesForEmployee,
} from './trainingRequirementsRegistry';
export {
  completeTrainingRecord,
  evaluateEmployeeTrainingDeployability,
  fetchEmployeeCertificates,
  fetchEmployeeTrainingRecords,
  fetchTrainingCourses,
  fetchTrainingDashboard,
  fetchTrainingReminders,
  refreshTrainingReminders,
  __resetTrainingServiceForTests,
  __seedTrainingServiceForTests,
} from './trainingService';
export {
  computeTrainingRecordStatus,
  daysUntil,
  isTrainingValidForDeployment,
  reminderLevelForDaysRemaining,
  syncExpiredTrainingStatuses,
} from './trainingStatusService';
export {
  appendTrainingAuditEvent,
  getTrainingCertificatesForTenant,
  getTrainingCoursesForTenant,
  getTrainingRecordsForTenant,
  resetTrainingStoreForTests,
  seedTrainingDemoStore,
  TRAINING_STORE,
} from './trainingStore';
export {
  TRAINING_TYPE_GROUP_LABELS,
  TRAINING_RECORD_STATUS_LABELS,
  CERTIFICATE_VERIFICATION_LABELS,
  TRAINING_VIEW_LABELS,
} from '@/types/modules/training';

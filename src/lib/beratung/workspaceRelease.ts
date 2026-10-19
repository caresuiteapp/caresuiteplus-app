/** Activate only with the consultation migration and the end-to-end release checks. */
export function isConsultationWorkspaceEnabled(): boolean {
    return process.env.EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED === 'true';
}

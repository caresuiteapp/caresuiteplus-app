import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

export const PORTAL_REFRESH_TASK = 'caresuite-portal-cache-refresh-v1';
if (!TaskManager.isTaskDefined(PORTAL_REFRESH_TASK)) {
  TaskManager.defineTask(PORTAL_REFRESH_TASK, async () => {
    try {
      const { refreshPortalDeviceCache } = await import('./refreshPortalDeviceCache');
      const ok = await refreshPortalDeviceCache();
      return ok
        ? BackgroundTask.BackgroundTaskResult.Success
        : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}
let configuration = Promise.resolve();
export function configurePortalBackgroundRefresh(enabled: boolean): Promise<void> {
  configuration = configuration
    .catch(() => {})
    .then(async () => {
      if (enabled) {
        if (
          (await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available
        )
          return;
        if (!(await TaskManager.isTaskRegisteredAsync(PORTAL_REFRESH_TASK))) {
          await BackgroundTask.registerTaskAsync(PORTAL_REFRESH_TASK, { minimumInterval: 30 });
        }
      } else if (await TaskManager.isTaskRegisteredAsync(PORTAL_REFRESH_TASK)) {
        await BackgroundTask.unregisterTaskAsync(PORTAL_REFRESH_TASK);
      }
    })
    .catch(() => {
      /* Unsupported/locked devices retain foreground refresh. */
    });
  return configuration;
}
export async function portalBackgroundRefreshStatus(): Promise<
  'available' | 'restricted' | 'unsupported'
> {
  try {
    return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available
      ? 'available'
      : 'restricted';
  } catch {
    return 'unsupported';
  }
}

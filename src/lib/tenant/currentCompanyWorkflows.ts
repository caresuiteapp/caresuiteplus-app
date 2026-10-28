import { Platform } from 'react-native';

/** Android and iOS use the same validated company workflow as the Web release. */
export const currentCompanyWorkflows = ['web', 'android', 'ios'].includes(Platform.OS);

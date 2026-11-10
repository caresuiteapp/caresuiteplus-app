import { Platform } from 'react-native';

export const NRW_MODULES = [
  'Grundlagen und Begriffe',
  'Grundlagen der Betreuungsarbeit',
  'Grund- und Notfallwissen',
  'Häufige Krankheitsbilder',
  'Wahrnehmung und Kommunikation',
  'Hauswirtschaft und Hygiene',
  'Selbstmanagement',
  'Alltagsaktivierung und Betreuung',
] as const;

export const NRW_FINAL_LESSON = 'nrw-final';
export const NRW_PRACTICE_UPLOAD = '/portal/employee/uploads?nachweis=anfoevo-nrw';
export const nrwModuleCode = (index: number) => String(index + 1).padStart(2, '0');
export const nrwModuleImage = (code: string, example = false) => {
  const origin = Platform.OS === 'web' ? '' : 'https://www.caresuiteplus.app';
  return `${origin}/academy/anfoevo-nrw-v1/${code}${example ? '-praxis' : ''}.jpg`;
};

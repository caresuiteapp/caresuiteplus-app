import {useNativeUnsavedChanges} from './useNativeUnsavedChanges.native';
export function useUserProfileUnsavedChanges(dirty:boolean,busy:boolean){return useNativeUnsavedChanges(dirty,busy,'Ihre Änderungen am Profil oder Profilbild sind noch nicht gespeichert. Möchten Sie die Seite ohne Speichern verlassen?');}

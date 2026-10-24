import {useNativeUnsavedChanges} from './useNativeUnsavedChanges.native';
export function useDataRequestUnsavedChanges(dirty:boolean,busy:boolean){return useNativeUnsavedChanges(dirty,busy,'Der Eingang Ihrer Anfrage ist noch nicht bestätigt. Möchten Sie die Seite verlassen und den Entwurf verwerfen?');}

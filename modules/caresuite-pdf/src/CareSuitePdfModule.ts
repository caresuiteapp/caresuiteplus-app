import { requireNativeModule } from 'expo';
import type { NativeModule } from 'expo';

declare class CareSuitePdfModule extends NativeModule<{}> {
  extractAttachments(uri:string):Promise<Array<{name:string;base64:string}>>;
  renderPages(uri:string,maximumPages:number):Promise<Array<{uri:string;sourcePage:number;sourcePages:number;width:number;height:number}>>;
}

// Resolve only when a PDF operation is requested. Importing a page must not
// require the native PDF extension to be present in the current runtime.
export function getCareSuitePdfModule(): CareSuitePdfModule {
  try {
    const module = requireNativeModule<CareSuitePdfModule>('CareSuitePdf');
    if (typeof module?.extractAttachments !== 'function' || typeof module?.renderPages !== 'function') {
      throw new Error('Incomplete PDF extension');
    }
    return module;
  } catch {
    throw new Error('Die PDF-Funktion ist in dieser App-Version nicht verfügbar. Bitte aktualisiere die App.');
  }
}

export default {
  extractAttachments: (uri: string) => getCareSuitePdfModule().extractAttachments(uri),
  renderPages: (uri: string, maximumPages: number) => getCareSuitePdfModule().renderPages(uri, maximumPages),
};

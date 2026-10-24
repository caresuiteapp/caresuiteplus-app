import { NativeModule, requireNativeModule } from 'expo';

declare class CareSuitePdfModule extends NativeModule<{}> {
  extractAttachments(uri:string):Promise<Array<{name:string;base64:string}>>;
  renderPages(uri:string,maximumPages:number):Promise<Array<{uri:string;sourcePage:number;sourcePages:number;width:number;height:number}>>;
}

export default requireNativeModule<CareSuitePdfModule>('CareSuitePdf');

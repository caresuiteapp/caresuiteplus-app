import { registerWebModule, NativeModule } from 'expo';

// CareSuitePdfModule is not available on the web platform.
class CareSuitePdfModule extends NativeModule<{}> {}

export default registerWebModule(CareSuitePdfModule, 'CareSuitePdfModule');

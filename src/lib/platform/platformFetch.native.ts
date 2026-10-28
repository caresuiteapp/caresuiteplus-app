import {createNativeFileFetch} from './nativeByteBlob.shared';
export const platformFetch=createNativeFileFetch((...args)=>fetch(...args));

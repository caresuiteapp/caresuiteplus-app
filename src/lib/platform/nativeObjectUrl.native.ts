import 'react-native-url-polyfill/auto';
import {Directory,File,Paths} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {NativeByteBlob} from './nativeByteBlob.shared';
const original=globalThis.URL,owned=new Map<string,Directory>();
export type nativeURL=URL;
export const nativeURL=new Proxy(original,{get(target,key){if(key==='createObjectURL')return(value:Blob)=>{if(!(value instanceof NativeByteBlob))return target.createObjectURL(value);if(value.uri)return value.uri;const bytes=value.synchronousBytes();if(!bytes)throw Error('Die Vorschau benötigt einen vollständig gelesenen Dateiinhalt.');const folder=new Directory(Paths.cache,'caresuite-preview',Crypto.randomUUID());folder.create({intermediates:true,idempotent:true});const file=new File(folder,value.type.includes('pdf')?'preview.pdf':'preview.bin');file.create();file.write(bytes);owned.set(file.uri,folder);return file.uri;};if(key==='revokeObjectURL')return(url:string)=>{const folder=owned.get(url);if(folder){owned.delete(url);if(folder.exists)folder.delete();}else if(!url.startsWith('file:'))target.revokeObjectURL(url);};return Reflect.get(target,key,target);}});

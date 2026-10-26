// Exact browser substitutes for native device boundaries. These are not device
// functionality tests. Active device operations reject and are reported.
const deny = `const deny=name=>{(globalThis.__nativePortalAuditEvents??=[]).push({type:'blocked-device-boundary',operation:name});throw Error('Native device boundary is not exercised by this visual audit: '+name)};const reject=name=>async()=>deny(name);`;
const rejected = (prefix, names) => names.map(name => `export const ${name}=reject(${JSON.stringify(prefix + '.' + name)});`).join('\n');
export const nativePortalAuditDeviceBindings = {
  '@maplibre/maplibre-react-native': `${deny}
    import React from 'react';
    export const Map=()=>deny('MapLibre.Map'),Camera=React.forwardRef(()=>deny('MapLibre.Camera')),
      GeoJSONSource=()=>deny('MapLibre.GeoJSONSource'),Layer=()=>deny('MapLibre.Layer');`,
  'expo-task-manager': `${deny}
    const tasks=new Map();
    export const defineTask=(name,executor)=>{if(typeof name!=='string'||typeof executor!=='function')throw Error('Invalid audit task definition');tasks.set(name,executor)};
    export const isTaskDefined=name=>tasks.has(name);
    ${rejected('TaskManager', ['isTaskRegisteredAsync','getRegisteredTasksAsync','unregisterTaskAsync','unregisterAllTasksAsync','getTaskOptionsAsync','isAvailableAsync'])}`,
  'expo-location': `${deny}
    export const Accuracy={Lowest:1,Low:2,Balanced:3,High:4,Highest:5,BestForNavigation:6};
    export const ActivityType={Other:1,AutomotiveNavigation:2,Fitness:3,OtherNavigation:4,Airborne:5};
    export const PermissionStatus={GRANTED:'granted',DENIED:'denied',UNDETERMINED:'undetermined'};
    ${rejected('Location', ['getCurrentPositionAsync','getLastKnownPositionAsync','watchPositionAsync','getHeadingAsync','watchHeadingAsync','geocodeAsync','reverseGeocodeAsync','getForegroundPermissionsAsync','requestForegroundPermissionsAsync','getBackgroundPermissionsAsync','requestBackgroundPermissionsAsync','hasServicesEnabledAsync','getProviderStatusAsync','enableNetworkProviderAsync','isBackgroundLocationAvailableAsync','startLocationUpdatesAsync','stopLocationUpdatesAsync','hasStartedLocationUpdatesAsync','startGeofencingAsync','stopGeofencingAsync','hasStartedGeofencingAsync'])}`,
  'expo-document-picker': `${deny}${rejected('DocumentPicker', ['getDocumentAsync'])}`,
  'expo-image-picker': `${deny}
    export const MediaTypeOptions={All:'All',Videos:'Videos',Images:'Images'};
    export const UIImagePickerControllerQualityType={High:0,Medium:1,Low:2,VGA640x480:3,IFrame1280x720:4,IFrame960x540:5};
    export const VideoExportPreset={Passthrough:0,LowQuality:1,MediumQuality:2,HighestQuality:3};
    ${rejected('ImagePicker', ['launchCameraAsync','launchImageLibraryAsync','getPendingResultAsync','getCameraPermissionsAsync','requestCameraPermissionsAsync','getMediaLibraryPermissionsAsync','requestMediaLibraryPermissionsAsync'])}`,
  'expo-clipboard': `${deny}${rejected('Clipboard', ['setStringAsync','getStringAsync','hasStringAsync','getImageAsync','setImageAsync','hasImageAsync','getUrlAsync','setUrlAsync','hasUrlAsync'])}`,
  'expo-local-authentication': `${deny}
    export const AuthenticationType={FINGERPRINT:1,FACIAL_RECOGNITION:2,IRIS:3};
    export const SecurityLevel={NONE:0,SECRET:1,BIOMETRIC_WEAK:2,BIOMETRIC_STRONG:3};
    ${rejected('LocalAuthentication', ['hasHardwareAsync','supportedAuthenticationTypesAsync','isEnrolledAsync','getEnrolledLevelAsync','authenticateAsync','cancelAuthenticate'])}`,
  'expo-notifications': `${deny}
    export const PermissionStatus={GRANTED:'granted',DENIED:'denied',UNDETERMINED:'undetermined'};
    export const AndroidImportance={UNKNOWN:0,UNSPECIFIED:-1000,NONE:0,MIN:1,LOW:2,DEFAULT:3,HIGH:4,MAX:5};
    export const AndroidNotificationVisibility={UNKNOWN:0,PUBLIC:1,PRIVATE:2,SECRET:3};
    export const setNotificationHandler=handler=>{globalThis.__nativePortalAuditNotificationHandler=handler};
    export const addNotificationReceivedListener=()=>({remove(){}}),addNotificationResponseReceivedListener=()=>({remove(){}});
    ${rejected('Notifications', ['getPermissionsAsync','requestPermissionsAsync','getExpoPushTokenAsync','getDevicePushTokenAsync','setNotificationChannelAsync','scheduleNotificationAsync','getLastNotificationResponseAsync','clearLastNotificationResponseAsync','registerTaskAsync','unregisterTaskAsync'])}`,
  'expo-background-task': `${deny}
    export const BackgroundTaskResult={Success:1,Failed:2};export const BackgroundTaskStatus={Restricted:1,Available:2};
    ${rejected('BackgroundTask', ['getStatusAsync','registerTaskAsync','unregisterTaskAsync','triggerTaskWorkerForTestingAsync'])}`,
  'expo-application': `${deny}
    export const applicationId='app.caresuitehealthos.visual-audit',applicationName='CareSuite visual audit',nativeApplicationVersion='audit-only',nativeBuildVersion=null;
    export const getAndroidId=()=>deny('Application.getAndroidId');${rejected('Application', ['getInstallationTimeAsync','getLastUpdateTimeAsync','getInstallReferrerAsync'])}`,
  'expo-device': `${deny}
    export const isDevice=false,deviceName='Synthetic visual audit',modelName='Browser-native boundary',manufacturer='Audit',brand='Audit',osName='Android',osVersion='audit-only',totalMemory=4*1024*1024*1024;
    export const DeviceType={UNKNOWN:0,PHONE:1,TABLET:2,DESKTOP:3,TV:4};${rejected('Device', ['getDeviceTypeAsync','isRootedExperimentalAsync'])}`,
  'expo-speech': `${deny}${rejected('Speech', ['speak','stop','pause','resume','isSpeakingAsync','getAvailableVoicesAsync'])}`,
  'expo-speech-recognition': `${deny}
    export const ExpoSpeechRecognitionModule={
      abort(){},stop(){},addListener(){return{remove(){}}},
      isRecognitionAvailable:()=>deny('SpeechRecognition.isRecognitionAvailable'),
      supportsOnDeviceRecognition:()=>deny('SpeechRecognition.supportsOnDeviceRecognition'),
      requestPermissionsAsync:reject('SpeechRecognition.requestPermissionsAsync'),
      start:()=>deny('SpeechRecognition.start')
    };
    export const useSpeechRecognitionEvent=()=>{};`,
  'expo-sqlite': `${deny}${rejected('SQLite', ['openDatabaseAsync','deleteDatabaseAsync'])}export const openDatabaseSync=()=>deny('SQLite.openDatabaseSync');`,
  'expo-sqlite/kv-store': `const stores=new Map();export class SQLiteStorage{
    constructor(name){if(!stores.has(name))stores.set(name,new Map());this.values=stores.get(name)}
    getItemSync(key){return this.values.get(key)??null}setItemSync(key,value){this.values.set(key,value)}removeItemSync(key){this.values.delete(key)}clearSync(){this.values.clear()}getKeyByIndexSync(index){return [...this.values.keys()][index]??null}getLengthSync(){return this.values.size}
    async getItem(key){return this.getItemSync(key)}async setItem(key,value){this.setItemSync(key,value)}async removeItem(key){this.removeItemSync(key)}
  }`,
  'expo-crypto': `export const CryptoDigestAlgorithm={MD2:'MD2',MD4:'MD4',MD5:'MD5',SHA1:'SHA-1',SHA256:'SHA-256',SHA384:'SHA-384',SHA512:'SHA-512'};
    export const CryptoEncoding={HEX:'hex',BASE64:'base64'};export const randomUUID=()=>globalThis.crypto.randomUUID(),getRandomValues=value=>globalThis.crypto.getRandomValues(value);
    export const digest=(algorithm,data)=>globalThis.crypto.subtle.digest(algorithm,data);
    export const getRandomBytes=count=>getRandomValues(new Uint8Array(count)),getRandomBytesAsync=async count=>getRandomBytes(count);`,
  '@react-native-community/netinfo': `const state=()=>({type:'unknown',isConnected:true,isInternetReachable:true,details:null});
    export const addEventListener=listener=>{listener(state());return()=>{}};export const fetch=async()=>state(),refresh=fetch;
    export default {addEventListener,fetch,refresh};`,
};

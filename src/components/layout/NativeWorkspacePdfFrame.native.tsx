import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,ScrollView,View,type ViewStyle} from 'react-native';
import {File} from 'expo-file-system';
import * as Print from 'expo-print';
import {sanitizeTemplateHtml} from '@/features/documents/templateEngine/sanitizeTemplateHtml';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {platformFetch} from '@/lib/platform/platformFetch.native';
import {renderNativePdfPages} from '@/lib/platform/nativePdfInspection.native';
type Page={dataUrl:string;width:number;height:number;sourcePage:number;sourcePages:number};
/** Render original PDF bytes as native images; the source file is never replaced. */
export function NativeWorkspacePdfFrame({uri,html,title,style}:{uri?:string;html?:string;title?:string;style?:ViewStyle}){
  const [pages,setPages]=useState<Page[]>([]),[error,setError]=useState(''),revision=useRef(0);
  useEffect(()=>{const ticket=++revision.current;let active=true,temporary:File|null=null;setPages([]);setError('');void(async()=>{let source=(uri??'').split('#')[0];if(html){const safe=sanitizeTemplateHtml(html).html;const printed=await Print.printToFileAsync({html:safe});temporary=new File(printed.uri);source=printed.uri;}if(!source)throw Error('Die Dokumentdatei ist noch nicht verfügbar.');const bytes=source.startsWith('file:')?new Uint8Array(await new File(source).arrayBuffer()):new Uint8Array(await(await platformFetch(source)).arrayBuffer());if(!active||ticket!==revision.current)return;const result=await renderNativePdfPages(bytes,title??'Dokument',100);if(active&&ticket===revision.current)setPages(result);})().catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Die Dokumentvorschau konnte nicht geladen werden.');}).finally(()=>{if(temporary?.exists)temporary.delete();});return()=>{active=false;};},[uri,html,title]);
  return <View accessibilityLabel={title??'Dokumentvorschau'} style={[{minHeight:260,width:'100%',backgroundColor:'#dfe7ef',borderRadius:10,overflow:'hidden'},style]}>{error?<Text accessibilityRole="alert" style={{padding:16,color:'#a32e37'}}>{error}</Text>:!pages.length?<View style={{padding:24,gap:12,alignItems:'center'}}><ActivityIndicator/><Text>Dokumentvorschau wird geladen …</Text></View>:<ScrollView nestedScrollEnabled minimumZoomScale={1} maximumZoomScale={3} contentContainerStyle={{gap:12,padding:10}}>{pages.map(page=><Image key={page.sourcePage} accessibilityLabel={'Seite '+page.sourcePage+' von '+page.sourcePages} source={{uri:page.dataUrl}} resizeMode="contain" style={{width:'100%',aspectRatio:page.width/page.height,backgroundColor:'#fff'}}/>)}</ScrollView>}</View>;
}

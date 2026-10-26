import ts from 'typescript';
export function nativeSource(file,original){let source=original;
  // The native client portal must not mount the browser-only Academy workplace.
  if(file==='app/portal/client/akademie/index.web.tsx'){
    if(!original.includes('AcademyWorkspaceScreen'))throw Error('Stale native Academy entry adaptation');
    return "export { NativeAcademyPortalEntry as default } from '@/screens/portal/NativeAcademyPortalEntry.native';\n";
  }
  const replace=(from,to)=>{if(!source.includes(from))throw Error('Stale native adaptation: '+file+' '+from.slice(0,60));source=source.replace(from,to);};
  const body=(name,text)=>{const ast=ts.createSourceFile(file,source,99,true,4),fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!fn?.body)throw Error('Stale native function: '+file+' '+name);source=source.slice(0,fn.body.getStart(ast))+text+source.slice(fn.body.end);};
  const callback=(name,text)=>{const ast=ts.createSourceFile(file,source,99,true,4);let found;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name&&n.initializer&&ts.isCallExpression(n.initializer)){const fn=n.initializer.arguments[0];if(fn&&(ts.isArrowFunction(fn)||ts.isFunctionExpression(fn))&&ts.isBlock(fn.body))found=fn.body;}ts.forEachChild(n,visit);};visit(ast);if(!found)throw Error('Stale native callback: '+file+' '+name);source=source.slice(0,found.getStart(ast))+text+source.slice(found.end);};
  const block=(startText,endText,text)=>{const start=source.indexOf(startText),end=source.indexOf(endText,start);if(start<0||end<0)throw Error('Stale native block: '+file);source=source.slice(0,start)+text+source.slice(end);};
  const add=text=>{source=text+'\n'+source;};
  const delivery="import {shareNativeFile} from '@/lib/platform/nativeFileDelivery.native';";
  if(file==='src/liquid-command/screens/DesktopWeatherLocationDialog.web.tsx'){
    replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';");
    replace("import { useWebFontScale } from '@/design/web/WebFontScaleProvider';",'');
    replace("import type { WeatherPlace } from '@/hooks/useDesktopWeather.web';", "import type { WeatherPlace } from '@/lib/platform/desktopWeatherModel';");
    replace("      const response = await fetch('/weather/de-places-v1.json', { signal: controller.signal, credentials: 'same-origin' });\n      if (!response.ok) throw new Error('Place list unavailable');\n      const rows: unknown = await response.json();", "      const rows: unknown = require('../../../assets/weather/de-places-v1.json');");
    replace('  onChoose: (place: WeatherPlace | null) => boolean;', '  onChoose: (place: WeatherPlace | null) => boolean | Promise<boolean>;');
    replace('  const { effectiveScale: scale } = useWebFontScale();', '  const scale = 1; // Android Text applies the system font scale once.');
    replace("  const [query, setQuery] = useState('');", "  const [query, setQuery] = useState('');\n  const [busy,setBusy]=useState(false),[choiceError,setChoiceError]=useState('');\n  const selectionRequest=useRef(0),selectionBusy=useRef(false);");
    replace("    setQuery('');\n    let active = true;", "    setQuery('');\n    setChoiceError('');setBusy(false);selectionBusy.current=false;selectionRequest.current++;\n    let active = true;");
    replace('    return () => { active = false; };', '    return () => { active = false;selectionRequest.current++;selectionBusy.current=false; };');
    block('  const choose = (next: WeatherPlace | null) => {','  const body = ',`  const choose = async (next: WeatherPlace | null) => {
    if(!visible||selectionBusy.current)return;
    const request=selectionRequest.current;
    selectionBusy.current=true;setBusy(true);setChoiceError('');
    const clean=next?{name:next.name,postcode:next.postcode,region:next.region,district:next.district,latitude:next.latitude,longitude:next.longitude}:null;
    try{if(await onChoose(clean)&&request===selectionRequest.current)onClose();}
    catch{if(request===selectionRequest.current)setChoiceError('Der Wetterort konnte nicht gespeichert werden. Bitte erneut versuchen.');}
    finally{if(request===selectionRequest.current){selectionBusy.current=false;setBusy(false);}}
  };
`);
    replace('in diesem Browser gespeichert.', 'auf diesem Gerät gespeichert.');
    replace('Der Browser kann dafür nach Ihrer Standortfreigabe fragen.', 'Die App fragt bei Bedarf nach Ihrer Standortfreigabe. Für das Wetter werden nur ungefähre Koordinaten an Bright Sky übermittelt.');
    replace("{preferenceError ? <Text accessibilityRole=\"alert\" style={[styles.error, body]}>{preferenceError}</Text> : null}", "{preferenceError||choiceError ? <Text accessibilityRole=\"alert\" style={[styles.error, body]}>{preferenceError||choiceError}</Text> : null}");
    replace("{status === 'loading' ? 'Ortsverzeichnis wird geladen …'", "{busy ? 'Wetterort wird gespeichert …' : status === 'loading' ? 'Ortsverzeichnis wird geladen …'");
    replace('accessibilityState={{ selected }}', 'accessibilityState={{ selected,disabled:busy,busy }} disabled={busy}');
    replace('onPress={() => choose(entry)}', 'onPress={() => void choose(entry)}');
    replace('onPress={() => choose(null)} style={styles.automatic}', 'onPress={() => void choose(null)} disabled={busy} accessibilityState={{disabled:busy,busy}} style={styles.automatic}');
    replace('      <Pressable onPress={event => event.stopPropagation()} style=', '      <Pressable accessibilityViewIsModal onPress={event => event.stopPropagation()} style=');
  }
  // Android's shared select owns its native modal; browser popover and DOM
  // measurements cannot execute against native workflow element handles.
  if(file==='src/components/assist/AssistLiveFilterSelect.web.tsx'){
    replace("import { WebActionIcon } from '@/components/icons/WebActionIcon.web';",'');
    replace("import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';",'');
    replace('  value: string;\n','  value: string;\n  disabled?: boolean;\n');
    replace('options: readonly { value: string; label: string }[];','options: readonly { value: string; label: string; disabled?: boolean }[];');
    replace('value, options, onChange }: Props)','value, options, onChange, disabled = false }: Props)');
    replace("// Keep the list in the dialog's DOM/focus scope. Its open state is independent of\n// live timers and refreshed options; no browser-owned native select is involved.","// Keep the controlled value through refreshed options; Android owns the option modal.");
    body('AssistLiveFilterSelect',`{return <div className={className+' cs-live-filter'} data-cs-live-filter="native-select-v1"><style>{css}</style><span>{label}</span><select className="cs-live-filter-trigger" aria-label={ariaLabel} aria-description={options.length?'': 'Keine Auswahl verfügbar.'} value={value} disabled={disabled||!options.some(option=>!option.disabled)} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>{!options.length?<span role="status">Keine Auswahl verfügbar.</span>:null}</div>;}`);
  }
  if(file==='src/components/platformConsole/PlatformRuntimeBoundary.web.tsx'){
    body('usePlatformRuntime',"{useEffect(()=>{void refreshPlatformRuntime();},[]);return useSyncExternalStore(subscribePlatformRuntime,getPlatformRuntimeSnapshot,getPlatformRuntimeServerSnapshot);}");
    body('PlatformRuntimeBoundary',`{
      const pathname=usePathname(),snapshot=usePlatformRuntime(),block=platformRuntimeBlock(pathname,snapshot),router=useRouter();
      useEffect(()=>{const check=()=>{if(AppState.currentState==='active')void refreshPlatformRuntime();};check();const timer=setInterval(check,30000);const listener=AppState.addEventListener('change',state=>{if(state==='active')check();});return()=>{clearInterval(timer);listener.remove();};},[]);
      const title=block==='checking'?'Verfügbarkeit wird geprüft':block==='maintenance'?'CareSuite wird gerade gewartet':block==='registration'?'Firmenregistrierung derzeit pausiert':'Registrierung vorübergehend nicht verfügbar';
      const message=block==='checking'?'Einen Moment bitte. Der aktuelle Betriebsstatus wird geladen.':block==='maintenance'?'CareSuite steht vorübergehend nicht zur Verfügung. Ihre Anmeldung bleibt erhalten. Nach der Freigabe können Sie hier weiterarbeiten.':block==='registration'?'Neue Unternehmen können sich aktuell nicht registrieren. Bereits registrierte Unternehmen können CareSuite weiterhin nutzen.':'Die Registrierungsfreigabe konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.';
      return <View style={{flex:1,minHeight:0}}>
        {snapshot.settings?.notice&&!block?<View accessibilityLiveRegion="polite" style={{padding:16,backgroundColor:'#eaf4ff'}}><Text style={{color:'#12385b'}}>{snapshot.settings.notice}</Text></View>:null}
        <View style={{flex:1,minHeight:0}} accessibilityElementsHidden={Boolean(block)} importantForAccessibility={block?'no-hide-descendants':'auto'} pointerEvents={block?'none':'auto'}>{children}</View>
        <Modal visible={Boolean(block)} onRequestClose={()=>{}} transparent animationType="fade"><View style={{flex:1,padding:20,justifyContent:'center',backgroundColor:'#06172bf5'}}><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center'}}><View accessibilityViewIsModal style={{width:'100%',maxWidth:680,alignSelf:'center',padding:24,gap:20,borderWidth:1,borderColor:'#4f7aa0',borderRadius:24,backgroundColor:'#0c2640'}}>
          <Text accessibilityRole="header" style={{color:'#eef8ff',fontSize:24,fontWeight:'700'}}>CareSuite HealthOS</Text><Text accessibilityRole="header" style={{color:'#fff',fontSize:26,fontWeight:'700'}}>{title}</Text><Text style={{color:'#eef8ff',fontSize:16,lineHeight:25}}>{message}</Text>
          {snapshot.settings?.notice?<Text style={{color:'#eef8ff'}}>{snapshot.settings.notice}</Text>:null}
          {block!=='checking'?<View style={{gap:12}}>{[['Erneut prüfen',()=>void refreshPlatformRuntime()],['Hilfe und Kontakt',()=>router.push('/support' as never)],['Datenschutz',()=>router.push('/datenschutz' as never)],[block==='maintenance'?'Plattformverwaltung':'Zur Anmeldung',()=>router.push((block==='maintenance'?'/platform/login':'/auth') as never)]].map(([label,action])=><Pressable key={String(label)} accessibilityRole="button" onPress={action as ()=>void} style={{padding:14,minHeight:48,borderWidth:1,borderColor:'#729aba',borderRadius:14,backgroundColor:'#123955'}}><Text style={{color:'#fff',fontSize:16}}>{String(label)}</Text></Pressable>)}</View>:null}
        </View></ScrollView></View></Modal>
      </View>;
    }`);
    add("import {AppState,Modal,Pressable,ScrollView,Text,View} from 'react-native';\nimport {useRouter} from 'expo-router';");
  }
  if(file==='src/components/support/SupportArchive.web.tsx'){
    block('      const objectUrl = URL.createObjectURL(data);','    } catch (cause)',"      await shareNativeFile(new Uint8Array(await data.arrayBuffer()),file.file_name||'Support-Anhang',data.type||'application/octet-stream');\n");
    add(delivery);
  }
  if(file==='src/components/platformConsole/ConsoleWorkspaceUi.web.tsx'){
    body('downloadConsoleCsv',"{return shareNativeFile(consoleCsv(headers,rows),name+'-'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');}");
    add(delivery);
  }
  // React Native already applies the device's font scale to Text. The CSS scale
  // controls Web typography; invoking its provider here would throw on Android.
  if(file==='src/liquid-command/screens/DesktopAppsWidgetsCenter.web.tsx'){
    replace("import { useWebFontScale } from '@/design/web/WebFontScaleProvider';",'');
    replace('  const { effectiveScale } = useWebFontScale();','  const effectiveScale = 1;');
  }
  if(file==='src/liquid-command/components/DesktopAreaSwitcher.web.tsx'){
    replace('className="cs-desktop-area-artwork" size="2.5em"','size={40}');
  }
  if(file==='src/liquid-command/components/desktopAreaSwitcherCss.web.ts'){
    replace('repeat(auto-fit,minmax(min(100%,calc(112px * var(--cs-desktop-area-scale,1))),1fr))','repeat(auto-fit,minmax(112px,1fr))');
  }
  if(file==='src/liquid-command/screens/desktopAppsWidgetsCenterCss.web.ts'){
    replace('repeat(auto-fill,minmax(min(100%,calc(260px * var(--cs-center-scale,1))),1fr))','repeat(auto-fill,minmax(260px,1fr))');
  }
  if(file==='src/screens/help/HelpCenterScreen.web.tsx'){
    replace("@/components/layout/ScreenShell.web","@/components/layout/ScreenShell.tsx");
    replace('router.push(route as never)','router.push(nativeAdministrationRoute(route) as never)');
    replace('showBack={false} contentOwnsHeader>',"showBack={false} scroll={false} contentOwnsHeader><div style={{flex:1,minHeight:0,overflowY:'auto'}}>" );
    replace('</ScreenShell>','</div></ScreenShell>');
    add("import {nativeAdministrationRoute} from '@/liquid-command/navigation/nativeAdministrationModel';");
  }
  if(file==='src/components/help/HelpCenterView.web.tsx'){
    body('printArticle',"{const article=HELP_ARTICLES.find(item=>item.title===title);if(!article)return false;await printNativeHelpArticle(article);return true;}");
    replace('function printArticle(','async function printArticle(');
    replace("onClick={() => { if (printArticle(articleRef.current, article.title) === false) setStatus('Das Druckfenster wurde blockiert. Bitte erlauben Sie Pop-ups für diese Seite.'); }}","onClick={async()=>{try{if(await printArticle(articleRef.current,article.title)===false)setStatus('Die Anleitung konnte nicht für den Druck gelesen werden.');}catch(error){setStatus(error instanceof Error?error.message:'Der Android-Druckdialog konnte nicht geöffnet werden.');}}}");
    replace('window.location.origin',"'https://www.caresuiteplus.app'");
    replace('event.target.select()','undefined');
    replace("const heading = section?.querySelector<HTMLElement>('h2,h3'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }","section?.focus?.({preventScroll:true});");
    source=source.replaceAll('Hilfe für Web & Desktop','Hilfe für Web, Desktop & App').replaceAll('Web & Desktop</span>','Web, Desktop & App</span>');
    add("import {printNativeHelpArticle} from '@/features/help/nativeHelpArticlePrint.native';");
  }
  if(file==='src/components/googleWorkspace/workspaceCss.web.ts'){
    replace('(max-width:44em)','(max-width:704px)');
    replace('repeat(auto-fit,minmax(min(100%,17em),1fr))','repeat(auto-fit,minmax(272px,1fr))');
    replace('repeat(auto-fit,minmax(min(100%,16em),1fr))','repeat(auto-fit,minmax(256px,1fr))');
    source=source.replaceAll('grid-template-columns:minmax(0,1fr) auto','grid-template-columns:minmax(0,2fr) minmax(0,1fr)');
  }
  if(file==='src/components/googleWorkspace/WorkspaceDashboard.web.tsx'){
    replace('  const state = useGoogleWorkspace();',"  const state = useGoogleWorkspace();\n  const refreshStatus=state.refresh;\n  useEffect(()=>{if(callbackResult)void refreshStatus();},[callbackResult,refreshStatus]);");
  }
  if(file==='src/components/googleWorkspace/WorkspaceServicePanel.web.tsx'){
    replace("  const [filter, setFilter] = useState<WorkspaceFilter>({});","  const [filter, setFilter] = useState<WorkspaceFilter>({});\n  const [draft,setDraft]=useState({query:'',from:'',to:''});\n  const [filterError,setFilterError]=useState('');");
    replace("onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const from = String(data.get('from') || ''); const to = String(data.get('to') || ''); if (from && to && from > to) { (e.currentTarget.elements.namedItem('to') as HTMLInputElement).setCustomValidity('Das Ende muss am oder nach dem Beginn liegen.'); e.currentTarget.reportValidity(); return; } resetFilter({ ...filter, pageToken: undefined, query: String(data.get('query') || ''), from, to }); }}","onSubmit={e=>{e.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to){setFilterError('Das Ende muss am oder nach dem Beginn liegen.');return;}setFilterError('');resetFilter({...filter,pageToken:undefined,...draft});}}");
    replace('type="search" name="query"','type="search" name="query" value={draft.query} onChange={e=>setDraft(previous=>({...previous,query:e.target.value}))}');
    replace('type="date" name="from"','type="date" name="from" value={draft.from} onChange={e=>setDraft(previous=>({...previous,from:e.target.value}))}');
    replace('type="date" name="to" onInput={e => e.currentTarget.setCustomValidity(\'\')}','type="date" name="to" value={draft.to} onChange={e=>{setDraft(previous=>({...previous,to:e.target.value}));setFilterError(\'\');}}');
    replace('<form className="cs-w-filter"','{filterError&&<p role="alert" className="cs-w-notice error">{filterError}</p>}<form className="cs-w-filter"');
  }
  if(file==='src/components/googleWorkspace/WorkspaceActionForm.web.tsx'){
    replace("  const [mode, setMode] = useState(service === 'drive' ? 'upload' : 'create');","  const [mode, setMode] = useState(service === 'drive' ? 'upload' : 'create');\n  const [values,setValues]=useState<Record<string,string>>({});\n  const [pickedFile,setPickedFile]=useState<Blob&{name?:string}>();\n  const formRef=useRef<HTMLFormElement>(null);\n  const update=(key:string,value:string)=>setValues(previous=>({...previous,[key]:value}));");
    replace('const submit = async (form: HTMLFormElement, draft: boolean) => {','const submit = async (draft: boolean) => {');
    replace('if (lock.current || !form.reportValidity()) return;','if (lock.current || !formRef.current?.reportValidity()) return;');
    replace("const data = new FormData(form); const value = (key: string) => String(data.get(key) ?? '').trim();","const data={get:(key:string)=>key==='file'?pickedFile:values[key]}; const value=(key:string)=>(values[key]??'').trim();");
    replace("await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.')); reader.readAsDataURL(file); })","(await nativeBlobDataUrl(file)).split(',')[1]");
    replace('<form className="cs-w-form cs-w-stack"','<form ref={formRef} className="cs-w-form cs-w-stack"');
    replace('void submit(e.currentTarget, false)','void submit(false)');
    replace("onClick={e => { const form = e.currentTarget.form; if (form) void submit(form, true); }}","onClick={()=>void submit(true)}");
    for(const name of ['to','title','start','end','attendee','due','first','last','email','phone','body']){
      replace('name="'+name+'"','name="'+name+'" value={values.'+name+"??''} onChange={e=>update('"+name+"',e.target.value)}");
    }
    replace('type="checkbox" name="meet"','type="checkbox" name="meet" checked={values.meet===\'on\'} onChange={e=>update(\'meet\',e.target.checked?\'on\':\'\')}');
    replace('<input type="file" name="file" required/>','<input type="file" name="file" onChange={e=>setPickedFile(e.target.files?.[0])}/>{pickedFile&&<span className="cs-w-muted">{pickedFile.name}</span>}');
    add("import {nativeBlobDataUrl} from '@/lib/platform/nativeInvoiceLogo.native';");
  }
  if(file==='src/features/akademie/AcademyCourseEditor.web.tsx'){
    replace('!field.validity.valid','!(field as unknown as {valid():boolean}).valid()');
  }
  if(file==='src/components/office/ClientRecordDocumentsPanel.web.tsx'){
    replace('requestAnimationFrame(() => rowButtons.current?.querySelector<HTMLButtonElement>(`[data-document-id="${CSS.escape(lastOpened.current ?? \'\')}"] button`)?.focus());',"requestAnimationFrame(()=>nativeWorkspaceNodes.get('native-client-document-'+JSON.stringify([tenantId,clientId,lastOpened.current]))?.focus());");
    replace('<button className="cr-docs-row"','<button id={\'native-client-document-\'+JSON.stringify([doc.tenantId,doc.clientId,doc.id])} className="cr-docs-row"');
    add("import {nativeWorkspaceNodes} from '@/lib/platform/nativeWorkspaceNodes.shared';");
  }
  if(file==='src/components/documents/CentralCatalogWorkspace.web.tsx'){
    body('downloadBytes',"{return shareNativeFile(bytes,fileName,'application/pdf');}");
    body('logoImage',"{if(!url)return undefined;if(!url.startsWith('data:')&&new URL(url).protocol!=='https:')throw Error('Das Unternehmenslogo benötigt eine sichere HTTPS-Adresse.');const logo=await prepareNativeInvoiceLogo(url);if(!logo)throw Error('Das Unternehmenslogo konnte nicht für die PDF-Ausgabe geladen werden.');return logo.dataUrl;}");
    source=source.replace('    let printWindow: Window | null = null;','').replace("      if (action === 'print') { printWindow = window.open('', '_blank'); if (printWindow) printWindow.opener = null; }",'').replaceAll('printWindow?.close();','');
    block("      if (action === 'print') {","      if (action === 'save') {","      if(action==='print'){await printNativePdf(result.bytes,centralFileName(chosen));if(mounted.current)setMessage('PDF an den Android-Druckdialog übergeben.');}\n");
    source=source.replace('Gespeicherte Datei geprüft und heruntergeladen.','Gespeicherte Datei geprüft und an Android übergeben.');
    add("import {shareNativeFile,printNativePdf} from '@/lib/platform/nativeFileDelivery.native';\nimport {prepareNativeInvoiceLogo} from '@/lib/platform/nativeInvoiceLogo.native';");
  }
  if(file==='src/lib/office/notes/export.web.ts'){body('downloadNote',"{const exported=buildNoteExport(draft,format);return shareNativeFile(exported.content,exported.filename,exported.mimeType);}");source=source.replace('format: NoteExportFormat): void','format: NoteExportFormat): Promise<void>');add(delivery);}
  if(file==='src/components/portal/ClientSignatureRequiredDialog.web.tsx'){source=source.replace("    const overflow = document.body.style.overflow;\n    document.body.style.overflow = 'hidden';\n",'').replace('      document.body.style.overflow = overflow;\n','');}
  if(file==='src/components/auth/TvDeviceLogin.web.tsx')source=source.replace('window.location.origin',"'https://www.caresuiteplus.app'");
  if(file==='src/screens/qm/QmDashboardScreen.web.tsx')source=source.replace('className="qm-heading-art"',"style={{alignSelf:'flex-end'}}");
  if(file==='src/components/documents/CentralCatalogEntitySelect.web.tsx')source=source.replace('onChange: (id: string) => boolean;','onChange: (id: string) => boolean|Promise<boolean>;').replaceAll('onChange={(event) => {','onChange={async(event) => {').replace('if (onChange(id))','if (await onChange(id))').replace('onChange(event.target.value);','await onChange(event.target.value);');
  if(file==='src/lib/platform/speechDictation.web.ts'){body('getCtor','{return null;}');source=source.replace('Ihr Browser unterstützt kein Diktat. Sie können Text eingeben oder eine Audio-Aufnahme erstellen.','Sie können die Diktierfunktion Ihrer Tastatur verwenden, Text eingeben oder eine Audio-Aufnahme erstellen.');}
  if(file==='src/components/office/officeDocumentWorkspace.web.ts'){body('saveDocumentBlob',"{return shareNativeFile(new Uint8Array(await blob.arrayBuffer()),filename,blob.type||'application/octet-stream');}");source=source.replace('export function saveDocumentBlob(','export async function saveDocumentBlob(');add(delivery);}
  if(file==='src/screens/office/OfficeDocumentUploadScreen.web.tsx'){const expression=/await new Promise<string>\(\(resolve,reject\)=>\{const reader=new FileReader\(\);[\s\S]*?reader.readAsDataURL\(file\);\}\)/;if(!expression.test(source))throw Error('Stale upload file reader');source=source.replace(expression,"(await nativeBlobDataUrl(file)).split(',')[1]");add("import {nativeBlobDataUrl} from '@/lib/platform/nativeInvoiceLogo.native';");}
  if(file==='src/components/inputs/CareIntakeDocumentsStepPanel.web.tsx'){
    replace("  const preview = useMemo(() => review ? buildIntakePackagePreview(review.documents) : '', [review]);", "  const [nativePreviewIndex,setNativePreviewIndex]=useState<number|null>(null);\n  useEffect(()=>setNativePreviewIndex(null),[review]);\n  const preview=useMemo(()=>review?buildIntakePackagePreview(nativePreviewIndex!==null&&review.documents[nativePreviewIndex]?[review.documents[nativePreviewIndex]]:review.documents):'',[review,nativePreviewIndex]);");
    replace("onClick={() => frame.current?.contentDocument?.getElementById(`package-document-${index}`)?.scrollIntoView({ block: 'start' })}","aria-pressed={nativePreviewIndex===index} onClick={()=>setNativePreviewIndex(index)}");
    replace("<iframe ref={frame} className=\"cs-contract-preview\"","<div className=\"cs-contract-native-preview\" style={{flex:1,minWidth:0,minHeight:0}}><p>{nativePreviewIndex===null?'Alle ausgew\u00e4hlten Unterlagen':review.documents[nativePreviewIndex]?.title}</p>{nativePreviewIndex!==null&&<button type=\"button\" onClick={()=>setNativePreviewIndex(null)}>Alle Unterlagen anzeigen</button>}<iframe ref={frame} className=\"cs-contract-preview\"");
    replace('srcDoc={preview} sandbox="allow-same-origin allow-modals" /></div>', 'srcDoc={preview} sandbox="allow-same-origin allow-modals" /></div></div>');
  }
  if(file==='src/lib/office/eInvoiceImport.web.ts'){body('attachmentReader','{return Promise.resolve({extractAttachments:extractNativePdfAttachments});}');replace("const parsed = new DOMParser().parseFromString(xml, 'application/xml');",'const parsed = parseNativeInvoiceXml(xml);');source=source.replace("  if (typeof DOMParser === 'undefined') throw new Error('Die strukturierte Vorschau benötigt einen Webbrowser.');\n",'').replace('Array.from(parent.children)','(Array.from(parent.childNodes).filter(child=>child.nodeType===1) as Element[])').replace('node.children.length','Array.from(node.childNodes).some(child=>child.nodeType===1)').replaceAll('pdfjs_embedded_attachment','pdfbox_embedded_attachment');add("import {extractNativePdfAttachments} from '@/lib/platform/nativePdfInspection.native';\nimport {parseNativeInvoiceXml} from '@/lib/platform/nativeXmlParser.native';");}
  if(file==='src/lib/office/invoiceProofAttachments.web.ts'){body('renderer','{return {render:renderNativePdfPages};}');add("import {renderNativePdfPages} from '@/lib/platform/nativePdfInspection.native';");}
  if(file==='src/lib/office/invoicePdfService.web.ts'){body('readBlobAsDataUrl','{return nativeBlobDataUrl(blob);}');body('prepareLogo','{return prepareNativeInvoiceLogo(url);}');add("import {nativeBlobDataUrl,prepareNativeInvoiceLogo} from '@/lib/platform/nativeInvoiceLogo.native';");}
  if(file==='src/components/assist/AssignmentFormControls.web.tsx'){body('PlatformModal','{return <NativePlatformModal visible={visible} onClose={onClose} title={title} subtitle={subtitle} maxWidth={maxWidth}><div className="aw-workspace acf-root"><AssignmentFormStyles/>{children}</div></NativePlatformModal>;}');add("import {PlatformModal as NativePlatformModal} from '@/components/layout/platform/platformmodal.tsx';");}
  if(file==='src/components/calendar/OfficeAssignmentProfileCalendarPlanner.web.tsx'){callback('stopBrowserDrag','{activeDragProfileId.current=null;}');callback('beginBrowserDrag','{if(!readOnly&&dataReady&&!savingRef.current&&!pendingProfileId)setSelectedProfileId(profileId);}');source=source.replace("import { autoScrollAssignmentProfileDrag } from './assignmentProfileDragAutoScroll';",'');}
  if(file==='src/components/office/clientintakemodal.web.tsx'){const pattern=/useEffect\(\(\) => \{\s*const overflow = document\.body[\s\S]*?\}, \[opener\]\);/;if(!pattern.test(source))throw Error('Stale intake modal lifecycle');source=source.replace(pattern,'useEffect(()=>{dialog.current?.focus();},[]);');}
  if(['src/components/company/CompanyResourcesWorkspace.web.tsx','src/components/office/invoices/EInvoiceInbox.web.tsx'].includes(file)){block('      const url = URL.createObjectURL(','\n    } catch','      await shareNativeFile(new Uint8Array(result.data.bytes),result.data.fileName,result.data.mimeType);');add(delivery);}
  if(file==='src/components/office/EmployeePersonnelFilePanel.web.tsx'){block('      const url = URL.createObjectURL(result.data.blob)','\n    } catch',"      await shareNativeFile(new Uint8Array(await result.data.blob.arrayBuffer()),result.data.filename,result.data.blob.type||'application/octet-stream');");add(delivery);}
  if(file==='src/components/office/messages/ConversationView.web.tsx'){const start=source.indexOf('      const url = URL.createObjectURL('),end=source.indexOf('\n    } catch',start),audit=source.slice(start,end).match(/void logOfficeMessageAuditEvent[\s\S]*?\.catch\(\(\) => \{\}\);/)?.[0];if(!audit)throw Error('Stale conversation audit');block('      const url = URL.createObjectURL(','\n    } catch',"      await shareNativeFile(conversationExport(thread,unique),'CareSuite-Gespraech-'+thread.id.slice(0,8)+'.txt','text/plain');"+audit);add(delivery);}
  if(file==='src/lib/privacy/dataSubjectRequestAdminWeb.web.ts'){body('downloadDataRequestAdminCsv',"{return shareNativeFile(csv,'betroffenenanfragen-'+new Date().toISOString().slice(0,10)+'.csv','text/csv');}");source=source.replace('downloadDataRequestAdminCsv(csv: string): void','downloadDataRequestAdminCsv(csv: string): Promise<void>');add(delivery);}
  if(file==='src/lib/privacy/dataRequestWorkspaceService.web.ts'){body('downloadDataRequestAccountExport',"{const file=buildDataRequestAccountExportFile(snapshot,format);if(!file.ok)return file;try{await shareNativeFile(file.data.content,file.data.fileName,file.data.mediaType);return {ok:true,data:{fileName:file.data.fileName}};}catch{return {ok:false,error:'Die Datei konnte nicht an Android übergeben werden. Bitte erneut versuchen.'};}}");source=source.replace('export function downloadDataRequestAccountExport(','export async function downloadDataRequestAccountExport(').replace('): ServiceResult<{ fileName: string }> {','): Promise<ServiceResult<{ fileName: string }>> {');add(delivery);}
  if(file==='src/screens/pflege/CaseHandoverWorkspace.web.tsx'){replace("window.open(clientRecordRoute(context.clientId), '_blank', 'noopener,noreferrer');",'router.push(clientRecordRoute(context.clientId) as never);');replace('function exportEmergency() {','async function exportEmergency() {');block('      const html = caseEmergencyExcerpt(','\n    } catch',"      const html=caseEmergencyExcerpt(content,state.head.recordedAt);await shareNativeFile(html,'CareSuite_Fallinformationen.html','text/html');");add(delivery);}
  if(file==='src/screens/pflege/SupplyWorkspace.web.tsx'){replace("window.open(clientRecordRoute(clientId),'_blank','noopener,noreferrer')",'router.push(clientRecordRoute(clientId) as never)');replace('function CaseSupply({ authority, grants, clientId }: { authority: SupplyAuthority; grants: readonly PermissionKey[]; clientId: string }) {','function CaseSupply({ authority, grants, clientId }: { authority: SupplyAuthority; grants: readonly PermissionKey[]; clientId: string }) {const router=useRouter();');const input=/<input aria-label=\{label\} type="datetime-local"[^\n]*?\/>/;if(!input.test(source))throw Error('Stale supply date input');source=source.replace(input,"<NativeLocalDateTimeInput label={label} disabled={disabled} value={value?supplyLocalTime(value):''} onChange={text=>onChange(supplyTimeFromInput(text))} color={color}/>");add("import {NativeLocalDateTimeInput} from '@/components/inputs/NativeLocalDateTimeInput.native';");}
  if(file==='src/components/pflege/VitalHistoryChartPanel.web.tsx')source=source.replace(/<title>\{[\s\S]*?\}<\/title>/g,'').replaceAll('onClick=','onPress=').replace(/ onKeyDown=\{e=>keyPoint\([\s\S]*?\)\}/g,'').replaceAll('aria-label=','accessibilityLabel=').replaceAll('role="button" tabIndex={0}','accessible').replace('role="group"','accessible={false}').replace('style={{color:c.text}}','color={c.text}');
  if(file==='src/screens/pflege/VitalReadingsListScreen.web.tsx'){block(' function download(){','\n if(!capture)'," async function download(){setExportError(null);if(!alive.current||!component||!current())return;try{const csv=vitalHistoryViewCsvWeb(historyAction);if(csv===null||!current())throw Error();await shareNativeFile(csv,'vitalwertverlauf-originale.csv','text/csv');}catch{if(alive.current)setExportError('Originalexport konnte nicht mit aktuellem Zugriff gestartet werden. Bitte neu laden und ausdrücklich auswählen.');}} ");add(delivery);}
  if(/src\/screens\/careAssessment\/(?:PlanAmendmentHistory|PlanReviewOverview|PlanEvaluationPanel)\.web\.tsx/.test(file))source=source.replace(/function (output|exportOriginals)\(mode:/g,'async function $1(mode:').replace(/(?<!function )\b(exportPlanAmendmentHistory|exportPlanReviewControls|exportEvaluationHistory)\(current/g,'await $1(current');
  if(file==='src/components/inputs/CareSignatureModal.web.tsx')source=source.replace("position: 'fixed' as ViewStyle['position']","position: 'absolute'").replace("overflow: 'scroll'","overflow: 'hidden'");
  if(file==='src/features/beratung/ConsultationControls.web.tsx'){block('export function SignaturePad(','export function SignatureDialog(',"export function SignaturePad({label,onChange,disabled=false}:{label:string;onChange(image:string):void;disabled?:boolean}){return <CareSignatureCanvas label={label} size='large' disabled={disabled} width={840} height={240} onClear={()=>onChange('')} onDirtyChange={()=>onChange('')} onConfirm={onChange}/>;}\n");add("import {CareSignatureCanvas} from '@/components/inputs/CareSignatureCanvas.tsx';");}
  if(file==='src/features/beratung/ConsultationEditor.web.tsx'){replace('window.print()','printConsultationRevision(revision)');add("import {printConsultationRevision} from '@/lib/beratung/printConsultation.native';");}
  if(['src/components/calendar/CalendarPageShell.web.tsx','src/screens/assist/AssistLiveStatusScreen.web.tsx'].includes(file)){replace("const windowId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('csWindow') ?? '';","const nativeParams=useGlobalSearchParams();const windowId=typeof nativeParams.csWindow==='string'?nativeParams.csWindow:'';");add("import {useGlobalSearchParams} from 'expo-router';");}
  if(file==='src/components/wfm/WfmEmployeeTimeAccountWorkspace.web.tsx'){replace("const preview = window.open('about:blank', '_blank');",'const preview=null;');source=source.replace('    if (preview) preview.opener = null;\n','').replaceAll('preview?.close();','').replace('if (preview && !preview.closed) preview.location.replace(url.href);\n      else setPdfLink({ id, url: url.href });','await openNativePdfUrl(url.href);');add("import {openNativePdfUrl} from '@/lib/platform/nativeFileDelivery.native';");}
  if(file==='src/screens/office/PayrollMonthOverviewScreen.web.tsx'){replace("const popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null;",'const popup=null;');source=source.replaceAll('popup?.close();','').replace('if (popup && !popup.closed) popup.location.replace(url.href); else setDocumentLink({ url: url.href, title });','await openNativePdfUrl(url.href,title);');add("import {openNativePdfUrl} from '@/lib/platform/nativeFileDelivery.native';");}
  source=source.replaceAll('globalThis.crypto','crypto');
  if(!source.includes('Platform.OS')&&!source.includes('createPortal'))return source;
  const ast=ts.createSourceFile(file,source,99,true,file.endsWith('tsx')?4:3),f=ts.factory;
  function evaluate(node){if(ts.isParenthesizedExpression(node))return evaluate(node.expression);if(node.getText(ast)==='Platform.OS')return 'android';if(ts.isStringLiteral(node))return node.text;if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken){const value=evaluate(node.operand);return value===undefined?undefined:!value;}if(ts.isBinaryExpression(node)){const left=evaluate(node.left),right=evaluate(node.right),kind=node.operatorToken.kind;if(kind===ts.SyntaxKind.BarBarToken)return left===true?true:left===false?right:undefined;if(kind===ts.SyntaxKind.AmpersandAmpersandToken)return left===false?false:left===true?right:undefined;if(left===undefined||right===undefined)return undefined;if([ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken].includes(kind))return left===right;if([ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(kind))return left!==right;}return undefined;}
  const transformed=ts.transform(ast,[context=>{const visit=node=>{if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='react-dom'&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)){const elements=node.importClause.namedBindings.elements.filter(e=>(e.propertyName?.text??e.name.text)!=='createPortal');return elements.length?f.updateImportDeclaration(node,node.modifiers,f.updateImportClause(node.importClause,node.importClause.isTypeOnly,node.importClause.name,f.updateNamedImports(node.importClause.namedBindings,elements)),node.moduleSpecifier,node.attributes):undefined;}if(ts.isCallExpression(node)&&node.expression.getText(ast)==='createPortal')return ts.visitNode(node.arguments[0],visit);if(ts.isIfStatement(node)){const value=evaluate(node.expression);if(value!==undefined)return ts.visitNode(value?node.thenStatement:node.elseStatement??f.createEmptyStatement(),visit);}if(ts.isSpreadAssignment(node)){const expression=ts.visitNode(node.expression,visit);let bare=expression;while(ts.isParenthesizedExpression(bare))bare=bare.expression;return f.updateSpreadAssignment(node,bare.kind===ts.SyntaxKind.NullKeyword?f.createObjectLiteralExpression():expression);}if(ts.isConditionalExpression(node)){const value=evaluate(node.condition);if(value!==undefined)return ts.visitNode(value?node.whenTrue:node.whenFalse,visit);}if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)){const value=evaluate(node.left);if(value!==undefined)return (node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken?value:!value)?ts.visitNode(node.right,visit):value?f.createTrue():f.createFalse();}const updated=ts.visitEachChild(node,visit,context);if(ts.isBlock(updated)){const returned=updated.statements.findIndex(s=>ts.isReturnStatement(s));if(returned>=0)return f.updateBlock(updated,[...updated.statements.slice(0,returned+1),...updated.statements.slice(returned+1).filter(ts.isFunctionDeclaration)]);}return updated;};return source=>ts.visitNode(source,visit);}]);
  const result=ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose();return result;
}

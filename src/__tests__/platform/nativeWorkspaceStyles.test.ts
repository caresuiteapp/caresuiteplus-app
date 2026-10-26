import {academyStyles} from '@/features/akademie/academyStyles';
import {personnelCss} from '@/components/office/personnelCss.web';
import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {compileWorkspaceCss,resolveWorkspacePresentation,workspaceGridWidths,workspaceContentWidth,matchesWorkspaceSelector,normalizeNativeTextStyle,nativeTextNeedsRadiusLayout} from '@/lib/platform/nativeWorkspaceStyles.shared';
import {resolveWorkspaceColorMixes} from '@/lib/platform/nativeWorkspaceColors.shared';
import {notesWorkspaceCss} from '@/components/office/notes/notesWorkspaceCss.native';
describe('native presentation of business layouts',()=>{
  it('matches first-of-type with type position instead of overall child position',()=>{
    const node={tag:'small',props:{},index:1,count:4,typeIndex:0};
    expect(matchesWorkspaceSelector('small:first-of-type',node,[])).toBe(true);
    expect(matchesWorkspaceSelector('small:first-of-type',{...node,index:2,typeIndex:1},[])).toBe(false);
    expect(matchesWorkspaceSelector('small:not(:first-of-type)',{...node,index:2,typeIndex:1},[])).toBe(true);
  });
  it.each([
    ['.action{font-size:11px;font-weight:700}.scope button{font:inherit}',14,'400'],
    ['.scope button{font:inherit;font-size:12px;font-weight:600}',12,'600'],
    ['.scope button{font-size:12px;font-weight:600;font:inherit}',14,'400'],
    ['.scope button{font:inherit!important}.scope button.action{font-size:12px;font-weight:600}',14,'400'],
  ] as const)('applies font:inherit at its real cascade priority (%s)',(css,size,weight)=>{
    const result=resolveWorkspacePresentation([compileWorkspaceCss(css)],{tag:'button',props:{className:'action'}},[{tag:'div',props:{className:'scope'}}],1280,{fontSize:14,fontWeight:'400',fontStyle:'normal',lineHeight:22.4},{'--cs-native-line-ratio':'1.6'});
    expect(result.text.fontSize).toBe(size);expect(result.text.fontWeight).toBe(weight);expect(result.text.lineHeight).toBeCloseTo(size*1.6);
  });
  it('keeps a later inline font longhand ahead of an inherited font shorthand',()=>{
    const result=resolveWorkspacePresentation([],{tag:'button',props:{style:{font:'inherit',fontSize:12}}},[],1280,{fontSize:14,fontWeight:'400',lineHeight:22.4},{'--cs-native-line-ratio':'1.6'});
    expect(result.text.fontSize).toBe(12);expect(result.text.lineHeight).toBeCloseTo(19.2);
  });

  it('fills the academy KPI row with its four items while auto-fill retains vacant tracks',()=>{
    const sheet=compileWorkspaceCss(academyStyles),parent={tag:'section',props:{className:'academy-workspace'}},node={tag:'div',props:{className:'ac-kpis'}};
    const presentation=resolveWorkspacePresentation([sheet],node,[parent],1280);
    const fitted=workspaceGridWidths(presentation.grid!,1248,12,1,4);
    expect(fitted).toEqual([303,303,303,303]);
    expect(workspaceGridWidths(presentation.grid!.replace('auto-fit','auto-fill'),1248,12,1,4)).toHaveLength(7);
  });
  it('uses the authored nested minimum for auto-repeat cards instead of a default track size',()=>{
    expect(workspaceGridWidths('repeat(auto-fill,minmax(min(100%,280px),1fr))',900,16)).toHaveLength(3);
    expect(workspaceGridWidths('repeat(auto-fit,minmax(min(100%,280px),1fr))',240,16,1,4)).toEqual([240]);
  });
  it('retains the personnel search track and three separate filters from the original stylesheet',()=>{
    const sheet=compileWorkspaceCss(personnelCss),parent={tag:'section',props:{className:'pe-list'}},node={tag:'div',props:{className:'pe-list-filters'}};
    const presentation=resolveWorkspacePresentation([sheet],node,[parent],1280);
    const tracks=workspaceGridWidths(presentation.grid!,1196,12);
    expect(tracks).toHaveLength(4);
    expect(tracks[0]).toBeCloseTo(tracks[1]*2);
    expect(tracks.slice(1)).toEqual([tracks[1],tracks[1],tracks[1]]);
    expect(tracks.reduce((sum,width)=>sum+width,0)+36).toBeCloseTo(1196);
  });
  it.each([1,1.6,2])('keeps all seven calendar days beside the time gutter at font scale %s',fontScale=>{
    const tracks=workspaceGridWidths('64px repeat(7,minmax(0,1fr))',1200,8,fontScale);
    expect(tracks).toHaveLength(8);
    expect(tracks[0]).toBe(64);
    expect(new Set(tracks.slice(1)).size).toBe(1);
    expect(tracks.reduce((sum,width)=>sum+width,0)+56).toBeCloseTo(1200);
  });
  it.each([[360,800,1.6],[844,390,1.6],[1280,800,1]])('keeps the actual notes list and footer reachable at %d×%d scale %s', (width,height,fontScale)=>{const sheet=compileWorkspaceCss(notesWorkspaceCss),variables={'--cs-native-viewport-width':String(width),'--cs-native-viewport-height':String(height),'--cs-native-font-scale':String(fontScale)},root={tag:'section',props:{className:'nw'}},layout={tag:'div',props:{className:'nw-layout','data-selected':false}},sidebar={tag:'aside',props:{className:'nw-sidebar'}},ancestors=[root,layout,sidebar];const presentation=(tag:string,className:string,parents=ancestors)=>resolveWorkspacePresentation([sheet],{tag,props:{className}},parents,width,{fontSize:14},variables);expect(presentation('aside','nw-sidebar',[root,layout]).scroll).toBe('vertical');const list=presentation('div','nw-notes-list');expect(list.scroll).toBe('vertical');expect(Number(list.box.minHeight)).toBeGreaterThanOrEqual(180);expect(list.box.flexShrink).toBe(0);expect(Number(list.box.flexBasis)).toBeGreaterThanOrEqual(Number(list.box.minHeight));for(const className of ['nw-sidebar-top','nw-sidebar-footer'])expect(presentation('div',className).box.flexShrink).toBe(0);if(height<600){expect(presentation('main','nw-main',[root,layout]).scroll).toBe('vertical');expect(Number(presentation('div','nw-editor-scroll',[root,layout,{tag:'main',props:{className:'nw-main'}}]).box.minHeight)).toBeGreaterThanOrEqual(180);}if(width<720){expect(resolveWorkspacePresentation([sheet],sidebar,[root,{...layout,props:{...layout.props,'data-selected':true}}],width,{},variables).box.display).toBe('none');}});

  it('keeps rules from every dedicated native CSS module compatible with Android numeric and enum style setters',()=>{
    const files:string[]=[];
    const walk=(directory:string)=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(/css.*\.native\.tsx?$/i.test(entry.name))files.push(path);}};
    walk(join(process.cwd(),'src'));
    expect(files.length).toBeGreaterThan(0);
    const numeric=/^(?:border.*(?:Radius|Width)|fontSize|lineHeight|letterSpacing|opacity|zIndex|flex|flexGrow|flexShrink|aspectRatio|elevation|shadowOpacity|shadowRadius|textShadowRadius)$/;
    let checked=0;
    for(const path of files){
      const ast=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
      const visit=(node:ts.Node)=>{
        if(ts.isNoSubstitutionTemplateLiteral(node)){
          const sheet=compileWorkspaceCss(node.text),variables=Object.fromEntries(sheet.flatMap(rule=>rule.declarations).filter(([key])=>key.startsWith('--')));
          for(const rule of sheet)for(const width of [320,800,1280])for(const fontScale of [1,1.6]){
            const presentation=resolveWorkspacePresentation([[{...rule,selector:'*',condition:''}]],{tag:'span',props:{}},[],width,{fontSize:14},{...variables,'--cs-native-font-scale':String(fontScale),'--cs-native-viewport-width':String(width)});
            const text=normalizeNativeTextStyle({...presentation.box,...presentation.text},{width:80,height:24});
            for(const [key,value] of Object.entries(text))if(numeric.test(key)&&value!==null&&value!==undefined){expect(typeof value,path+' '+rule.selector+' '+key).toBe('number');expect(Number.isFinite(value),path+' '+rule.selector+' '+key).toBe(true);}
            if(text.fontWeight!==undefined)expect(String(text.fontWeight),path+' '+rule.selector+' fontWeight').toMatch(/^(normal|bold|[1-9]00)$/);
            if(text.borderStyle!==undefined)expect(['solid','dashed','dotted'],path+' '+rule.selector+' borderStyle').toContain(text.borderStyle);
            checked++;
          }
        }
        ts.forEachChild(node,visit);
      };
      visit(ast);
    }
    expect(checked).toBeGreaterThan(files.length);
  });
  it('keeps percentage View geometry while converting only text radii to native numbers',()=>{
    const sheet=compileWorkspaceCss('.round{width:6px;height:6px;border-radius:50%;background:#3684ed}');
    const view=resolveWorkspacePresentation([sheet],{tag:'i',props:{className:'round'}},[],390);
    expect(view.box).toMatchObject({width:6,height:6,borderRadius:'50%',backgroundColor:'#3684ed'});
    expect(normalizeNativeTextStyle(view.box)).toMatchObject({width:6,height:6,borderRadius:3,backgroundColor:'#3684ed'});
    expect(nativeTextNeedsRadiusLayout(view.box)).toBe(false);
    const responsive={...view.box,width:'100%' as const,height:undefined};
    expect(nativeTextNeedsRadiusLayout(responsive)).toBe(true);
    expect(normalizeNativeTextStyle(responsive).borderRadius).toBe(0);
    expect(normalizeNativeTextStyle(responsive,{width:120,height:32})).toMatchObject({width:'100%',borderRadius:16});
    expect(normalizeNativeTextStyle(responsive,{width:90,height:48}).borderRadius).toBe(24);
  });
  it('retains individual and shorthand message-bubble corners without passing percent radii to Text',()=>{
    const sheet=compileWorkspaceCss('.message{width:80px;height:24px;border-radius:16px 16px 4px 16px}.corner{width:80px;height:24px;border-top-left-radius:50%}');
    const message=resolveWorkspacePresentation([sheet],{tag:'span',props:{className:'message'}},[],390);
    expect(message.box).toMatchObject({borderTopLeftRadius:16,borderTopRightRadius:16,borderBottomRightRadius:4,borderBottomLeftRadius:16});
    const corner=resolveWorkspacePresentation([sheet],{tag:'span',props:{className:'corner'}},[],390);
    expect(corner.box.borderTopLeftRadius).toBe('50%');expect(normalizeNativeTextStyle(corner.box).borderTopLeftRadius).toBe(12);
  });
  it('resolves percentage type metrics against the inherited font once, including calc',()=>{
    const sheet=compileWorkspaceCss('.copy{font-size:125%;line-height:120%;opacity:50%}.calculated{font-size:calc(100% + 2px)}');
    const copy=resolveWorkspacePresentation([sheet],{tag:'span',props:{className:'copy'}},[],900,{fontSize:16});
    expect(copy.text).toMatchObject({fontSize:20,lineHeight:24});expect(copy.box.opacity).toBe(.5);
    expect(resolveWorkspacePresentation([sheet],{tag:'span',props:{className:'calculated'}},[],900,{fontSize:16}).text.fontSize).toBe(18);
  });
  it('never forwards CSS auto or percentage strings to Android numeric setters',()=>{
    const sheet=compileWorkspaceCss('.copy{width:50%;height:auto;z-index:auto;border-width:5%;letter-spacing:normal;opacity:50%;font-weight:650}');
    const copy=resolveWorkspacePresentation([sheet],{tag:'span',props:{className:'copy'}},[],390);
    expect(copy.box).toMatchObject({width:'50%',height:'auto',opacity:.5});
    expect(copy.box.zIndex).toBeUndefined();expect(copy.box.borderWidth).toBeUndefined();expect(copy.text.fontWeight).toBe('700');expect(copy.text.letterSpacing).toBe(0);
    const text=normalizeNativeTextStyle({borderRadius:'50%',borderTopLeftRadius:'25%',fontSize:'18px',lineHeight:'auto',letterSpacing:'1.5px',opacity:'50%',zIndex:'auto',width:'100%',borderWidth:'1px'} as never,{width:80,height:24});
    expect(text).toMatchObject({borderRadius:12,borderTopLeftRadius:6,fontSize:18,letterSpacing:1.5,opacity:.5,width:'100%',borderWidth:1});
    expect(text.lineHeight).toBeUndefined();expect(text.zIndex).toBeUndefined();
  });
  it('uses the fixed upper bound of a sidebar before distributing the flexible pane',()=>{expect(workspaceGridWidths('minmax(275px,310px) minmax(0,1fr)',736,0)).toEqual([310,426]);expect(workspaceGridWidths('minmax(0,310px) minmax(0,1fr)',736,0)).toEqual([310,426]);});
  it('uses the same responsive grid after the navigation reduces the content width',()=>{const sheet=compileWorkspaceCss('.workspace .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}@container(max-width:850px){.workspace .cards{grid-template-columns:repeat(2,minmax(0,1fr))}}'),parent={tag:'section',props:{className:'workspace'}},node={tag:'div',props:{className:'cards'}};const wide=resolveWorkspacePresentation([sheet],node,[parent],1100),narrow=resolveWorkspacePresentation([sheet],node,[parent],600);expect(workspaceGridWidths(wide.grid!,1100,12)).toEqual([266,266,266,266]);expect(workspaceGridWidths(narrow.grid!,600,12)).toEqual([294,294]);});
  it('preserves selected, disabled and child selector rules',()=>{const sheet=compileWorkspaceCss('.toolbar button{color:#123456;padding:8px 12px}.toolbar>button[aria-pressed=true]{color:#ffffff;background:#126fbd}.toolbar button:disabled{opacity:.5}'),parent={tag:'div',props:{className:'toolbar'}},node={tag:'button',props:{'aria-pressed':true,disabled:true}};const styles=resolveWorkspacePresentation([sheet],node,[parent],390);expect(styles.text.color).toBe('#ffffff');expect(styles.box.backgroundColor).toBe('#126fbd');expect(styles.box.opacity).toBe(.5);expect(styles.box.paddingLeft).toBe(12);expect(matchesWorkspaceSelector('.other button',node,[parent])).toBe(false);});
  it('uses the viewport for media rules and the enclosing pane for container rules',()=>{const sheet=compileWorkspaceCss('.card{font-size:18px;display:grid;grid-template-columns:1fr 1fr}@media(max-width:700px){.card{font-size:12px}}@container(max-width:600px){.card{grid-template-columns:1fr}}'),card=resolveWorkspacePresentation([sheet],{tag:'section',props:{className:'card'}},[],300,{}, {'--cs-native-viewport-width':'1280'});expect(card.text.fontSize).toBe(18);expect(card.grid).toBe('1fr');});
  it('does not apply print-only styles to a native screen header',()=>{const sheet=compileWorkspaceCss('.hero{color:#fff;font-size:28px}@media print{.hero{display:none;color:#000;font-size:12px}}'),hero=resolveWorkspacePresentation([sheet],{tag:'header',props:{className:'hero'}},[],390);expect(hero.box.display).not.toBe('none');expect(hero.text.color).toBe('#fff');expect(hero.text.fontSize).toBe(28);});
  it('drops dormant grid tracks when a narrow notes pane switches to flex',()=>{const sheet=compileWorkspaceCss('.layout{display:grid;grid-template-columns:275px 1fr}@container(max-width:720px){.layout{display:flex}}'),layout=resolveWorkspacePresentation([sheet],{tag:'div',props:{className:'layout'}},[],288);expect(layout.grid).toBeNull();expect(layout.box.flexDirection).toBe('row');});
  it('does not apply short-window scrolling rules to a tall phone viewport',()=>{const sheet=compileWorkspaceCss('.main{display:flex}@media(max-height:600px){.main{overflow:auto}}'),main=resolveWorkspacePresentation([sheet],{tag:'main',props:{className:'main'}},[],288,{}, {'--cs-native-viewport-width':'320','--cs-native-viewport-height':'740'});expect(main.scroll).toBeNull();});
  it('keeps the original container-relative Academy heading size',()=>{const sheet=compileWorkspaceCss('.academy h1{font-size:clamp(24px,3.4cqi,36px)}'),parent={tag:'section',props:{className:'academy'}},heading={tag:'h1',props:{}};expect(resolveWorkspacePresentation([sheet],heading,[parent],288).text.fontSize).toBe(24);expect(resolveWorkspacePresentation([sheet],heading,[parent],900).text.fontSize).toBeCloseTo(30.6);expect(resolveWorkspacePresentation([sheet],heading,[parent],1280).text.fontSize).toBe(36);});
  it('retains a responsive flex basis containing a spaced calculation',()=>{const sheet=compileWorkspaceCss('.tab{display:flex;flex:1 1 calc(50% - 8px)}'),tab=resolveWorkspacePresentation([sheet],{tag:'button',props:{className:'tab'}},[],288);expect(tab.box.flexBasis).toBe(136);expect(tab.box.flexGrow).toBe(1);expect(tab.box.flexShrink).toBe(1);});
  it('preserves explicit alignment of wrapped content',()=>{const sheet=compileWorkspaceCss('.cards{display:flex;flex-wrap:wrap;align-content:start}'),cards=resolveWorkspacePresentation([sheet],{tag:'section',props:{className:'cards'}},[],600);expect(cards.box.alignContent).toBe('flex-start');});
  it('makes fixed text columns wrap before squeezing enlarged system text',()=>{const sheet=compileWorkspaceCss('.copy{display:flex;flex:1 1 280px;flex-basis:190px}'),copy=resolveWorkspacePresentation([sheet],{tag:'div',props:{className:'copy'}},[],288,{}, {'--cs-native-font-scale':'1.6'});expect(copy.box.flexBasis).toBe(304);expect(copy.text.fontSize).toBe(14);expect(workspaceGridWidths('repeat(4,minmax(0,1fr))',288,8,1.6)).toEqual([140,140]);});
  it.each(['auto-fit','auto-fill'])('reserves readable scaled minimum tracks for %s grids',repeat=>{const template=`repeat(${repeat},minmax(112px,1fr))`;expect(workspaceGridWidths(template,248,8,1)).toEqual([120,120]);expect(workspaceGridWidths(template,248,8,1.6)).toEqual([248]);expect(workspaceGridWidths(template,248,8,2)).toEqual([248]);expect(workspaceGridWidths(template,748,8,1.6)).toEqual([181,181,181,181]);});
  it('fits a two-column company header inside its padding and border',()=>{const available=workspaceContentWidth(1280,{paddingHorizontal:36,borderWidth:1}),tracks=workspaceGridWidths('minmax(0,1fr) 310px',available,30);expect(available).toBe(1206);expect(tracks).toEqual([866,310]);expect(tracks.reduce((sum,width)=>sum+width,0)+30+72+2).toBe(1280);});
  it('resolves translucent original theme colors without turning white text dark',()=>{const sheet=compileWorkspaceCss('.hero{--foreground:#fff;color:color-mix(in srgb,var(--foreground) 83%,transparent)}'),hero=resolveWorkspacePresentation([sheet],{tag:'header',props:{className:'hero'}},[],288);expect(hero.text.color).toBe('rgba(255,255,255,0.83)');expect(resolveWorkspaceColorMixes('color-mix(in srgb,rgba(255,0,0,.7) 20%,rgba(0,255,0,.2) 60%)')).toBe('rgba(137,118,0,0.26)');});
  it('does not activate browser forced-colors borders on the normal native theme',()=>{const sheet=compileWorkspaceCss('.panel{border:1px solid #d7e3f1}@media(forced-colors:active){.panel{border:1px solid CanvasText}}'),panel=resolveWorkspacePresentation([sheet],{tag:'section',props:{className:'panel'}},[],288);expect(panel.box.borderColor).toBe('#d7e3f1');});
  it('inherits the line-height ratio when a heading increases its font size',()=>{const sheet=compileWorkspaceCss('.workspace{font-size:14px;line-height:1.5;color:#173b57}.workspace h2{font-size:28px}'),parent={tag:'section',props:{className:'workspace'}},root=resolveWorkspacePresentation([sheet],parent,[],390),heading=resolveWorkspacePresentation([sheet],{tag:'h2',props:{}},[parent],390,root.text,root.variables);expect(heading.text.fontSize).toBe(28);expect(heading.text.lineHeight).toBe(42);});
  it('does not split gradient functions or lose custom colors',()=>{const sheet=compileWorkspaceCss('.workspace{--ink:#173b57;color:var(--ink)}.workspace .card{background:linear-gradient(135deg,#fff,rgba(12,20,30,.2));border:1px solid var(--ink)}'),parent={tag:'section',props:{className:'workspace'}},root=resolveWorkspacePresentation([sheet],parent,[],390),card=resolveWorkspacePresentation([sheet],{tag:'div',props:{className:'card'}},[parent],390,root.text,root.variables);expect(card.box.borderColor).toBe('#173b57');expect(card.box.experimental_backgroundImage).toContain('rgba(12,20,30,.2)');});
});

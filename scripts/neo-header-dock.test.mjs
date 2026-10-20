import test from 'node:test';
import assert from 'node:assert/strict';
import { makeNeoDraggable } from '../src/ai/robot/neoPosition.web.ts';
function fixture(docked=true) {
 const handlers=new Map(), windowHandlers=new Map(); let dockAvailable=docked;
 const body={appendChild(host){host.parentElement=this},hasAttribute(){return false}};
 const dock={appendChild(host){host.parentElement=this},hasAttribute(name){return name==='data-cs-neo-dock'}};
 const host={style:{},offsetWidth:68,offsetHeight:74,parentElement:body,getBoundingClientRect(){return {left:0,top:0,width:68,height:74}}};
 const button={style:{},addEventListener(k,f){handlers.set(k,f)},removeEventListener(k){handlers.delete(k)}};
 globalThis.innerWidth=1920;globalThis.innerHeight=1080;
 globalThis.document={body,querySelector(selector){return selector.includes('data-cs-neo-dock')&&dockAvailable?dock:null}};
 globalThis.window={addEventListener(k,f){windowHandlers.set(k,f)},removeEventListener(k){windowHandlers.delete(k)}};
 globalThis.localStorage={getItem(){return JSON.stringify({x:.4,y:.1})},setItem(){throw Error('docked Neo must not save a drag')}};
 const stop=makeNeoDraggable(host,button,'test',()=>{throw Error('unexpected drag')});
 return {host,button,dock,body,handlers,windowHandlers,stop,showDock(){dockAvailable=true}};
}
test('Neo attaches inside the header and overrides old floating coordinates',()=>{
 const f=fixture();assert.equal(f.host.parentElement,f.dock);assert.equal(f.host.style.position,'relative');assert.equal(f.button.style.cursor,'pointer');assert.equal(f.button.style.touchAction,'manipulation');f.stop();
});
test('pointer and arrow input cannot drag embedded Neo',()=>{
 const f=fixture();const before={...f.host.style};
 f.handlers.get('pointerdown')({isPrimary:true,button:0});
 f.handlers.get('keydown')({key:'ArrowRight'});
 assert.deepEqual(f.host.style,before);f.stop();assert.equal(f.windowHandlers.size,0);
});
test('late header layout binds Neo after preferences finish loading',()=>{
 const f=fixture(false);f.showDock();f.windowHandlers.get('caresuite:neo-dock-layout')();assert.equal(f.host.parentElement,f.dock);assert.equal(f.host.style.position,'relative');f.stop();
});

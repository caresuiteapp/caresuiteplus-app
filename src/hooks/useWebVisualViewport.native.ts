import {useEffect,useState} from 'react';
import {Keyboard,useWindowDimensions} from 'react-native';
export function useWebVisualViewport(){const {width,height}=useWindowDimensions(),[top,setTop]=useState<number|null>(null);useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',event=>setTop(event.endCoordinates.screenY)),hide=Keyboard.addListener('keyboardDidHide',()=>setTop(null));return()=>{show.remove();hide.remove();};},[]);return {width,height:top===null?height:Math.min(height,top),offsetTop:0,offsetLeft:0,keyboardVisible:top!==null};}

"use strict";

const $ = (id) => document.getElementById(id);
const svg = (icon) => `<svg aria-hidden="true"><use href="#i-${icon}"/></svg>`;

const figures = [
  { key:"older-man", name:"Mann", age:"Älter", label:"Älterer Mann", anatomy:"male" },
  { key:"older-woman", name:"Frau", age:"Älter", label:"Ältere Frau", anatomy:"female" },
  { key:"adult-man", name:"Mann", age:"Erwachsen", label:"Erwachsener Mann", anatomy:"male" },
  { key:"adult-woman", name:"Frau", age:"Erwachsen", label:"Erwachsene Frau", anatomy:"female" },
  { key:"boy", name:"Junge", age:"Kind", label:"Junge", anatomy:"male", child:true },
  { key:"girl", name:"Mädchen", age:"Kind", label:"Mädchen", anatomy:"female", child:true },
];

const views = [
  { key:"front", label:"Vorne", icon:"front", yaw:0, pitch:.04 },
  { key:"side", label:"Profil", icon:"side", yaw:-Math.PI/2, pitch:.035 },
  { key:"back", label:"Hinten", icon:"back", yaw:Math.PI, pitch:.04 },
  { key:"free", label:"Frei drehen", icon:"rotate" },
];

const regions = [
  { key:"torso", label:"Oberkörper", summary:"Brust, Schultern und Bauch", icon:"front", range:.91, paired:false, yaw:0, pitch:.035,
    angles:[["Vorderansicht",0,.035],["Schrägansicht",-.63,.23],["Von oben",-.71,.55]],
    zones:["Brust","Rechte Schulter","Linke Schulter","Oberbauch","Unterbauch","Rechte Flanke","Linke Flanke"] },
  { key:"hand", label:"Hand", summary:"Finger und Handgelenk", icon:"hand", range:.24, paired:true, yaw:-.15, pitch:.03,
    angles:[["Handfläche",-.15,.03],["Handrücken",-2.93,.02],["Handkante",-1.35,.03],["Fingernägel",-3.04,-.05,"fingertips",.115],["Handgelenk",-.18,.04,"wrist",.122]],
    zones:["Handgelenk","Handfläche","Handballen","Handrücken","Daumen","Zeigefinger","Mittelfinger","Ringfinger","Kleiner Finger","Fingernagel","Fingergelenk"] },
  { key:"foot", label:"Fuß", summary:"Zehen, Ferse und Sohle", icon:"foot", range:.32, paired:true, yaw:-.64, pitch:.37,
    angles:[["Fußrücken",-.63,.66],["Fußsohle",-.16,-1.40],["Ferse",-2.87,-.06],["Zehen",-.22,.73,"toes",.152]],
    zones:["Außenknöchel","Innenknöchel","Fußrücken","Ferse","Großzehe","Kleinzehe","Fußsohle","Fußgewölbe","Ballen"] },
  { key:"eye", label:"Auge", summary:"Lider und Augenwinkel", icon:"eye", range:.115, paired:true, yaw:0, pitch:.03,
    angles:[["Lider",0,.03],["Schrägansicht",-.41,.08],["Iris und Pupille",0,0,"eye",.075]],
    zones:["Oberlid","Unterlid","Innerer Augenwinkel","Äußerer Augenwinkel","Augenbraue"] },
  { key:"ear", label:"Ohr", summary:"Ohrmuschel und Ohrläppchen", icon:"ear", range:.18, paired:true, yaw:-1.45, pitch:.035,
    angles:[["Ohrmuschel",-1.45,.035],["Hinter dem Ohr",-2.19,.04],["Ohrmuschel nah",-1.57,.025,"ear",.090]],
    zones:["Ohrmuschel","Ohrläppchen","Äußerer Ohrrand","Tragus","Ohrmuschelvertiefung","Hinter dem Ohr"] },
  { key:"head", label:"Kopf und Gesicht", summary:"Nase, Lippen und Kopfhaut", icon:"side", range:.307, paired:false, yaw:-.23, pitch:.045,
    angles:[["Gesicht",-.23,.035],["Nase",-.27,-.25,"nose",.087],["Lippen",-.15,.045,"mouth",.091],["Kopfhaut",-.88,.72,"scalp",.192]],
    zones:["Stirn","Schläfe","Nasenrücken","Nasenflügel","Naseneingang","Oberlippe","Unterlippe","Mundwinkel","Kinn","Kopfhaut"] },
  { key:"back", label:"Rücken", summary:"Schulterblatt und Wirbelsäule", icon:"back-region", range:.63, paired:false, yaw:Math.PI, pitch:.025,
    zones:["Oberer Rücken","Rechtes Schulterblatt","Linkes Schulterblatt","Wirbelsäule","Lendenbereich"] },
  { key:"arm", label:"Arm und Ellenbogen", summary:"Oberarm, Ellenbeuge und Unterarm", icon:"front", range:.37, paired:true, yaw:-.39, pitch:.08,
    angles:[["Unterarm",-.39,.08],["Ellenbeuge",-.19,.24,"elbow",.22],["Ellenbogenspitze",-2.78,.05,"elbow",.22],["Schulter",-.65,.15,"shoulder",.28]],
    zones:["Schulter","Oberarm","Ellenbeuge","Ellenbogenspitze","Unterarm"] },
  { key:"knee", label:"Knie und Unterschenkel", summary:"Kniescheibe, Kniekehle und Wade", icon:"knee", range:.37, paired:true, yaw:-.25, pitch:.05,
    angles:[["Kniescheibe",-.25,.05],["Kniekehle",-2.95,.035],["Unterschenkel",-.53,.03,"shin",.37],["Knöchel",-1.10,.16,"ankle",.23]],
    zones:["Kniescheibe","Kniekehle","Schienbein","Wade","Außenknöchel","Innenknöchel"] },
  { key:"pelvis", label:"Intimbereich und Gesäß", summary:"Katheterstellen, Damm und After", icon:"pelvis", range:.53, paired:false, yaw:0, pitch:.045,
    zones:["Intimbereich","Linkes Gesäß","Rechtes Gesäß","Steißbein"] },
];

const state = {
  figure:figures[0], cameraView:"front", region:null, side:"right", mark:false, anatomyIndex:0, clinical:false, detailAngle:0,
  anatomyLabels:true,
};
const notes = [];
let canWrite = false;
let figureRequest = 0;
const stageError = $("stage-error");
const markerNodes = new Map();
let clinicalNodes = [];
let draft = null;
let drag = null;
let armedPinch = false;
let pinch = null;
let recentSide = "right";
let counter = 1;
let landmarkData;
let spot = null;
let editOrigin;
let renderedRegion;
let keyboard = { x:50, y:50 };
let diagramKeyboard = { x:50, y:50 };
const activePointers = new Map();
const sideNames = { right:"Rechts", left:"Links" };
const el = {
  models:$("model-options"), viewControls:$("viewer-controls"), viewButtons:$("view-options"), sides:$("side-options"), viewerTitle:$("viewer-title"),
  caption:$("viewer-caption"), overview:$("back-overview"), stage:$("stage"), markerArea:$("stage-markers"),
  crosshair:$("keyboard-cross"), tag:$("stage-tag"), markerButton:$("mark-mode"), markerLabel:$("mark-label"),
  help:$("viewer-help"), zoomTools:$("zoom-tools"), zoomIn:$("zoom-in"), zoomOut:$("zoom-out"), zoomReset:$("zoom-reset"), zoomLevel:$("zoom-level"),
  noteCount:$("notes-count"), notes:$("notes-list"), dialog:$("note-dialog"), noteTitle:$("note-title"),
  form:$("note-form"), location:$("note-location"), name:$("note-region"), kind:$("note-kind"), text:$("note-text"),
  deleteNote:$("note-delete"), grid:$("detail-options"), noteClose:$("note-close"), orientation:$("orientation"),
  anatomy:$("anatomy-panel"), anatomyViews:$("anatomy-views"),
  anatomyPicture:$("anatomy-picture"), anatomyPoints:$("anatomy-points"), anatomyZones:$("anatomy-zones"),
  anatomyStage:$("anatomy-stage"),
  anatomyWounds:$("anatomy-wounds"), anatomyCursor:$("anatomy-cursor"),
  status:$("status"),
  panel:$("viewer-panel"), expand:$("viewer-expand"), light:$("stage-light"),
};

function makeButton(className, label, action) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.setAttribute("aria-label",label);
  node.addEventListener("click",action);
  return node;
}

function modelThumbnails() {
  for (const figure of figures) {
    const option = makeButton("model-button",figure.label,()=>chooseFigure(figure));
    option.dataset.model = figure.key;
    option.innerHTML = '<span class="model-name">'+figure.name+'<small>'+figure.age+'</small></span><span class="model-check" aria-hidden="true">'+svg("check")+'</span>';
    el.models.append(option);
  }
}

function overviewPose(yaw = 0,pitch = .04) {
  const aspect = Math.max(1,el.stage.clientWidth) / Math.max(1,el.stage.clientHeight);
  const minimum = landmarkData.height*1.12;
  const width = (landmarkData.width ?? landmarkData.height*.64)*1.10;
  return { yaw,pitch,target:[0,-.025,landmarkData.height/2 + .015],height:Math.max(minimum,width/aspect) };
}

function areaTarget(region = state.region,side = state.side) {
  if (!region) return overviewPose().target;
  if (region.key === "torso") return landmarkData.landmarks.torso || [0,0,landmarkData.height*.67];
  if (region.key === "pelvis") return state.clinical && landmarkData.clinical ? clinicalPose().target : [0,-.035,landmarkData.landmarks.pelvis[2]+.045];
  if (region.key === "head") {
    return landmarkData.landmarks.head;
  }
  return region.paired ? landmarkData.landmarks[side][region.key] : landmarkData.landmarks[region.key];
}

function frameFingernails(fingers,yaw,pitch,aspect,minimum,scale) {
  const right=[Math.cos(yaw),Math.sin(yaw),0];
  const up=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(yaw)*Math.sin(pitch),Math.cos(pitch)];
  const range=axis=>{
    const values=fingers.map(point=>point.reduce((sum,value,i)=>sum+value*axis[i],0));
    return [Math.min(...values),Math.max(...values)];
  };
  const [xlo,xhi]=range(right), [ylo,yhi]=range(up);
  const average=fingers[0].map((_,i)=>fingers.reduce((sum,point)=>sum+point[i],0)/fingers.length);
  const mid=axis=>average.reduce((sum,value,i)=>sum+value*axis[i],0);
  const dx=(xlo+xhi)/2-mid(right),dy=(ylo+yhi)/2-mid(up);
  const target=average.map((value,i)=>value+dx*right[i]+dy*up[i]);
  const margin=.033*scale;
  return {target,height:Math.max(minimum,(xhi-xlo+margin)/aspect,yhi-ylo+margin)};
}

function areaPose(region = state.region) {
  if (!region) {
    const view = views.find(view=>view.key===state.cameraView);
    return overviewPose(view?.yaw ?? sculpt.pose.yaw,view?.pitch ?? sculpt.pose.pitch);
  }
  if (region.key === "pelvis" && state.clinical) return clinicalPose();
  const [,yaw,pitch,focus,range] = region.angles?.[state.detailAngle] ?? ["",region.yaw,region.pitch];
  let facing = region.paired && state.side === "left" ? -yaw : yaw;
  let elevation = pitch;
  if (region.key === "hand") {
    const [dorsal,top] = landmarkData.landmarks[state.side].handDorsal || [facing+Math.PI,.15];
    const angles = [[dorsal+Math.PI,-top],[dorsal,top],
                    [dorsal+(state.side==="left" ? 1.22 : -1.22),.21],[dorsal,top],[dorsal+Math.PI,-top]];
    [facing,elevation] = angles[state.detailAngle] || angles[0];
  }
  let target = landmarkData.landmarks[state.side]?.[focus] ?? landmarkData.landmarks[focus] ?? areaTarget(region);
  const scale = landmarkData.height / 1.75;
  const isolate = ["hand","arm","knee","foot"].includes(region.key);
  const depth = region.key==="foot" && state.detailAngle===1 ? -.125*scale : undefined;
  const half = isolate ? (state.side === "left" ? 1 : -1) : 0;
  const horizontal = Math.max(1,el.stage.clientWidth) / Math.max(1,el.stage.clientHeight);
  const width = focus === "toes" ? .126*scale
    : region.key==="head" && !focus ? landmarkData.landmarks.headWidth ?? 0 : 0;
  let height = Math.max((range ?? region.range)*scale,width/horizontal);
  if (focus==="fingertips" && landmarkData.landmarks[state.side].digits) {
    const expandedAspect=Math.max(1,window.innerWidth-29)/Math.max(1,window.innerHeight-225);
    ({target,height}=frameFingernails(landmarkData.landmarks[state.side].digits,facing,elevation,
      Math.min(horizontal,expandedAspect),height,scale));
  }
  return {yaw:facing,pitch:elevation,target,height,depth,half};
}

function directionForView(view) {
  if (view.key === "side" && state.region?.paired && state.side === "left") return -view.yaw;
  return view.yaw;
}

async function chooseFigure(figure, initial = false) {
  if (!initial && state.figure.key === figure.key && landmarkData) return;
  const request = ++figureRequest;
  stageError.hidden = false;
  stageError.textContent = "3D-Figur wird geladen …";
  try {
    await loadCareFigure(figure.key);
  } catch {
    if (request === figureRequest) stageError.textContent = "Die 3D-Figur konnte nicht geladen werden. Wähle die Figur erneut aus.";
    return;
  }
  if (request !== figureRequest) return;
  stageError.hidden = true;
  state.figure = figure;
  state.region = null;
  state.side = recentSide;
  state.cameraView = "front";
  state.anatomyIndex = 0;
  state.detailAngle = 0;
  state.clinical = false;
  landmarkData = sculpt.choose(figure.key);
  spot = null;
  applyMode(false);
  refreshUI();
  refreshNotes();
  sculpt.transition(overviewPose(),true);
  if (!initial && matchMedia("(max-width: 620px)").matches) focusViewer();
}

function focusViewer() {
  el.viewerTitle.focus({preventScroll:true});
  if (matchMedia("(max-width: 950px)").matches) el.viewerTitle.scrollIntoView({block:"start",behavior:"instant"});
}

function isDiagramView() {
  return state.region?.key==="pelvis" && !state.clinical;
}

function selectRegion(region, focus = true) {
  const isSame = state.region === region;
  state.region = region;
  state.cameraView = region ? "free" : "front";
  if (!isSame) {
    state.anatomyIndex = 0;
    state.detailAngle = 0;
    state.clinical = Boolean(region?.key === "pelvis" && landmarkData.clinical);
    sculpt.clinical(state.clinical);
  }
  spot = null;
  applyMode(false);
  refreshUI();
  if (!isDiagramView()) sculpt.transition(areaPose());
  if (focus) focusViewer();
}

function renderControls() {
  for (const view of views) {
    const button = makeButton("",view.label,()=>{
      if (view.key === "free") {
        state.cameraView = view.key;
        refreshUI();
        return;
      }
      state.cameraView = view.key;
      spot = null;
      refreshUI();
      if (state.region?.angles) anglePicker.value = "";
      sculpt.transition({
        yaw:directionForView(view),pitch:view.pitch,height:state.region ? areaPose().height : overviewPose().height,
        target:areaTarget(),
      });
    });
    button.dataset.view = view.key;
    button.innerHTML = svg(view.icon) + view.label;
    el.viewButtons.append(button);
  }

  for (const side of ["right","left"]) {
    const button = makeButton("",sideNames[side],()=>{
      state.side = side;
      recentSide = side;
      state.cameraView = "free";
      spot = null;
      refreshUI();
      sculpt.transition(areaPose());
    });
    button.dataset.side = side;
    button.textContent = sideNames[side];
    el.sides.append(button);
  }

  for (const region of regions) {
    const button = makeButton("detail-button",region.label,()=>selectRegion(region));
    button.dataset.detail = region.key;
    button.innerHTML = `<span class="detail-thumb">${svg(region.icon)}</span><span class="detail-name">${region.label}<small>${region.summary}</small></span>${svg("arrow")}`;
    el.grid.append(button);
  }
}

function refreshUI() {
  const diagram=isDiagramView();
  const enteringDiagram=diagram && el.anatomy.hidden;
  el.stage.hidden=diagram;
  el.anatomy.hidden=!diagram;
  el.viewControls.hidden=diagram;
  el.zoomTools.hidden=diagram;
  el.light.hidden=diagram;
  el.grid.querySelector('[data-detail="pelvis"] small').textContent=state.figure.child
    ? "Genitalien, Damm und After"
    : "Katheterstellen, Damm und After";
  sculpt.showScalp(state.region?.key==="head" && state.detailAngle===3);
  el.viewerTitle.textContent = state.region?.label || "Körperansicht";
  el.caption.textContent = state.figure.label + (state.region?.paired ? " · " + sideNames[state.side] : "");
  el.overview.hidden = state.region === null;
  el.sides.hidden = !state.region?.paired;
  el.tag.innerHTML = svg(state.region ? state.region.icon : "rotate") + (state.region ? "Detailansicht" : "Ganzkörper · 360°");
  if (state.clinical) el.tag.innerHTML = svg("pelvis")+" Anatomische 3D-Ansicht";
  el.stage.setAttribute("aria-label",state.figure.label + " in 3D. Pfeiltasten drehen die Figur. Leertaste aktiviert das Markieren.");
  for(const button of el.models.children) button.setAttribute("aria-pressed",button.dataset.model===state.figure.key);
  for(const button of el.viewButtons.children) button.setAttribute("aria-pressed",button.dataset.view===state.cameraView);
  for(const button of el.sides.children) button.setAttribute("aria-pressed",button.dataset.side===state.side);
  for(const button of el.grid.children) button.setAttribute("aria-pressed",button.dataset.detail===state.region?.key);
  el.orientation.hidden = state.region !== null || !["front","back"].includes(state.cameraView);
  $("orientation-left").textContent = state.cameraView==="front" ? "Rechts" : "Links";
  $("orientation-right").textContent = state.cameraView==="front" ? "Links" : "Rechts";
  updateHelp();
  regionTools.hidden = !state.region || state.clinical || diagram;
  clinicalTools.hidden = !state.clinical;
  regionPicker.hidden = state.region?.key === "pelvis";
  anglePicker.hidden = !state.region?.angles;
  if (enteringDiagram) renderAnatomy();
  if (state.clinical) renderClinicalTools();
  if (renderedRegion === state.region) return;
  renderedRegion = state.region;
  regionPicker.options.length = 0;
  anglePicker.options.length = 0;
  if(state.region) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Körperstelle benennen";
    regionPicker.add(empty);
    for (const name of state.region.zones) {
      const option = document.createElement("option");
      option.textContent = name;
      regionPicker.add(option);
    }
    for (const [index,[label]] of (state.region.angles ?? []).entries()) {
      anglePicker.add(new Option(label,String(index)));
    }
    if(state.region.angles) anglePicker.add(new Option("Freie Ansicht",""));
  }
  placeMarkers();
}

const regionTools = document.createElement("div");
regionTools.className = "region-tools";
regionTools.hidden = true;
el.stage.before(regionTools);
const regionPicker = document.createElement("select");
regionPicker.className = "region-picker";
regionPicker.setAttribute("aria-label","Körperstelle für Markierung benennen");
regionTools.append(regionPicker);

const anglePicker = document.createElement("select");
anglePicker.className = "region-picker";
anglePicker.setAttribute("aria-label","Detailperspektive");
anglePicker.addEventListener("change",()=>{
  if (anglePicker.value==="") return;
  state.detailAngle = Number(anglePicker.value);
  state.cameraView="free";
  refreshUI();
  sculpt.transition(areaPose());
});
regionTools.prepend(anglePicker);

const clinicalTools = document.createElement("div");
clinicalTools.className = "clinical-tools";
clinicalTools.hidden = true;
el.stage.after(clinicalTools);

function updateHelp() {
  if (isDiagramView()) {
    el.help.textContent=state.mark
      ? "Stelle im Schema antippen oder das Fadenkreuz mit den Pfeiltasten bewegen und Enter drücken."
      : "Eine beschriftete Körperstelle auswählen oder über „Stelle markieren“ einen Punkt setzen.";
    return;
  }
  el.help.textContent = state.mark
    ? "Körperstelle antippen. Mit der Tastatur erst die Pfeiltasten und dann Enter drücken."
    : state.clinical
      ? "Die Figur lässt sich frei drehen. Eine beschriftete Stelle öffnet den Befund."
    : state.region
        ? "Ziehen zum Drehen. Mit Umschalt oder zwei Fingern den Ausschnitt verschieben."
        : "Ziehen zum Drehen. Mit + und − zoomen oder einen Körperbereich wählen.";
}

function applyMode(mark) {
  state.mark = mark;
  const diagram=isDiagramView();
  el.stage.classList.toggle("is-marking",mark&&!diagram);
  el.anatomyStage.classList.toggle("is-marking",mark&&diagram);
  el.anatomyPoints.inert=mark&&diagram;
  el.anatomyWounds.inert=mark&&diagram;
  el.markerButton.setAttribute("aria-pressed",mark);
  el.markerLabel.textContent = mark ? "Markieren beenden" : "Stelle markieren";
  updateHelp();
  placeMarkers();
}

function stagePoint(event) {
  const r = el.stage.getBoundingClientRect();
  return { x:event.clientX-r.left-el.stage.clientLeft, y:event.clientY-r.top-el.stage.clientTop };
}

function pinchPose() {
  const [a,b]=activePointers.values();
  return { x:(a.x+b.x)/2, y:(a.y+b.y)/2, distance:Math.hypot(a.x-b.x,a.y-b.y) };
}

el.stage.addEventListener("pointerdown",event=>{
  if (!sculpt.ready || event.button!==0 || event.target.closest("button")) return;
  const point = stagePoint(event);
  activePointers.set(event.pointerId,point);
  el.stage.setPointerCapture(event.pointerId);
  if (activePointers.size===1) {
    drag={ id:event.pointerId, startX:point.x, startY:point.y, x:point.x,y:point.y, moved:false, pan:event.shiftKey };
    armedPinch=false;
  } else if(activePointers.size===2) {
    pinch=pinchPose();
    armedPinch=true;
  }
});

el.stage.addEventListener("pointermove",event=>{
  if (!activePointers.has(event.pointerId)) return;
  const point = stagePoint(event);
  activePointers.set(event.pointerId,point);
  if (activePointers.size===2 && armedPinch) {
    const next=pinchPose();
    const zoom=pinch.distance>10 ? pinch.distance/Math.max(10,next.distance) : 1;
    const dx=next.x-pinch.x, dy=next.y-pinch.y;
    if (Math.abs(zoom-1)>.008) sculpt.stepZoom(zoom,true);
    else if (Math.hypot(dx,dy)>1) sculpt.pan(dx,dy);
    pinch=next;
    return;
  }
  if (!drag || drag.id!==event.pointerId || armedPinch) return;
  const exceeds = Math.hypot(point.x-drag.startX,point.y-drag.startY)>5;
  if (!drag.moved && !exceeds) return;
  el.stage.classList.add("is-grabbing");
  if (state.cameraView!=="free") {
    state.cameraView="free";
    refreshUI();
  }
  if (drag.pan || event.shiftKey) sculpt.pan(point.x-drag.x,point.y-drag.y);
  else {
    if (state.region?.angles) anglePicker.value="";
    sculpt.orbit(point.x-drag.x,point.y-drag.y);
  }
  drag={...drag,x:point.x,y:point.y,moved:true};
});

function endPointer(event) {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.delete(event.pointerId);
  if (event.type==="pointerup" && drag?.id===event.pointerId && state.mark && !drag.moved && !armedPinch) {
    const {x,y}=stagePoint(event);
    pickSurface(x,y);
  }
  if (activePointers.size===0) {
    drag=null;
    armedPinch=false;
    pinch=null;
    el.stage.classList.remove("is-grabbing");
  }
}
el.stage.addEventListener("pointerup",endPointer);
el.stage.addEventListener("pointercancel",endPointer);
el.stage.addEventListener("lostpointercapture",endPointer);

el.stage.addEventListener("wheel",event=>{
  if (!sculpt.ready || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  sculpt.stepZoom(event.deltaY>0 ? 1.1 : 1/1.1,true);
},{passive:false});

function pickSurface(x,y) {
  const point = sculpt.pickAt(x,y);
  if (!point) {
    el.help.textContent = "Bitte direkt auf die Oberfläche der Figur tippen.";
    el.status.textContent = el.help.textContent;
    return;
  }
  spot = point;
  const place = regionPicker.value && !regionPicker.hidden ? decoratedRegion(regionPicker.value) : "";
  openNote({ point, name:place, kind:"Hautbefund", clinical:state.clinical });
}

function decoratedRegion(place) {
  return place && state.region?.paired ? place + " " + sideNames[state.side].toLowerCase() : place;
}

function positionKeyboard(x,y) {
  keyboard={ x:Math.max(3,Math.min(97,x)),y:Math.max(3,Math.min(97,y)) };
  el.crosshair.style.left=keyboard.x+"%";
  el.crosshair.style.top=keyboard.y+"%";
}

el.stage.addEventListener("keydown",event=>{
  if (!sculpt.ready || event.target!==el.stage) return;
  if (event.key === " ") {
    event.preventDefault();
    if (!canWrite || !landmarkData) return;
  applyMode(!state.mark);
    if (state.mark) positionKeyboard(50,50);
    return;
  }
  if (event.key==="Escape" && state.mark) {
    applyMode(false);
    return;
  }
  if (event.key==="Enter" && state.mark) {
    event.preventDefault();
    pickSurface(el.stage.clientWidth*keyboard.x/100,el.stage.clientHeight*keyboard.y/100);
    return;
  }
  const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!step) return;
  event.preventDefault();
  const [x,y]=step;
  if (state.mark) positionKeyboard(keyboard.x+x*(event.shiftKey ? .35 : 1.65),keyboard.y+y*(event.shiftKey ? .35 : 1.65));
  else {
    if (state.cameraView!=="free") {
      state.cameraView="free";
      refreshUI();
    }
    if(event.shiftKey) sculpt.pan(-x*18,-y*18);
    else {
      if (state.region?.angles) anglePicker.value="";
      sculpt.orbit(-x*16,y*16);
    }
  }
});

function placeMarkers() {
  if (!landmarkData) return;
  for (const [note,node] of markerNodes) {
    if (note.figure!==state.figure.key || (note.clinical && !state.clinical)) {
      node.hidden=true;
      continue;
    }
    const [x,y] = sculpt.project(note.point);
    node.hidden = !sculpt.visible(x,y,note.point);
    if(!node.hidden) {
      node.style.left=x+"px";
      node.style.top=y+"px";
    }
  }
  const active = state.clinical && state.anatomyLabels && !state.mark;
  const annotated = new Set(notes.filter(note => note.figure === state.figure.key).map(note => note.anatomy));
  const placed=[];
  for (const {point,node,line,key} of clinicalNodes) {
    node.hidden=true;
    line.hidden=true;
    if (!active || annotated.has(key)) continue;
    const [x,y]=sculpt.project(point);
    if (!sculpt.visible(x,y,point,.016)) continue;
    const options=[[0,0],[25,-11],[-25,-11],[24,23],[-24,22],[0,-30],[0,32],[45,5],[-45,5]];
    const position=options.map(([dx,dy])=>[x+dx,y+dy]).find(([left,top])=>
      left>=16 && left<=el.stage.clientWidth-16 && top>=16 && top<=el.stage.clientHeight-16 &&
      placed.every(([px,py])=>Math.hypot(px-left,py-top)>=24));
    if (!position) continue;
    const [nx,ny]=position;
    placed.push(position);
    node.style.left=nx+"px";
    node.style.top=ny+"px";
    const length=Math.hypot(nx-x,ny-y);
    if (length>8) {
      line.style.left=x+"px";
      line.style.top=y+"px";
      line.style.width=length+"px";
      line.style.rotate=Math.atan2(ny-y,nx-x)+"rad";
      line.hidden=false;
    }
    node.hidden=false;
  }
}

function woundMarker(note) {
  const marker=makeButton("marker wound",`${note.kind} · ${note.name} öffnen`,()=>openNote(note));
  marker.title=`${note.kind} · ${note.name}`;
  marker.innerHTML=svg("cross");
  return marker;
}

function refreshNotes() {
  for (const node of markerNodes.values()) node.remove();
  markerNodes.clear();
  const items=notes.filter(note=>note.figure===state.figure.key);
  el.noteCount.textContent=items.length;
  if (isDiagramView()) refreshDiagramMarkers();
  if (!items.length) {
    el.notes.innerHTML='<p class="muted no-notes">Für diese Figur gibt es noch keine Markierung.</p>';
    return;
  }
  el.notes.replaceChildren(...items.map(note=>{
    if (!note.diagram) {
      const marker=woundMarker(note);
      el.markerArea.append(marker);
      markerNodes.set(note,marker);
    }
    const item=makeButton("note-button",note.name+" anzeigen",()=>{
      if (note.diagram) {
        if (state.region?.key!=="pelvis") selectRegion(regions.find(region=>region.key==="pelvis"),false);
        if (state.anatomyIndex!==note.diagram.view) {
          state.anatomyIndex=note.diagram.view;
          renderAnatomy();
        }
        openNote(note);
        return;
      }
      const needsClinical = Boolean(note.clinical) !== state.clinical;
      if (needsClinical) {
        state.clinical=Boolean(note.clinical);
        state.anatomyIndex=note.anatomyIndex || 0;
        sculpt.clinical(state.clinical);
      }
      const [x,y]=sculpt.project(note.point);
      if (needsClinical || !sculpt.visible(x,y,note.point) || (state.region?.key ?? null) !== note.focusRegion || state.side !== note.side) {
        state.region=regions.find(region=>region.key===note.focusRegion) || null;
        state.side=note.side;
        state.detailAngle=note.detailAngle ?? 0;
        const closeup=areaPose();
        state.cameraView="free";
        sculpt.transition({...closeup,yaw:note.yaw,pitch:note.pitch,target:note.target ?? note.point,height:note.height},true);
        refreshUI();
        if (state.region?.angles) anglePicker.value=String(state.detailAngle);
      }
      openNote(note);
    });
    item.innerHTML=`<span class="note-x">${svg("cross")}</span><span class="detail-name"></span>${svg("arrow")}`;
    const content=item.querySelector(".detail-name");
    content.textContent=note.name;
    const category=document.createElement("small");
    category.textContent=note.kind+(note.sample ? " · Beispiel" : "");
    content.append(category);
    return item;
  }));
  placeMarkers();
}

function openNote(note) {
  editOrigin=document.activeElement;
  draft = {
    figure:state.figure.key, focusRegion:state.region?.key ?? null, side:state.side,
    detailAngle:state.detailAngle,target:[...sculpt.pose.target],
    yaw:sculpt.pose.yaw,pitch:sculpt.pose.pitch,height:sculpt.pose.height,
    name:"",kind:"Hautbefund",text:"",...note,
  };
  el.noteTitle.textContent=draft.id ? "Markierung ansehen" : "Markierung erfassen";
  const location=draft.diagram ? anatomySet()[draft.diagram.view].name : state.region?.label;
  el.location.textContent=state.figure.label+(location ? " · "+location : "");
  el.name.setCustomValidity("");
  el.name.placeholder=draft.diagram ? "Z. B. linke Leiste" : "Z. B. linker Unterarm";
  el.name.value=draft.name;
  el.kind.value=draft.kind;
  el.text.value=draft.text;
  el.deleteNote.hidden=true;
  el.name.readOnly=Boolean(draft.id);
  el.kind.disabled=Boolean(draft.id);
  el.text.readOnly=Boolean(draft.id);
  el.form.querySelector('button[type="submit"]').hidden=Boolean(draft.id) || !canWrite;
  if (spot) showSpot();
  el.dialog.showModal();
  (draft.name ? el.text : el.name).focus();
}

function showSpot() {
  const [x,y]=sculpt.project(spot);
  const node=document.createElement("span");
  node.className="marker wound provisional";
  node.innerHTML=svg("cross");
  node.style.left=x+"px";
  node.style.top=y+"px";
  el.markerArea.append(node);
}

function ensureFocus(node,fallback) {
  if (node?.isConnected) node.focus({preventScroll:true});
  else fallback.focus({preventScroll:true});
}

$("note-close").addEventListener("click",()=>el.dialog.close());
el.dialog.addEventListener("close",()=>{
  draft=null;
  spot=null;
  el.markerArea.querySelector(".provisional")?.remove();
  ensureFocus(editOrigin,isDiagramView() ? el.anatomyStage : el.markerButton);
});
el.name.addEventListener("input",()=>el.name.setCustomValidity(""));
el.form.addEventListener("submit",event=>{
  event.preventDefault();
  const name=el.name.value.trim();
  if (!name) {
    el.name.setCustomValidity("Bitte eine Körperstelle eingeben.");
    el.name.reportValidity();
    return;
  }
  if (!canWrite || draft.id) return;
  const note={...draft,name,kind:el.kind.value,text:el.text.value.trim()};
  notifyHost({type:"caresuite-body-mark",mark:note});
  applyMode(false);
  el.dialog.close();
  el.status.textContent="Markierung zur Wundakte übernommen.";
});

function notifyHost(message) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  else if (window.parent !== window) window.parent.postMessage(message, location.origin);
}
window.setCareWoundContext = (context) => {
  if (!context || !Array.isArray(context.marks)) return;
  canWrite = context.canWrite === true;
  el.markerButton.disabled = !canWrite;
  if (!canWrite) applyMode(false);
  notes.splice(0,notes.length,...context.marks);
  if (landmarkData) refreshNotes();
  if (context.figure && !landmarkData && !figureRequest) {
    const startFigure = figures.find(figure => figure.key === context.figure) || figures[0];
    void chooseFigure(startFigure,true);
  }
};
window.addEventListener("message", event => {
  if (event.source === window.parent && event.origin === location.origin && event.data?.type === "caresuite-wound-context") {
    window.setCareWoundContext(event.data);
  }
});

function anatomySet() {
  return [pelvicViews[state.figure.anatomy],pelvicViews.perineum,pelvicViews.buttocks];
}

function clinicalPose() {
  const center = [...landmarkData.clinical.center];
  const index = state.anatomyIndex;
  if (index === 1 || index === 2) {
    const points=landmarkData.clinical.points[index===1 ? "perineum" : "back"];
    for (const axis of [1,2]) center[axis]=points.reduce((sum,point)=>sum+point[axis],0)/points.length;
  }
  const scale=landmarkData.height/1.75;
  const width=Math.max(1,el.stage.clientWidth)/Math.max(1,el.stage.clientHeight);
  const female=state.figure.anatomy==="female";
  return {
    yaw: index === 2 ? Math.PI : index === 1 ? Math.PI+.14 : female ? -.03 : -.18,
    pitch: index === 2 ? .025 : index === 1 ? -.97 : female ? -.59 : -.22,
    target:center,
    height:Math.max(index === 1 ? .252 : index === 2 ? .38 : female ? .194 : .261,.143/width)*scale,
  };
}

function renderClinicalTools() {
  const groups=["front","perineum","back"];
  const choices=anatomySet();
  const controls=document.createElement("div");
  controls.className="segmented clinical-tabs";
  controls.setAttribute("role","group");
  controls.setAttribute("aria-label","Anatomische 3D-Ansicht");
  for (const [index,choice] of choices.entries()) {
    const option=makeButton("",choice.name,()=>{
      state.anatomyIndex=index;
      state.cameraView="free";
      refreshUI();
      sculpt.transition(clinicalPose());
      clinicalTools.querySelectorAll(".clinical-tabs button")[index].focus({preventScroll:true});
    });
    option.textContent=choice.name;
    option.setAttribute("aria-pressed",index===state.anatomyIndex);
    controls.append(option);
  }
  const nearby=choices[state.anatomyIndex];
  const group=groups[state.anatomyIndex];
  for (const {node,line} of clinicalNodes) {node.remove();line.remove();}
  clinicalNodes=[];
  const named=document.createElement("ol");
  named.className="region-list";
  for (const [index,[name,,,,,kind]] of nearby.zones.entries()) {
    const entry=document.createElement("li");
    const point=landmarkData.clinical.points[group][index];
    const key = group+"/"+name;
    const open=()=>{
      const existing=notes.find(note=>note.figure===state.figure.key && note.anatomy===key);
      const camera=clinicalPose();
      const found=point;
      spot=existing?.point || found;
      sculpt.transition(camera,true);
      openNote(existing || {point:found,name,kind:kind||"Hautbefund",clinical:true,anatomy:key,anatomyIndex:state.anatomyIndex});
    };
    const location=makeButton("",name,open);
    location.innerHTML=`<span class="region-number" aria-hidden="true">${index+1}</span>`;
    location.append(document.createTextNode(name));
    entry.append(location);
    named.append(entry);
    const marker=makeButton("marker anatomical-point",name+" am Modell",open);
    marker.textContent=String(index+1);
    marker.title=name;
    marker.hidden=true;
    const line=document.createElement("span");
    line.className="anatomical-leader";
    line.hidden=true;
    line.setAttribute("aria-hidden","true");
    el.markerArea.append(line,marker);
    clinicalNodes.push({point,node:marker,line,key});
  }
  const visibility=makeButton("anatomy-label-toggle","Nummern am Modell",()=>{
    state.anatomyLabels=!state.anatomyLabels;
    visibility.setAttribute("aria-pressed",state.anatomyLabels);
    placeMarkers();
  });
  visibility.textContent="Nummern am Modell";
  visibility.setAttribute("aria-pressed",state.anatomyLabels);
  const toolbar=document.createElement("div");
  toolbar.className="anatomy-toolbar";
  toolbar.append(controls,visibility);
  clinicalTools.replaceChildren(toolbar,named);
}

function anatomyZones(view) {
  return view.zones.map(([label,x,y,bx,by,category],index)=>({label,x,y,bx,by,category,index}));
}

function moveDiagramCursor(x,y) {
  diagramKeyboard={x:Math.min(98,Math.max(2,x)),y:Math.min(98,Math.max(2,y))};
  el.anatomyCursor.style.left=diagramKeyboard.x+"%";
  el.anatomyCursor.style.top=diagramKeyboard.y+"%";
}

function openDiagramNote(x,y,zone) {
  applyMode(false);
  spot=null;
  const view=state.anatomyIndex;
  const anatomy=zone ? `${anatomySet()[view].name}/${zone.label}` : undefined;
  const existing=anatomy && notes.find(note=>note.figure===state.figure.key && note.diagram?.view===view && note.anatomy===anatomy);
  openNote(existing || {diagram:{view,x,y},name:zone?.label || "",kind:zone?.category || "Wunde",anatomy});
}

function markDiagramPosition(x,y) {
  const point=new DOMPoint(x*3.2,y*3.9);
  const contours=el.anatomyPicture.querySelectorAll(".outline, .tissue");
  if (![...contours].some(contour=>contour.isPointInFill(point))) {
    el.help.textContent="Die Stelle muss innerhalb der Körperkontur liegen.";
    return;
  }
  openDiagramNote(x,y);
}

function refreshDiagramMarkers() {
  const visible=notes.filter(note=>note.figure===state.figure.key && note.diagram?.view===state.anatomyIndex);
  el.anatomyWounds.replaceChildren(...visible.map(note=>{
    const marker=woundMarker(note);
    marker.style.left=note.diagram.x+"%";
    marker.style.top=note.diagram.y+"%";
    return marker;
  }));
}

function renderAnatomy() {
  const choices=anatomySet();
  const view=choices[state.anatomyIndex];
  el.anatomyViews.replaceChildren(...choices.map((item,index)=>{
    const button=makeButton("",item.name,()=>{
      state.anatomyIndex=index;
      renderAnatomy();
      el.anatomyViews.children[index].focus();
    });
    button.textContent=item.name;
    button.setAttribute("aria-pressed",index===state.anatomyIndex);
    return button;
  }));
  const zones=anatomyZones(view);
  el.anatomyPicture.innerHTML=pelvisDrawing(view.name,zones);
  el.anatomyStage.setAttribute("aria-label",view.name+" · Körperschema");
  applyMode(false);
  const makeZone=(zone,inline)=>{
    const button=makeButton(inline ? "marker zone" : "",zone.label,()=>openDiagramNote(zone.x,zone.y,zone));
    button.title=zone.label;
    if(inline) {
      button.style.left=zone.bx+"%";
      button.style.top=zone.by+"%";
      button.textContent=zone.index+1;
    } else {
      button.innerHTML=`<span class="region-number" aria-hidden="true">${zone.index+1}</span>`;
      button.append(document.createTextNode(zone.label));
    }
    return button;
  };
  el.anatomyPoints.replaceChildren(...zones.map(zone=>makeZone(zone,true)));
  el.anatomyZones.replaceChildren(...zones.map(zone=>{
    const li=document.createElement("li");
    li.append(makeZone(zone,false));
    return li;
  }));
  refreshDiagramMarkers();
}

el.anatomyStage.addEventListener("click",event=>{
  if (!state.mark || event.target.closest("button")) return;
  const rect=el.anatomyStage.getBoundingClientRect();
  markDiagramPosition((event.clientX-rect.left)*100/rect.width,(event.clientY-rect.top)*100/rect.height);
});
el.anatomyStage.addEventListener("keydown",event=>{
  if (event.target!==el.anatomyStage) return;
  if (event.code==="Space") {
    event.preventDefault();
    if (!canWrite || !landmarkData) return;
  applyMode(!state.mark);
    if (state.mark) moveDiagramCursor(50,50);
    return;
  }
  if (!state.mark) return;
  if (event.key==="Enter") {
    event.preventDefault();
    markDiagramPosition(diagramKeyboard.x,diagramKeyboard.y);
    return;
  }
  const motion={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if (!motion) return;
  event.preventDefault();
  const step=event.shiftKey ? .45 : 1.8;
  moveDiagramCursor(diagramKeyboard.x+motion[0]*step,diagramKeyboard.y+motion[1]*step);
});

function setExpanded(open) {
  el.panel.classList.toggle("expanded",open);
  document.body.classList.toggle("preview-expanded",open);
  for (const node of document.querySelectorAll(".top, #page-heading, .models, .side, .preview-footer")) {
    node.inert=open;
  }
  const label=open ? "Großansicht schließen" : "Großansicht öffnen";
  el.expand.setAttribute("aria-label",label);
  el.expand.setAttribute("aria-pressed",open);
  el.expand.title=label;
  el.expand.innerHTML=svg(open ? "collapse" : "expand");
  el.expand.focus({preventScroll:true});
}

el.expand.addEventListener("click",()=>setExpanded(!el.panel.classList.contains("expanded")));
el.light.addEventListener("click",()=>{
  const light=el.stage.classList.toggle("light");
  sculpt.examLight(light);
  el.light.setAttribute("aria-pressed",light);
  el.light.setAttribute("aria-label",light ? "Hellen Ansichtsmodus ausschalten" : "Hellen Ansichtsmodus einschalten");
  el.light.title=el.light.getAttribute("aria-label");
});
document.addEventListener("keydown",event=>{
  if (event.key!=="Escape" || el.dialog.open) return;
  if (isDiagramView() && state.mark) applyMode(false);
  else if (!state.mark && el.panel.classList.contains("expanded")) setExpanded(false);
});

el.markerButton.addEventListener("click",event=>{
  if (!canWrite || !landmarkData) return;
  applyMode(!state.mark);
  if (state.mark && isDiagramView()) {
    moveDiagramCursor(50,50);
    el.anatomyStage.focus({preventScroll:true});
    if (matchMedia("(max-width: 620px)").matches) el.anatomyStage.scrollIntoView({block:"nearest"});
  } else if (state.mark && event.detail===0) {
    positionKeyboard(50,50);
    el.stage.focus({preventScroll:true});
  }
});
el.overview.addEventListener("click",()=>selectRegion(null));
el.zoomIn.addEventListener("click",()=>sculpt.stepZoom(1/1.22));
el.zoomOut.addEventListener("click",()=>sculpt.stepZoom(1.22));
el.zoomReset.addEventListener("click",()=>{ if (landmarkData) sculpt.transition(areaPose()); });

if (!sculpt.ready) {
  $("stage-error").hidden=false;
  for (const id of ["mark-mode","zoom-in","zoom-out","zoom-reset"]) $(id).disabled=true;
} else {
  renderControls();
  modelThumbnails();
  sculpt.onRender(()=>{
    el.zoomLevel.textContent = Math.round(overviewPose().height / sculpt.pose.height * 100) + " %";
    el.zoomOut.disabled = sculpt.pose.height >= landmarkData.height*1.65-.0001;
    el.zoomIn.disabled = sculpt.pose.height <= landmarkData.height*.027+.0001;
    placeMarkers();
  });
  el.markerButton.disabled=true;
  notifyHost({type:"caresuite-body-ready"});
  if (window.parent === window && !window.ReactNativeWebView) void chooseFigure(figures[0],true);
  new ResizeObserver(() => notifyHost({
    type:"caresuite-body-height",height:Math.ceil(document.body.getBoundingClientRect().height),
  })).observe(document.body);
}

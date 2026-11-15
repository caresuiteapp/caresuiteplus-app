"use strict";

const sculpt = (() => {
  const canvas = document.getElementById("body-canvas");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, preserveDrawingBuffer: true });
  const software = gl ? null : setupSoftwareRasterizer(canvas);
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const unit = (v) => {
    const magnitude = Math.hypot(...v) || 1;
    return v.map((value) => value / magnitude);
  };
  const limit = (n, low, high) => Math.min(high, Math.max(low,n));
  const wrap = (angle) => angle - Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
  const fullDepth = -2;
  const pose = { yaw: -.18, pitch: 0.025, height: 1.97, target: [0, -.01, .88], depth:fullDepth, half:0 };
  const vertexScale = 15000;
  const objects = new Map();
  const atlases = new Map();
  let current;
  let currentKey;
  let onRender = () => {};
  let frame = 0;
  let view;
  let generation = 0;
  let idle = 0;
  let scalp = false;
  let examinationLight = false;
  const anisotropy = gl?.getExtension("EXT_texture_filter_anisotropic");

  function frameSize(view, zoom, moving) {
    const native = window.devicePixelRatio || 1;
    const target = moving ? Math.min(native,1.4) : Math.max(native,zoom > 8 ? 3.4 : zoom > 2 ? 2.8 : 2);
    const maxSide = moving ? 880 : 3000;
    const pixelBudget = moving ? 620000 : gl ? 5100000 : 4200000;
    const ratio = Math.min(target,maxSide/Math.max(view.width,view.height),Math.sqrt(pixelBudget/(view.width*view.height)));
    return [Math.max(2,Math.round(view.width*ratio)),Math.max(2,Math.round(view.height*ratio))];
  }

  function decode(value) {
    if (typeof Uint8Array.fromBase64 === "function") return Uint8Array.fromBase64(value).buffer;
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }


  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result));
    }
    return result;
  }

  function program(vertexSource, fragmentSource) {
    const result = gl.createProgram();
    gl.attachShader(result, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(result, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(result);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(result));
    }
    return result;
  }

  const skinProgram = gl && program(`#version 300 es
    precision highp float;
    layout(location=0) in vec3 grid;
    layout(location=1) in vec3 n;
    layout(location=2) in vec3 color;
    layout(location=3) in float hair;
    layout(location=4) in float fabric;
    layout(location=5) in vec3 skinUV;
    layout(location=6) in float ao;
    layout(location=7) in vec3 tangent;
    uniform mat4 camera;
    out vec3 surfaceNormal;
    out vec3 pigment;
    out vec3 world;
    out float follicleWeight;
    out float fabricWeight;
    out vec3 surfaceUV;
    out float visibility;
    out vec3 strand;
    void main() {
      world = grid / 15000.0;
      surfaceNormal = n;
      pigment = color;
      follicleWeight = hair;
      fabricWeight = fabric;
      surfaceUV = skinUV;
      visibility = ao;
      strand = tangent;
      gl_Position = camera * vec4(world, 1.0);
    }
  `, `#version 300 es
    precision highp float;
    in vec3 surfaceNormal;
    in vec3 pigment;
    in vec3 world;
    in float follicleWeight;
    in float fabricWeight;
    in vec3 surfaceUV;
    in float visibility;
    in vec3 strand;
    uniform sampler2D skinMap;
    uniform bool useMap;
    uniform bool examineTexture;
    uniform bool scalp;
    uniform float fillLight;
    uniform vec3 facing;
    uniform vec3 key;
    uniform vec3 fillDirection;
    uniform float rear;
    uniform float feather;
    uniform float halfBody;
    uniform float detail;
    out vec4 fragment;
    float pore(vec3 coordinate) {
      vec3 cell = floor(coordinate);
      vec3 random = fract(sin(vec3(dot(cell,vec3(127.1,311.7,74.7)),
                                  dot(cell,vec3(269.5,183.3,246.1)),
                                  dot(cell,vec3(113.5,271.9,124.6)))) * 43758.5453);
      vec3 delta = fract(coordinate) - (.26 + random * .48);
      return max(0.0, 1.0 - dot(delta,delta) * 12.0);
    }
    vec3 sampleSkin(vec2 uv, vec2 dx, vec2 dy) {
      vec2 size = vec2(textureSize(skinMap,0));
      float footprint = max(length(dx*size),length(dy*size));
      vec3 linear = textureGrad(skinMap,uv,dx,dy).rgb;
      if (!examineTexture || footprint >= .86) return linear;

      // Catmull–Rom reconstruction. Combine the two inner weights in
      // each direction with the sampler's linear interpolation.
      vec2 cell = uv*size - .5;
      vec2 edge = floor(cell);
      vec2 f = cell-edge;
      vec2 f2 = f*f;
      vec2 f3 = f2*f;
      vec2 first = -.5*f+f2-.5*f3;
      vec2 second = 1.0-2.5*f2+1.5*f3;
      vec2 third = .5*f+2.0*f2-1.5*f3;
      vec2 last = -.5*f2+.5*f3;
      vec2 inside = second+third;
      vec2 coordinates[3] = vec2[3]((edge-.5)/size,(edge+.5+third/inside)/size,(edge+2.5)/size);
      vec2 weights[3] = vec2[3](first,inside,last);
      vec3 cubic = vec3(0.0);
      for (int y = 0; y < 3; ++y) {
        for (int x = 0; x < 3; ++x) {
          cubic += textureLod(skinMap,vec2(coordinates[x].x,coordinates[y].y),0.0).rgb*weights[x].x*weights[y].y;
        }
      }
      return mix(clamp(cubic,0.0,1.0),linear,smoothstep(.42,.86,footprint));
    }
    void main() {
      vec2 uvDx = dFdx(surfaceUV.xy), uvDy = dFdy(surfaceUV.xy);
      if (scalp && follicleWeight > .001) discard;
      vec3 normal = normalize(surfaceNormal);
      normal *= dot(normal, facing) < 0.0 ? -1.0 : 1.0;
      vec3 main = normalize(key);
      float d = max(0.0, dot(normal, main));
      vec3 fillSource = normalize(fillDirection);
      float fill = max(0.0, dot(normal, fillSource));
      float edge = pow(1.0 - max(0.0, dot(normal, facing)), 3.0);
      vec3 keyHalfDirection = normalize(main + facing);
      vec3 fillHalfDirection = normalize(fillSource + facing);
      float keyHalf = max(0.0, dot(normal,keyHalfDirection));
      float fillHalf = max(0.0, dot(normal,fillHalfDirection));
      float material = step(.12,fabricWeight);
      float eye = step(.801,surfaceUV.x)*step(.5,surfaceUV.z);
      float hair = step(.005,follicleWeight);
      vec3 base = pigment;
      if (useMap && surfaceUV.z > .5) base = sampleSkin(surfaceUV.xy,uvDx,uvDy) * .80 + pigment * .20;
      float bounce = .045*clamp(.42-normal.z*.51,0.0,.9);
      float sky = .058*clamp(.45+normal.z*.6,0.0,1.0);
      vec3 ambient = vec3(.285,.297,.317) + sky + bounce*vec3(1.0,.83,.73);
      vec3 direct = d*vec3(.925,.873,.810) + fill*vec3(.302,.330,.366);
      vec3 light = ambient*visibility + direct*(.57+.43*visibility) + fillLight*.19;
      float skin = (1.0-material)*(1.0-eye)*(1.0-hair);
      float warmScatter = skin*.031*fill*(1.0-d)*visibility;
      light += warmScatter*vec3(1.0,.41,.30);

      float keyGloss = pow(keyHalf,32.0)*.0072;
      float fillGloss = pow(fillHalf,23.0)*.0031;
      keyGloss = mix(keyGloss,pow(keyHalf,12.0)*.0019,material);
      fillGloss = mix(fillGloss,pow(fillHalf,11.0)*.0009,material);
      keyGloss = mix(keyGloss,pow(keyHalf,41.0)*.0060,hair);
      fillGloss = mix(fillGloss,pow(fillHalf,30.0)*.0020,hair);
      keyGloss = mix(keyGloss,pow(keyHalf,105.0)*.057,eye);
      fillGloss = mix(fillGloss,pow(fillHalf,89.0)*.022,eye);
      float strandLength = dot(strand,strand);
      if (follicleWeight > .50 && strandLength > .08) {
        vec3 direction = normalize(strand + normal*.14);
        float primary = dot(direction,keyHalfDirection);
        float secondary = dot(direction,fillHalfDirection);
        keyGloss = .016*pow(max(0.0,1.0-primary*primary),15.0)*(.25+.75*d);
        fillGloss = .0068*pow(max(0.0,1.0-secondary*secondary),12.0)*(.34+.66*fill);
      }
      float rim = edge*(.002+.004*fill);
      vec3 specular = (vec3(1.0,.93,.85)*keyGloss + vec3(.77,.9,1.0)*(fillGloss+rim)) * visibility;
      vec3 colour = sqrt(max(vec3(0.0),base*base*light+specular));
      float footprint=max(length(dFdx(world)),length(dFdy(world)));
      if (detail > 0.0 && skin > 0.0) {
        float textureWeight=detail*skin*(1.0-smoothstep(.00055,.00170,footprint));
        float fine=pore(world*710.0);
        float relief=pore((world+normal*.00030)*710.0);
        float stipple=pore(world*304.0+vec3(2.7,-1.8,5.6));
        colour += textureWeight*((relief-fine)*(.016+.014*d) - fine*.013 + (stipple-.19)*.017);
      }
      if (follicleWeight > .64 && detail > 0.0 && strandLength < .08) {
        float flow = world.x*(.93+clamp((world.y+.04)/.08,0.0,1.0)*.31) + .46*world.y + .10*world.z;
        float transverse = (flow + sin(world.z*68.0+world.y*107.0)*.0027)*740.0;
        float whole = floor(transverse);
        float centre = (fract(transverse)-.45-sin(whole*78.23)*.18)*4.0;
        float strength = max(0.0,.48+.42*sin(world.y*381.0-world.z*211.0+whole*5.7)
                                   +.24*sin(world.x*593.0+whole*12.1));
        float fibre = exp(-centre*centre)*strength-.21;
        float reflection = .00235*sin(flow*3110.0+sin(world.z*771.0+world.x*51.0)*3.3);
        colour += follicleWeight * detail * (fibre*.0364+reflection) * vec3(1.0,.94,.91);
      }
      if (fabricWeight > .01 && detail > 0.0) {
        float warp=sin((world.x*.83+world.y*.54)*2512.0+sin(world.z*112.0)*.24);
        float weft=sin((world.z+.08*world.y)*2827.0+sin(world.x*160.0)*.19);
        float weave=1.0-smoothstep(.00050,.00115,footprint);
        colour += fabricWeight*detail*weave*(.010*warp*weft+.003*weft);
      }
      float coverage = smoothstep(rear,rear+feather,dot(world,facing));
      coverage *= mix(1.0,smoothstep(-.02,.024,sign(halfBody)*world.x),abs(halfBody));
      if (coverage <= 0.0) discard;
      fragment = vec4(colour, coverage);
    }
  `);

  const shadowProgram = gl && program(`#version 300 es
    precision highp float;
    layout(location=0) in vec2 xy;
    uniform mat4 camera;
    out vec2 uv;
    void main() {
      uv = xy;
      gl_Position = camera * vec4(xy.x * .34, xy.y * .25 + .012, .003, 1.0);
    }
  `, `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 fragment;
    void main() {
      float distance = dot(uv, uv);
      float spread = max(0.0, 1.0 - distance);
      float shadow = exp(-distance * 4.4) * spread * 0.36;
      fragment = vec4(.102, .244, .274, shadow);
    }
  `);

  const uniforms = gl && Object.fromEntries(["camera","facing","key","fillDirection","detail","rear","feather","halfBody","useMap","examineTexture","skinMap","scalp","fillLight"].map(name => [name, gl.getUniformLocation(skinProgram, name)]));
  const shadowCamera = gl?.getUniformLocation(shadowProgram, "camera");
  const shadowVao = gl?.createVertexArray();
  const flatMap = gl?.createTexture();
  if (gl) {
    gl.bindTexture(gl.TEXTURE_2D,flatMap);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.bindVertexArray(shadowVao);
    const shadowBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,0);
  }

  function buffers(key, cache = true) {
    if (objects.has(key)) return objects.get(key);
    const [identity, variant] = key.split(":");
    const neutral = window.figureGeometry[identity];
    const data = (variant === "clinical" && neutral.clinical) || neutral;
    function attribute(field, Type) {
      const dataValues = new Type(decode(data[field]));
      if (!data.addToBase) return dataValues;
      const base = buffers(identity)[field === "vertices" ? "positions" : field];
      const merged = new Type(base.length + dataValues.length);
      merged.set(base);
      merged.set(dataValues,base.length);
      return merged;
    }
    let triangles=data.indices16 ? new Uint16Array(decode(data.triangles)) : new Uint32Array(decode(data.triangles));
    if (data.omittedBaseFaces) {
      const base=buffers(identity).triangles;
      const omit=new Uint32Array(decode(data.omittedBaseFaces));
      const joined=new Uint32Array(base.length-omit.length*3+triangles.length);
      let from=0, to=0;
      for (const index of omit) {
        const before=base.subarray(from,index*3);
        joined.set(before,to);
        to+=before.length;
        from=index*3+3;
      }
      joined.set(base.subarray(from),to);
      joined.set(triangles,joined.length-triangles.length);
      triangles=joined;
    }
    const model = {
      positions: attribute("vertices",Int16Array),
      normals: attribute("normals",Int8Array),
      colors: attribute("colors",Uint8Array),
      identity, clinicalSurface:data !== neutral,
      triangles,
      indexType: data.indices16 ? gl?.UNSIGNED_SHORT : gl?.UNSIGNED_INT,
      landmarks: neutral.landmarks, height: neutral.height, width:neutral.width, clinical: neutral.clinical?.focus, handle: gl?.createVertexArray(),
    };
    for (const field of ["hair","fabric"]) {
      if (!neutral[field]) continue;
      const values = new Uint8Array(decode(neutral[field]));
      const expanded = new Uint8Array(model.positions.length/3);
      expanded.set(values);
      model[field]=expanded;
    }
    if (neutral.skinUV) {
      model.skinUV = new Uint16Array(model.positions.length);
      model.skinUV.set(new Uint16Array(decode(neutral.skinUV)));
    }
    model.ao = new Uint8Array(model.positions.length/3).fill(255);
    if (neutral.ao) model.ao.set(new Uint8Array(decode(neutral.ao)));
    if (neutral.tangent) {
      model.tangent = new Int8Array(model.positions.length);
      model.tangent.set(new Int8Array(decode(neutral.tangent)));
    }
    if (gl) {
      gl.bindVertexArray(model.handle);
      const attributes = [
        [0,model.positions,gl.SHORT,false,3],
        [1,model.normals,gl.BYTE,true,3],
        [2,model.colors,gl.UNSIGNED_BYTE,true,3],
        [3,model.hair,gl.UNSIGNED_BYTE,true,1],
        [4,model.fabric,gl.UNSIGNED_BYTE,true,1],
        [5,model.skinUV,gl.UNSIGNED_SHORT,true,3],
        [6,model.ao,gl.UNSIGNED_BYTE,true,1],
        [7,model.tangent,gl.BYTE,true,3],
      ];
      for (const [slot,values,format,normalize,size] of attributes) {
        if (!values) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(slot);
        gl.vertexAttribPointer(slot,size,format,normalize,0,0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.triangles, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
    }
    if (cache) objects.set(key, model);
    return model;
  }

  function loadAtlas(identity) {
    const source = window.figureGeometry[identity].skinMap;
    if (!source) return;
    if (atlases.has(identity)) {
      const previous=atlases.get(identity);
      atlases.delete(identity);
      atlases.set(identity,previous);
      return;
    }
    atlases.set(identity,null);
    const image = new Image();
    image.onload = () => {
      if (gl) {
        const handle = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D,handle);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        if (anisotropy) gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        gl.generateMipmap(gl.TEXTURE_2D);
        atlases.set(identity,handle);
      } else {
        const screen = document.createElement("canvas");
        screen.width = image.naturalWidth;
        screen.height = image.naturalHeight;
        const context = screen.getContext("2d",{willReadFrequently:true});
        context.drawImage(image,0,0);
        atlases.set(identity,context.getImageData(0,0,screen.width,screen.height));
      }
      for (const [previous, cached] of atlases) {
        if (atlases.size<=3) break;
        if (!cached || previous===currentKey) continue;
        if (gl) gl.deleteTexture(cached);
        atlases.delete(previous);
      }
      if (currentKey === identity) render();
    };
    image.src = source;
  }

  function cameraAt(currentPose, width, height) {
    const {yaw, pitch, target} = currentPose;
    const facing = [Math.sin(yaw)*Math.cos(pitch), -Math.cos(yaw)*Math.cos(pitch), Math.sin(pitch)];
    const right = [Math.cos(yaw), Math.sin(yaw), 0];
    const up = cross(facing, right);
    const sx = 2 / (currentPose.height * width / Math.max(height,1));
    const sy = 2 / currentPose.height;
    const sz = -.42;
    const matrix = new Float32Array([
      right[0]*sx,up[0]*sy,facing[0]*sz,0,
      right[1]*sx,up[1]*sy,facing[1]*sz,0,
      right[2]*sx,up[2]*sy,facing[2]*sz,0,
      -dot(target,right)*sx,-dot(target,up)*sy,-dot(target,facing)*sz,1,
    ]);
    const fillLight=examinationLight ? .85 : current?.clinicalSurface ? .42 : 0;
    const key=facing.map((v,i)=>v+up[i]*.81-right[i]*.67);
    const fill=facing.map((v,i)=>v*.76+up[i]*.26+right[i]*.79);
    return {facing,right,up,key,fill,sx,sy,matrix,height,width,target,rear:currentPose.depth ?? fullDepth,feather:.034,half:currentPose.half ?? 0,scalp,fillLight};
  }

  function render(fast = false) {
    if (!current || !canvas.clientWidth || !canvas.clientHeight) return;
    view = cameraAt(pose,Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight));
    const zoom = current.height / pose.height;
    const pixels = frameSize(view,zoom,fast);
    const atlas = atlases.get(current.identity);
    if (software) {
      software.render(current,view,zoom,fast,pixels,atlas);
      onRender();
      return;
    }
    if (canvas.width !== pixels[0] || canvas.height !== pixels[1]) {
      canvas.width = pixels[0];
      canvas.height = pixels[1];
    }
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(shadowProgram);
    gl.uniformMatrix4fv(shadowCamera, false, view.matrix);
    gl.bindVertexArray(shadowVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(skinProgram);
    gl.uniformMatrix4fv(uniforms.camera, false, view.matrix);
    gl.uniform3fv(uniforms.facing, view.facing);
    gl.uniform3fv(uniforms.key,view.key);
    gl.uniform3fv(uniforms.fillDirection,view.fill);
    const detail = fast ? 0 : limit((view.height * view.sy - 1250) / 6200,0,1);
    gl.uniform1f(uniforms.detail,detail);
    gl.uniform1f(uniforms.rear,view.rear+dot(view.target,view.facing));
    gl.uniform1f(uniforms.feather,view.feather);
    gl.uniform1f(uniforms.halfBody,view.half);
    gl.uniform1i(uniforms.useMap,atlas ? 1 : 0);
    gl.uniform1i(uniforms.examineTexture,!fast && zoom > 5 ? 1 : 0);
    gl.uniform1i(uniforms.skinMap,0);
    gl.uniform1i(uniforms.scalp,scalp ? 1 : 0);
    gl.uniform1f(uniforms.fillLight,view.fillLight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,atlas ?? flatMap);
    gl.bindVertexArray(current.handle);
    gl.drawElements(gl.TRIANGLES, current.triangles.length, current.indexType, 0);
    gl.bindVertexArray(null);
    onRender();
  }

  function choose(key) {
    current = buffers(key);
    currentKey = key;
    if (!current) return;
    loadAtlas(key);
    return { landmarks: current.landmarks, height: current.height, width:current.width, clinical: current.clinical };
  }

  function clinical(active) {
    current = buffers(currentKey + (active && current.clinical ? ":clinical" : ""));
  }

  function transition(goal, instant = false) {
    cancelAnimationFrame(frame);
    const pick = ++generation;
    const start = structuredClone(pose);
    const delta = wrap(goal.yaw - start.yaw);
    const depth = goal.depth ?? fullDepth;
    const half = goal.half ?? 0;
    const began = performance.now();
    const duration = instant || matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 325;
    function draw(now) {
      const ratio = duration ? limit((now-began)/duration,0,1) : 1;
      const t = 1 - (1-ratio)**3;
      pose.yaw = wrap(start.yaw + delta*t);
      pose.pitch = start.pitch + (goal.pitch - start.pitch)*t;
      pose.height = start.height + (goal.height - start.height)*t;
      pose.target = start.target.map((v,i)=>v+(goal.target[i]-v)*t);
      pose.depth = start.depth + (depth - start.depth)*t;
      pose.half = start.half + (half - start.half)*t;
      render(ratio < 1);
      if (ratio < 1 && generation === pick) frame = requestAnimationFrame(draw);
    }
    draw(began);
  }

  function interactiveRender() {
    render(true);
    clearTimeout(idle);
    idle = setTimeout(render,100);
  }

  function orbit(dx,dy) {
    cancelAnimationFrame(frame);
    pose.yaw = wrap(pose.yaw - dx * .011);
    pose.pitch = wrap(pose.pitch + dy * .011);
    interactiveRender();
  }

  function stepZoom(delta, interacting = false) {
    cancelAnimationFrame(frame);
    pose.height = limit(pose.height * delta, .027 * current.height, current.height * 1.65);
    if (interacting) interactiveRender();
    else render();
  }

  function pan(dx,dy) {
    if (!view) return;
    cancelAnimationFrame(frame);
    const factor = pose.height / view.height;
    pose.target = pose.target.map((c,i) => c - view.right[i]*dx*factor + view.up[i]*dy*factor);
    interactiveRender();
  }

  function project(point) {
    const world = subtract(point,view.target);
    return [
      (1 + dot(view.right,world)*view.sx) * view.width * .5,
      (1 - dot(view.up,world)*view.sy) * view.height * .5,
    ];
  }

  function ray(x,y) {
    const at = view.target.map((v,i)=>v + (x*2/view.width-1)/view.sx * view.right[i] + (1-y*2/view.height)/view.sy * view.up[i]);
    return { origin: at.map((v,i)=>v + view.facing[i]*2), direction: view.facing.map(v=>-v) };
  }

  function intersect(origin, dir, compareDistance = Infinity, respectClip = true) {
    const {triangles, positions} = current;
    const [ox,oy,oz] = origin;
    const [dx,dy,dz] = dir;
    const focusDepth = respectClip ? view.rear + view.feather*.36 : -Infinity;
    const initialDepth = dot(subtract(origin,view.target),view.facing);
    const depthStep = dot(dir,view.facing);
    let found = false;
    let best = compareDistance;
    for (let i=0;i<triangles.length;i+=3) {
      if (scalp && current.hair?.[triangles[i]]) continue;
      const a=triangles[i]*3, b=triangles[i+1]*3, c=triangles[i+2]*3;
      const ax=positions[a]/vertexScale, ay=positions[a+1]/vertexScale, az=positions[a+2]/vertexScale;
      const ux=positions[b]/vertexScale-ax, uy=positions[b+1]/vertexScale-ay, uz=positions[b+2]/vertexScale-az;
      const vx=positions[c]/vertexScale-ax, vy=positions[c+1]/vertexScale-ay, vz=positions[c+2]/vertexScale-az;
      const hx=dy*vz-dz*vy, hy=dz*vx-dx*vz, hz=dx*vy-dy*vx;
      const determinant=ux*hx+uy*hy+uz*hz;
      if (Math.abs(determinant)<1e-10) continue;
      const sx=ox-ax, sy=oy-ay, sz=oz-az;
      const u=(sx*hx+sy*hy+sz*hz)/determinant;
      if (u < -1e-7 || u > 1.0000001) continue;
      const qx=sy*uz-sz*uy, qy=sz*ux-sx*uz, qz=sx*uy-sy*ux;
      const v=(dx*qx+dy*qy+dz*qz)/determinant;
      if(v < -1e-7 || u+v > 1.0000001) continue;
      const t=(vx*qx+vy*qy+vz*qz)/determinant;
      if(t >= 0 && t < best && initialDepth+t*depthStep>focusDepth &&
          (!respectClip || Math.abs(view.half)<.55 || Math.sign(view.half)*(ox+t*dx)>-.004)) {
        if (compareDistance !== Infinity) return true;
        best = t;
        found = true;
      }
    }
    return found ? origin.map((v,i)=>v+dir[i]*best) : null;
  }

  function pickAt(x,y) {
    if (!view || !current) return null;
    const {origin,direction} = ray(x,y);
    return intersect(origin,direction);
  }

  function surfaceNear(point, azimuth, pitch = 0, distance = .48) {
    const d = unit([Math.sin(azimuth)*Math.cos(pitch), -Math.cos(azimuth)*Math.cos(pitch), Math.sin(pitch)]);
    return intersect(point.map((v,i)=>v+d[i]*distance), d.map(v=>-v),Infinity,false) || point;
  }

  function visible(x,y,point,tolerance=.009) {
    if (x<10 || x>view.width-10 || y<10 || y>view.height-10) return false;
    if (dot(subtract(point,view.target),view.facing)<view.rear + view.feather*.36) return false;
    if (Math.abs(view.half)>.55 && Math.sign(view.half)*point[0]<-.004) return false;
    const {origin,direction} = ray(x,y);
    return !intersect(origin, direction, dot(subtract(point,origin),direction)-tolerance);
  }

  function thumbnails() {
    if (software) {
      const images = new Map();
      for (const key of Object.keys(window.figureGeometry)) {
        const model = buffers(key,false);
        const thumbnail = {yaw:-.22,pitch:.02,height:model.height*1.09,target:[0,-.02,model.height/2+.003]};
        images.set(key, software.thumbnail(model,cameraAt(thumbnail,112,140)));
      }
      return images;
    }
    const big = document.createElement("canvas");
    big.width = 224;
    big.height = 280;
    const ctx = big.getContext("2d");
    const thumbVao = gl.createVertexArray();
    gl.bindVertexArray(thumbVao);
    const attributeBuffers = Array.from({length:8},()=>gl.createBuffer());
    const index = gl.createBuffer();
    const target = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,target);
    const color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,color);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,big.width,big.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
    gl.bindTexture(gl.TEXTURE_2D,flatMap);
    const depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,big.width,big.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    gl.viewport(0,0,big.width,big.height);
    const answers = new Map();
    for (const [key, data] of Object.entries(window.figureGeometry)) {
      const geometry = [
        [new Int16Array(decode(data.vertices)),gl.SHORT,false,3],
        [new Int8Array(decode(data.normals)),gl.BYTE,true,3],
        [new Uint8Array(decode(data.colors)),gl.UNSIGNED_BYTE,true,3],
        [data.hair && new Uint8Array(decode(data.hair)),gl.UNSIGNED_BYTE,true,1],
        [data.fabric && new Uint8Array(decode(data.fabric)),gl.UNSIGNED_BYTE,true,1],
        [data.skinUV && new Uint16Array(decode(data.skinUV)),gl.UNSIGNED_SHORT,true,3],
        [data.ao && new Uint8Array(decode(data.ao)),gl.UNSIGNED_BYTE,true,1],
        [data.tangent && new Int8Array(decode(data.tangent)),gl.BYTE,true,3],
      ];
      gl.bindVertexArray(thumbVao);
      for (const [slot,[values,type,normalize,size]] of geometry.entries()) {
        if (!values) {
          gl.disableVertexAttribArray(slot);
          if (slot===6) gl.vertexAttrib1f(6,1);
          continue;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,attributeBuffers[slot]);
        gl.bufferData(gl.ARRAY_BUFFER,values,gl.STREAM_DRAW);
        gl.enableVertexAttribArray(slot);
        gl.vertexAttribPointer(slot,size,type,normalize,0,0);
      }
      const indices = data.indices16 ? new Uint16Array(decode(data.triangles)) : new Uint32Array(decode(data.triangles));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STREAM_DRAW);
      const thumbnailView = cameraAt({yaw:-.23,pitch:.02,height:data.height*1.09,target:[0,-.02,data.height/2+.003]},big.width,big.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(skinProgram);
      gl.uniform1i(uniforms.useMap,0);
      gl.uniform1i(uniforms.scalp,0);
      gl.uniform1f(uniforms.fillLight,0);
      gl.uniformMatrix4fv(uniforms.camera,false,thumbnailView.matrix);
      gl.uniform3fv(uniforms.facing,thumbnailView.facing);
      gl.uniform3fv(uniforms.key,thumbnailView.key);
      gl.uniform3fv(uniforms.fillDirection,thumbnailView.fill);
      gl.uniform1f(uniforms.detail,0);
      gl.uniform1f(uniforms.rear,-3);
      gl.uniform1f(uniforms.feather,.034);
      gl.uniform1f(uniforms.halfBody,0);
      gl.drawElements(gl.TRIANGLES, indices.length,data.indices16 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,0);
      const line = big.width*4;
      const all = new Uint8Array(line*big.height);
      gl.readPixels(0,0,big.width,big.height,gl.RGBA,gl.UNSIGNED_BYTE,all);
      const image = ctx.createImageData(big.width,big.height);
      for(let y=0;y<big.height;y++) image.data.set(all.subarray(y*line,(y+1)*line),(big.height-y-1)*line);
      ctx.putImageData(image,0,0);
      answers.set(key,big.toDataURL("image/png"));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.bindVertexArray(null);
    gl.deleteVertexArray(thumbVao);
    gl.deleteBuffer(index);
    for(const buffer of attributeBuffers) gl.deleteBuffer(buffer);
    gl.deleteTexture(color);
    gl.deleteRenderbuffer(depth);
    gl.deleteFramebuffer(target);
    return answers;
  }

  new ResizeObserver(() => render()).observe(canvas);
  return {
    ready:true, renderer:gl ? "WebGL 2" : "Canvas", choose, clinical, transition,
    orbit, pan, stepZoom, project, surfaceNear, pickAt, visible, thumbnails, pose,
    showScalp:visible=>{scalp=visible;},
    examLight:bright=>{examinationLight=bright; render();},
    onRender:callback=>{onRender=callback;},
  };
})();

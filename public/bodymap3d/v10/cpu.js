"use strict";

function setupSoftwareRasterizer(canvas) {
  const canvasContext = canvas.getContext("2d", { alpha: true });
  let width, height, image, rgba, depth;
  const lightPosition = p => Math.max(0, p);
  const clampByte = value => Math.round(Math.min(255, Math.max(0,value)));
  const sampleMap = (pixels,a,b,x,y) =>
    (pixels[a]*(1-x)+pixels[a+4]*x)*(1-y)+(pixels[b]*(1-x)+pixels[b+4]*x)*y;

  function allocate(w,h) {
    if (w===width && h===height) return;
    width=w;
    height=h;
    image=canvasContext.createImageData(w,h);
    rgba=image.data;
    depth=new Float32Array(w*h);
  }

  function skinGrain(x, y, z) {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const k = Math.floor(z);
    const seed = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791);
    const bits = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
    const u = x - i - .26 - (bits & 7) * .065;
    const v = y - j - .26 - ((bits >>> 3) & 7) * .065;
    const w = z - k - .26 - ((bits >>> 6) & 7) * .065;
    return Math.max(0, 1 - (u*u + v*v + w*w) * 12);
  }

  function hairGrain(x, y, z) {
    // Break up the fibres in object space so the highlights do not form
    // parallel bands across the whole scalp.
    const flow=x*(.93+Math.min(1,Math.max(0,(y+.04)/.08))*.31)+.46*y+.10*z;
    const transverse=(flow+Math.sin(z*68+y*107)*.0027)*740;
    const whole=Math.floor(transverse);
    const centre=(transverse-whole-.45-Math.sin(whole*78.23)*.18)*4;
    const striation=Math.exp(-centre*centre);
    const strength=Math.max(0,.48+.42*Math.sin(y*381-z*211+whole*5.7)+.24*Math.sin(x*593+whole*12.1));
    const under=.60*Math.sin(flow*3110+Math.sin(z*771+x*51)*3.3);
    return 9.3*(striation*strength-.21)+under;
  }

  function frameMesh(model,camera,output,renderWidth,renderHeight,zoom,fast,atlas) {
    allocate(renderWidth,renderHeight);
    rgba.fill(0);
    depth.fill(-Infinity);
    const data = coordinates(model,camera,renderWidth,renderHeight);
    const count = data.z.length;
    const red = new Float32Array(count);
    const green = new Float32Array(count);
    const blue = new Float32Array(count);
    const lighting = new Float32Array(count*3);
    const { positions, normals, colors, triangles, hair, fabric, skinUV, ao, tangent } = model;
    const mapped = atlas && skinUV && !fast;
    const f = camera.facing;
    const key = direction(camera.key);
    const fill = direction(camera.fill);
    const keyGloss = direction(f.map((v,i)=>v + key[i]));
    const fillGloss = direction(f.map((v,i)=>v + fill[i]));
    const exposure=camera.fillLight*.19;

    for (let i=0,j=0;i<count;i++,j+=3) {
      let nx=normals[j]/127, ny=normals[j+1]/127, nz=normals[j+2]/127;
      let face=nx*f[0]+ny*f[1]+nz*f[2];
      if (face<0) { nx=-nx;ny=-ny;nz=-nz;face=-face; }
      const diffuse=lightPosition(nx*key[0]+ny*key[1]+nz*key[2]);
      const soft=lightPosition(nx*fill[0]+ny*fill[1]+nz*fill[2]);
      const eye=skinUV && skinUV[j+2]===65535 && skinUV[j]>=52493;
      const cloth=fabric && fabric[i]>30;
      const follicle=hair && hair[i]>1;
      const visible=(ao?.[i] ?? 255)/255;
      const direct=.57+.43*visible;
      const bounce=.045*Math.min(.9,Math.max(0,.42-nz*.51));
      const sky=.058*Math.min(1,Math.max(0,.45+nz*.6));
      const scatter=!(eye||cloth||follicle) ? .031*soft*(1-diffuse)*visible : 0;
      lighting[j]=(.285+sky+bounce)*visible+(.925*diffuse+.302*soft)*direct+exposure+scatter;
      lighting[j+1]=(.297+sky+.83*bounce)*visible+(.873*diffuse+.330*soft)*direct+exposure+.41*scatter;
      lighting[j+2]=(.317+sky+.73*bounce)*visible+(.810*diffuse+.366*soft)*direct+exposure+.30*scatter;

      const keyHalf=lightPosition(nx*keyGloss[0]+ny*keyGloss[1]+nz*keyGloss[2]);
      const fillHalf=lightPosition(nx*fillGloss[0]+ny*fillGloss[1]+nz*fillGloss[2]);
      let mainShine=keyHalf**(eye ? 105 : cloth ? 12 : follicle ? 41 : 32)*
        (eye ? .057 : cloth ? .0019 : follicle ? .006 : .0072);
      const rim=(1-Math.min(1,face))**3*(.002+.004*soft);
      let reflectedShine=fillHalf**(eye ? 89 : cloth ? 11 : follicle ? 30 : 23)*
        (eye ? .022 : cloth ? .0009 : follicle ? .002 : .0031)+rim;
      if (hair?.[i]>127 && tangent) {
        const tx=tangent[j]/127+nx*.14,ty=tangent[j+1]/127+ny*.14,tz=tangent[j+2]/127+nz*.14;
        const length=Math.hypot(tx,ty,tz);
        if (length>.28) {
          const primary=(tx*keyGloss[0]+ty*keyGloss[1]+tz*keyGloss[2])/length;
          const secondary=(tx*fillGloss[0]+ty*fillGloss[1]+tz*fillGloss[2])/length;
          mainShine=.016*Math.max(0,1-primary*primary)**15*(.25+.75*diffuse);
          reflectedShine=.0068*Math.max(0,1-secondary*secondary)**12*(.34+.66*soft)+rim;
        }
      }
      red[i]=colors[j]**2*lighting[j]+65025*visible*(mainShine+.77*reflectedShine);
      green[i]=colors[j+1]**2*lighting[j+1]+65025*visible*(.93*mainShine+.90*reflectedShine);
      blue[i]=colors[j+2]**2*lighting[j+2]+65025*visible*(.85*mainShine+reflectedShine);
    }

    const { x, y, z } = data;
    const texture = fast ? 0 : Math.min(1,Math.max(0,(camera.height * camera.sy - 1250) / 6200));
    const grainScale = 710 / 15000;
    const footprint=2/(camera.sy*renderHeight);
    const skinTexture=texture*Math.max(0,Math.min(1,(.0017-footprint)/.00115));
    const fabricTexture=texture*Math.max(0,Math.min(1,(.00115-footprint)/.00065));
    const rear = camera.rear ?? -2;
    const bodyHalf = Math.abs(camera.half);
    const hemisphere = Math.sign(camera.half) / 15000;
    for(let i=0;i<triangles.length;i+=3) {
      const a=triangles[i],b=triangles[i+1],c=triangles[i+2];
      if (camera.scalp && hair?.[a]) continue;
      const minX=Math.max(0,Math.ceil(Math.min(x[a],x[b],x[c])));
      const maxX=Math.min(width-1,Math.floor(Math.max(x[a],x[b],x[c])));
      const minY=Math.max(0,Math.ceil(Math.min(y[a],y[b],y[c])));
      const maxY=Math.min(height-1,Math.floor(Math.max(y[a],y[b],y[c])));
      if (maxX<minX || maxY<minY || Math.max(z[a],z[b],z[c])<=rear) continue;
      const ux=x[b]-x[a],uy=y[b]-y[a],vx=x[c]-x[a],vy=y[c]-y[a];
      const determinant=ux*vy-uy*vx;
      if (Math.abs(determinant)<.0001) continue;
      const inverse=1/determinant;
      const hairDetail=texture && hair && !tangent && Math.max(hair[a],hair[b],hair[c])>160;
      const fabricDetail=fabricTexture && fabric && fabric[a]>0;
      const skin=skinTexture && !hair?.[a] && !fabric?.[a] && !(skinUV && skinUV[a*3]>=52493);
      const ia=a*3, ib=b*3, ic=c*3;
      const paint=mapped && skinUV[ia+2]===65535;
      if (bodyHalf>.999 && Math.max(positions[ia]*hemisphere,positions[ib]*hemisphere,positions[ic]*hemisphere)<-.02) continue;
      for(let py=minY;py<=maxY;py++){
        const sy=py-y[a];
        for(let px=minX;px<=maxX;px++) {
          const sx=px-x[a];
          const u=(sx*vy-sy*vx)*inverse;
          const v=(ux*sy-uy*sx)*inverse;
          const w=1-u-v;
          if (Math.min(w,u,v)<-.0001) continue;
          const k=py*width+px;
          const position=z[a]*w+z[b]*u+z[c]*v;
          if(position<=depth[k] || position<=rear) continue;
          const worldX = (bodyHalf || skin || hairDetail || fabricDetail) ? positions[ia]*w+positions[ib]*u+positions[ic]*v : 0;
          const midline = bodyHalf ? Math.max(0,Math.min(1,(worldX*hemisphere + .02)/.044)) : 1;
          if (bodyHalf===1 && midline===0) continue;
          depth[k]=position;
          const idx=k*4;
          let grain=0;
          if (hairDetail || skin || fabricDetail) {
            const worldY=(positions[ia+1]*w+positions[ib+1]*u+positions[ic+1]*v)/15000;
            const worldZ=(positions[ia+2]*w+positions[ib+2]*u+positions[ic+2]*v)/15000;
            if (fabricDetail) {
              const x=worldX/15000;
              const warp=Math.sin((x*.83+worldY*.54)*2512+Math.sin(worldZ*112)*.24);
              const weft=Math.sin((worldZ+.08*worldY)*2827+Math.sin(x*160)*.19);
              grain=fabricTexture*(2.55*warp*weft+.765*weft);
            } else if (hairDetail) {
              const amount=(hair[a]*w+hair[b]*u+hair[c]*v)/255;
              grain=amount*texture*hairGrain(worldX/15000,worldY,worldZ);
            } else {
              const fine=skinGrain(worldX*grainScale,worldY*710,worldZ*710);
              const soft=skinGrain(worldX/15000*304+2.7,worldY*304-1.8,worldZ*304+5.6);
              const raised=skinGrain((worldX/15000+key[0]*.00028)*710,
                (worldY+key[1]*.00028)*710,(worldZ+key[2]*.00028)*710);
              grain=skinTexture*((soft-.19)*4.34-fine*3.32+(raised-fine)*5.85);
            }
          }
          let r=red[a]*w+red[b]*u+red[c]*v;
          let g=green[a]*w+green[b]*u+green[c]*v;
          let bluePixel=blue[a]*w+blue[b]*u+blue[c]*v;
          if (paint) {
            const tx=(skinUV[ia]*w+skinUV[ib]*u+skinUV[ic]*v)/65535*atlas.width-.5;
            const ty=(skinUV[ia+1]*w+skinUV[ib+1]*u+skinUV[ic+1]*v)/65535*atlas.height-.5;
            const ix=Math.max(0,Math.min(atlas.width-2,Math.floor(tx)));
            const iy=Math.max(0,Math.min(atlas.height-2,Math.floor(ty)));
            const rx=Math.max(0,Math.min(1,tx-ix)),ry=Math.max(0,Math.min(1,ty-iy));
            const p00=(iy*atlas.width+ix)*4,p01=p00+atlas.width*4;
            const pixels=atlas.data;
            const baseR=colors[ia]*w+colors[ib]*u+colors[ic]*v;
            const baseG=colors[ia+1]*w+colors[ib+1]*u+colors[ic+1]*v;
            const baseB=colors[ia+2]*w+colors[ib+2]*u+colors[ic+2]*v;
            const inkR=.80*sampleMap(pixels,p00,p01,rx,ry)+.20*baseR;
            const inkG=.80*sampleMap(pixels,p00+1,p01+1,rx,ry)+.20*baseG;
            const inkB=.80*sampleMap(pixels,p00+2,p01+2,rx,ry)+.20*baseB;
            r+=(inkR**2-baseR**2)*(lighting[ia]*w+lighting[ib]*u+lighting[ic]*v);
            g+=(inkG**2-baseG**2)*(lighting[ia+1]*w+lighting[ib+1]*u+lighting[ic+1]*v);
            bluePixel+=(inkB**2-baseB**2)*(lighting[ia+2]*w+lighting[ib+2]*u+lighting[ic+2]*v);
          }
          rgba[idx]=clampByte(Math.sqrt(Math.max(0,r))+grain);
          rgba[idx+1]=clampByte(Math.sqrt(Math.max(0,g))+grain);
          rgba[idx+2]=clampByte(Math.sqrt(Math.max(0,bluePixel))+grain);
          const visibility = Math.min(1,(position-rear)/camera.feather);
          const sideAlpha = 1 - bodyHalf*(1-midline*midline*(3-2*midline));
          rgba[idx+3]=Math.round(255*visibility*visibility*(3-2*visibility)*sideAlpha);
        }
      }
    }

    if (output.canvas.width!==renderWidth || output.canvas.height!==renderHeight) {
      output.canvas.width=renderWidth;
      output.canvas.height=renderHeight;
    }
    if (output === canvasContext && zoom < 2) {
      // Shadow is rendered in the same projection on the floor of the stage.
      const [x,y] = projected([0,.02,.001],camera,renderWidth,renderHeight);
      const length=Math.max(1,renderWidth*camera.sx*.20);
      const thickness=Math.max(3,renderHeight*camera.sy*(Math.abs(f[2])*.135+.018));
      const ground=new Uint8ClampedArray(image.data);
      for (let yy=Math.max(0,Math.floor(y-thickness));yy<Math.min(height,y+thickness);yy++) {
        for (let xx=Math.max(0,Math.floor(x-length));xx<Math.min(width,x+length);xx++) {
          const k=(width*yy+xx)*4;
          if (ground[k+3]!==0) continue;
          const distance=((xx-x)/length)**2+((yy-y)/thickness)**2;
          if(distance>=1) continue;
          ground[k]=37;
          ground[k+1]=67;
          ground[k+2]=77;
          ground[k+3]=Math.round(Math.exp(-distance*4.6)*(1-distance)*66);
        }
      }
      output.putImageData(new ImageData(ground,width,height),0,0);
    } else {
      output.putImageData(image,0,0);
    }
  }

  function direction(vector) {
    const magnitude=Math.hypot(...vector) || 1;
    return vector.map(value=>value/magnitude);
  }

  function projected(point,camera,w,h) {
    const difference=point.map((value,i)=>value-camera.target[i]);
    const x=difference.reduce((sum,value,i)=>sum+value*camera.right[i],0);
    const y=difference.reduce((sum,value,i)=>sum+value*camera.up[i],0);
    return [(x*camera.sx+1)*(w-1)/2,(1-y*camera.sy)*(h-1)/2];
  }

  function coordinates(model,camera,w,h) {
    const { positions } = model;
    const number = positions.length/3;
    const x=new Float32Array(number),y=new Float32Array(number),z=new Float32Array(number);
    const [rx,ry,rz]=camera.right;
    const [ux,uy,uz]=camera.up;
    const [fx,fy,fz]=camera.facing;
    const [tx,ty,tz]=camera.target;
    for(let i=0,j=0;i<number;i++,j+=3) {
      const a=positions[j]/15000-tx, b=positions[j+1]/15000-ty, c=positions[j+2]/15000-tz;
      x[i]=((a*rx+b*ry+c*rz)*camera.sx+1)*(w-1)*.5;
      y[i]=(1-(a*ux+b*uy+c*uz)*camera.sy)*(h-1)*.5;
      z[i]=a*fx + b*fy + c*fz;
    }
    return {x,y,z};
  }

  return {
    render(model,camera,zoom,fast,[width,height],atlas) {
      frameMesh(model,camera,canvasContext,width,height,zoom,fast,atlas);
    },
    thumbnail(model,camera) {
      const thumb=document.createElement("canvas");
      thumb.width=224;
      thumb.height=280;
      frameMesh(model,camera,thumb.getContext("2d"),224,280,1,false);
      return thumb.toDataURL("image/png");
    },
  };
}

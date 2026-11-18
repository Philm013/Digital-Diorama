import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import * as THREE from 'three';
import { sampleHeight, sampleColor } from '../assets/infinite-terrain';
import type { Stroke, WorldParams } from '../studio';

type Props={field:WorldParams;travel:{x:number;z:number};region:{x:number;z:number;span:number}|null;strokes:Stroke[];night:boolean;onPick:(x:number,z:number)=>void;heading?:number};
const N=64;

export function WorldMap({field,travel,region,strokes,night,onPick,heading=0}:Props){
  const base=useRef<HTMLCanvasElement>(null),overlay=useRef<HTMLCanvasElement>(null),wrap=useRef<HTMLDivElement>(null);
  const [span,setSpan]=useState(2600),[drawing,setDrawing]=useState(false);
  const [dragOrigin,setDragOrigin]=useState<{x:number;z:number}|null>(null);
  const dragOriginRef=useRef<{x:number;z:number}|null>(null);
  const anchorX=Math.round(travel.x/(span*.35))*span*.35,anchorZ=Math.round(travel.z/(span*.35))*span*.35;
  const anchor=useMemo(()=>dragOrigin||{x:anchorX,z:anchorZ},[dragOrigin,anchorX,anchorZ]);
  const rx=region?.x,rz=region?.z,rs=region?.span;
  useEffect(()=>{
    const canvas=base.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    let frame=0,cancelled=false,row=0;setDrawing(true);
    const height=new Float64Array((N+2)*(N+2)),image=ctx.createImageData(N,N),step=span/N,color=new THREE.Color(),water=new THREE.Color(field.zones.water);
    const heights=()=>{
      if(cancelled)return;const start=performance.now();
      while(row<N+2){for(let i=0;i<N+2;i++)height[row*(N+2)+i]=sampleHeight(anchor.x-span/2+(i-1)*step,anchor.z-span/2+(row-1)*step,field);row++;if(performance.now()-start>5)break;}
      if(row<N+2)frame=requestAnimationFrame(heights);else{row=0;frame=requestAnimationFrame(colors);}
    };
    const colors=()=>{
      if(cancelled)return;const start=performance.now();
      while(row<N){for(let i=0;i<N;i++){
        const id=(row+1)*(N+2)+i+1,h=height[id],dx=(height[id+1]-height[id-1])/(step*2),dz=(height[id+N+2]-height[id-N-2])/(step*2);
        sampleColor(anchor.x-span/2+i*step,anchor.z-span/2+row*step,h,Math.hypot(dx,dz),field,color);
        if(field.waterSurface&&h<field.waterLevel)color.copy(water).multiplyScalar(.9-Math.min(.28,(field.waterLevel-h)*.006));
        color.multiplyScalar((.98+Math.max(-.22,Math.min(.2,(dx-dz)*.18)))*(night?.58:1)).convertLinearToSRGB();
        const index=(row*N+i)*4;image.data[index]=color.r*255;image.data[index+1]=color.g*255;image.data[index+2]=color.b*255;image.data[index+3]=255;
      }row++;if(performance.now()-start>5)break;}
      if(row<N)frame=requestAnimationFrame(colors);else{canvas.width=N;canvas.height=N;ctx.putImageData(image,0,0);setDrawing(false);}
    };
    frame=requestAnimationFrame(heights);return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[field,span,anchor,night]);

  useEffect(()=>{
    const c=overlay.current;if(!c)return;c.width=320;c.height=320;const ctx=c.getContext('2d');if(!ctx)return;
    const scale=320/span,xy=(x:number,z:number)=>[(x-anchor.x+span/2)*scale,(z-anchor.z+span/2)*scale];
    if(rx!==undefined&&rz!==undefined&&rs!==undefined){const [x,y]=xy(rx,rz);ctx.strokeStyle=night?'#d3e2c9aa':'#2e594daa';ctx.setLineDash([5,4]);ctx.lineWidth=1.5;ctx.strokeRect(x,y,rs*scale,rs*scale);ctx.setLineDash([]);}
    ctx.strokeStyle=night?'#f0d1a577':'#b4865c88';ctx.lineWidth=1.5;
    for(const s of strokes){
      let visible=false;for(let i=0;i<s.points.length;i+=2)if(Math.abs(s.points[i]-anchor.x)<span*.55&&Math.abs(s.points[i+1]-anchor.z)<span*.55){visible=true;break;}
      if(!visible)continue;ctx.beginPath();for(let i=0;i<s.points.length;i+=2){const [x,y]=xy(s.points[i],s.points[i+1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    }
    const [x,y]=xy(travel.x,travel.z);ctx.save();ctx.translate(x,y);ctx.rotate(heading*Math.PI/180);ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fillStyle=night?'#f6f2dc':'#234e3e';ctx.strokeStyle='#fffdf4';ctx.lineWidth=1.6;ctx.fill();ctx.stroke();ctx.restore();
  },[span,anchor,travel.x,travel.z,heading,night,rx,rz,rs,strokes]);

  const pick=(event:React.PointerEvent<HTMLDivElement>)=>{
    const rect=wrap.current?.getBoundingClientRect();if(!rect)return;
    const origin=dragOriginRef.current||anchor;const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
    onPick(origin.x+(x-.5)*span,origin.z+(y-.5)*span);
  };
  return <section className="world-map" aria-label="World atlas">
    <header><span className="label-mini">WORLD ATLAS</span><span className="map-span">{drawing?'Mapping...':`${(span/1000).toFixed(1)} km`}</span></header>
    <div ref={wrap} className="map-canvas-wrap" role="button" tabIndex={0} aria-label="Choose a place to travel. Arrow keys move by a quarter of the map."
      onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);dragOriginRef.current=anchor;setDragOrigin(anchor);}}
      onPointerUp={(e)=>{pick(e);dragOriginRef.current=null;setDragOrigin(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{dragOriginRef.current=null;setDragOrigin(null);}}
      onKeyDown={(e)=>{const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dz=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;if(dx||dz){e.preventDefault();e.stopPropagation();onPick(travel.x+dx*span*.25,travel.z+dz*span*.25);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(anchor.x,anchor.z);}}}>
      <canvas ref={base} className="map-canvas"/><canvas ref={overlay} className="map-overlay"/><span className="map-frame"/><span className="map-hint">Choose a point to travel</span>
    </div>
    <footer><button onClick={()=>setSpan((v)=>Math.max(600,Math.round(v*.7)))} aria-label="Zoom in on the atlas"><Plus size={12}/>Closer</button><span className="map-coords"><Crosshair size={11}/>{Math.round(travel.x)}, {Math.round(travel.z)}</span><button onClick={()=>setSpan((v)=>Math.min(20000,Math.round(v*1.4)))} aria-label="Zoom out on the atlas"><Minus size={12}/>Wider</button></footer>
  </section>;
}
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from './assets/scene';
import type { World } from './assets/scene';
import { COORDINATE_LIMIT, sampleBiomes, night as nightMetadata, params as terrainParams } from './assets/infinite-terrain';
import { DEFAULT_BRUSH, DEFAULT_VIEW, settingsOnly } from './studio';
import type { BrushSettings, CameraView, ProjectState, SceneStats, Stroke, Tool, TravelReport, ViewSettings } from './studio';

const UP = new THREE.Vector3(0, 1, 0);
const MOVEMENT = new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','shift']);
type Handlers = { onStats:(stats:SceneStats)=>void; onStroke:(stroke:Stroke)=>void; onTravel:(report:TravelReport)=>void };

export class TerrainEngine {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(49, 1, .3, 10000);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  world: World | null = null;
  private host: HTMLDivElement;
  private handlers: Handlers;
  private hemisphere = new THREE.HemisphereLight('#e4edf4', '#758567', 1.5);
  private sunlight = new THREE.DirectionalLight('#fff4df', 2.0);
  private sunTarget = new THREE.Object3D();
  private ambient = new THREE.AmbientLight('#f8fff3', .38);
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private grid = new THREE.GridHelper(128 * 14, 14, '#abbda0', '#bdccaf');
  private ring: THREE.LineLoop;
  private observer: ResizeObserver;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private view: ViewSettings = DEFAULT_VIEW;
  private brush: BrushSettings = DEFAULT_BRUSH;
  private tool: Tool = 'orbit';
  private cameraView: CameraView = 'orbit';
  private offset = new THREE.Vector2();
  private fogUniforms = { terraCenter: {value:new THREE.Vector2()}, terraRange: {value:new THREE.Vector2(150,350)} };
  private keys = new Set<string>();
  private pad = new THREE.Vector2();
  private clock = new THREE.Clock();
  private frame = 0;
  private disposed = false;
  private paused = false;
  private dragging = false;
  private pointerId = -1;
  private lastPaint = 0;
  private lastReport = 0;
  private lastStats = 0;
  private lastReportKey = '';
  private projectId = '';
  private paramsKey = '';
  private sceneKey = '';
  private appliedStrokes: Stroke[] | null = null;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private localTarget = new THREE.Vector3();

  constructor(host:HTMLDivElement,handlers:Handlers) {
    this.host=host;this.handlers=handlers;
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,host.clientWidth<700?1.5:2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.style.touchAction='none';canvas.setAttribute('aria-label','Interactive terrain. Drag to orbit, use WASD to travel, or select a sculpt brush.');host.appendChild(canvas);
    this.scene.background=new THREE.Color('#dfe8e0');this.scene.fog=new THREE.Fog('#dfe8e0',500,1800);
    this.sunlight.target=this.sunTarget;this.sunlight.castShadow=true;this.sunlight.shadow.mapSize.set(2048,2048);
    Object.assign(this.sunlight.shadow.camera,{left:-450,right:450,top:450,bottom:-450,near:1,far:2400});this.sunlight.shadow.normalBias=.25;this.sunlight.shadow.bias=-.0003;
    this.scene.add(this.hemisphere,this.sunlight,this.sunTarget,this.ambient);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(5000,24,16),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{top:{value:new THREE.Color('#9cbdd5')},horizon:{value:new THREE.Color('#dfe8e0')}},
      vertexShader:'varying vec3 vSky; void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec3 vSky; uniform vec3 top; uniform vec3 horizon; void main(){float h=smoothstep(0.0,0.8,normalize(vSky).y);gl_FragColor=vec4(mix(horizon,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    }));
    this.sky.frustumCulled=false;this.scene.add(this.sky);
    const points=new Float32Array(700*3);
    for(let i=0;i<700;i++){const a=i*2.39996,y=.12+(Math.sin(i*78.233)*.5+.5)*.85,r=Math.sqrt(1-y*y);points[i*3]=Math.cos(a)*r*4500;points[i*3+1]=y*4500;points[i*3+2]=Math.sin(a)*r*4500;}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(points,3));
    this.stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#e8f5ff',size:1.7,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false}));this.scene.add(this.stars);
    const gridMaterial=this.grid.material as THREE.Material;gridMaterial.transparent=true;gridMaterial.opacity=.16;gridMaterial.depthWrite=false;this.grid.visible=false;this.scene.add(this.grid);
    const ringGeo=new THREE.BufferGeometry();ringGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(80*3),3));
    this.ring=new THREE.LineLoop(ringGeo,new THREE.LineBasicMaterial({color:'#f5ffe4',depthTest:false,transparent:true,opacity:.95}));this.ring.visible=false;this.ring.frustumCulled=false;this.ring.renderOrder=50;this.scene.add(this.ring);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.maxPolarAngle=Math.PI*.49;this.controls.minPolarAngle=.02;this.controls.screenSpacePanning=false;this.controls.rotateSpeed=.55;this.controls.panSpeed=.85;this.controls.autoRotateSpeed=.28;
    this.controls.minDistance=12;this.controls.maxDistance=600;
    canvas.addEventListener('pointerdown',this.pointerDown,true);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointercancel',this.pointerCancel);canvas.addEventListener('pointerleave',this.pointerLeave);
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.releaseInput);document.addEventListener('visibilitychange',this.visibilityChange);
    this.observer=new ResizeObserver(this.resize);this.observer.observe(host);this.resize();this.loop();
  }

  private configureFog(material:THREE.MeshStandardMaterial) {
    material.onBeforeCompile=(shader)=>{
      Object.assign(shader.uniforms,this.fogUniforms);
      shader.vertexShader='varying vec2 vTerraXZ;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 terraPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          terraPosition=instanceMatrix*terraPosition;
        #endif
        vTerraXZ=(modelMatrix*terraPosition).xz;`);
      shader.fragmentShader='varying vec2 vTerraXZ; uniform vec2 terraCenter; uniform vec2 terraRange;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
        float terraFog=smoothstep(terraRange.x,terraRange.y,length(vTerraXZ-terraCenter));
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,terraFog);
        #endif`);
    };
    material.customProgramCacheKey=()=> 'terra-radial-fog-v3';material.needsUpdate=true;
  }

  setProject(project:ProjectState) {
    const pk=JSON.stringify(settingsOnly(project.params)),sk=JSON.stringify(project.scene);
    if(this.world && project.id===this.projectId && pk===this.paramsKey && sk===this.sceneKey && project.strokes===this.appliedStrokes)return;
    this.appliedStrokes=project.strokes;
    if(!this.world||project.id!==this.projectId){
      if(this.world){this.scene.remove(this.world.group);this.world.dispose();}
      this.world=createWorld({...settingsOnly(project.params),...project.scene,strokes:project.strokes,startX:project.travel.x,startZ:project.travel.z});
      this.scene.add(this.world.group);this.projectId=project.id;this.paramsKey=pk;this.sceneKey=sk;
      this.configureFog(this.world.landMaterial);this.configureFog(this.world.propMaterial);
      this.offset.set(Math.floor(project.travel.x/project.params.chunkSize)*project.params.chunkSize,Math.floor(project.travel.z/project.params.chunkSize)*project.params.chunkSize);
      this.world.setRenderOrigin(this.offset.x,this.offset.y);
      this.controls.target.set(project.travel.x-this.offset.x,this.world.heightAt(project.travel.x,project.travel.z)+8,project.travel.z-this.offset.y);
      this.fit();this.world.update(project.travel.x,project.travel.z,{budget:2});this.applyView();this.report(true);return;
    }
    if(pk!==this.paramsKey){
      const next=Object.fromEntries(Object.keys(terrainParams).map((key)=>[key,project.params[key]]));
      this.world.setParams(next);this.paramsKey=pk;this.configureFog(this.world.landMaterial);this.configureFog(this.world.propMaterial);
    }
    if(sk!==this.sceneKey){for(const [key,value]of Object.entries(project.scene))if(this.world.sceneOptions[key]!==value)this.world.setSceneOption(key,value);this.sceneKey=sk;}
    if(!this.world.activeStroke)this.world.setStrokes(project.strokes);
    this.applyView();this.report(true);
  }
  setView(view:ViewSettings){this.view=view;this.applyView();}
  setBrush(brush:BrushSettings){this.brush=brush;}
  setTool(tool:Tool){if(this.dragging)this.finishStroke();this.tool=tool;this.applyView();}
  setPaused(value:boolean){this.paused=value;if(value)this.releaseInput();this.controls.enabled=!value;}
  setMoveAxis(x:number,y:number){this.pad.set(x,y);}
  private applyView(){
    this.controls.enableRotate=this.tool==='orbit';this.controls.enablePan=this.tool==='orbit';this.controls.autoRotate=this.view.autoRotate&&this.tool==='orbit'&&!this.reduced;
    this.renderer.domElement.style.cursor=this.tool==='orbit'?'grab':'crosshair';if(this.tool==='orbit')this.ring.visible=false;
    this.grid.visible=this.view.grid;this.renderer.shadowMap.enabled=this.view.shadows;this.sunlight.castShadow=this.view.shadows;
    if(!this.world)return;
    const reach=this.world.sceneOptions.radius*this.world.params.chunkSize;this.controls.maxDistance=reach*1.15;
    this.fogUniforms.terraRange.value.set(reach*.43,reach*.99);
    for(const m of [this.world.landMaterial,this.world.propMaterial])m.wireframe=this.view.wireframe;
    if(this.world.water){const m=this.world.water.material;m.wireframe=this.view.wireframe;m.emissive.set(this.view.night?nightMetadata.water.color:'#000000');m.emissiveIntensity=this.view.night?nightMetadata.water.intensity:0;this.configureFog(m);}
    this.grid.scale.setScalar(this.world.params.chunkSize/128);
  }
  private worldPosition(){return {x:this.controls.target.x+this.offset.x,z:this.controls.target.z+this.offset.y};}
  private rebase(){
    if(!this.world)return;const p=this.worldPosition(),size=this.world.params.chunkSize;
    if(Math.abs(this.controls.target.x)<size*4&&Math.abs(this.controls.target.z)<size*4)return;
    const nx=Math.floor(p.x/size)*size,nz=Math.floor(p.z/size)*size,dx=nx-this.offset.x,dz=nz-this.offset.y;
    this.offset.set(nx,nz);this.controls.target.x-=dx;this.controls.target.z-=dz;this.camera.position.x-=dx;this.camera.position.z-=dz;this.world.setRenderOrigin(nx,nz);this.ring.visible=false;
  }
  travelTo(x:number,z:number){
    if(!this.world||!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>COORDINATE_LIMIT||Math.abs(z)>COORDINATE_LIMIT)return;this.finishStroke();const current=this.worldPosition();
    this.camera.position.x+=x-current.x;this.camera.position.z+=z-current.z;this.controls.target.x=x-this.offset.x;this.controls.target.z=z-this.offset.y;
    this.rebase();this.followGround(1);this.world.update(x,z,{budget:2});this.controls.update();this.report(true);
  }
  fit(){
    if(!this.world)return;const p=this.worldPosition(),height=this.world.heightAt(p.x,p.z),reach=this.world.sceneOptions.radius*this.world.params.chunkSize;
    this.cameraView='orbit';this.controls.target.y=height+5;
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3(reach*.38,reach*.38+32,reach*.48));this.controls.update();
  }
  setCameraView(view:CameraView){
    this.cameraView=view;if(!this.world)return;const p=this.worldPosition(),h=this.world.heightAt(p.x,p.z),reach=this.world.sceneOptions.radius*this.world.params.chunkSize;
    this.controls.target.y=h+3;
    if(view==='top')this.camera.position.copy(this.controls.target).add(new THREE.Vector3(.1,reach*.9,.1));
    else if(view==='ground'){this.camera.position.copy(this.controls.target).add(new THREE.Vector3(24,5,32));const ch=this.world.heightAt(this.camera.position.x+this.offset.x,this.camera.position.z+this.offset.y);this.camera.position.y=Math.max(this.camera.position.y,ch+5);}
    else this.fit();this.controls.update();
  }
  zoomBy(factor:number){const v=this.camera.position.clone().sub(this.controls.target);v.setLength(THREE.MathUtils.clamp(v.length()/factor,this.controls.minDistance,this.controls.maxDistance));this.camera.position.copy(this.controls.target).add(v);this.controls.update();}
  private followGround(ease:number){
    if(!this.world)return;const p=this.worldPosition(),floor=Math.max(this.world.heightAt(p.x,p.z),this.world.params.waterSurface?this.world.params.waterLevel:-Infinity),dy=(floor+5-this.controls.target.y)*ease;
    this.controls.target.y+=dy;this.camera.position.y+=dy;
    const floorAtCamera=this.world.heightAt(this.camera.position.x+this.offset.x,this.camera.position.z+this.offset.y)+3;
    if(this.camera.position.y<floorAtCamera)this.camera.position.y=floorAtCamera;
  }
  private keyDown=(event:KeyboardEvent)=>{
    const el=event.target as HTMLElement;
    if(event.defaultPrevented||this.paused||event.ctrlKey||event.metaKey||event.altKey||el.closest('input,select,textarea,[contenteditable="true"],[role="dialog"]'))return;
    const key=event.key.toLowerCase();if(MOVEMENT.has(key)){event.preventDefault();this.keys.add(key);}
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.key.toLowerCase());};
  private releaseInput=()=>{this.keys.clear();this.pad.set(0,0);if(this.dragging)this.finishStroke();};
  private visibilityChange=()=>{if(document.hidden)this.releaseInput();};
  private move(delta:number){
    if(!this.world||this.paused||this.dragging)return;
    let y=this.pad.y+(this.keys.has('w')||this.keys.has('arrowup')?1:0)-(this.keys.has('s')||this.keys.has('arrowdown')?1:0);
    let x=this.pad.x+(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0);
    const length=Math.hypot(x,y);if(length<.01)return;if(length>1){x/=length;y/=length;}
    const forward=this.camera.getWorldDirection(new THREE.Vector3());forward.y=0;if(forward.lengthSq()<.01)forward.set(0,0,-1);forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,UP);const velocity=this.keys.has('shift')?250:95;
    const d=forward.multiplyScalar(y).add(right.multiplyScalar(x)).multiplyScalar(velocity*delta),current=this.worldPosition();
    d.x=THREE.MathUtils.clamp(current.x+d.x,-COORDINATE_LIMIT,COORDINATE_LIMIT)-current.x;d.z=THREE.MathUtils.clamp(current.z+d.z,-COORDINATE_LIMIT,COORDINATE_LIMIT)-current.z;this.camera.position.add(d);this.controls.target.add(d);
  }
  private hit(event:PointerEvent){
    if(!this.world)return null;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.camera.updateMatrixWorld();this.world.group.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.camera);
    return this.ray.intersectObjects([...this.world.chunks.values()],true)[0]?.point || null;
  }
  private showRing(point:THREE.Vector3){
    if(!this.world)return;const a=this.ring.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<80;i++){const angle=i/80*Math.PI*2,x=point.x+Math.cos(angle)*this.brush.size,z=point.z+Math.sin(angle)*this.brush.size;a.setXYZ(i,x,this.world.surfaceAt(x+this.offset.x,z+this.offset.y)+.3,z);}
    a.needsUpdate=true;this.ring.visible=true;
  }
  private pointerDown=(event:PointerEvent)=>{
    if(this.paused||this.tool==='orbit'||event.button!==0||!event.isPrimary||!this.world)return;const point=this.hit(event);if(!point)return;
    event.preventDefault();event.stopImmediatePropagation();this.pointerId=event.pointerId;this.renderer.domElement.setPointerCapture(event.pointerId);this.dragging=true;
    this.world.beginStroke({mode:event.shiftKey&&this.tool==='raise'?'lower':this.tool,r:this.brush.size,k:this.brush.strength,y:point.y,linear:this.brush.falloff==='linear',x:point.x+this.offset.x,z:point.z+this.offset.y});
    this.showRing(point);this.lastPaint=performance.now();
  };
  private pointerMove=(event:PointerEvent)=>{
    if(this.paused||this.tool==='orbit'||!this.world)return;const point=this.hit(event);if(!point){this.ring.visible=false;return;}this.showRing(point);
    const live=this.world.activeStroke;if(!this.dragging||!live)return;
    const n=live.points.length,x=point.x+this.offset.x,z=point.z+this.offset.y;
    if(performance.now()-this.lastPaint>40&&Math.hypot(x-live.points[n-2],z-live.points[n-1])>live.r*.18){this.world.extendStroke(x,z);this.lastPaint=performance.now();}
  };
  private finishStroke(){
    if(!this.dragging)return;this.dragging=false;
    const canvas=this.renderer.domElement;if(canvas.hasPointerCapture(this.pointerId))canvas.releasePointerCapture(this.pointerId);this.pointerId=-1;
    const stroke=this.world?.endStroke();if(stroke)this.handlers.onStroke(stroke);
  }
  private pointerUp=(event:PointerEvent)=>{if(event.pointerId===this.pointerId)this.finishStroke();};
  private pointerCancel=()=>{this.finishStroke();};
  private pointerLeave=()=>{if(!this.dragging)this.ring.visible=false;};

  private report(force=false){
    if(!this.world)return;const now=performance.now();if(!force&&now-this.lastReport<240)return;this.lastReport=now;
    const pos=this.worldPosition(),info=sampleBiomes(pos.x,pos.z,this.world.params),h=this.world.heightAt(pos.x,pos.z);
    const direction=this.camera.getWorldDirection(new THREE.Vector3()),heading=Math.atan2(direction.x,-direction.z)*180/Math.PI;
    const report:TravelReport={x:pos.x,z:pos.z,height:Math.round(h),biome:info.primaryName,blend:info.blend?.name||null,transition:info.transition||0,weight:info.weight,blendWeight:info.blend?.weight||0,heading};
    const key=[Math.round(pos.x*10),Math.round(pos.z*10),report.height,report.biome,Math.round(info.weight*100),Math.round(heading)].join('|');
    if(force||key!==this.lastReportKey){this.lastReportKey=key;this.handlers.onTravel(report);}
  }
  private resize=()=>{if(this.disposed)return;const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);};
  private loop=()=>{
    if(this.disposed)return;this.frame=requestAnimationFrame(this.loop);const dt=Math.min(this.clock.getDelta(),.05);if(document.hidden)return;
    const ease=this.reduced?1:1-Math.exp(-dt*5);this.move(dt);this.controls.update();this.rebase();
    if(this.world){
      if(this.cameraView!=='top'||!this.dragging)this.followGround(ease);
      const pos=this.worldPosition();this.world.update(pos.x,pos.z);this.world.tick(performance.now()/1000);
      this.fogUniforms.terraCenter.value.set(this.controls.target.x,this.controls.target.z);
      const size=this.world.params.chunkSize;this.grid.position.set(Math.floor(pos.x/size)*size-this.offset.x,this.world.params.waterLevel+.2,Math.floor(pos.z/size)*size-this.offset.y);
      if(performance.now()-this.lastStats>550){this.lastStats=performance.now();const stats=this.world.stats(),distance=this.camera.position.distanceTo(this.controls.target);this.handlers.onStats({...stats,triangles:Math.round(stats.triangles),zoom:Math.round(320/distance*100)});}
      this.report();
    }
    const fog=this.scene.fog as THREE.Fog;fog.color.lerp(new THREE.Color(this.view.night?'#243a40':'#dfe8e0'),ease);this.scene.background=fog.color;
    (this.sky.material.uniforms.horizon.value as THREE.Color).copy(fog.color);(this.sky.material.uniforms.top.value as THREE.Color).lerp(new THREE.Color(this.view.night?'#101e35':'#9cbdd5'),ease);
    this.sky.position.copy(this.camera.position);this.stars.position.copy(this.camera.position);this.stars.material.opacity=THREE.MathUtils.lerp(this.stars.material.opacity,this.view.night?.8:0,ease);
    this.hemisphere.intensity=THREE.MathUtils.lerp(this.hemisphere.intensity,this.view.night?.7:1.5,ease);this.ambient.intensity=THREE.MathUtils.lerp(this.ambient.intensity,this.view.night?.15:.38,ease);
    this.sunlight.intensity=THREE.MathUtils.lerp(this.sunlight.intensity,this.view.night?.4:2,ease);this.sunlight.color.lerp(new THREE.Color(this.view.night?'#b4cfed':'#fff4df'),ease);
    this.localTarget.copy(this.controls.target);this.sunlight.position.copy(this.localTarget).add(new THREE.Vector3(-280,530,330));this.sunTarget.position.copy(this.localTarget);this.sunTarget.updateMatrixWorld();
    this.renderer.render(this.scene,this.camera);
  };
  screenshot(){this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');}
  regionBounds(){if(!this.world)return null;const {cx,cz}=this.world.centre,size=this.world.params.chunkSize,r=this.world.sceneOptions.radius;return {x:(cx-r)*size,z:(cz-r)*size,span:(r*2+1)*size};}
  dispose(){
    if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.releaseInput();
    const c=this.renderer.domElement;c.removeEventListener('pointerdown',this.pointerDown,true);c.removeEventListener('pointermove',this.pointerMove);c.removeEventListener('pointerup',this.pointerUp);c.removeEventListener('pointercancel',this.pointerCancel);c.removeEventListener('pointerleave',this.pointerLeave);
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.releaseInput);document.removeEventListener('visibilitychange',this.visibilityChange);
    this.controls.dispose();this.world?.dispose();this.sky.geometry.dispose();this.sky.material.dispose();this.stars.geometry.dispose();this.stars.material.dispose();this.grid.geometry.dispose();(this.grid.material as THREE.Material).dispose();this.ring.geometry.dispose();(this.ring.material as THREE.Material).dispose();this.sunlight.shadow.dispose();this.renderer.dispose();this.renderer.forceContextLoss();c.remove();
  }
}
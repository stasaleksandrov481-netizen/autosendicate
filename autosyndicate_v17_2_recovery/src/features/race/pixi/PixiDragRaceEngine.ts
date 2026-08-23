'use client';

import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import { buildPixiCar } from '@/features/car-visual/pixi-car';
import { carVisualDataUri } from '@/features/car-visual/svg';
import { defaultCarVisualConfig, normalizeCarVisualConfig } from '@/features/car-visual/catalog';
import { createPixiApplication, destroyPixiApplication } from '@/features/pixi-app';
import type { CarVisualConfig } from '@/features/car-visual/types';

export interface PixiRaceRacer { id:string; label:string; visual:CarVisualConfig|unknown; kind?:'player'|'rival'|'cop'; }
export interface PixiRaceSnapshot { playerDistance:number; speedKmh:number; racers:Array<{id:string;distance:number}>; trackLength:number; }
export interface PixiDragRaceOptions { racers:PixiRaceRacer[]; reducedMotion?:boolean; }
export interface RaceVisualEngine { update(snapshot:PixiRaceSnapshot):void; destroy():void; }

function tileTexture(kind:'sky'|'city'|'fence'|'road') {
  const canvas=document.createElement('canvas');
  canvas.width=kind==='city'?512:kind==='fence'?256:kind==='road'?320:256;
  canvas.height=kind==='sky'?220:kind==='city'?180:kind==='fence'?92:150;
  const ctx=canvas.getContext('2d')!;
  if(kind==='sky') {
    const g=ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'#07101f');g.addColorStop(.62,'#10192a');g.addColorStop(1,'#2c2431');ctx.fillStyle=g;ctx.fillRect(0,0,256,220);
    ctx.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<26;i++)ctx.fillRect((i*47)%256,(i*73)%110,1+(i%2),1+(i%2));
  } else if(kind==='city') {
    ctx.clearRect(0,0,512,180);ctx.fillStyle='#0b1020';for(let i=0;i<18;i++){const x=i*31,h=45+(i*37)%105,w=24+(i*13)%28;ctx.fillRect(x,180-h,w,h);ctx.fillStyle='rgba(250,204,21,.22)';for(let wy=180-h+12;wy<165;wy+=18)for(let wx=x+7;wx<x+w-5;wx+=12)if((wx+wy+i)%3)ctx.fillRect(wx,wy,3,5);ctx.fillStyle='#0b1020';}
  } else if(kind==='fence') {
    ctx.clearRect(0,0,256,92);ctx.strokeStyle='rgba(226,232,240,.34)';ctx.lineWidth=2;for(let x=-50;x<310;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+62,92);ctx.stroke();ctx.beginPath();ctx.moveTo(x+62,0);ctx.lineTo(x,92);ctx.stroke();}ctx.fillStyle='#7f1d1d';ctx.fillRect(0,76,256,16);for(let x=0;x<256;x+=48){ctx.fillStyle=(x/48)%2?'#f8fafc':'#dc2626';ctx.fillRect(x,76,48,16);}
  } else {
    ctx.fillStyle='#25272b';ctx.fillRect(0,0,320,150);ctx.fillStyle='#1f2125';for(let y=0;y<150;y+=18)ctx.fillRect(0,y,320,1);ctx.fillStyle='#f8fafc';for(let x=0;x<320;x+=74)ctx.fillRect(x,72,35,4);ctx.fillStyle='#111827';ctx.fillRect(0,0,320,7);ctx.fillRect(0,143,320,7);
  }
  return Texture.from(canvas);
}

function lanePositions(count:number,height:number) {
  if(count<=2) return [height*.49,height*.73]; // opponent top, player bottom when caller orders accordingly
  if(count===3) return [height*.44,height*.62,height*.80];
  return Array.from({length:count},(_,i)=>height*(.40+i*(.45/Math.max(1,count-1))));
}

export class PixiDragRaceEngine implements RaceVisualEngine {
  private app:Application|null=null;
  private host:HTMLElement;
  private options:PixiDragRaceOptions;
  private sky?:TilingSprite; private city?:TilingSprite; private fence?:TilingSprite; private road?:TilingSprite;
  private racers=new Map<string,{sprite:Sprite;kind:string}>();
  private destroyed=false; private resizeObserver?:ResizeObserver;
  private lastSnapshot:PixiRaceSnapshot={playerDistance:0,speedKmh:0,racers:[],trackLength:402};
  private textures:Texture[]=[];
  constructor(host:HTMLElement,options:PixiDragRaceOptions){this.host=host;this.options=options;}

  async init() {
    const app=await createPixiApplication(this.host,{transparent:true,antialias:true});
    if(this.destroyed){destroyPixiApplication(app,this.host);return this;}
    this.app=app;app.canvas.classList.add('pixi-race-canvas-v172');
    const skyTex=tileTexture('sky'),cityTex=tileTexture('city'),fenceTex=tileTexture('fence'),roadTex=tileTexture('road');
    this.textures.push(skyTex,cityTex,fenceTex,roadTex);
    this.sky=new TilingSprite({texture:skyTex,width:app.screen.width,height:app.screen.height});
    this.city=new TilingSprite({texture:cityTex,width:app.screen.width,height:app.screen.height*.52});this.city.y=app.screen.height*.11;
    this.fence=new TilingSprite({texture:fenceTex,width:app.screen.width,height:app.screen.height*.25});this.fence.y=app.screen.height*.34;
    this.road=new TilingSprite({texture:roadTex,width:app.screen.width,height:app.screen.height*.48});this.road.y=app.screen.height*.48;
    app.stage.addChild(this.sky,this.city,this.fence,this.road);

    // Sort visual order so rival/cops use upper lanes and player is always lower lane.
    const ordered=[...this.options.racers].sort((a,b)=>(a.kind==='player'?1:0)-(b.kind==='player'?1:0));
    for(const racer of ordered) {
      const normalized=normalizeCarVisualConfig(racer.visual,Number((racer.visual as any)?.carId)||1);
      const build=buildPixiCar(normalized);
      build.root.scale.set(.72);build.root.position.set(-6,-70);
      if(racer.kind==='cop') {
        const red=new Graphics().roundRect(102,30,18,5,2).fill('#ef4444');
        const blue=new Graphics().roundRect(121,30,18,5,2).fill('#3b82f6');
        build.root.addChild(red,blue);
      }
      const texture=app.renderer.generateTexture({target:build.root,resolution:Math.min(2,globalThis.devicePixelRatio||1),antialias:true});
      this.textures.push(texture);
      const sprite=new Sprite(texture);sprite.anchor.set(.5,.78);sprite.label=racer.id;
      app.stage.addChild(sprite);this.racers.set(racer.id,{sprite,kind:racer.kind||'rival'});
      build.root.destroy({children:true});
    }
    this.layout();
    if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>this.layout());this.resizeObserver.observe(this.host);}
    app.ticker.add((ticker)=>{
      if(this.options.reducedMotion||!this.city||!this.fence||!this.road)return;
      const speed=this.lastSnapshot.speedKmh,dt=ticker.deltaMS/16.6667;
      this.city.tilePosition.x-=speed*.020*dt;
      this.fence.tilePosition.x-=speed*.075*dt;
      this.road.tilePosition.x-=speed*.135*dt;
    });
    app.render();
    return this;
  }

  private layout(){
    const app=this.app;if(!app)return;const w=app.screen.width,h=app.screen.height;if(!w||!h)return;
    if(this.sky){this.sky.width=w;this.sky.height=h;}
    if(this.city){this.city.width=w;this.city.height=h*.52;this.city.y=h*.11;}
    if(this.fence){this.fence.width=w;this.fence.height=h*.25;this.fence.y=h*.34;}
    if(this.road){this.road.width=w;this.road.height=h*.48;this.road.y=h*.48;}
    const entries=[...this.racers.entries()].sort(([,a],[,b])=>(a.kind==='player'?1:0)-(b.kind==='player'?1:0));
    const lanes=lanePositions(entries.length,h);
    entries.forEach(([,entry],i)=>{entry.sprite.y=lanes[i]||h*.72;entry.sprite.scale.set(Math.max(.54,Math.min(.82,w/650)));});
    this.update(this.lastSnapshot);
  }

  update(snapshot:PixiRaceSnapshot){
    this.lastSnapshot=snapshot;const app=this.app;if(!app)return;const w=app.screen.width;if(!w)return;
    const playerX=w*.29;const pxPerMeter=Math.max(.55,Math.min(2.15,w/275));
    const distanceById=new Map(snapshot.racers.map((r)=>[r.id,Number(r.distance)||0]));
    for(const [id,entry] of this.racers){
      const dist=distanceById.get(id)??0;const relative=dist-snapshot.playerDistance;
      const target=entry.kind==='player'?playerX:playerX+relative*pxPerMeter;
      entry.sprite.x=Math.max(w*.08,Math.min(w*.92,target));
    }
    if(this.sky)this.sky.tilePosition.x=-Math.max(0,snapshot.playerDistance)*.008;
  }

  destroy(){
    this.destroyed=true;this.resizeObserver?.disconnect();this.racers.clear();
    for(const t of this.textures)try{t.destroy(true);}catch{}this.textures=[];
    const app=this.app;this.app=null;destroyPixiApplication(app,this.host);
  }
}

class NativeCanvasDragRaceEngine implements RaceVisualEngine {
  private canvas=document.createElement('canvas');private ctx=this.canvas.getContext('2d')!;private host:HTMLElement;private options:PixiDragRaceOptions;
  private snapshot:PixiRaceSnapshot={playerDistance:0,speedKmh:0,racers:[],trackLength:402};private images=new Map<string,HTMLImageElement>();private raf=0;private last=performance.now();private roadOffset=0;private resizeObserver?:ResizeObserver;
  constructor(host:HTMLElement,options:PixiDragRaceOptions){this.host=host;this.options=options;this.canvas.className='pixi-race-canvas-v172 native-canvas-race-v172';host.replaceChildren(this.canvas);this.loadCars();this.resize();if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);}this.raf=requestAnimationFrame(this.frame);}
  private loadCars(){for(const r of this.options.racers){const img=new Image();img.decoding='async';img.src=carVisualDataUri(r.visual);this.images.set(r.id,img);}}
  private resize(){const rect=this.host.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.canvas.style.width=rect.width+'px';this.canvas.style.height=rect.height+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  private frame=(now:number)=>{const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.roadOffset=(this.roadOffset+this.snapshot.speedKmh*dt*.45)%80;this.draw();this.raf=requestAnimationFrame(this.frame);};
  private draw(){const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height,c=this.ctx;c.clearRect(0,0,w,h);const sky=c.createLinearGradient(0,0,0,h*.55);sky.addColorStop(0,'#07101f');sky.addColorStop(1,'#252238');c.fillStyle=sky;c.fillRect(0,0,w,h*.56);c.fillStyle='#0b1020';for(let x=-((this.roadOffset*.12)%55)-20;x<w+60;x+=55){const bh=40+(Math.abs(Math.floor(x/55))*23)%80;c.fillRect(x,h*.50-bh,42,bh);}c.strokeStyle='rgba(225,232,240,.25)';c.lineWidth=1.5;for(let x=-((this.roadOffset*.55)%30)-50;x<w+80;x+=30){c.beginPath();c.moveTo(x,h*.34);c.lineTo(x+70,h*.58);c.stroke();}c.fillStyle='#27292d';c.fillRect(0,h*.48,w,h*.52);c.fillStyle='rgba(255,255,255,.08)';c.fillRect(0,h*.615,w,2);c.fillRect(0,h*.805,w,2);c.fillStyle='#fff';for(let x=-(this.roadOffset%80);x<w+80;x+=80){c.fillRect(x,h*.612,38,3);c.fillRect(x,h*.802,38,3);}const ordered=[...this.options.racers].sort((a,b)=>(a.kind==='player'?1:0)-(b.kind==='player'?1:0));const lanes=lanePositions(ordered.length,h),dist=new Map(this.snapshot.racers.map(r=>[r.id,r.distance]));const playerX=w*.29,ppm=Math.max(.55,Math.min(2.15,w/275));for(let i=0;i<ordered.length;i++){const r=ordered[i],img=this.images.get(r.id),d=dist.get(r.id)||0,rel=d-this.snapshot.playerDistance,x=Math.max(w*.08,Math.min(w*.92,r.kind==='player'?playerX:playerX+rel*ppm)),y=lanes[i]||h*.72;if(img?.complete&&img.naturalWidth){const cw=Math.min(190,w*.34),ch=cw*.553;c.drawImage(img,x-cw*.5,y-ch*.78,cw,ch);if(r.kind==='cop'){c.fillStyle='#ef4444';c.fillRect(x-10,y-ch*.73,10,4);c.fillStyle='#3b82f6';c.fillRect(x,y-ch*.73,10,4);}}}}
  update(snapshot:PixiRaceSnapshot){this.snapshot=snapshot;}
  destroy(){cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();try{this.canvas.remove();}catch{}}
}

export async function mountPixiDragRace(host:HTMLElement,options:PixiDragRaceOptions):Promise<RaceVisualEngine>{
  try { const engine=new PixiDragRaceEngine(host,options);await engine.init();return engine; }
  catch(error){console.error('[Race] Pixi WebGL/Canvas renderer failed; activating graphical native Canvas2D renderer',error);return new NativeCanvasDragRaceEngine(host,options);}
}
export function defaultRaceVisual(carId:number){return defaultCarVisualConfig(carId);}

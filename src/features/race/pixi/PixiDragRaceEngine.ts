'use client';

import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { buildPixiCar } from '@/features/car-visual/pixi-car';
import { defaultCarVisualConfig, normalizeCarVisualConfig } from '@/features/car-visual/catalog';
import type { CarVisualConfig } from '@/features/car-visual/types';

export interface PixiRaceRacer {
  id:string;
  label:string;
  visual:CarVisualConfig|unknown;
  kind?:'player'|'rival'|'cop';
}
export interface PixiRaceSnapshot { playerDistance:number; speedKmh:number; racers:Array<{id:string;distance:number}>; trackLength:number; }
export interface PixiDragRaceOptions { racers:PixiRaceRacer[]; reducedMotion?:boolean; }

function tileTexture(kind:'sky'|'city'|'fence'|'road'){
  const canvas=document.createElement('canvas');
  canvas.width=kind==='city'?512:kind==='fence'?256:kind==='road'?320:256;canvas.height=kind==='sky'?220:kind==='city'?180:kind==='fence'?92:150;
  const ctx=canvas.getContext('2d')!;
  if(kind==='sky'){
    const g=ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'#07101f');g.addColorStop(.62,'#10192a');g.addColorStop(1,'#2c2431');ctx.fillStyle=g;ctx.fillRect(0,0,256,220);
    ctx.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<26;i++)ctx.fillRect((i*47)%256,(i*73)%110,1+(i%2),1+(i%2));
  } else if(kind==='city'){
    ctx.clearRect(0,0,512,180);ctx.fillStyle='#0b1020';for(let i=0;i<18;i++){const x=i*31,h=45+(i*37)%105,w=24+(i*13)%28;ctx.fillRect(x,180-h,w,h);ctx.fillStyle='rgba(250,204,21,.22)';for(let wy=180-h+12;wy<165;wy+=18)for(let wx=x+7;wx<x+w-5;wx+=12)if((wx+wy+i)%3)ctx.fillRect(wx,wy,3,5);ctx.fillStyle='#0b1020';}
  } else if(kind==='fence'){
    ctx.clearRect(0,0,256,92);ctx.strokeStyle='rgba(226,232,240,.34)';ctx.lineWidth=2;for(let x=-50;x<310;x+=18){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+62,92);ctx.stroke();ctx.beginPath();ctx.moveTo(x+62,0);ctx.lineTo(x,92);ctx.stroke();}ctx.fillStyle='#7f1d1d';ctx.fillRect(0,76,256,16);for(let x=0;x<256;x+=48){ctx.fillStyle=(x/48)%2?'#f8fafc':'#dc2626';ctx.fillRect(x,76,48,16);}
  } else {
    ctx.fillStyle='#25272b';ctx.fillRect(0,0,320,150);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,72,320,2);ctx.fillStyle='#f8fafc';for(let x=0;x<320;x+=72)ctx.fillRect(x,70,34,4);ctx.fillStyle='#111827';ctx.fillRect(0,0,320,7);ctx.fillRect(0,143,320,7);
  }
  return Texture.from(canvas);
}

function lanePositions(count:number,height:number){
  if(count<=2)return [height*.54,height*.73];
  if(count===3)return [height*.48,height*.64,height*.80];
  return Array.from({length:count},(_,i)=>height*(.42+i*(.45/Math.max(1,count-1))));
}

export class PixiDragRaceEngine {
  private app=new Application();private host:HTMLElement;private options:PixiDragRaceOptions;
  private sky!:TilingSprite;private city!:TilingSprite;private fence!:TilingSprite;private road!:TilingSprite;
  private racers=new Map<string,{sprite:Sprite;kind:string}>();private destroyed=false;private resizeObserver?:ResizeObserver;
  private lastSnapshot:PixiRaceSnapshot={playerDistance:0,speedKmh:0,racers:[],trackLength:402};
  private textures:Texture[]=[];
  constructor(host:HTMLElement,options:PixiDragRaceOptions){this.host=host;this.options=options;}
  async init(){
    await this.app.init({resizeTo:this.host,backgroundAlpha:0,antialias:true,preference:'webgl',powerPreference:'high-performance'});
    if(this.destroyed){this.app.destroy(true);return this;}
    this.app.canvas.classList.add('pixi-race-canvas-v17');this.host.replaceChildren(this.app.canvas);
    const skyTex=tileTexture('sky'),cityTex=tileTexture('city'),fenceTex=tileTexture('fence'),roadTex=tileTexture('road');this.textures.push(skyTex,cityTex,fenceTex,roadTex);
    this.sky=new TilingSprite({texture:skyTex,width:this.app.screen.width,height:this.app.screen.height});
    this.city=new TilingSprite({texture:cityTex,width:this.app.screen.width,height:this.app.screen.height*.52});this.city.y=this.app.screen.height*.13;
    this.road=new TilingSprite({texture:roadTex,width:this.app.screen.width,height:this.app.screen.height*.46});this.road.y=this.app.screen.height*.48;
    this.fence=new TilingSprite({texture:fenceTex,width:this.app.screen.width,height:this.app.screen.height*.24});this.fence.y=this.app.screen.height*.35;
    this.app.stage.addChild(this.sky,this.city,this.fence,this.road);
    const laneGuide=new Graphics();laneGuide.label='lane-guides';this.app.stage.addChild(laneGuide);
    for(const racer of this.options.racers){
      const normalized=normalizeCarVisualConfig(racer.visual,Number((racer.visual as any)?.carId)||1);
      const build=buildPixiCar(normalized);build.root.scale.set(.66);build.root.position.set(-10,-70);
      if(racer.kind==='cop'){
        const light=new Graphics().roundRect(103,31,17,5,2).fill('#ef4444');const blue=new Graphics().roundRect(121,31,17,5,2).fill('#3b82f6');build.root.addChild(light,blue);
      }
      const texture=this.app.renderer.generateTexture({target:build.root,resolution:2,antialias:true});this.textures.push(texture);
      const sprite=new Sprite(texture);sprite.anchor.set(.5,.78);sprite.label=racer.id;this.app.stage.addChild(sprite);this.racers.set(racer.id,{sprite,kind:racer.kind||'rival'});
      build.root.destroy({children:true});
    }
    this.layout();
    this.resizeObserver=new ResizeObserver(()=>this.layout());this.resizeObserver.observe(this.host);
    this.app.ticker.add((ticker)=>{if(this.options.reducedMotion)return;const speed=this.lastSnapshot.speedKmh;const dt=ticker.deltaMS/16.6667;this.city.tilePosition.x-=speed*.028*dt;this.fence.tilePosition.x-=speed*.095*dt;this.road.tilePosition.x-=speed*.145*dt;});
    return this;
  }
  private layout(){
    const w=this.app.screen.width,h=this.app.screen.height;if(!w||!h)return;
    for(const layer of [this.sky,this.city,this.fence,this.road])if(layer)layer.width=w;
    if(this.sky)this.sky.height=h;if(this.city){this.city.height=h*.52;this.city.y=h*.13;}if(this.fence){this.fence.height=h*.24;this.fence.y=h*.35;}if(this.road){this.road.height=h*.46;this.road.y=h*.48;}
    const lanes=lanePositions(this.racers.size,h);[...this.racers.values()].forEach((entry,i)=>{entry.sprite.y=lanes[i]||h*.65;entry.sprite.scale.set(Math.max(.58,Math.min(.88,w/640)));});
    this.update(this.lastSnapshot);
  }
  update(snapshot:PixiRaceSnapshot){
    this.lastSnapshot=snapshot;const w=this.app.screen.width,h=this.app.screen.height;if(!w||!h)return;
    const playerX=w*.34;const pxPerMeter=Math.max(.65,Math.min(2.4,w/260));
    const distanceById=new Map(snapshot.racers.map((r)=>[r.id,Number(r.distance)||0]));
    for(const [id,entry] of this.racers){
      const dist=distanceById.get(id)??0;const isPlayer=entry.kind==='player';const relative=dist-snapshot.playerDistance;
      const target=isPlayer?playerX:playerX+relative*pxPerMeter;entry.sprite.x=Math.max(-w*.08,Math.min(w*1.08,target));
    }
    const progress=Math.max(0,Math.min(1,snapshot.playerDistance/Math.max(1,snapshot.trackLength)));
    this.sky.tilePosition.x=-progress*12; // sky is practically static; only a tiny camera drift
    this.road.tilePosition.y=0;void h;
  }
  destroy(){
    this.destroyed=true;this.resizeObserver?.disconnect();this.racers.clear();for(const t of this.textures)try{t.destroy(true);}catch{}this.textures=[];try{this.app.destroy(true,{children:true});}catch{}if(this.host)this.host.replaceChildren();
  }
}

export async function mountPixiDragRace(host:HTMLElement,options:PixiDragRaceOptions){const engine=new PixiDragRaceEngine(host,options);await engine.init();return engine;}
export function defaultRaceVisual(carId:number){return defaultCarVisualConfig(carId);}

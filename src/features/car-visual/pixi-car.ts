'use client';

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CAR_GEOMETRY, DECAL_CATALOG, WHEEL_CATALOG, normalizeCarVisualConfig } from './catalog';
import type { CarVisualConfig, DecalConfig } from './types';

export interface PixiCarBuild {
  root: Container;
  bodyLayer: Container;
  finishLayer: Container;
  tintLayer: Container;
  wheelsLayer: Container;
  aeroLayer: Container;
  decalsLayer: Container;
  decalSprites: Map<string, Sprite>;
  config: CarVisualConfig;
}

function toHexNumber(value:string){return Number.parseInt(value.replace('#',''),16) || 0xffffff;}

function polygon(points:number[], color:string, alpha=1){
  const g=new Graphics();
  g.poly(points).fill({color,alpha});
  return g;
}

function wheel(cx:number,cy:number,r:number,id:string){
  const holder=new Container();
  const meta=WHEEL_CATALOG.find((x)=>x.id===id)||WHEEL_CATALOG[0];
  const tire=new Graphics().circle(0,0,r).fill('#050607');
  const rim=new Graphics().circle(0,0,r*.72).fill('#252b34').stroke({color:'#6b7280',width:1.5});
  holder.addChild(tire,rim);
  for(let i=0;i<meta.spokes;i++){
    const a=(Math.PI*2*i/meta.spokes)-Math.PI/2;
    const spoke=new Graphics().moveTo(Math.cos(a)*r*.22,Math.sin(a)*r*.22).lineTo(Math.cos(a)*r*.70,Math.sin(a)*r*.70).stroke({color:meta.accent,width:2.2});
    holder.addChild(spoke);
  }
  holder.addChild(new Graphics().circle(0,0,r*.17).fill('#111827').stroke({color:'#d1d5db',width:1}));
  holder.position.set(cx,cy);
  return holder;
}

function decalCanvas(assetId:string){
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=80;
  const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,160,80);ctx.fillStyle='#ffffff';ctx.strokeStyle='#ffffff';ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';
  const shape=DECAL_CATALOG.find((x)=>x.id===assetId)?.shape||'stripe';
  if(shape==='stripe'){ctx.fillRect(18,29,124,7);ctx.fillRect(18,44,124,7);}
  else if(shape==='bolt'){ctx.beginPath();ctx.moveTo(12,40);ctx.lineTo(62,18);ctx.lineTo(53,34);ctx.lineTo(103,23);ctx.lineTo(84,45);ctx.lineTo(145,34);ctx.lineTo(92,62);ctx.lineTo(101,47);ctx.lineTo(43,57);ctx.lineTo(64,39);ctx.closePath();ctx.fill();}
  else if(shape==='number'){ctx.font='900 54px Arial Black,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('77',80,41);}
  else if(shape==='checker'){for(let x=0;x<8;x++)for(let y=0;y<3;y++)if((x+y)%2===0)ctx.fillRect(22+x*14,19+y*14,14,14);}
  else if(shape==='flame'){ctx.beginPath();ctx.moveTo(15,52);ctx.bezierCurveTo(50,50,57,18,76,8);ctx.bezierCurveTo(73,28,88,28,100,14);ctx.bezierCurveTo(109,35,133,39,146,48);ctx.bezierCurveTo(116,46,109,68,77,69);ctx.bezierCurveTo(51,70,31,64,15,52);ctx.fill();}
  else {ctx.font='900 22px Arial Black,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('SYNDICATE',80,41);}
  return canvas;
}

const decalTextureCache=new Map<string,Texture>();
function decalTexture(assetId:string){
  let texture=decalTextureCache.get(assetId);if(texture)return texture;
  texture=Texture.from(decalCanvas(assetId));decalTextureCache.set(assetId,texture);return texture;
}

function createDecalSprite(decal:DecalConfig){
  const sprite=new Sprite(decalTexture(decal.assetId));
  sprite.anchor.set(.5);sprite.position.set(decal.x,decal.y);sprite.scale.set(decal.scale*.48);
  sprite.rotation=decal.rotation;sprite.zIndex=decal.zIndex;sprite.tint=toHexNumber(decal.tint);sprite.alpha=decal.opacity;
  sprite.label=`decal:${decal.id}`;
  return sprite;
}

export function buildPixiCar(raw:unknown):PixiCarBuild {
  const id=Number((raw as any)?.carId)||1,config=normalizeCarVisualConfig(raw,id),geo=CAR_GEOMETRY[config.carId]||CAR_GEOMETRY[1];
  const root=new Container({sortableChildren:true});root.label=`car:${config.carId}`;
  const bodyLayer=new Container({sortableChildren:true});bodyLayer.label='base-body';bodyLayer.zIndex=10;
  const finishLayer=new Container({sortableChildren:true});finishLayer.label='color-finish';finishLayer.zIndex=12;
  const tintLayer=new Container({sortableChildren:true});tintLayer.label='window-tint';tintLayer.zIndex=18;
  const wheelsLayer=new Container({sortableChildren:true});wheelsLayer.label='wheels-rims';wheelsLayer.zIndex=24;
  const aeroLayer=new Container({sortableChildren:true});aeroLayer.label='body-kits-spoilers';aeroLayer.zIndex=28;
  const decalsLayer=new Container({sortableChildren:true});decalsLayer.label='decals-vinyls';decalsLayer.zIndex=16;
  root.addChild(bodyLayer,finishLayer,tintLayer,wheelsLayer,aeroLayer,decalsLayer);

  // Positive rideHeight means lowering: move the body down while wheel hubs stay fixed.
  const yOffset=config.rideHeight*.45;
  decalsLayer.y=yOffset;
  // Vinyls are body paint layers: clip them to the model silhouette so dragged decals never float outside the sheet metal.
  const decalMask=polygon(geo.bodyPoints,'#ffffff');decalMask.y=yOffset;decalMask.zIndex=15;decalMask.label='decals-body-mask';root.addChild(decalMask);decalsLayer.mask=decalMask;
  const shadow=new Graphics().ellipse(123,128,108,5).fill({color:'#000000',alpha:.28});shadow.zIndex=0;root.addChildAt(shadow,0);
  const body=polygon(geo.bodyPoints,config.paint.hex);body.y=yOffset;bodyLayer.addChild(body);
  const finish=new Graphics();
  finish.poly(geo.bodyPoints).fill({color:config.paint.type==='chameleon'?'#7c3aed':'#ffffff',alpha:config.paint.type==='matte'?.035:config.paint.type==='gloss'?.10:.15});finish.y=yOffset;finishLayer.addChild(finish);
  const highlight=new Graphics().moveTo(18,84).bezierCurveTo(57,79,178,75,226,89).stroke({color:'#ffffff',alpha:config.paint.type==='matte'?.08:.24,width:2});highlight.y=yOffset;finishLayer.addChild(highlight);

  const windows=polygon(geo.windowPoints,config.tint.color,config.tint.opacity);windows.y=yOffset;tintLayer.addChild(windows);
  const r=geo.wheelRadius*(1+(config.wheels.diameter-15)*.035),wheelY=geo.wheelY;
  wheelsLayer.addChild(wheel(geo.wheelFrontX,wheelY,r,config.wheels.frontId),wheel(geo.wheelRearX,wheelY,r,config.wheels.rearId));

  if(config.bodyKitId!=='stock'){
    const kit=new Graphics().poly([13,geo.kitBaseline-2+yOffset,229,geo.kitBaseline-2+yOffset,225,geo.kitBaseline+4+yOffset,18,geo.kitBaseline+4+yOffset]).fill('#0b0f16');
    aeroLayer.addChild(kit);
  }
  if(config.spoilerId!=='none'){
    const [sx,sy]=geo.spoilerAnchor;
    if(config.spoilerId==='ducktail_v1')aeroLayer.addChild(new Graphics().poly([sx-18,sy+yOffset,sx+13,sy-5+yOffset,sx+11,sy+2+yOffset,sx-18,sy+5+yOffset]).fill(config.paint.hex));
    else {
      const wing=new Container();wing.addChild(new Graphics().roundRect(sx-12,sy-15+yOffset,36,4,2).fill(config.paint.hex));wing.addChild(new Graphics().rect(sx-7,sy-11+yOffset,3,13).fill(config.paint.hex));wing.addChild(new Graphics().rect(sx+16,sy-11+yOffset,3,13).fill(config.paint.hex));aeroLayer.addChild(wing);
    }
  }
  const decalSprites=new Map<string,Sprite>();
  [...config.decals].sort((a,b)=>a.zIndex-b.zIndex).forEach((d)=>{const sprite=createDecalSprite(d);decalsLayer.addChild(sprite);decalSprites.set(d.id,sprite);});
  root.sortChildren();decalsLayer.sortChildren();
  return {root,bodyLayer,finishLayer,tintLayer,wheelsLayer,aeroLayer,decalsLayer,decalSprites,config};
}

export function setPixiCarInteractive(build:PixiCarBuild,onMove:(id:string,x:number,y:number)=>void,onCommit?:(id:string,x:number,y:number)=>void){
  for(const [id,sprite] of build.decalSprites){
    sprite.eventMode='static';sprite.cursor='grab';
    let dragging=false;let offsetX=0,offsetY=0;
    sprite.on('pointerdown',(event:any)=>{dragging=true;sprite.cursor='grabbing';const p=event.getLocalPosition(build.decalsLayer);offsetX=p.x-sprite.x;offsetY=p.y-sprite.y;});
    sprite.on('globalpointermove',(event:any)=>{if(!dragging)return;const p=event.getLocalPosition(build.decalsLayer);sprite.position.set(Math.max(0,Math.min(240,p.x-offsetX)),Math.max(25,Math.min(120,p.y-offsetY)));onMove(id,sprite.x,sprite.y);});
    const stop=()=>{if(dragging)onCommit?.(id,sprite.x,sprite.y);dragging=false;sprite.cursor='grab';};sprite.on('pointerup',stop);sprite.on('pointerupoutside',stop);
  }
}

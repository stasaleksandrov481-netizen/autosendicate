'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { buildPixiCar, setPixiCarInteractive } from '@/features/car-visual/pixi-car';
import type { CarVisualConfig } from '@/features/car-visual/types';

export function PixiCarEditor({config,onDecalCommit}:{config:CarVisualConfig;onDecalCommit:(id:string,x:number,y:number)=>void}){
  const hostRef=useRef<HTMLDivElement>(null);
  const appRef=useRef<Application|null>(null);
  const carRootRef=useRef<Container|null>(null);
  const commitRef=useRef(onDecalCommit);
  const [ready,setReady]=useState(0);
  useEffect(()=>{commitRef.current=onDecalCommit;},[onDecalCommit]);

  const positionCar=useCallback((app:Application,root:Container)=>{
    const scale=Math.max(.82,Math.min(1.65,app.screen.width/330));
    root.scale.set(scale);
    root.position.set((app.screen.width-246*scale)/2,(app.screen.height-136*scale)/2);
  },[]);

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    let disposed=false;let resizeObserver:ResizeObserver|undefined;
    void (async()=>{
      const app=new Application();
      await app.init({resizeTo:host,backgroundAlpha:0,antialias:true,preference:'webgl',powerPreference:'high-performance'});
      if(disposed){app.destroy(true);return;}
      appRef.current=app;app.canvas.classList.add('atelier-pixi-canvas');host.replaceChildren(app.canvas);
      const bg=new Graphics();bg.label='atelier-background';const grid=new Graphics();grid.label='atelier-grid';app.stage.addChild(bg,grid);
      const redraw=()=>{
        bg.clear().roundRect(0,0,app.screen.width,app.screen.height,24).fill({color:'#0b0f16',alpha:1});
        grid.clear();for(let x=0;x<app.screen.width;x+=32)grid.moveTo(x,0).lineTo(x,app.screen.height);for(let y=0;y<app.screen.height;y+=32)grid.moveTo(0,y).lineTo(app.screen.width,y);grid.stroke({color:'#ffffff',alpha:.035,width:1});
        if(carRootRef.current)positionCar(app,carRootRef.current);
      };
      redraw();resizeObserver=new ResizeObserver(redraw);resizeObserver.observe(host);setReady((v)=>v+1);
    })();
    return()=>{
      disposed=true;resizeObserver?.disconnect();carRootRef.current=null;
      const app=appRef.current;appRef.current=null;try{app?.destroy(true,{children:true});}catch{}host.replaceChildren();
    };
  },[positionCar]);

  useEffect(()=>{
    const app=appRef.current;if(!app||!ready)return;
    if(carRootRef.current){try{app.stage.removeChild(carRootRef.current);carRootRef.current.destroy({children:true});}catch{}carRootRef.current=null;}
    const build=buildPixiCar(config);positionCar(app,build.root);app.stage.addChild(build.root);carRootRef.current=build.root;
    setPixiCarInteractive(build,()=>{},(id,x,y)=>commitRef.current(id,x,y));
    return()=>{
      if(carRootRef.current===build.root){try{app.stage.removeChild(build.root);build.root.destroy({children:true});}catch{}carRootRef.current=null;}
    };
  },[config,positionCar,ready]);

  return <div className="atelier-pixi-host" ref={hostRef}/>;
}

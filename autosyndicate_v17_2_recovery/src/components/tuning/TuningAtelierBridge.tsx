'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { BODY_KIT_CATALOG, DECAL_CATALOG, SPOILER_CATALOG, WHEEL_CATALOG, normalizeCarVisualConfig } from '@/features/car-visual/catalog';
import type { CarVisualConfig, DecalConfig, PaintFinish } from '@/features/car-visual/types';

interface AtelierOpenDetail { carId:number; carName?:string; config?:unknown; }
type AtelierTab='paint'|'wheels'|'tint'|'aero'|'vinyl';

const PALETTE=['#f8fafc','#d6d3d1','#111827','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#2563eb','#7c3aed','#ec4899','#78350f'];
const FINISHES:{id:PaintFinish;name:string}[]=[{id:'gloss',name:'Глянец'},{id:'matte',name:'Мат'},{id:'pearl',name:'Перламутр'},{id:'chameleon',name:'Хамелеон'}];

const PixiCarEditor = dynamic(()=>import('./PixiCarEditor').then((m)=>m.PixiCarEditor),{ssr:false,loading:()=> <div className="atelier-editor-loading">Загрузка редактора…</div>});

export function TuningAtelierBridge(){
  const [open,setOpen]=useState(false);const [name,setName]=useState('Автомобиль');const [config,setConfig]=useState<CarVisualConfig|null>(null);const [tab,setTab]=useState<AtelierTab>('paint');const [selectedDecal,setSelectedDecal]=useState<string|null>(null);
  useEffect(()=>{
    const handler=(event:Event)=>{const detail=(event as CustomEvent<AtelierOpenDetail>).detail;if(!detail?.carId)return;setName(detail.carName||`CAR #${detail.carId}`);setConfig(normalizeCarVisualConfig(detail.config,detail.carId));setSelectedDecal(null);setTab('paint');setOpen(true);};
    window.addEventListener('autosyndicate:open-atelier',handler as EventListener);return()=>window.removeEventListener('autosyndicate:open-atelier',handler as EventListener);
  },[]);
  const patch=useCallback((fn:(draft:CarVisualConfig)=>CarVisualConfig)=>setConfig((current)=>current?fn(current):current),[]);
  const commitMove=useCallback((id:string,x:number,y:number)=>patch((c)=>({...c,decals:c.decals.map((d)=>d.id===id?{...d,x,y}:d)})),[patch]);
  const currentDecal=useMemo(()=>config?.decals.find((d)=>d.id===selectedDecal)||null,[config,selectedDecal]);
  if(!open||!config)return null;
  const save=()=>{window.dispatchEvent(new CustomEvent('autosyndicate:visual-save',{detail:{carId:config.carId,config}}));setOpen(false);};
  const addDecal=(assetId:string)=>{
    if(config.decals.length>=60)return;
    const id=(globalThis.crypto?.randomUUID?.()||`decal_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
    const decal:DecalConfig={id,assetId,x:122,y:78,scale:1,rotation:0,zIndex:20+config.decals.length,tint:'#ffffff',opacity:1};
    patch((c)=>({...c,decals:[...c.decals,decal]}));setSelectedDecal(decal.id);
  };
  const updateSelected=(values:Partial<DecalConfig>)=>selectedDecal&&patch((c)=>({...c,decals:c.decals.map((d)=>d.id===selectedDecal?{...d,...values}:d)}));
  const removeSelected=()=>{if(!selectedDecal)return;patch((c)=>({...c,decals:c.decals.filter((d)=>d.id!==selectedDecal)}));setSelectedDecal(null);};
  return <div className="atelier-overlay" role="dialog" aria-modal="true" aria-label="Тюнинг-Ателье">
    <div className="atelier-shell">
      <header className="atelier-head"><div><span>ТЮНИНГ-АТЕЛЬЕ</span><b>{name}</b></div><button onClick={()=>setOpen(false)} aria-label="Закрыть">×</button></header>
      <div className="atelier-preview"><PixiCarEditor config={config} onDecalCommit={commitMove}/><div className="atelier-layer-note">PIXI · {config.decals.length}/60 слоёв винила</div></div>
      <nav className="atelier-tabs">
        {([['paint','Покраска'],['wheels','Диски'],['tint','Тонировка'],['aero','Обвесы'],['vinyl','Винилы']] as [AtelierTab,string][]).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
      </nav>
      <div className="atelier-controls">
        {tab==='paint'&&<><div className="atelier-control-title">Цвет кузова</div><div className="atelier-palette">{PALETTE.map((hex)=><button key={hex} aria-label={hex} className={config.paint.hex===hex?'selected':''} style={{background:hex}} onClick={()=>patch((c)=>({...c,paint:{...c.paint,hex}}))}/>)}</div><div className="atelier-segments">{FINISHES.map((f)=><button key={f.id} className={config.paint.type===f.id?'active':''} onClick={()=>patch((c)=>({...c,paint:{...c.paint,type:f.id}}))}>{f.name}</button>)}</div></>}
        {tab==='wheels'&&<><div className="atelier-control-title">Передняя ось</div><div className="atelier-catalog">{WHEEL_CATALOG.map((w)=><button key={w.id} className={config.wheels.frontId===w.id?'active':''} onClick={()=>patch((c)=>({...c,wheels:{...c.wheels,frontId:w.id}}))}>{w.name}</button>)}</div><div className="atelier-control-title">Задняя ось</div><div className="atelier-catalog">{WHEEL_CATALOG.map((w)=><button key={w.id} className={config.wheels.rearId===w.id?'active':''} onClick={()=>patch((c)=>({...c,wheels:{...c.wheels,rearId:w.id}}))}>{w.name}</button>)}</div><label className="atelier-range">Диаметр <b>{config.wheels.diameter}&quot;</b><input type="range" min="14" max="22" step="1" value={config.wheels.diameter} onChange={(e)=>patch((c)=>({...c,wheels:{...c.wheels,diameter:Number(e.target.value)}}))}/></label><label className="atelier-range">Подвеска <b>{config.rideHeight>0?`−${Math.abs(config.rideHeight).toFixed(0)} мм`:config.rideHeight<0?`+${Math.abs(config.rideHeight).toFixed(0)} мм`:'СТОК'}</b><input type="range" min="-8" max="14" step="1" value={config.rideHeight} onChange={(e)=>patch((c)=>({...c,rideHeight:Number(e.target.value)}))}/></label></>}
        {tab==='tint'&&<><label className="atelier-range">Затемнение <b>{Math.round(config.tint.opacity*100)}%</b><input type="range" min="0" max="0.95" step="0.05" value={config.tint.opacity} onChange={(e)=>patch((c)=>({...c,tint:{...c.tint,opacity:Number(e.target.value)}}))}/></label><div className="atelier-palette">{['#020617','#111827','#172554','#3f0d12','#052e16'].map((hex)=><button key={hex} className={config.tint.color===hex?'selected':''} style={{background:hex}} onClick={()=>patch((c)=>({...c,tint:{...c.tint,color:hex}}))}/>)}</div></>}
        {tab==='aero'&&<><div className="atelier-control-title">Спойлер</div><div className="atelier-catalog">{SPOILER_CATALOG.map((x)=><button key={x.id} className={config.spoilerId===x.id?'active':''} onClick={()=>patch((c)=>({...c,spoilerId:x.id}))}>{x.name}</button>)}</div><div className="atelier-control-title">Обвес</div><div className="atelier-catalog">{BODY_KIT_CATALOG.map((x)=><button key={x.id} className={config.bodyKitId===x.id?'active':''} onClick={()=>patch((c)=>({...c,bodyKitId:x.id}))}>{x.name}</button>)}</div></>}
        {tab==='vinyl'&&<><div className="atelier-control-title">Добавить слой</div><div className="atelier-catalog">{DECAL_CATALOG.map((x)=><button key={x.id} disabled={config.decals.length>=60} onClick={()=>addDecal(x.id)}>+ {x.name}</button>)}</div><div className="atelier-layer-list">{config.decals.map((d,i)=><button key={d.id} className={selectedDecal===d.id?'active':''} onClick={()=>setSelectedDecal(d.id)}><span>#{i+1}</span><b>{DECAL_CATALOG.find((x)=>x.id===d.assetId)?.name||d.assetId}</b><small>Z {d.zIndex}</small></button>)}</div>{currentDecal&&<div className="atelier-decal-tools"><label>Масштаб <input type="range" min="0.2" max="3" step="0.05" value={currentDecal.scale} onChange={(e)=>updateSelected({scale:Number(e.target.value)})}/></label><label>Поворот <input type="range" min="-3.14" max="3.14" step="0.05" value={currentDecal.rotation} onChange={(e)=>updateSelected({rotation:Number(e.target.value)})}/></label><label>Слой <input type="range" min="1" max="120" step="1" value={currentDecal.zIndex} onChange={(e)=>updateSelected({zIndex:Number(e.target.value)})}/></label><label>Прозрачность <input type="range" min="0.05" max="1" step="0.05" value={currentDecal.opacity} onChange={(e)=>updateSelected({opacity:Number(e.target.value)})}/></label><input type="color" value={currentDecal.tint} onChange={(e)=>updateSelected({tint:e.target.value})}/><button className="danger" onClick={removeSelected}>Удалить слой</button><small>Наклейку можно перетаскивать пальцем прямо по машине.</small></div>}</>}
      </div>
      <footer className="atelier-actions"><button onClick={()=>setOpen(false)}>ОТМЕНА</button><button className="primary" onClick={save}>СОХРАНИТЬ СБОРКУ</button></footer>
    </div>
  </div>;
}

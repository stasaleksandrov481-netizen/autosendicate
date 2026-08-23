import type { CarGeometryPreset, CarVisualConfig, PaintFinish } from './types';

const MODEL_NAMES: Record<number, string> = {
  1: 'vaz_2106', 2: 'golf_mk2', 3: 'ae86', 4: 'silvia_s15', 5: 'rx7_fd',
  6: 'supra_mk4', 7: 'evo_ix', 8: 'wrx_sti', 9: 'gtr_r34', 10: 'mustang_gt',
  11: 'challenger_srt', 12: 'camaro_ss', 13: 'bmw_m4', 14: 'mercedes_amg_gt', 15: 'audi_rs6',
  16: 'porsche_911_turbo', 17: 'porsche_911_gt3rs', 18: 'audi_r8', 19: 'gtr_r35', 20: 'mclaren_720s',
  21: 'ferrari_488', 22: 'ferrari_sf90', 23: 'huracan', 24: 'aventador', 25: 'bugatti_chiron'
};

const CLASSES: Record<number, CarGeometryPreset['bodyClass']> = {
  1:'classic',2:'hatch',3:'classic',4:'coupe',5:'coupe',6:'coupe',7:'classic',8:'classic',9:'coupe',10:'muscle',
  11:'muscle',12:'muscle',13:'coupe',14:'coupe',15:'wagon',16:'super',17:'super',18:'super',19:'super',20:'super',
  21:'super',22:'hyper',23:'hyper',24:'hyper',25:'hyper'
};

const BODY_VARIANTS: Record<CarGeometryPreset['bodyClass'], { body:number[]; win:number[]; front:number; rear:number; wheelY:number; radius:number; spoiler:[number,number]; kit:number }> = {
  classic:{body:[10,102,18,79,52,72,72,42,132,42,155,72,207,76,230,91,226,111,10,111],win:[76,47,126,47,145,72,61,72],front:58,rear:184,wheelY:106,radius:17,spoiler:[205,71],kit:111},
  hatch:{body:[10,103,18,80,48,73,62,45,116,43,143,65,202,76,229,91,226,111,10,111],win:[66,50,111,48,136,69,54,72],front:58,rear:182,wheelY:106,radius:17,spoiler:[202,72],kit:111},
  coupe:{body:[8,104,18,79,50,73,75,42,139,39,171,69,215,77,232,91,228,112,8,112],win:[81,47,135,44,161,69,60,72],front:60,rear:188,wheelY:107,radius:18,spoiler:[207,70],kit:112},
  muscle:{body:[6,104,16,80,46,75,70,55,137,53,162,72,218,76,236,92,232,113,6,113],win:[77,59,134,58,153,72,58,73],front:62,rear:194,wheelY:108,radius:18,spoiler:[211,72],kit:113},
  wagon:{body:[7,104,18,80,48,72,69,43,155,43,179,70,219,77,235,91,231,112,7,112],win:[74,48,150,48,170,70,57,71],front:60,rear:194,wheelY:107,radius:18,spoiler:[214,70],kit:112},
  super:{body:[5,105,19,81,49,75,83,47,143,43,181,68,220,75,239,91,234,113,5,113],win:[88,52,138,48,171,69,61,73],front:61,rear:199,wheelY:108,radius:18,spoiler:[214,69],kit:113},
  hyper:{body:[4,106,20,82,48,76,91,50,151,46,191,68,224,76,242,92,236,114,4,114],win:[96,55,146,51,181,69,64,74],front:61,rear:202,wheelY:109,radius:19,spoiler:[216,68],kit:114}
};

function vary(points:number[], id:number, className:CarGeometryPreset['bodyClass']) {
  const out=[...points];
  const roofBias=((id*17)%7)-3;
  const noseBias=((id*11)%5)-2;
  if(className==='classic'||className==='hatch') {
    out[5]+=roofBias; out[7]+=roofBias; out[9]+=roofBias;
  } else {
    out[7]+=roofBias; out[9]+=roofBias; out[11]+=roofBias;
  }
  out[14]+=noseBias; out[16]+=noseBias;
  return out;
}

function varyWindow(points:number[], id:number) {
  const out=[...points];
  const bias=((id*13)%5)-2;
  out[1]+=bias; out[3]+=bias; out[5]+=bias;
  return out;
}

export const CAR_GEOMETRY: Record<number, CarGeometryPreset> = Object.fromEntries(
  Array.from({length:25},(_,i)=>i+1).map((id)=>{
    const bodyClass=CLASSES[id] || 'classic';
    const base=BODY_VARIANTS[bodyClass];
    return [id,{
      id,key:MODEL_NAMES[id] || `car_${id}`,bodyClass,
      bodyPoints:vary(base.body,id,bodyClass),windowPoints:varyWindow(base.win,id),
      wheelFrontX:base.front + ((id%3)-1)*2,wheelRearX:base.rear + (((id+1)%3)-1)*2,
      wheelY:base.wheelY,wheelRadius:base.radius,spoilerAnchor:base.spoiler,kitBaseline:base.kit
    } satisfies CarGeometryPreset];
  })
);

export const WHEEL_CATALOG = [
  {id:'steel_15',name:'Steel 15',spokes:5,accent:'#cbd5e1'},
  {id:'bbs_rim_18',name:'BBS Mesh 18',spokes:10,accent:'#e2e8f0'},
  {id:'te37_18',name:'TE37 18',spokes:6,accent:'#94a3b8'},
  {id:'deepdish_19',name:'Deep Dish 19',spokes:8,accent:'#f8fafc'},
  {id:'forged_20',name:'Forged 20',spokes:7,accent:'#cbd5e1'}
] as const;

export const SPOILER_CATALOG = [
  {id:'none',name:'Без спойлера'},
  {id:'ducktail_v1',name:'Ducktail'},
  {id:'gt_wing_v1',name:'GT Wing'},
  {id:'track_wing_v2',name:'Track Wing'}
] as const;

export const BODY_KIT_CATALOG = [
  {id:'stock',name:'Сток'},
  {id:'street_lip',name:'Street Lip'},
  {id:'widebody_v1',name:'Widebody'},
  {id:'track_splitter',name:'Track Splitter'}
] as const;

export const DECAL_CATALOG = [
  {id:'racing_stripes_white',name:'Racing Stripes',shape:'stripe'},
  {id:'side_flash',name:'Side Flash',shape:'bolt'},
  {id:'number_77',name:'77',shape:'number'},
  {id:'checker',name:'Checker',shape:'checker'},
  {id:'flame',name:'Flame',shape:'flame'},
  {id:'syndicate',name:'SYNDICATE',shape:'word'}
] as const;

const HEX_RE=/^#[0-9a-f]{6}$/i;
const FINISHES:PaintFinish[]=['gloss','matte','pearl','chameleon'];
const finite=(value:unknown,fallback:number)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};

export function defaultCarVisualConfig(carId:number):CarVisualConfig {
  const palette=['#d6d3d1','#ef4444','#2563eb','#111827','#eab308','#f8fafc','#10b981','#7c3aed'];
  return {
    version:1,carId,
    paint:{hex:palette[(Math.max(1,carId)-1)%palette.length],type:'gloss'},
    tint:{opacity:.45,color:'#111827'},
    wheels:{frontId:'steel_15',rearId:'steel_15',diameter:15},
    spoilerId:'none',bodyKitId:'stock',rideHeight:0,decals:[]
  };
}

export function normalizeCarVisualConfig(raw:unknown, carId:number):CarVisualConfig {
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const hinted=Number((raw as Record<string,unknown>).carId||(raw as Record<string,unknown>).car_id);
    if(Number.isInteger(hinted)&&hinted>0)carId=hinted;
  }
  const base=defaultCarVisualConfig(carId);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return base;
  const o=raw as Record<string,unknown>;
  const paint=(o.paint&&typeof o.paint==='object'&&!Array.isArray(o.paint))?o.paint as Record<string,unknown>:{};
  const tint=(o.tint&&typeof o.tint==='object'&&!Array.isArray(o.tint))?o.tint as Record<string,unknown>:{};
  const wheels=(o.wheels&&typeof o.wheels==='object'&&!Array.isArray(o.wheels))?o.wheels as Record<string,unknown>:{};
  const legacyWheel=String(o.wheels_id||'').slice(0,64);
  const finish=FINISHES.includes(String(paint.type) as PaintFinish)?String(paint.type) as PaintFinish:base.paint.type;
  const sourceDecals=Array.isArray(o.decals)?o.decals:(o.vinyl_id?[{id:'legacy_vinyl',assetId:o.vinyl_id,x:120,y:76,scale:1,rotation:0,zIndex:20,tint:'#ffffff',opacity:1}]:[]);
  const decals=sourceDecals.slice(0,60).map((item,index)=>{
    const d=(item&&typeof item==='object'&&!Array.isArray(item))?item as Record<string,unknown>:{};
    return {
      id:String(d.id||`decal_${index}`).slice(0,64),assetId:String(d.assetId||d.asset_id||'racing_stripes_white').slice(0,64),
      x:Math.max(0,Math.min(240,finite(d.x,120))),y:Math.max(25,Math.min(120,finite(d.y,76))),
      scale:Math.max(.2,Math.min(3,finite(d.scale,1))),rotation:Math.max(-Math.PI*2,Math.min(Math.PI*2,finite(d.rotation,0))),
      zIndex:Math.max(1,Math.min(999,Math.trunc(finite(d.zIndex??d.z_index,20+index)))),
      tint:HEX_RE.test(String(d.tint||''))?String(d.tint):'#ffffff',opacity:Math.max(.05,Math.min(1,finite(d.opacity,1)))
    };
  });
  return {
    version:1,carId,
    paint:{hex:HEX_RE.test(String(paint.hex||''))?String(paint.hex):base.paint.hex,type:finish},
    tint:{opacity:Math.max(0,Math.min(.95,finite(tint.opacity,base.tint.opacity))),color:HEX_RE.test(String(tint.color||''))?String(tint.color):base.tint.color},
    wheels:{frontId:String(wheels.frontId||wheels.front_id||legacyWheel||base.wheels.frontId).slice(0,64),rearId:String(wheels.rearId||wheels.rear_id||legacyWheel||base.wheels.rearId).slice(0,64),diameter:Math.max(14,Math.min(22,Math.trunc(finite(wheels.diameter,base.wheels.diameter))))},
    spoilerId:String(o.spoilerId||o.spoiler_id||base.spoilerId).slice(0,64),bodyKitId:String(o.bodyKitId||o.body_kit_id||base.bodyKitId).slice(0,64),
    rideHeight:Math.max(-12,Math.min(18,finite(o.rideHeight??o.ride_height,0))),decals
  };
}

export function carModelName(carId:number){return CAR_GEOMETRY[carId]?.key || `car_${carId}`;}

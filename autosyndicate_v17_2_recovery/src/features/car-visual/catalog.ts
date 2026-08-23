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

type ProfileSpec = {
  cls: CarGeometryPreset['bodyClass']; roofStart:number; roofEnd:number; roofY:number;
  rearDeckX:number; rearDeckY:number; hoodX:number; hoodY:number; noseY:number;
  rearWheel:number; frontWheel:number; wheelY:number; radius:number; beltY?:number;
};

// Hand-tuned side-profile proportions for every production model in the catalog.
// Each car id owns its roof, hood, rear deck and axle geometry; there is no shared placeholder rectangle.
const MODEL_PROFILES: Record<number, ProfileSpec> = {
  1:{cls:'classic',roofStart:62,roofEnd:150,roofY:45,rearDeckX:26,rearDeckY:77,hoodX:170,hoodY:76,noseY:87,rearWheel:58,frontWheel:187,wheelY:107,radius:17},
  2:{cls:'hatch',roofStart:52,roofEnd:138,roofY:42,rearDeckX:19,rearDeckY:73,hoodX:158,hoodY:75,noseY:88,rearWheel:57,frontWheel:183,wheelY:107,radius:17},
  3:{cls:'classic',roofStart:65,roofEnd:147,roofY:48,rearDeckX:22,rearDeckY:77,hoodX:170,hoodY:75,noseY:88,rearWheel:58,frontWheel:186,wheelY:107,radius:17},
  4:{cls:'coupe',roofStart:72,roofEnd:151,roofY:45,rearDeckX:23,rearDeckY:78,hoodX:176,hoodY:72,noseY:88,rearWheel:59,frontWheel:190,wheelY:108,radius:18},
  5:{cls:'coupe',roofStart:77,roofEnd:151,roofY:43,rearDeckX:20,rearDeckY:79,hoodX:179,hoodY:70,noseY:88,rearWheel:59,frontWheel:190,wheelY:108,radius:18},
  6:{cls:'coupe',roofStart:76,roofEnd:153,roofY:44,rearDeckX:18,rearDeckY:80,hoodX:181,hoodY:70,noseY:89,rearWheel:60,frontWheel:191,wheelY:108,radius:18},
  7:{cls:'classic',roofStart:61,roofEnd:151,roofY:44,rearDeckX:22,rearDeckY:76,hoodX:173,hoodY:75,noseY:88,rearWheel:58,frontWheel:188,wheelY:107,radius:18},
  8:{cls:'classic',roofStart:59,roofEnd:151,roofY:45,rearDeckX:22,rearDeckY:77,hoodX:172,hoodY:75,noseY:88,rearWheel:58,frontWheel:188,wheelY:107,radius:18},
  9:{cls:'coupe',roofStart:65,roofEnd:151,roofY:46,rearDeckX:20,rearDeckY:78,hoodX:176,hoodY:74,noseY:89,rearWheel:59,frontWheel:190,wheelY:108,radius:18},
 10:{cls:'muscle',roofStart:72,roofEnd:148,roofY:52,rearDeckX:19,rearDeckY:80,hoodX:184,hoodY:70,noseY:87,rearWheel:61,frontWheel:195,wheelY:109,radius:18},
 11:{cls:'muscle',roofStart:65,roofEnd:151,roofY:53,rearDeckX:17,rearDeckY:80,hoodX:187,hoodY:70,noseY:88,rearWheel:61,frontWheel:196,wheelY:109,radius:19},
 12:{cls:'muscle',roofStart:72,roofEnd:153,roofY:51,rearDeckX:18,rearDeckY:79,hoodX:184,hoodY:69,noseY:87,rearWheel:61,frontWheel:195,wheelY:109,radius:19},
 13:{cls:'coupe',roofStart:70,roofEnd:154,roofY:45,rearDeckX:20,rearDeckY:77,hoodX:179,hoodY:71,noseY:88,rearWheel:60,frontWheel:191,wheelY:108,radius:18},
 14:{cls:'coupe',roofStart:88,roofEnd:153,roofY:49,rearDeckX:21,rearDeckY:80,hoodX:182,hoodY:69,noseY:86,rearWheel:59,frontWheel:194,wheelY:108,radius:19},
 15:{cls:'wagon',roofStart:55,roofEnd:171,roofY:43,rearDeckX:16,rearDeckY:75,hoodX:184,hoodY:72,noseY:88,rearWheel:58,frontWheel:195,wheelY:108,radius:18},
 16:{cls:'super',roofStart:70,roofEnd:154,roofY:46,rearDeckX:17,rearDeckY:79,hoodX:180,hoodY:73,noseY:88,rearWheel:59,frontWheel:195,wheelY:109,radius:19},
 17:{cls:'super',roofStart:69,roofEnd:153,roofY:45,rearDeckX:17,rearDeckY:78,hoodX:180,hoodY:72,noseY:88,rearWheel:59,frontWheel:195,wheelY:109,radius:19},
 18:{cls:'super',roofStart:79,roofEnd:154,roofY:47,rearDeckX:16,rearDeckY:79,hoodX:183,hoodY:70,noseY:87,rearWheel:59,frontWheel:197,wheelY:109,radius:19},
 19:{cls:'super',roofStart:67,roofEnd:155,roofY:48,rearDeckX:18,rearDeckY:79,hoodX:182,hoodY:71,noseY:89,rearWheel:60,frontWheel:196,wheelY:109,radius:19},
 20:{cls:'super',roofStart:83,roofEnd:151,roofY:48,rearDeckX:14,rearDeckY:81,hoodX:185,hoodY:69,noseY:86,rearWheel:59,frontWheel:199,wheelY:109,radius:19},
 21:{cls:'super',roofStart:82,roofEnd:153,roofY:48,rearDeckX:15,rearDeckY:80,hoodX:184,hoodY:69,noseY:87,rearWheel:59,frontWheel:199,wheelY:109,radius:19},
 22:{cls:'hyper',roofStart:84,roofEnd:154,roofY:50,rearDeckX:14,rearDeckY:81,hoodX:187,hoodY:68,noseY:86,rearWheel:59,frontWheel:200,wheelY:110,radius:19},
 23:{cls:'hyper',roofStart:87,roofEnd:153,roofY:51,rearDeckX:13,rearDeckY:82,hoodX:189,hoodY:67,noseY:85,rearWheel:58,frontWheel:201,wheelY:110,radius:20},
 24:{cls:'hyper',roofStart:89,roofEnd:154,roofY:50,rearDeckX:12,rearDeckY:82,hoodX:190,hoodY:66,noseY:85,rearWheel:58,frontWheel:202,wheelY:110,radius:20},
 25:{cls:'hyper',roofStart:72,roofEnd:165,roofY:48,rearDeckX:12,rearDeckY:82,hoodX:191,hoodY:68,noseY:86,rearWheel:58,frontWheel:203,wheelY:110,radius:20}
};

function geometryFor(id:number):CarGeometryPreset {
  const p=MODEL_PROFILES[id] || MODEL_PROFILES[1];
  const sill=113;
  const body=[
    7,sill, 8,94, p.rearDeckX,p.rearDeckY,
    p.roofStart-15,p.rearDeckY-5, p.roofStart,p.roofY+9, p.roofStart+16,p.roofY,
    p.roofEnd,p.roofY, p.roofEnd+19,p.roofY+12,
    p.hoodX,p.hoodY, 220,p.noseY-3, 239,p.noseY+6, 235,sill
  ];
  const belt=p.beltY ?? Math.min(78,p.hoodY+3);
  const win=[
    p.roofStart+4,p.roofY+10, p.roofStart+19,p.roofY+4,
    p.roofEnd-5,p.roofY+4, p.roofEnd+12,p.roofY+14,
    p.roofEnd+16,belt, p.roofStart-5,belt
  ];
  return {
    id,key:MODEL_NAMES[id] || `car_${id}`,bodyClass:p.cls,
    bodyPoints:body,windowPoints:win,
    wheelFrontX:p.frontWheel,wheelRearX:p.rearWheel,wheelY:p.wheelY,wheelRadius:p.radius,
    spoilerAnchor:[Math.min(215,p.hoodX+28),Math.min(76,p.hoodY)] as const,kitBaseline:sill
  };
}

export const CAR_GEOMETRY: Record<number, CarGeometryPreset> = Object.fromEntries(
  Array.from({length:25},(_,i)=>i+1).map((id)=>[id,geometryFor(id)])
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

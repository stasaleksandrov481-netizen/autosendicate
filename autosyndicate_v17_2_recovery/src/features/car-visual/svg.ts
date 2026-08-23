import { CAR_GEOMETRY, DECAL_CATALOG, WHEEL_CATALOG, normalizeCarVisualConfig } from './catalog';
import type { CarVisualConfig, DecalConfig } from './types';

const esc=(value:string)=>value.replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[m]!));
const pts=(values:number[])=>values.reduce<string[]>((out,v,i)=>{if(i%2===0)out.push(`${v},${values[i+1]}`);return out;},[]).join(' ');

function wheelMarkup(cx:number,cy:number,r:number,id:string){
  const wheel=WHEEL_CATALOG.find((x)=>x.id===id)||WHEEL_CATALOG[0];
  const spokes=Array.from({length:wheel.spokes},(_,i)=>{
    const a=(Math.PI*2*i/wheel.spokes)-Math.PI/2;
    const x1=cx+Math.cos(a)*r*.25,y1=cy+Math.sin(a)*r*.25,x2=cx+Math.cos(a)*r*.72,y2=cy+Math.sin(a)*r*.72;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${wheel.accent}" stroke-width="2.2" stroke-linecap="round"/>`;
  }).join('');
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#050607"/><circle cx="${cx}" cy="${cy}" r="${(r*.72).toFixed(2)}" fill="#222831" stroke="#6b7280" stroke-width="1.5"/>${spokes}<circle cx="${cx}" cy="${cy}" r="${(r*.18).toFixed(2)}" fill="#111827" stroke="#d1d5db" stroke-width="1"/></g>`;
}

function decalMarkup(d:DecalConfig){
  const meta=DECAL_CATALOG.find((x)=>x.id===d.assetId)||DECAL_CATALOG[0];
  const deg=d.rotation*180/Math.PI;
  const common=`transform="translate(${d.x} ${d.y}) rotate(${deg.toFixed(2)}) scale(${d.scale.toFixed(3)})" opacity="${d.opacity.toFixed(3)}"`;
  if(meta.shape==='stripe')return `<g ${common} fill="${esc(d.tint)}"><rect x="-34" y="-4" width="68" height="4" rx="2"/><rect x="-34" y="4" width="68" height="4" rx="2"/></g>`;
  if(meta.shape==='bolt')return `<path ${common} d="M-35,-5 -7,-11 -14,-2 18,-7 4,4 35,1 6,13 12,5 -24,10 -6,1Z" fill="${esc(d.tint)}"/>`;
  if(meta.shape==='number')return `<text ${common} x="0" y="8" text-anchor="middle" fill="${esc(d.tint)}" font-family="Arial Black,Arial" font-size="25" font-weight="900">77</text>`;
  if(meta.shape==='checker'){
    const cells=Array.from({length:8},(_,i)=>
      Array.from({length:3},(_,j)=>(i+j)%2===0?`<rect x="${-32+i*8}" y="${-10+j*7}" width="8" height="7"/>`:'').join('')
    ).join('');
    return `<g ${common} fill="${esc(d.tint)}">${cells}</g>`;
  }
  if(meta.shape==='flame')return `<path ${common} d="M-34 8c18-3 22-17 30-27 0 9 5 12 11 8 8-5 11-14 15-20 4 16 14 20 17 32-8-4-12-2-18 7-5 8-13 12-26 11-11-1-20-4-29-11Z" fill="${esc(d.tint)}"/>`;
  return `<text ${common} x="0" y="6" text-anchor="middle" fill="${esc(d.tint)}" font-family="Arial Black,Arial" font-size="13" font-weight="900" letter-spacing="1">SYNDICATE</text>`;
}

function finishDefs(type:CarVisualConfig['paint']['type'],hex:string,id:string){
  if(type==='matte')return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${hex}"/><stop offset="1" stop-color="#111827" stop-opacity=".25"/></linearGradient>`;
  if(type==='pearl')return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hex}"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".72" stop-color="${hex}"/><stop offset="1" stop-color="#111827" stop-opacity=".28"/></linearGradient>`;
  if(type==='chameleon')return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${hex}"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>`;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".28"/><stop offset=".18" stop-color="${hex}"/><stop offset=".78" stop-color="${hex}"/><stop offset="1" stop-color="#020617" stop-opacity=".35"/></linearGradient>`;
}

export function carVisualSvgMarkup(raw:unknown, options?:{className?:string;ariaLabel?:string}){
  const carId=Number((raw as any)?.carId)||1,config=normalizeCarVisualConfig(raw,carId),geo=CAR_GEOMETRY[config.carId]||CAR_GEOMETRY[1];
  const grad=`carpaint-${config.carId}-${config.paint.hex.slice(1)}-${config.paint.type}`.replace(/[^a-z0-9-]/gi,'');
  const wheelScale=1+(config.wheels.diameter-15)*.035;
  const r=geo.wheelRadius*wheelScale;
  const y=geo.wheelY;
  // rideHeight is a suspension/body offset: positive values lower the body relative to the wheel hubs.
  const bodyTranslate=config.rideHeight*.45;
  const spoiler= config.spoilerId==='none'?'': config.spoilerId==='ducktail_v1'
    ? `<path d="M${geo.spoilerAnchor[0]-18} ${geo.spoilerAnchor[1]} q18 -8 31 -2 l-2 5 q-15 -3 -31 3Z" fill="url(#${grad})"/>`
    : `<g fill="url(#${grad})"><rect x="${geo.spoilerAnchor[0]-12}" y="${geo.spoilerAnchor[1]-15}" width="36" height="4" rx="2"/><rect x="${geo.spoilerAnchor[0]-7}" y="${geo.spoilerAnchor[1]-11}" width="3" height="13"/><rect x="${geo.spoilerAnchor[0]+16}" y="${geo.spoilerAnchor[1]-11}" width="3" height="13"/></g>`;
  const kit=config.bodyKitId==='stock'?'':`<path d="M13 ${geo.kitBaseline-2} H229 L225 ${geo.kitBaseline+4} H18Z" fill="#0b0f16" opacity=".95"/>`;
  const decals=[...config.decals].sort((a,b)=>a.zIndex-b.zIndex).map(decalMarkup).join('');
  const clip=`${grad}-body-clip`;
  return `<svg class="${esc(options?.className||'car-visual-svg')}" viewBox="0 0 246 136" role="img" aria-label="${esc(options?.ariaLabel||'Автомобиль')}">
  <defs>${finishDefs(config.paint.type,config.paint.hex,grad)}<clipPath id="${clip}"><polygon points="${pts(geo.bodyPoints)}"/></clipPath></defs>
  <g transform="translate(0 ${bodyTranslate})">
    <polygon points="${pts(geo.bodyPoints)}" fill="url(#${grad})" stroke="#020617" stroke-width="2" stroke-linejoin="round"/>
    <path d="M18 84 C57 79 178 75 226 89" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
    <g clip-path="url(#${clip})">${decals}</g>
    <polygon points="${pts(geo.windowPoints)}" fill="${esc(config.tint.color)}" fill-opacity="${config.tint.opacity.toFixed(3)}" stroke="#dbeafe" stroke-opacity=".16" stroke-width="1"/>
    ${kit}${spoiler}
  </g>
  ${wheelMarkup(geo.wheelFrontX,y,r,config.wheels.frontId)}${wheelMarkup(geo.wheelRearX,y,r,config.wheels.rearId)}
  <ellipse cx="123" cy="128" rx="108" ry="5" fill="#000" opacity=".3"/>
</svg>`;
}

export function carVisualDataUri(raw:unknown){
  const svg=carVisualSvgMarkup(raw,{ariaLabel:'Car'});
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

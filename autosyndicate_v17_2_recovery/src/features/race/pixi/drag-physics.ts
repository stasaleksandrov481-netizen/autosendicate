export type DragGear = 1|2|3|4|5|6;
export type DragShiftQuality = 'miss'|'good'|'perfect';

const GEAR_RATIOS=[0,3.20,2.10,1.55,1.22,1.00,.82] as const;
const GEAR_SPEED_CAPS=[0,62,112,168,226,292,390] as const;

export interface DragPhysicsSetup {
  powerHp:number;
  maxSpeedKmh:number;
  gearboxLevel:number;
  massKg?:number;
}

export interface DragPhysicsState {
  speedKmh:number;
  rpm:number;
  gear:DragGear;
  distanceM:number;
  throttle:number;
  brake:number;
  nitroSeconds:number;
  shiftBoostSeconds:number;
  lastShiftQuality:DragShiftQuality|null;
}

export function shiftWindows(level:number){
  const safe=Math.max(0,Math.min(5,Math.trunc(level)));
  return {good:[6600-safe*70,8200+safe*30] as const,perfect:[7350-safe*45,7850+safe*45] as const};
}

export function evaluateShift(rpm:number,level:number):DragShiftQuality{
  const w=shiftWindows(level);if(rpm>=w.perfect[0]&&rpm<=w.perfect[1])return 'perfect';if(rpm>=w.good[0]&&rpm<=w.good[1])return 'good';return 'miss';
}

function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v));}

export class DragPhysicsModel {
  readonly setup:Required<DragPhysicsSetup>;
  state:DragPhysicsState;
  constructor(setup:DragPhysicsSetup){
    this.setup={powerHp:Math.max(60,setup.powerHp),maxSpeedKmh:Math.max(120,setup.maxSpeedKmh),gearboxLevel:Math.max(0,Math.min(5,setup.gearboxLevel)),massKg:Math.max(850,setup.massKg||1450)};
    this.state={speedKmh:0,rpm:1100,gear:1,distanceM:0,throttle:0,brake:0,nitroSeconds:0,shiftBoostSeconds:0,lastShiftQuality:null};
  }
  setThrottle(value:number){this.state.throttle=clamp(value,0,1);}
  setBrake(value:number){this.state.brake=clamp(value,0,1);}
  useNitro(seconds=2.4){this.state.nitroSeconds=Math.max(this.state.nitroSeconds,seconds);}
  shift(direction:1|-1){
    const s=this.state;
    if(direction>0&&s.gear<6){const quality=evaluateShift(s.rpm,this.setup.gearboxLevel);s.lastShiftQuality=quality;s.gear=(s.gear+1) as DragGear;s.shiftBoostSeconds=quality==='perfect'?.65:quality==='good'?.28:0;s.speedKmh*=quality==='miss'?.92:1;s.rpm=Math.max(2200,s.rpm*(quality==='perfect'?.68:quality==='good'?.62:.52));return quality;}
    if(direction<0&&s.gear>1){s.gear=(s.gear-1) as DragGear;s.rpm=Math.min(8200,s.rpm*1.36);}
    return s.lastShiftQuality;
  }
  step(dt:number){
    const s=this.state,d=Math.max(.001,Math.min(.05,dt)),gear=s.gear,cap=Math.min(this.setup.maxSpeedKmh,GEAR_SPEED_CAPS[gear]);
    const rpmNorm=clamp((s.rpm-900)/7500,0,1);const torqueCurve=.58+Math.sin(Math.min(1,rpmNorm)*Math.PI)*.44;
    const hpPerTon=this.setup.powerHp/(this.setup.massKg/1000);const powerFactor=clamp(hpPerTon/220,.38,3.2);
    const limiter=clamp((cap-s.speedKmh)/22,.02,1);const nitro=s.nitroSeconds>0?1.20:1;const shift=s.shiftBoostSeconds>0?1.12:1;
    const accelKmh=43*powerFactor*(GEAR_RATIOS[gear]/GEAR_RATIOS[1])*.78*torqueCurve*limiter*nitro*shift*s.throttle;
    const aero=1.6+Math.pow(s.speedKmh/260,2)*10;
    s.speedKmh=clamp(s.speedKmh+(accelKmh-aero-s.brake*(78+s.speedKmh*.08))*d,0,cap);
    const lower=gear===1?0:GEAR_SPEED_CAPS[gear-1],span=Math.max(1,GEAR_SPEED_CAPS[gear]-lower),gearProgress=clamp((s.speedKmh-lower)/span,0,1);
    const targetRpm=900+gearProgress*7500;s.rpm+= (targetRpm-s.rpm)*Math.min(1,d*9);s.rpm=clamp(s.rpm,800,8500);
    s.distanceM+=(s.speedKmh/3.6)*d;s.nitroSeconds=Math.max(0,s.nitroSeconds-d);s.shiftBoostSeconds=Math.max(0,s.shiftBoostSeconds-d);
    return s;
  }
}

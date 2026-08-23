export type PaintFinish = 'gloss' | 'matte' | 'pearl' | 'chameleon';

export interface PaintConfig {
  hex: string;
  type: PaintFinish;
}

export interface TintConfig {
  opacity: number;
  color: string;
}

export interface WheelsConfig {
  frontId: string;
  rearId: string;
  diameter: number;
}

export interface DecalConfig {
  id: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  tint: string;
  opacity: number;
}

export interface CarVisualConfig {
  version: 1;
  carId: number;
  paint: PaintConfig;
  tint: TintConfig;
  wheels: WheelsConfig;
  spoilerId: string;
  bodyKitId: string;
  rideHeight: number;
  decals: DecalConfig[];
}

export interface CarGeometryPreset {
  id: number;
  key: string;
  bodyClass: 'classic' | 'hatch' | 'coupe' | 'muscle' | 'wagon' | 'super' | 'hyper';
  bodyPoints: number[];
  windowPoints: number[];
  wheelFrontX: number;
  wheelRearX: number;
  wheelY: number;
  wheelRadius: number;
  spoilerAnchor: readonly [number, number];
  kitBaseline: number;
}

export interface CarVisualSize {
  width: number;
  height: number;
}

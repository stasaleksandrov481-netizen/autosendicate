import { z } from 'zod';

export const paintFinishSchema=z.enum(['gloss','matte','pearl','chameleon']);
export const decalConfigSchema=z.object({
  id:z.string().min(1).max(80),assetId:z.string().min(1).max(80),
  x:z.number().finite().min(-1000).max(1000),y:z.number().finite().min(-1000).max(1000),
  scale:z.number().finite().min(.05).max(5),rotation:z.number().finite().min(-12.57).max(12.57),
  zIndex:z.number().int().min(0).max(999),tint:z.string().regex(/^#[0-9a-fA-F]{6}$/),opacity:z.number().finite().min(0).max(1)
}).strict();
export const carVisualConfigSchema=z.object({
  version:z.literal(1),carId:z.number().int().min(1).max(100000),
  paint:z.object({hex:z.string().regex(/^#[0-9a-fA-F]{6}$/),type:paintFinishSchema}).strict(),
  tint:z.object({opacity:z.number().finite().min(0).max(.98),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
  wheels:z.object({frontId:z.string().min(1).max(80),rearId:z.string().min(1).max(80),diameter:z.number().finite().min(12).max(26)}).strict(),
  spoilerId:z.string().max(80),bodyKitId:z.string().max(80),rideHeight:z.number().finite().min(-20).max(30),
  decals:z.array(decalConfigSchema).max(60)
}).strict();
export const carVisualMapSchema=z.record(z.string().regex(/^\d{1,6}$/),carVisualConfigSchema).superRefine((value,ctx)=>{if(Object.keys(value).length>100)ctx.addIssue({code:'custom',message:'too many car visual entries'});});

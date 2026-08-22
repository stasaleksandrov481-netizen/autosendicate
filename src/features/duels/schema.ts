import { z } from 'zod';

export const duelCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{12,32}$/);
export const duelRoomActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('selectCar'), code: duelCodeSchema, carId: z.number().int().min(1).max(100000) }),
  z.object({ action: z.literal('ready'), code: duelCodeSchema, ready: z.boolean() }),
  z.object({
    action: z.literal('progress'), code: duelCodeSchema,
    distance: z.number().min(0).max(5000), speedKmh: z.number().min(0).max(500), elapsedMs: z.number().int().min(0).max(180000)
  }),
  z.object({ action: z.literal('submitResult'), code: duelCodeSchema, elapsedMs: z.number().int().min(2500).max(180000), topSpeedKmh: z.number().min(0).max(500), perfectShifts: z.number().int().min(0).max(12), missedShifts: z.number().int().min(0).max(12) })
]);

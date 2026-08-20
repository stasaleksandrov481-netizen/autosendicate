import { z } from 'zod';

export const profileSyncSchema = z.object({
  displayName: z.string().trim().min(1).max(48),
  photoUrl: z.string().url().max(800).nullable().optional(),
  currentCarName: z.string().trim().max(80).nullable().optional(),
  activeCarId: z.number().int().min(1).max(100000).optional(),
  activePlate: z.object({ uid:z.string().max(64), text:z.string().trim().min(1).max(24), rarity:z.string().max(24), series:z.string().max(32) }).nullable().optional()
}).strict();

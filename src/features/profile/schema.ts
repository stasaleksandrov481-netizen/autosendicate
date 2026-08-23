import { z } from 'zod';

export const profileSyncSchema = z.object({
  displayName: z.string().trim().min(1).max(48),
  photoUrl: z.string().url().max(800).nullable().optional(),
  currentCarName: z.string().trim().max(80).nullable().optional(),
  activeCarId: z.number().int().min(1).max(100000).optional(),
  wantedLevel: z.number().int().min(0).max(5).optional(),
  activePlate: z.object({ uid: z.string().max(80), text: z.string().trim().max(24), rarity: z.string().max(24), series: z.string().max(40) }).nullable().optional(),
  /* v17-fix: клиент — единственный источник истины по составу гаража и экономике
     (owned_cars/balance/статистика), но раньше синк отправлял только «презентационные»
     поля (имя, фото, активная машина). owned_cars в БД годами не обновлялся, из-за
     чего инлайн-бот/рейтинг показывали давно проданные машины, а «сброс прогресса»
     на самом деле подтягивал эти протухшие серверные данные обратно. */
  ownedCars: z.array(z.number().int().min(1).max(100000)).max(200).optional(),
  balance: z.number().int().min(0).max(1_000_000_000_000).optional(),
  xp: z.number().int().min(0).max(1_000_000_000).optional(),
  races: z.number().int().min(0).max(1_000_000_000).optional(),
  wins: z.number().int().min(0).max(1_000_000_000).optional(),
  losses: z.number().int().min(0).max(1_000_000_000).optional(),
  totalEarned: z.number().int().min(0).max(1_000_000_000_000).optional(),
  level: z.number().int().min(1).max(1_000_000).optional()
}).strict();

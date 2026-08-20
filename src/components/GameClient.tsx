'use client';

import { useEffect, useRef } from 'react';
import { GAME_SHELL } from '@/legacy/game-shell';
import { startPreloader } from '@/features/ui/preloader';
import { bootstrapSecureSession } from '@/features/auth/client';

export function GameClient() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const stopPreloader = startPreloader();

    void (async () => {
      try {
        await bootstrapSecureSession();
      } catch (error) {
        console.warn('secure Telegram session unavailable', error);
      }
      await import('@/legacy/runtime');
    })();

    return () => stopPreloader();
  }, []);

  return <div id="game-root" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: GAME_SHELL }} />;
}

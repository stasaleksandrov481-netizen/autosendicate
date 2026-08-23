'use client';

import { Application } from 'pixi.js';

const baseOptions = (host:HTMLElement, options?:{transparent?:boolean;antialias?:boolean}) => ({
  resizeTo: host,
  autoStart: true,
  backgroundAlpha: options?.transparent === false ? 1 : 0,
  antialias: options?.antialias !== false,
  autoDensity: true,
  resolution: Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)),
  powerPreference: 'high-performance' as const,
});

export async function createPixiApplication(host: HTMLElement, options?: { transparent?: boolean; antialias?: boolean }) {
  let app = new Application();
  const base = baseOptions(host, options);

  // PixiJS 8.20: renderer preference chain is the supported replacement for the old
  // forceCanvas flag. WebGL is attempted first and Canvas2D is the automatic fallback.
  try {
    await app.init({ ...base, preference: ['webgl', 'canvas'] as any });
  } catch (webglError) {
    console.warn('[Pixi] WebGL/auto-detect init failed, retrying a clean Canvas2D Application', webglError);
    try { app.destroy(true); } catch {}
    app = new Application();
    await app.init({ ...base, preference: 'canvas' as any });
  }

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  host.replaceChildren(canvas);
  return app;
}

export function destroyPixiApplication(app: Application | null, host?: HTMLElement | null) {
  if (!app) return;
  try { app.stop(); } catch {}
  try { app.destroy(true, { children: true, texture: false, textureSource: false } as any); } catch {
    try { app.destroy(true); } catch {}
  }
  try { host?.replaceChildren(); } catch {}
}

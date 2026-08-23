'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Container, Graphics } from 'pixi.js';
import type { Application } from 'pixi.js';
import { buildPixiCar, setPixiCarInteractive } from '@/features/car-visual/pixi-car';
import { CarVisual } from '@/components/car/CarVisual';
import { createPixiApplication, destroyPixiApplication } from '@/features/pixi-app';
import type { CarVisualConfig } from '@/features/car-visual/types';

export function PixiCarEditor({ config, onDecalCommit }:{ config:CarVisualConfig; onDecalCommit:(id:string,x:number,y:number)=>void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const carRootRef = useRef<Container | null>(null);
  const commitRef = useRef(onDecalCommit);
  const [generation, setGeneration] = useState(0);
  const [graphicsUnavailable, setGraphicsUnavailable] = useState(false);

  useEffect(() => { commitRef.current = onDecalCommit; }, [onDecalCommit]);

  const positionCar = useCallback((app:Application, root:Container) => {
    const scale = Math.max(.72, Math.min(1.7, Math.min(app.screen.width / 320, app.screen.height / 178)));
    root.scale.set(scale);
    root.position.set((app.screen.width - 246 * scale) / 2, (app.screen.height - 136 * scale) / 2 + 8);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let ro:ResizeObserver | undefined;

    void (async () => {
      try {
        const app = await createPixiApplication(host, { transparent:true, antialias:true });
        if (cancelled) { destroyPixiApplication(app, host); return; }
        appRef.current = app;
        app.canvas.classList.add('atelier-pixi-canvas');

        const bg = new Graphics(); bg.label = 'atelier-background';
        const grid = new Graphics(); grid.label = 'atelier-grid';
        app.stage.addChild(bg, grid);
        const redraw = () => {
          bg.clear().roundRect(0,0,app.screen.width,app.screen.height,24).fill({ color:'#0b0f16', alpha:1 });
          grid.clear();
          for (let x=0;x<app.screen.width;x+=32) grid.moveTo(x,0).lineTo(x,app.screen.height);
          for (let y=0;y<app.screen.height;y+=32) grid.moveTo(0,y).lineTo(app.screen.width,y);
          grid.stroke({ color:'#ffffff', alpha:.035, width:1 });
          if (carRootRef.current) positionCar(app,carRootRef.current);
          try { app.render(); } catch {}
        };
        redraw();
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(redraw); ro.observe(host);
        }
        setGraphicsUnavailable(false);
        setGeneration((v)=>v+1);
      } catch (error) {
        console.error('[Tuning] Pixi WebGL/Canvas initialization failed', error);
        if (!cancelled) setGraphicsUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      carRootRef.current = null;
      const app = appRef.current; appRef.current = null;
      destroyPixiApplication(app, host);
    };
  }, [positionCar]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !generation || graphicsUnavailable) return;
    if (carRootRef.current) {
      try { app.stage.removeChild(carRootRef.current); carRootRef.current.destroy({children:true}); } catch {}
      carRootRef.current = null;
    }
    try {
      const build = buildPixiCar(config);
      positionCar(app, build.root);
      app.stage.addChild(build.root);
      carRootRef.current = build.root;
      setPixiCarInteractive(build, () => { try { app.render(); } catch {} }, (id,x,y) => commitRef.current(id,x,y));
      // Explicit render is required after every React state-driven tuning mutation.
      app.render();
      return () => {
        if (carRootRef.current === build.root) {
          try { app.stage.removeChild(build.root); build.root.destroy({children:true}); } catch {}
          carRootRef.current = null;
        }
      };
    } catch (error) {
      console.error('[Tuning] layered car build failed', error);
      setGraphicsUnavailable(true);
    }
  }, [config, generation, graphicsUnavailable, positionCar]);

  // Graphical emergency path only. Never replace the car with text or a gray rectangle.
  if (graphicsUnavailable) return <div className="atelier-graphic-emergency"><CarVisual config={config} size="lg" label="Превью автомобиля"/></div>;
  return <div className="atelier-pixi-host" ref={hostRef}/>;
}

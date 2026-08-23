'use client';
import type { Container, Renderer, Texture } from 'pixi.js';

export function bakeCarTexture(renderer:Renderer, container:Container):Texture {
  // PixiJS v8 RenderTexture path. The caller owns and must destroy the returned texture.
  return renderer.generateTexture({ target: container, resolution: 2, antialias: true });
}

export async function bakeCarPng(renderer:Renderer, container:Container):Promise<string> {
  const texture=bakeCarTexture(renderer,container);
  try {
    return await renderer.extract.base64({target:texture,format:'png',resolution:1,antialias:true});
  } finally { texture.destroy(true); }
}

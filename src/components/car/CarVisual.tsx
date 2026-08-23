import { carVisualSvgMarkup } from '@/features/car-visual/svg';
import { normalizeCarVisualConfig } from '@/features/car-visual/catalog';
import type { CarVisualConfig } from '@/features/car-visual/types';

export function CarVisual({ config, size='md', className='', label='Автомобиль' }:{ config:CarVisualConfig|unknown; size?:'sm'|'md'|'lg'; className?:string; label?:string }){
  const carId=Number((config as any)?.carId)||1;
  const normalized=normalizeCarVisualConfig(config,carId);
  return <div className={`car-visual car-visual-${size} ${className}`} data-car-id={normalized.carId}
    dangerouslySetInnerHTML={{__html:carVisualSvgMarkup(normalized,{ariaLabel:label})}}/>;
}

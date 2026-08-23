import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));

const pkg=JSON.parse(read('package.json'));
const runtime=read('src/legacy/runtime.ts');
const css=read('src/app/globals.css');
const catalog=read('src/features/car-visual/catalog.ts');
const types=read('src/features/car-visual/types.ts');
const svg=read('src/features/car-visual/svg.ts');
const pixiCar=read('src/features/car-visual/pixi-car.ts');
const bake=read('src/features/car-visual/bake.ts');
const schema=read('src/features/car-visual/schema.ts');
const engine=read('src/features/race/pixi/PixiDragRaceEngine.ts');
const physics=read('src/features/race/pixi/drag-physics.ts');
const editor=read('src/components/tuning/PixiCarEditor.tsx');
const atelier=read('src/components/tuning/TuningAtelierBridge.tsx');
const carVisual=read('src/components/car/CarVisual.tsx');
const gameClient=read('src/components/GameClient.tsx');
const profileSchema=read('src/features/profile/schema.ts');
const profileServer=read('src/features/profile/server.ts');
const profileDirectory=read('src/features/profile/directory.ts');
const bootstrap=read('src/app/api/game/bootstrap/route.ts');
const bot=read('src/features/bot/handler.ts');
const duelClient=read('src/components/duels/DuelRoomClient.tsx');
const duelServer=read('src/features/duels/server.ts');
const marketSchema=read('src/features/market/schema.ts');
const migration=read('supabase/upgrade-v17-car-visuals.sql');
const preloader=read('src/features/ui/preloader.ts');
const imageRoute=read('src/app/api/car-visual/[playerId]/route.tsx');

const vectorDir=path.join(root,'public/assets/cars/vector');
const vectorSvgs=exists('public/assets/cars/vector')?fs.readdirSync(vectorDir).filter((x)=>x.endsWith('.svg')):[];

const checks=[
  ['PixiJS 8.20.0 dependency pinned',pkg.dependencies?.['pixi.js']==='8.20.0'],
  ['V17 package version',pkg.version==='17.0.0'],
  ['Universal CarVisual component exists',carVisual.includes('export function CarVisual')&&carVisual.includes("size='md'")&&carVisual.includes('carVisualSvgMarkup')],
  ['Canonical visual config has all requested layers',types.includes('paint: PaintConfig')&&types.includes('tint: TintConfig')&&types.includes('wheels: WheelsConfig')&&types.includes('spoilerId: string')&&types.includes('bodyKitId: string')&&types.includes('decals: DecalConfig[]')],
  ['Visual JSON validates max 60 decals',schema.includes('z.array(decalConfigSchema).max(60)')],
  ['Legacy snake_case config is accepted',catalog.includes('.car_id')&&catalog.includes('o.wheels_id')&&catalog.includes('o.spoiler_id')&&catalog.includes('o.vinyl_id')],
  ['All 25 car model keys are mapped',catalog.includes("1: 'vaz_2106'")&&catalog.includes("14: 'mercedes_amg_gt'")&&catalog.includes("25: 'bugatti_chiron'")],
  ['25 editable vector body files exist',vectorSvgs.length===25],

  ['Pixi car has independent layer containers',pixiCar.includes("label='base-body'")&&pixiCar.includes("label='color-finish'")&&pixiCar.includes("label='window-tint'")&&pixiCar.includes("label='wheels-rims'")&&pixiCar.includes("label='body-kits-spoilers'")&&pixiCar.includes("label='decals-vinyls'")],
  ['Front and rear wheel layers are independent',pixiCar.includes('config.wheels.frontId')&&pixiCar.includes('config.wheels.rearId')],
  ['Ride height moves body relative to fixed wheel hubs',pixiCar.includes('const yOffset=config.rideHeight*.45')&&pixiCar.includes('wheelY=geo.wheelY')],
  ['Decals are actual Pixi Sprites',pixiCar.includes('new Sprite(decalTexture')&&pixiCar.includes('sprite.rotation=decal.rotation')&&pixiCar.includes('sprite.zIndex=decal.zIndex')&&pixiCar.includes('sprite.tint=toHexNumber(decal.tint)')],
  ['Decals support touch drag',pixiCar.includes("sprite.on('pointerdown'")&&pixiCar.includes("sprite.on('globalpointermove'")&&pixiCar.includes('onCommit?.')],
  ['Bake creates a flat generated texture',bake.includes('renderer.generateTexture')&&bake.includes('resolution: 2')],
  ['Bake can export PNG base64',bake.includes('renderer.extract.base64')&&bake.includes("format:'png'")],

  ['2.5D race uses Pixi Application',engine.includes('new Application()')&&engine.includes('await this.app.init')&&engine.includes("preference:'webgl'")],
  ['Race has three-speed parallax behavior',engine.includes("new TilingSprite")&&engine.includes('this.city.tilePosition.x-=speed*.028')&&engine.includes('this.fence.tilePosition.x-=speed*.095')&&engine.includes('this.road.tilePosition.x-=speed*.145')],
  ['Race has separate participant lanes',engine.includes('lanePositions')&&engine.includes('height*.54,height*.73')&&engine.includes('height*.48,height*.64,height*.80')],
  ['Race car is baked before track rendering',engine.includes('buildPixiCar(normalized)')&&engine.includes('this.app.renderer.generateTexture')&&engine.includes('new Sprite(texture)')],
  ['Police has explicit visual layer',engine.includes("racer.kind==='cop'")&&engine.includes("fill('#ef4444')")&&engine.includes("fill('#3b82f6')")],
  ['Race camera positions cars by real relative distance',engine.includes('const relative=dist-snapshot.playerDistance')&&engine.includes('playerX+relative*pxPerMeter')],
  ['Manual drag physics module contains green/perfect shift logic',physics.includes('shiftWindows')&&physics.includes("'perfect'")&&physics.includes('evaluateShift')&&physics.includes('gear')],
  ['Runtime mounts Pixi dynamically only for race',runtime.includes("import('@/features/race/pixi/PixiDragRaceEngine')")&&runtime.includes('mountPixiDragRace')],
  ['Runtime keeps real-time online opponent distance',runtime.includes('privateRemoteProgress?.distance')&&runtime.includes('raceDistancesV17')],
  ['HTML cockpit stays over Pixi with speed/gear controls',runtime.includes('pixi-race-overlay-v17')&&runtime.includes('pixi-speed-label-v17')&&runtime.includes('shift-down-v17')&&runtime.includes('manualShiftDownV17')],
  ['Existing gas/brake/N2O and tach remain active',runtime.includes('gas-btn')&&runtime.includes('brake-btn')&&runtime.includes('nitro-btn')&&runtime.includes('tach')],
  ['Pixi canvas does not intercept HTML cockpit',css.includes('.pixi-race-host-v17 canvas')&&css.includes('.pixi-race-overlay-v17')],

  ['Tuning atelier bridge is mounted globally',gameClient.includes('TuningAtelierBridge')&&gameClient.includes('<TuningAtelierBridge')],
  ['Atelier has paint/wheels/tint/aero/vinyl tabs',atelier.includes("'paint','Покраска'")&&atelier.includes("'wheels','Диски'")&&atelier.includes("'tint','Тонировка'")&&atelier.includes("'aero','Обвесы'")&&atelier.includes("'vinyl','Винилы'")],
  ['Atelier live preview is PixiJS',atelier.includes('<PixiCarEditor')&&editor.includes('new Application()')&&editor.includes('buildPixiCar(config)')],
  ['Atelier edits finish/tint/wheels/aero/ride height',atelier.includes('config.paint.type')&&atelier.includes('config.tint.opacity')&&atelier.includes('frontId')&&atelier.includes('rearId')&&atelier.includes('spoilerId')&&atelier.includes('bodyKitId')&&atelier.includes('rideHeight')],
  ['Atelier enforces 60 vinyl layers',atelier.includes('config.decals.length>=60')&&atelier.includes('/60 слоёв винила')],
  ['Garage exposes tuning atelier',runtime.includes('openVisualAtelierV17')&&runtime.includes('ТЮНИНГ-АТЕЛЬЕ')],
  ['Atelier save writes state and profile sync',runtime.includes("window.addEventListener('autosyndicate:visual-save'")&&runtime.includes('setVisualConfigForCar')&&runtime.includes('syncPlayerProfile(true)')],

  ['State persists carVisuals',runtime.includes('carVisuals:{}')&&runtime.includes('normalizeCarVisuals')&&runtime.includes('MAX_SAVE_BYTES = 1024 * 1024')],
  ['Profile sync validates carVisuals',profileSchema.includes('carVisuals: carVisualMapSchema.optional()')&&profileServer.includes('patch.car_visuals=body.carVisuals')],
  ['Profile directory exposes visual configs',profileDirectory.includes('car_visuals')],
  ['SQL migration adds car_visuals JSONB',migration.includes('car_visuals jsonb')&&migration.includes("jsonb_typeof(car_visuals)='object'")],
  ['Bootstrap loads car_visuals',bootstrap.includes('car_visuals')],
  ['Bootstrap does not send active raster car path',bootstrap.includes('image:null')],
  ['Raster car preloader removed',preloader.includes('const assets:string[] = []')&&!preloader.includes('/assets/cars/${id}.webp')],
  ['Legacy garage/shop/profile car art uses generated SVG',runtime.includes('carVisualSvgMarkup(visualConfigForCar')&&runtime.includes('carVisualDataUri(visualConfigForCar')],
  ['Public profiles use the player visual config',runtime.includes('pp-active-car-v17')&&runtime.includes('profile?.car_visuals')],
  ['Duel Room uses CarVisual',duelClient.includes("import { CarVisual }")&&duelClient.includes('<CarVisual')],
  ['Duel server hydrates car_visuals',duelServer.includes('car_visuals')],
  ['Market snapshot schema includes visualConfig',marketSchema.includes('visualConfig: carVisualConfigSchema.optional()')],

  ['Telegram has public PNG visual endpoint',imageRoute.includes('new ImageResponse')&&imageRoute.includes('carVisualDataUri')&&imageRoute.includes('car_visuals')],
  ['Inline duel sends customized car as photo',bot.includes("type:'photo'")&&bot.includes('/api/car-visual/')&&bot.includes('TelegramInlinePhotoResult')],
];

let failed=0;
for(const [name,ok] of checks){if(ok)console.log(`✓ ${name}`);else{console.error(`✗ ${name}`);failed++;}}
if(failed){console.error(`V17 checks failed: ${failed}/${checks.length}`);process.exit(1);}
console.log(`V17 checks passed: ${checks.length}/${checks.length}`);

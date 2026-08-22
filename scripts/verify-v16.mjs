import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../src/legacy/runtime.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const bot = fs.readFileSync(new URL('../src/features/bot/handler.ts', import.meta.url), 'utf8');
const botTypes = fs.readFileSync(new URL('../src/features/bot/types.ts', import.meta.url), 'utf8');
const telegram = fs.readFileSync(new URL('../src/features/bot/telegram.ts', import.meta.url), 'utf8');
const duelServer = fs.readFileSync(new URL('../src/features/duels/server.ts', import.meta.url), 'utf8');
const duelSchema = fs.readFileSync(new URL('../src/features/duels/schema.ts', import.meta.url), 'utf8');
const duelClient = fs.readFileSync(new URL('../src/components/duels/DuelRoomClient.tsx', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../src/app/api/duels/room/route.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/upgrade-v16-duel-live-progress.sql', import.meta.url), 'utf8');

const checks = [
  ['Garage directional pointer drag', runtime.includes('bindGarageCarouselV16') && runtime.includes("root.addEventListener('pointermove'") && runtime.includes("Math.abs(dx)>Math.abs(dy)*1.08")],
  ['Garage vertical page gesture preserved', css.includes('garage-drag-v16') && css.includes('touch-action:pan-y pinch-zoom!important')],
  ['Garage media cannot steal pointer drag', css.includes('.garage-media-v151 img') && css.includes('pointer-events:none!important') && runtime.includes("root.addEventListener('dragstart'")],
  ['Garage drag disables snap only while dragging', css.includes('.is-dragging-v16{scroll-snap-type:none!important') && runtime.includes("root.classList.add('is-dragging-v16')")],
  ['Garage snaps nearest car after release', runtime.includes('snapGarageV16') && runtime.includes("root.scrollTo({left:Math.max(0,left),behavior:'smooth'})")],

  ['Race uses V16 vector markers', runtime.includes('raceMarkerSvgV16') && runtime.includes('race-marker-svg-v16') && css.includes('.race-marker-svg-v16')],
  ['Race hides V15 raster markers in final layer', css.includes('.race-map.race-cinematic.race-v16 .cine-vehicle-img-v15{display:none!important}')],
  ['Race lanes are participant-aware', runtime.includes('lanePositionsV16') && runtime.includes('if(count===3)return [20,50,80]')],
  ['Race markers use explicit lane variable', runtime.includes("--lane-y-v16") && css.includes('top:var(--lane-y-v16,50%)!important')],
  ['Race telemetry separated from lane area', css.includes('.cine-distance-row-v16') && css.includes('.race-map.race-cinematic.race-v16 .cine-road{bottom:56px!important')],

  ['Chase start delay is fair', runtime.includes("aiStartDelay=(c.chase||c.isPolice)?1.15")],
  ['Chase AI uses gap/inertia', runtime.includes('const gap=Math.max(-40') && runtime.includes('const warmup=clamp((c.elapsed-c.aiStartDelay)/4.2') && runtime.includes('patrolCap')],
  ['Chase catch has minimum race time', runtime.includes('c.elapsed>4.2') && runtime.includes('c.aiDistance>=c.distance-1.5')],
  ['Chase police is visible SVG', runtime.includes("raceMarkerSvgV16((c.chase||c.isPolice)&&i===0?'cop':'rival')")],
  ['Chase live distance label', runtime.includes("'ДПС · '+Math.round(gap)+' м ПОЗАДИ'") && css.includes('.chase-meter-v16')],

  ['Salon vertical overflow no longer clips cards', css.includes('#shop-list.showroom-horizontal-v15') && css.includes('overflow-y:visible!important')],
  ['Salon reserves fixed-nav safe area', css.includes('padding:6px 10vw calc(126px + env(safe-area-inset-bottom))!important')],
  ['Salon cards flex to full content', css.includes('min-height:480px!important') && css.includes('.dealer-price-v15{margin-top:auto!important}')],

  ['Inline requires @opponent format', bot.includes('parseInlineTarget') && bot.includes('Укажи соперника: @username')],
  ['Inline list acts as challenger car selector', bot.includes("cars.slice(0, 20).map") && bot.includes('Telegram\'s inline-results list is the car selector')],
  ['Inline challenge is target-locked', bot.includes('di:a:') && bot.includes("actorUsername.toLowerCase() !== targetUsername.toLowerCase()")],
  ['Inline no-car message matches requested flow', bot.includes('у вас нет авто!') && bot.includes('купить первую машину и принять вызов')],
  ['Inline opponent has actual car buttons', bot.includes('di:p:') && bot.includes('выбери машину для дуэли')],
  ['Inline callbacks edit true inline messages', bot.includes('editInlineCallbackMessage') && botTypes.includes('inline_message_id?: string') && telegram.includes('editTelegramInlineMessage') && telegram.includes('inline_message_id: inlineMessageId')],
  ['Inline creates pretty Race Room card', bot.includes('AUTOSYNDICATE · RACE ROOM') && bot.includes('ОТКРЫТЬ RACE ROOM')],

  ['Live duel schema accepts progress', duelSchema.includes("action: z.literal('progress')") && duelSchema.includes('distance: z.number().min(0).max(5000)')],
  ['Live duel migration stores both players progress', migration.includes('player_a_progress jsonb') && migration.includes('player_b_progress jsonb')],
  ['Live duel server writes progress', duelServer.includes("action.action === 'progress'") && duelServer.includes('player_a_progress: progress')],
  ['Live duel write rate supports realtime polling', route.includes("'duel-room-write',180,60")],
  ['Race submits progress and consumes remote progress', runtime.includes("action:'progress'") && runtime.includes('privateRemoteProgress') && runtime.includes('player_b_progress')],
  ['Private duel is real 402m room', runtime.includes('raceCtx.trackLength=402') && runtime.includes("raceCtx.route='PRIVATE · 402m'")],
  ['Server-confirmed final result replaces local guess', runtime.includes('waitPrivateResultV16') && runtime.includes('Результат подтверждён Race Room')],
  ['Room UI understands live progress', duelClient.includes('DuelProgress') && duelClient.includes('duel-live-progress-v16')],

  ['Taxi is a low-income safety net', runtime.includes('650+p*4.5+Math.sqrt(price)*.34') && runtime.includes('Базовая страховка на случай нулевого баланса')],
  ['Taxi takes longer than V15 farm loop', runtime.includes('Math.max(7,Math.min(17,Math.round(18-p/100)))')],
  ['Race rewards dominate work', runtime.includes('power*105+lvl*3500') && runtime.includes('Math.max(24000')],
  ['Risk work also reduced', runtime.includes('6500+workPowerV15(car)*18')],
  ['Tow passive income reduced', runtime.includes('30000+lvl*2500') && runtime.includes('Math.max(18000')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
}
if (failed) {
  console.error(`V16 checks failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`V16 checks passed: ${checks.length}/${checks.length}`);

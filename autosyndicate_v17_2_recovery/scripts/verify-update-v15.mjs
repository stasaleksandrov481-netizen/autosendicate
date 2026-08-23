import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../src/legacy/runtime.ts', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/legacy/game-shell.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const bankSchema = fs.readFileSync(new URL('../src/features/bank/schema.ts', import.meta.url), 'utf8');

const v15Start = runtime.indexOf('ECONOMY + WORK + UX UPDATE 15');
const v15 = v15Start >= 0 ? runtime.slice(v15Start) : '';
const checks = [
  ['M1 realistic car ladder', runtime.includes('carPrices:{1:60000') && runtime.includes('25:280000000') && runtime.includes('applyEconomyCarPrices(carsDB)')],
  ['M1 race reward rebalance', (runtime.includes('power*54+lvl*1800') || runtime.includes('power*105+lvl*3500')) && runtime.includes('Math.max(2500,Math.round((Number(opp.reward)||0)*0.10))')],
  ['M1 casino uses SYND', runtime.includes('state.coins-=bet; state.stats.casinoWagered+=bet') && v15.includes('Casino is back on Syndicate Coins') && !v15.includes("chipSpend(bet")],
  ['M1 chips are premium', v15.includes('ПРЕМИАЛЬНАЯ ЭКОНОМИКА') && v15.includes('МАГАЗИН ЗА ЧИПЫ') && v15.includes('boss_win')],
  ['M2 ordinary jobs pay SYND', runtime.includes('state.coins=(Number(state.coins)||0)+job.reward') && v15.includes('РЕЗЕРВНЫЙ ЗАРАБОТОК · ТОЛЬКО SYND')],
  ['M2 taxi scales by car', v15.includes('taxiRewardV15') && v15.includes('workPowerV15') && v15.includes('taxiDurationV15') && css.includes('.work-road-v15') && css.includes('.work-car-v15')],
  ['M2 theft risk/reward', v15.includes("type==='theft'") && v15.includes('ДПС ПЕРЕХВАТИЛ') && v15.includes('theftRewardV15')],
  ['M2 tow passive shift', v15.includes('TOW_SHIFT_MS=15*60*1000') && v15.includes('towTruckOwned') && v15.includes('collectTowShiftV15')],
  ['M2 chip contracts separate screen', v15.includes("screen.id='screen-chips'") && v15.includes('Доставка редких деталей') && v15.includes('chipQuestProgressV15')],
  ['M3 mobile tap scale', css.includes('--tap-min:46px') && css.includes('body{font-size:15px}')],
  ['M3 garage vertical gesture preserved', css.includes('touch-action:pan-x pan-y pinch-zoom!important') && !runtime.includes('if(horizontal)e.preventDefault()') && css.includes('78vw')],
  ['M3 profile cleanup/menu', shell.includes('id="screen-more"') && shell.includes('Чаты') && shell.includes('Кланы') && shell.includes('Кейсы') && shell.includes('data-tab="more"') && v15.includes('moveProfileExtrasV15')],
  ['M3 wanted SVG', v15.includes('wanted-icon-v15') && v15.includes('<svg class="wanted-icon-v15"')],
  ['M3 horizontal dealership', v15.includes("showroom-horizontal-v15") && css.includes('scroll-snap-type:x mandatory') && css.includes('.dealer-card-v15')],
  ['M4 race cars visible', v15.includes('cine-vehicle-img-v15') && css.includes('.cine-car[data-rival="0"]{bottom:58px') && css.includes('.cine-car[data-rival="1"]{bottom:8px') && css.includes('visibility:visible!important')],
  ['M4 case immediate reward', runtime.includes('// Grant prize immediately after server confirms') && runtime.includes('grantServerCasePrize(prize,cs,rollId);') && v15.includes('Case opening watchdog')],
  ['M4 no fake chat ticker', !runtime.includes("Math.random()<.08&&!document.getElementById('screen-chat')") && v15.includes('Remove fake unread notifications')],
  ['M4 varied AI list/race consistency', v15.includes('v15DisplayName') && v15.includes('v15VisualCarId') && v15.includes('usedNames') && v15.includes('usedCars')],
  ['M4 race render cleanup/contain', runtime.includes('cleanupRaceRuntimeV127') && css.includes('contain:layout paint style')],
  ['Audit zero balance stays zero', runtime.includes('Number(serverPlayer.balance ?? 1500)')],
  ['Audit bank validator follows economy', bankSchema.includes('.max(250000)') && runtime.includes('BANK_MAX_PER_TRANSFER = 250000')],
  ['iOS safe area retained', css.includes('env(safe-area-inset-bottom)')],
  ['Shell casino labels SYND', shell.includes('Ставка: только Синдикат коины') || shell.includes('Синдикат коинах')],
  ['No casino chip wagering copy', !shell.includes('Ставка: Чипы') && !v15.includes('ставки на Чип')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
}
if (failed) {
  console.error(`Update v15 checks failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`Update v15 checks passed: ${checks.length}/${checks.length}`);

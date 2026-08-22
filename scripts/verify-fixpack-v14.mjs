import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../src/legacy/runtime.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const clanSchema = fs.readFileSync(new URL('../src/features/clans/schema.ts', import.meta.url), 'utf8');
const clanServer = fs.readFileSync(new URL('../src/features/clans/server.ts', import.meta.url), 'utf8');
const profileSchema = fs.readFileSync(new URL('../src/features/profile/schema.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/upgrade-v14-clan-visibility.sql', import.meta.url), 'utf8');

const checks = [
  ['P0.1 garage snap carousel', css.includes('scroll-snap-type:x mandatory') && css.includes('is-centered-v14') && runtime.includes('bindGarageCarouselV14') && runtime.includes("touchmove")],
  ['P0.2 showroom grid', css.includes('.showroom-grid-v14') && css.includes('grid-template-columns:repeat(2,1fr)') && runtime.includes("root.className='list-container showroom-grid-v14'")],
  ['P0.3 duel image contain', css.includes('.duel-car-v127 img') && css.includes('object-fit:contain!important') && css.includes('max-height:120px!important')],
  ['P1.4 DPS chase mechanics', runtime.includes('simulateChaseAiV14') && runtime.includes('c.trackLength=1500') && runtime.includes('c.distance=80') && runtime.includes('c.aiDistance>=c.distance')],
  ['P1.5 chase result/reward', runtime.includes('ШТРАФ: −') && runtime.includes('ПОБЕГ УДАЛСЯ') && runtime.includes('БЕЗ НАГРАДЫ')],
  ['P1.6 power physics/catch-up', runtime.includes('rawPower*.20') && runtime.includes('hp/300') && runtime.includes("stateText='ДОГОНЯЮ'")],
  ['P1.7 wanted gameplay effects', runtime.includes('wantedMultV14') && runtime.includes('Math.random()<.30') && runtime.includes('Math.random()<.50') && runtime.includes('WANTED_DECAY_MS=30*60*1000')],
  ['P1.8 license plates in previews', runtime.includes('plateVisualForCar') && runtime.includes('plateBadgeV14') && runtime.includes('БЕЗ НОМЕРА')],
  ['P1.9 selected button feedback', runtime.includes("btn.textContent='ВЫБРАНА ✓'") && runtime.includes('state.activeCarId=carId')],
  ['P2.10 open/invite clans', clanSchema.includes("z.literal('joinOpen')") && clanSchema.includes("z.literal('visibility')") && clanServer.includes(".eq('is_open', true)") && migration.includes('is_open boolean')],
  ['P3.11 independent race lanes', css.includes('.cine-car[data-rival="0"]') && css.includes('.cine-car[data-rival="1"]') && css.includes('.cine-car[data-rival="2"]')],
  ['P3.12 wanted profile info', runtime.includes('openWantedInfoV14') && runtime.includes('СНИЗИТЬ РОЗЫСК') && profileSchema.includes('wantedLevel') && migration.includes('wanted_level')],
  ['Currency split', runtime.includes('Поставлено</span><b>\'+fmt(wagered)+\' CHIPS') && runtime.includes("job_'+job.id") && runtime.includes('ЧИПОВ')],
  ['iOS safe area', css.includes('env(safe-area-inset-bottom)')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else { console.error(`✗ ${name}`); failed++; }
}
if (failed) {
  console.error(`Fixpack v14 checks failed: ${failed}`);
  process.exit(1);
}
console.log(`Fixpack v14 checks passed: ${checks.length}`);

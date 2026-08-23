import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const runtime=read('src/legacy/runtime.ts');
const principal=read('src/features/auth/principal.ts');
const bootstrap=read('src/app/api/game/bootstrap/route.ts');
const bot=read('src/features/bot/handler.ts');
const sql=read('supabase/schema_v12_8_FIX.sql');
const full=read('supabase/schema_v12_8_FULL.sql');
const css=read('src/app/globals.css');
const checks=[
 ['package version 12.8', JSON.parse(read('package.json')).version==='12.8.0'],
 ['per-player save key', runtime.includes("autosyndicate_save_v12_7") && runtime.includes('`${SAVE_KEY_BASE}:${id}`')],
 ['shared orphan save is not claimed', runtime.includes('if(playerId && owner!==playerId)continue')],
 ['server starter reconciliation', runtime.includes('serverPlayer=bootstrap.player') && runtime.includes('localIsFresh')],
 ['principal starter state', principal.includes('needsStarterRepair') && principal.includes('owned_cars: [1]') && principal.includes('balance: Math.max(1500')],
 ['bootstrap includes player state', bootstrap.includes("select('id,name,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,rating,best_0_100')")],
 ['duel plain words', ['дуэль','поединок','гонка','заезд'].every(x=>bot.includes(x))],
 ['duel slash fallback', bot.includes("parsed.command === 'duel'")],
 ['bank stores both UIDs', sql.includes('sender_uid,sender_id,sender_name,receiver_uid,receiver_id,amount,claimed')],
 ['bank claim timestamp', sql.includes('set claimed=true,claimed_at=now()')],
 ['referral rewards update profile', sql.includes('set balance=balance+total,total_earned=total_earned+total')],
 ['starter repair SQL', sql.includes("cardinality(coalesce(owned_cars,'{}'::integer[]))=0")],
 ['webp production catalogue', sql.includes('id not between 1 and 25')],
 ['full schema single transaction', full.split(/\r?\n/).filter(x=>x.trim().toLowerCase()==='begin;').length===1 && full.split(/\r?\n/).filter(x=>x.trim().toLowerCase()==='commit;').length===1],
 ['race dynamic viewport', css.includes('body.race-mode #race-content') && css.includes('100dvh')],
 ['duel grid compact', css.includes('duel-card-v127') && css.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important')],
 ['all 25 car images exist', Array.from({length:25},(_,i)=>fs.existsSync(`public/assets/cars/${i+1}.webp`)).every(Boolean)],
 ['all 25 thumbs exist', Array.from({length:25},(_,i)=>fs.existsSync(`public/assets/cars/thumb/${i+1}.webp`)).every(Boolean)]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'}  ${name}`);if(!ok)failed++;}
if(failed)process.exitCode=1;else console.log('AutoSyndicate v12.8 final stability verification passed.');

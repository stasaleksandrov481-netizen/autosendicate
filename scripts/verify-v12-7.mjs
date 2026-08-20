import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const runtime=read('src/legacy/runtime.ts');
const css=read('src/app/globals.css');
const sql=read('supabase/schema_v12_7_FIX.sql');
const refs=read('src/features/social/referrals.ts');
const bank=read('src/features/bank/server.ts');
const checks=[
 ['catalog has no runtime id 26/27',!runtime.includes('{ id:26')&&!runtime.includes('{ id:27')],
 ['production car filter exists',runtime.includes('function realCarCatalog()')],
 ['local duel fallback is large',(runtime.match(/id:'street_/g)||[]).length>=25],
 ['duel uses actual car thumbnails',runtime.includes('carThumb(rivalCar)')],
 ['per-route server backoff',runtime.includes('serverBackoffByRoute=new Map')],
 ['referral auto-claim removed',!runtime.includes('await refreshReferralDashboard();await claimReferralRewards();')],
 ['unified duel grid',css.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important')],
 ['dynamic race viewport',css.includes('body.race-mode #race-content')&&css.includes('100dvh')],
 ['low-fx race fallback',css.includes('.race-low-fx .speed-effects')],
 ['v12.7 catalog SQL',sql.includes('id not between 1 and 25')],
 ['v12.7 referral RPC',sql.includes('autosyndicate_server_bind_referrer_v12_7')],
 ['v12.7 bank RPC',sql.includes('autosyndicate_server_bank_send_v12_7')],
 ['no psql include',!sql.includes('\\i ')],
 ['TS referral RPC target',refs.includes('autosyndicate_server_claim_referrals_v12_7')],
 ['TS bank RPC target',bank.includes('autosyndicate_server_bank_claim_v12_7')],
 ['25 thumbs exist',Array.from({length:25},(_,i)=>fs.existsSync(`public/assets/cars/thumb/${i+1}.webp`)).every(Boolean)]
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'OK':'FAIL'}  ${name}`);
if(failed.length){process.exitCode=1}else console.log('AutoSyndicate v12.7 global verification passed.');

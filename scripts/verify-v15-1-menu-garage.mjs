import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../src/legacy/runtime.ts', import.meta.url), 'utf8');
const shell = fs.readFileSync(new URL('../src/legacy/game-shell.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

const checks = [
  ['Bottom navigation exposes Menu', shell.includes("switchTab('more')") && shell.includes('data-tab="more"') && shell.includes('>Меню</div>')],
  ['Menu screen is permanent', shell.includes('id="screen-more"') && shell.includes('id="more-grid-v15"')],
  ['Menu exposes chat/clans/cases', shell.includes("switchTab('chat')") && shell.includes("switchTab('clans')") && shell.includes("switchTab('cases')")],
  ['Menu exposes friends/market/rating', shell.includes("switchTab('friends')") && shell.includes("switchTab('market')") && shell.includes("switchTab('leaderboard')")],
  ['Menu exposes bank/referrals/settings', shell.includes("switchTab('bank')") && shell.includes("switchTab('referrals')") && shell.includes("switchTab('settings')")],
  ['Menu exposes chips and profile', shell.includes("switchTab('chips')") && shell.includes('more-profile-btn-v151') && shell.includes("switchTab('profile')")],
  ['Tab map selects Menu as fifth item', runtime.includes("const TAB_MAP = {garage:0,shop:1,'duel-select':2,casino:3,more:4};")],
  ['Profile keeps career and hides service clutter', runtime.includes("new Set(['Районы','Контракты','Подработка','Достижения','Награда дня','Меню'])") && runtime.includes('moveProfileExtrasV15')],
  ['Service screens return to Menu', runtime.includes('normalizeMenuBackLinksV151') && runtime.includes("back.textContent='← Меню'")],
  ['Chat badge targets visible Menu card', runtime.includes("document.getElementById('menu-chat-v151')")],
  ['Garage markup reordered around carousel', shell.includes('garage-screen-v151') && shell.indexOf('garage-stage-v151') < shell.indexOf('garage-service-v151')],
  ['Garage card has compact spec grid', runtime.includes('garage-spec-grid-v151') && runtime.includes('ТОПЛИВО') && runtime.includes('СОСТОЯНИЕ')],
  ['Garage service is compact dock', runtime.includes('garage-service-dock-v151') && css.includes('.garage-service-grid-v151')],
  ['Garage side cars remain visible', css.includes('flex:0 0 min(78vw,390px)!important') && css.includes('padding:4px 11vw 16px!important')],
  ['Garage vertical swipe is not trapped', css.includes('touch-action:pan-x pan-y pinch-zoom!important') && !runtime.includes('if(horizontal)e.preventDefault()')],
  ['Garage centered card is visually primary', css.includes('.garage-card-v151.is-centered-v14') && css.includes('border-color:#edf1f5!important')],
  ['Garage action hierarchy is explicit', runtime.includes('garage-primary-v151') && runtime.includes('garage-secondary-actions-v151')],
  ['Garage image uses contain', css.includes('#garage-list .garage-media-v151 .car-real-image') && css.includes('object-fit:contain!important')],
];
let failed=0;
for (const [name,ok] of checks){ if(ok) console.log(`✓ ${name}`); else {console.error(`✗ ${name}`);failed++;}}
if(failed){console.error(`V15.1 checks failed: ${failed}/${checks.length}`);process.exit(1);}
console.log(`V15.1 checks passed: ${checks.length}/${checks.length}`);

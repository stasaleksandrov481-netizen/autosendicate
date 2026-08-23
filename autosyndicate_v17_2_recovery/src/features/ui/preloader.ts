export function startPreloader() {
  // Only critical early-garage art is preloaded. The remaining WebP cars stay native-lazy.
  const assets = [1,2,3,4,5].map((id)=>`/assets/cars/${id}.webp`);
  const tips = [
    'Идеальное переключение сохраняет тягу и сокращает разрыв.',
    'Настраивай КПП под дистанцию, а не только под максимальную скорость.',
    'Сильная машина без зацепа теряет время уже на старте.',
    'В дуэлях подбирай соперника под текущую сборку.'
  ];
  let done=0,finished=false; const total=assets.length+1;
  const bar=document.getElementById('pl-bar'),pct=document.getElementById('pl-percent'),sub=document.getElementById('pl-sub'),tip=document.getElementById('pl-tip');
  const paint=(label?:string)=>{const value=Math.min(100,Math.round((done/total)*100));if(bar)bar.style.width=`${value}%`;if(pct)pct.textContent=`${value}%`;if(sub&&label)sub.textContent=label;};
  const finish=()=>{if(finished)return;finished=true;paint('Готово');window.setTimeout(()=>{const el=document.getElementById('preloader');el?.classList.add('hide');window.setTimeout(()=>el?.remove(),260);},70);};
  const step=()=>{done+=1;paint('Подготовка гаража');if(done>=total)finish();};
  assets.forEach((src)=>{const img=new Image();img.onload=step;img.onerror=step;img.decoding='async';img.src=src;});
  let index=0;const timer=window.setInterval(()=>{index=(index+1)%tips.length;if(tip)tip.textContent=tips[index];},1200);step();
  window.setTimeout(()=>{window.clearInterval(timer);finish();},2600);
  return ()=>window.clearInterval(timer);
}

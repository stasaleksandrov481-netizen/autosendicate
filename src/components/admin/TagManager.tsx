'use client';
import {useEffect,useState} from 'react';

export function TagManager(){
 const [tags,setTags]=useState<any[]>([]);
 const [form,setForm]=useState({key:'custom_tag',label:'Новый тег',emoji:'✦',background:'#2563eb',foreground:'#ffffff',border_color:'#60a5fa',glow:false});
 async function load(){const r=await fetch('/api/admin/tags'); const j=await r.json(); setTags(j.tags||[])}
 useEffect(()=>{load()},[]);
 async function save(){await fetch('/api/admin/tags',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)});load()}
 return <div className="admin-panel">
  <h2>Конструктор тегов</h2>
  <div className="admin-form-row">{Object.keys(form).filter(k=>k!=='glow').map(k=><input key={k} value={(form as any)[k]} placeholder={k} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}
  <label><input type="checkbox" checked={form.glow} onChange={e=>setForm({...form,glow:e.target.checked})}/> Glow</label>
  <button className="admin-primary" onClick={save}>Сохранить</button></div>
  <div className="admin-mini-list">{tags.map(t=><div key={t.key}><span style={{background:t.background,color:t.foreground,border:`1px solid ${t.border_color}`,borderRadius:999,padding:'5px 10px',boxShadow:t.glow?'0 0 12px #ec4899':'none'}}>{t.emoji} {t.label}</span><small>{t.key}</small></div>)}</div>
 </div>
}

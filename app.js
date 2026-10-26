'use strict';
const $ = id => document.getElementById(id);
const KEY = 'karman-notes-v1';
let notes = [], editing = null, saveTimer, toastTimer, storageOK = true, corruptStorage = false, storageError = false;
const requiredFiles = ['./','./style.css','./app.js','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,4500); }
function validNotes(value) { return Array.isArray(value) && value.length<=10000 && value.every(n=>n && typeof n.id==='string' && n.id.length<200 && typeof n.title==='string' && n.title.length<=160 && typeof n.body==='string' && n.body.length<=100000 && typeof n.updated==='string' && Number.isFinite(Date.parse(n.updated))); }
try {
  const raw=localStorage.getItem(KEY);
  if(raw!==null) { const value=JSON.parse(raw); if(!validNotes(value)) throw new Error('Invalid saved data'); notes=value; }
  localStorage.setItem('karman-storage-check','1'); localStorage.removeItem('karman-storage-check');
} catch(error) { storageOK=false; corruptStorage=true; toast('Не удалось прочитать хранилище. Существующие данные не перезаписаны.'); }
function persist() {
  if(corruptStorage) return false;
  try { localStorage.setItem(KEY,JSON.stringify(notes)); storageOK=true; return true; }
  catch { storageOK=false; toast('Не удалось сохранить. Скачай резервную копию в разделе «Об этом».'); return false; }
}
function renderNotes() {
  const query=$('search').value.trim().toLocaleLowerCase('ru');
  const visible=notes.filter(n=>(n.title+' '+n.body).toLocaleLowerCase('ru').includes(query)).sort((a,b)=>Date.parse(b.updated)-Date.parse(a.updated));
  $('note-count').textContent=notes.length; $('note-list').replaceChildren();
  $('empty').hidden=notes.length!==0; $('no-results').hidden=!notes.length || visible.length!==0;
  for(const note of visible) {
    const button=document.createElement('button'); button.type='button'; button.className='note-card';
    const title=document.createElement('h3'); title.textContent=note.title.trim() || 'Без названия';
    const body=document.createElement('p'); body.textContent=note.body || 'Пока без текста';
    const foot=document.createElement('div'); foot.className='note-card-foot';
    const time=document.createElement('time'); time.dateTime=note.updated; time.textContent=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(note.updated));
    foot.append(time); button.append(title,body,foot); button.addEventListener('click',()=>openEditor(note)); $('note-list').append(button);
  }
}
function openEditor(note) {
  editing=note ? {...note} : {id:crypto.randomUUID(),title:'',body:'',updated:new Date().toISOString()};
  storageError=false; $('note-title').value=editing.title; $('note-body').value=editing.body; $('delete-confirm').hidden=true;
  $('delete-note').hidden=!note; $('save-status').textContent=note?'Сохранено на устройстве':'Новая мысль'; $('save-status').classList.remove('error');
  $('char-count').textContent=`${editing.body.length} символов`; $('editor').showModal();
}
function saveEditor() {
  clearTimeout(saveTimer); if(!editing) return true;
  const title=$('note-title').value, body=$('note-body').value;
  const existing=notes.find(n=>n.id===editing.id);
  if(!existing && !title.trim() && !body.trim()) return true;
  if(existing && existing.title===title && existing.body===body && !storageError) return true;
  editing={...editing,title,body,updated:new Date().toISOString()};
  const index=notes.findIndex(n=>n.id===editing.id);
  if(index<0) notes.push({...editing}); else notes[index]={...editing};
  const ok=persist(); storageError=!ok;
  $('save-status').textContent=ok?'Сохранено на устройстве':'Не сохранено — нет доступа к памяти'; $('save-status').classList.toggle('error',!ok); $('delete-note').hidden=false;
  renderNotes(); return ok;
}
function closeEditor() { if(!saveEditor()) { toast('Сохранить не удалось. Текст остаётся в редакторе — скопируй его.'); return; } $('editor').close(); editing=null; }
function queueSave() { $('char-count').textContent=`${$('note-body').value.length} символов`; $('save-status').textContent='Сохраняем…'; clearTimeout(saveTimer); saveTimer=setTimeout(saveEditor,250); }
$('note-title').addEventListener('input',queueSave); $('note-body').addEventListener('input',queueSave);
$('close-editor').addEventListener('click',closeEditor); $('editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
$('editor-form').addEventListener('submit',event=>event.preventDefault());
for(const id of ['add-note','first-note']) $(id).addEventListener('click',()=>openEditor());
$('delete-note').addEventListener('click',()=>{$('delete-confirm').hidden=false;});
$('cancel-delete').addEventListener('click',()=>{$('delete-confirm').hidden=true;});
$('confirm-delete').addEventListener('click',()=>{
  clearTimeout(saveTimer); const previous=notes; notes=notes.filter(n=>n.id!==editing.id);
  if(!persist()) { notes=previous; return; }
  $('editor').close(); editing=null; renderNotes(); toast('Заметка удалена');
});
$('search').addEventListener('input',renderNotes);
function navigate() {
  const page=['notes','test','about'].includes(location.hash.slice(1))?location.hash.slice(1):'notes';
  for(const item of ['notes','test','about']) $(item+'-page').hidden=item!==page;
  document.querySelectorAll('[data-page]').forEach(link=>{const active=link.dataset.page===page;link.classList.toggle('active',active);if(active) link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  window.scrollTo(0,0); if(page==='test') checkOffline();
}
window.addEventListener('hashchange',navigate); $('offline-card').addEventListener('click',()=>{location.hash='test';});
function updateDeviceStatus() {
  $('network-state').textContent=navigator.onLine?'Есть подключение':'Без подключения';
  $('display-state').textContent=(matchMedia('(display-mode: standalone)').matches || navigator.standalone)?'С иконки · приложение':'В браузере';
  $('storage-state').textContent=storageOK?'На устройстве':'Ошибка доступа';
}
async function checkOffline() {
  updateDeviceStatus(); let ready=false;
  try {
    const cache=await caches.open('karman-shell-v2');
    const responses=await Promise.all(requiredFiles.map(path=>cache.match(new URL(path,location.href))));
    ready=Boolean(navigator.serviceWorker?.controller) && responses.every(Boolean);
  } catch { /* Initial setup or storage not available. */ }
  $('cache-state').textContent=ready?'Файлы готовы':'Ещё не готовы';
  $('offline-title').textContent=ready?'Готов к жизни без сети':'Офлайн-запуск пока не готов';
  $('offline-subtitle').textContent=ready?'Файлы приложения сохранены здесь':'Нужна успешная загрузка всех файлов';
  return ready;
}
$('check-offline').addEventListener('click',async()=>{const ok=await checkOffline();toast(ok?'Файлы на месте. Теперь проверь запуск в авиарежиме.':'Проверь интернет и открой приложение ещё раз.');});
window.addEventListener('online',updateDeviceStatus);window.addEventListener('offline',updateDeviceStatus);
document.addEventListener('visibilitychange',()=>{if(document.hidden) saveEditor();else updateDeviceStatus();});
window.addEventListener('pagehide',saveEditor);
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({app:'karman',version:1,exportedAt:new Date().toISOString(),notes},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download='karman-notes-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
});
$('import').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('Too large');
    const data=JSON.parse(await file.text());if(data.app!=='karman'||data.version!==1||!validNotes(data.notes))throw new Error('Invalid file');
    if(corruptStorage)throw new Error('Storage unreadable');
    const previous=notes;const map=new Map(notes.map(note=>[note.id,note]));let count=0;
    for(const note of data.notes) {const current=map.get(note.id);if(!current||Date.parse(note.updated)>Date.parse(current.updated)){map.set(note.id,{id:note.id,title:note.title,body:note.body,updated:note.updated});count++;}}
    if(map.size>10000)throw new Error('Too many notes');
    notes=[...map.values()];if(!persist()){notes=previous;return;}renderNotes();toast(`Восстановлено заметок: ${count}`);
  }catch{toast('Не удалось восстановить. Нужен файл резервной копии «Кармана» и доступное хранилище.');}
  finally{event.target.value='';}
});
renderNotes();navigate();updateDeviceStatus();
if('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange',checkOffline);
  navigator.serviceWorker.register('./sw.js').then(async registration=>{
    if(registration.installing) registration.installing.addEventListener('statechange',checkOffline);
    await navigator.serviceWorker.ready;await checkOffline();
  }).catch(()=>{checkOffline();toast('Офлайн-файлы не загрузились. Пока не отключай интернет.');});
} else { checkOffline(); }

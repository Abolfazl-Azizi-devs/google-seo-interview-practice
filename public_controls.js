function syncQuestionLink(){
 const q=pool[index];
 const next=location.pathname+location.search+(q?'#q'+q.id:'');
 if(location.pathname+location.search+location.hash!==next)history.replaceState(null,'',next);
}
function openLinkedQuestion(){
 const match=location.hash.match(/^#q(\d+)$/);if(!match)return;
 const id=Number(match[1]);if(!DATA.questions.some(q=>q.id===id))return;
 if(view!=='practice')setView('practice');
 if(!pool.some(q=>q.id===id))clearFilters();
 index=pool.findIndex(q=>q.id===id);renderCard();
}
window.addEventListener('hashchange',openLinkedQuestion);
window.addEventListener('popstate',openLinkedQuestion);
$('copy-question').onclick=async()=>{
 syncQuestionLink();
 try{await navigator.clipboard.writeText(location.href);$('copy-status').textContent='Link copied';}
 catch(e){$('copy-status').textContent='Copy the link from your address bar';}
 setTimeout(()=>{$('copy-status').textContent='';},4000);
};
let mobileFiltersOpen=false;
const mobileMedia=matchMedia('(max-width:780px)');
function updateFilterPanel(){
 const open=!mobileMedia.matches||mobileFiltersOpen;
 $('filter-fields').hidden=!open;
 $('filter-toggle').setAttribute('aria-expanded',String(open));
}
$('filter-toggle').onclick=()=>{mobileFiltersOpen=!mobileFiltersOpen;updateFilterPanel();};
mobileMedia.addEventListener('change',()=>{updateFilterPanel();if(!mobileMedia.matches)closeDocumentMenu();});
updateFilterPanel();
const backdrop=document.createElement('button');
backdrop.className='sidebar-backdrop';backdrop.type='button';backdrop.hidden=true;
backdrop.setAttribute('aria-label','Close document menu');document.body.append(backdrop);
const closeButton=document.createElement('button');closeButton.id='close-document-menu';closeButton.className='menu-close';closeButton.textContent='Close ×';
$('sidebar').prepend(closeButton);
function closeDocumentMenu(){
 const wasOpen=$('sidebar').classList.contains('open');
 $('sidebar').classList.remove('open');backdrop.hidden=true;
 $('menu-toggle').setAttribute('aria-expanded','false');
 document.querySelector('.main').inert=false;
 if(wasOpen&&mobileMedia.matches)$('menu-toggle').focus({preventScroll:true});
}
function openDocumentMenu(){
 $('sidebar').classList.add('open');backdrop.hidden=false;
 $('menu-toggle').setAttribute('aria-expanded','true');
 document.querySelector('.main').inert=true;closeButton.focus();
}
$('menu-toggle').onclick=()=>{$('sidebar').classList.contains('open')?closeDocumentMenu():openDocumentMenu();};
closeButton.onclick=closeDocumentMenu;backdrop.onclick=closeDocumentMenu;
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){closeDocumentMenu();return;}
 if(e.key==='Tab'&&$('sidebar').classList.contains('open')&&mobileMedia.matches){
  const focusable=[...$('sidebar').querySelectorAll('a,button,input,select')].filter(el=>!el.disabled&&el.offsetParent!==null);
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
 const tab=e.target.closest('[data-view]');
 if(tab&&['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
  e.preventDefault();const tabs=[...document.querySelectorAll('.tabs [data-view]')];
  const current=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();setView(tabs[next].dataset.view);
 }
});
document.querySelectorAll('[data-open-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.openView);window.scrollTo({top:0,behavior:'smooth'});});
updateFilterUI();
window.studyInitialized=true;

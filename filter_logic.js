const searchIndex=new Map(DATA.questions.map(q=>{
 const c=getChapter(q.chapter),question=q.question.toLowerCase(),answer=q.answer.toLowerCase();
 const evidence=q.evidence.map(e=>e.quote).join(' ').toLowerCase();
 return [q.key,{question,qa:question+' '+answer,evidence,all:[question,answer,evidence,c.title].join(' ').toLowerCase()}];
}));
function groupLabel(group){return group.replace(/^Crawl · /,'Crawling: ').replace(/^Appearance · /,'Appearance: ');}
function rebuildPool(keep=true){
 const current=pool[index]?.id,term=$('search').value.trim().toLowerCase();
 const scope=$('search-scope').value,group=$('group-filter').value,status=$('status-filter').value,set=$('set-filter').value;
 const words=term.split(/\s+/).filter(Boolean);
 pool=DATA.questions.filter(q=>{
  const c=getChapter(q.chapter),text=searchIndex.get(q.key)[scope];
  const unseen=document.body.dataset.mode==='quiz'?!responses[q.key]:!marks[q.key];
  return (!chapter||q.chapter===chapter)&&(!group||c.group===group)
   &&(set==='all'||(set==='priority'?q.priority:set==='scenarios'?q.scenario:q.additional))
   &&(status==='all'||(status==='unseen'?unseen:marks[q.key]===status))
   &&words.every(word=>text.includes(word));
 });
 if(order){const rank=new Map(order.map((id,i)=>[id,i]));pool.sort((a,b)=>(rank.get(a.id)??a.id+669)-(rank.get(b.id)??b.id+669));}
 index=keep?Math.max(0,pool.findIndex(q=>q.id===current)):0;
 renderCard();updateFilterUI();
}
function updateDocumentOptions(){
 const group=$('group-filter').value,chapters=DATA.chapters.filter(c=>!group||c.group===group);
 const selected=chapter;
 $('document-filter').innerHTML='<option value="0">'+(group?'All documents in this group':'All 95 documents')+'</option>'+
  chapters.map(c=>'<option value="'+c.id+'">'+String(c.id).padStart(2,'0')+' · '+esc(c.short)+'</option>').join('');
 if(!chapters.some(c=>c.id===selected))chapter=0;
 $('document-filter').value=String(chapter);
}
function updateFilterUI(){
 const term=$('search').value.trim(),scope=$('search-scope').value,group=$('group-filter').value,status=$('status-filter').value,set=$('set-filter').value;
 const help={qa:'Searches question and answer text.',question:'Searches question text only.',evidence:'Searches the quoted Google excerpts.',all:'Searches questions, answers, excerpts and document names.'};
 $('search-help').textContent=help[scope]+' All search terms must match. Filters work together.';
 $('search-clear').hidden=!term;
 const chips=[];
 if(term)chips.push({field:'search',label:'Search: '+term});
 if(group)chips.push({field:'group',label:'Group: '+groupLabel(group)});
 if(chapter)chips.push({field:'document',label:'Document: '+getChapter(chapter).short});
 if(status!=='all')chips.push({field:'status',label:'Progress: '+$('status-filter').selectedOptions[0].textContent});
 if(set!=='all')chips.push({field:'set',label:'Set: '+$('set-filter').selectedOptions[0].textContent});
 $('active-filters').innerHTML=chips.length?chips.map(c=>'<button class="filter-chip" data-clear-filter="'+c.field+'" aria-label="Remove '+esc(c.label)+'">'+esc(c.label)+' <span aria-hidden="true">×</span></button>').join(''):'<span class="no-filters">Showing all questions · no filters selected</span>';
 const count=chips.filter(c=>c.field!=='search').length;
 $('filter-count').textContent=count+' active';
 $('match-count').textContent=pool.length+' of 669 questions';
 $('document-filter').value=String(chapter);
 $('copy-question').disabled=!pool.length;
 document.querySelectorAll('[data-clear-filter]').forEach(b=>b.onclick=()=>{
  const field=b.dataset.clearFilter;
  if(field==='search')$('search').value='';
  if(field==='group'){$('group-filter').value='';updateDocumentOptions();}
  if(field==='document')chapter=0;
  if(field==='status')$('status-filter').value='all';
  if(field==='set')$('set-filter').value='all';
  activeSidebar();rebuildPool(false);
 });
}

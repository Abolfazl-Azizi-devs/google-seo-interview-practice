
'use strict';
const DATA=window.SEOStudyData;
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='seo-public-quiz-v1';
let marks={},responses={};
try{
 const v=JSON.parse(localStorage.getItem(KEY)||'{}');
 if(v&&typeof v==='object'&&!Array.isArray(v)){
  if(v.marks&&typeof v.marks==='object'&&!Array.isArray(v.marks))marks=v.marks;
  if(v.responses&&typeof v.responses==='object'&&!Array.isArray(v.responses)){
   for(const q of DATA.questions){
    const r=v.responses[q.key];
    if(r&&q.options.some(o=>o.id===r.selected)&&typeof r.firstCorrect==='boolean')
     responses[q.key]={selected:r.selected,correct:r.selected===q.correctOptionId,firstCorrect:r.firstCorrect};
   }
  }
 }
}catch(e){$('storage-notice').style.display='block';}
let view='practice',chapter=0,source=1,pool=[],index=0,order=null,revealed=false,timer=null,seconds=60,searchTimeout,retryKey=null;
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify({marks,responses}));}catch(e){$('storage-notice').style.display='block';}
 updateProgress();
}
function updateProgress(){
 const valid=DATA.questions.map(q=>marks[q.key]);
 const know=valid.filter(v=>v==='know').length,review=valid.filter(v=>v==='review').length;
 $('confident-count').textContent=know;
 $('progress-fill').style.width=(know/DATA.questions.length*100)+'%';
 $('queue-count').textContent=review+' questions in your review queue';
 const answered=Object.keys(responses).length,correct=Object.values(responses).filter(r=>r.firstCorrect).length;
 $('quiz-score').textContent=correct+' / '+answered+' correct';
 $('quiz-rate').textContent=answered?Math.round(correct/answered*100)+'% · first choices':'Choose your first answer';
 $('quiz-answered').textContent=answered+' of '+DATA.questions.length+' answered';
}

function getChapter(n){return DATA.chapters.find(c=>c.id===n);}
function quoteHtml(e){const label=(e.source<=95?'Google D'+String(e.source).padStart(2,'0'):'Google S'+(e.source-95))+' · '+e.section;return '<div class="evidence"><div class="eyebrow">DOCUMENT EVIDENCE'+(e.clipped?' · EXACT EXCERPT':'')+'</div><blockquote>“'+esc(e.quote)+'”</blockquote><div class="citations"><a href="'+esc(e.url)+'" target="_blank" rel="noopener">'+esc(label)+'</a><button data-source="'+e.source+'" data-anchor="'+esc(e.anchor)+'">Open this section in the source library ↗</button></div></div>';}
function bindSourceButtons(root){root.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>openSource(+b.dataset.source,b.dataset.anchor||'')));}
function activeSidebar(){document.querySelectorAll('.topic[data-chapter]').forEach(b=>b.classList.toggle('active',+b.dataset.chapter===chapter));}
function stopTimer(){if(timer)clearInterval(timer);timer=null;}
function timerText(){return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
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

function renderCard(){
 queueMicrotask(syncQuestionLink);
 stopTimer();seconds=60;revealed=false;
 updateFilterUI();
 if(!pool.length){
  $('practice-content').innerHTML='<div class="empty"><div class="eyebrow">NO MATCHING QUESTIONS</div><h3>Try a broader selection.</h3><p class="muted">Clear the search or choose another topic or practice status.</p><button class="primary" id="empty-clear">Clear filters</button></div>';
  $('empty-clear').onclick=clearFilters;return;
 }
 index=Math.min(index,pool.length-1);
 const q=pool[index],c=getChapter(q.chapter),mark=marks[q.key],record=responses[q.key];
 const selected=retryKey===q.key?null:record;
 const letters=['A','B','C','D'];
 const correctIndex=q.options.findIndex(o=>o.correct);
 const options=q.options.map((o,i)=>{
  let state='',badge='';
  if(selected){
   if(o.correct){state=' correct-option';badge=selected.selected===o.id?'✓ Your answer · correct':'✓ Correct answer';}
   else if(selected.selected===o.id){state=' wrong-option';badge='× Your answer · incorrect';}
  }
  return '<button class="quiz-option'+state+'" data-option="'+esc(o.id)+'" '+(selected?'disabled':'')+' aria-pressed="'+Boolean(selected&&selected.selected===o.id)+'"><span class="option-letter">'+letters[i]+'</span><span class="option-copy">'+esc(o.text)+(badge?'<span class="option-badge">'+badge+'</span>':'')+'</span></button>';
 }).join('');
 const feedback=selected?'<div class="quiz-feedback '+(selected.correct?'is-correct':'is-wrong')+'" role="status">'+(selected.correct?'✓ Correct.':'× That choice is incorrect.')+' The correct answer is <strong>'+letters[correctIndex]+'</strong>. Read the explanation and source evidence below.</div>':'';
 $('practice-content').innerHTML=`<article class="card" id="question-card">
  <div class="card-top"><div class="eyebrow">QUESTION ${String(q.id).padStart(3,'0')} / 669 · DOCUMENT ${String(c.id).padStart(2,'0')}<br><span class="small">${esc(c.short)}</span></div>
  <span class="pill">${q.scenario?'CROSS-TOPIC SCENARIO':q.priority?'PRIORITY PRACTICE':q.additional?'EXTRA PRACTICE':'FULL BANK'}</span></div>
  <h2 class="question" id="question-text">${esc(q.question)}</h2>
  <div class="prompt"><span class="circle">?</span>Choose the one answer that matches the documented guidance.</div>
  <div class="quiz-options" role="group" aria-labelledby="question-text">${options}</div>
  <div id="quiz-feedback" aria-live="polite">${feedback}</div>
  <div class="quiz-actions"><div class="timer"><span class="digits" id="timer-digits">1:00</span><button class="quiet" id="timer-start">Start 60-second timer</button><span class="caption" id="timer-caption">Optional</span></div>
  <button class="quiet" id="retry-question" ${!record?'disabled':''}>↻ Try this question again</button></div>
  <button class="quiet reveal" id="reveal-answer" aria-expanded="${Boolean(selected)}" aria-controls="answer-area">${selected?'Hide explanation & evidence':'Reveal without scoring'}</button>
  <div class="answer-area" id="answer-area" ${selected?'':'hidden'}>
   <div class="eyebrow">EXPLANATION · EDITORIAL PARAPHRASE</div>
   <p class="answer-text">${esc(q.answer)}</p>${q.evidence.map(quoteHtml).join('')}
   <p class="hint">The correct choice is the original interview answer, a paraphrase/application of the guidance. Other choices are practice alternatives, not Google quotations. Quotations below are exact contiguous excerpts from the captured Google article text; whitespace is normalized. Open the source section for full context.</p>
  </div>
  <div class="grading"><span class="small muted">Can you explain the rule aloud?</span><button class="review ${mark==='review'?'active':''}" id="mark-review" aria-pressed="${mark==='review'}">↻ Needs review</button><button class="know ${mark==='know'?'active':''}" id="mark-know" aria-pressed="${mark==='know'}">✓ I can explain this</button><button class="quiet" id="unmark">Clear mark</button></div>
  <p class="score-note">Your score uses the first choice for each question. Retries and confidence marks do not change it. Reveal alone adds no score.</p>
  <div class="card-bottom"><span class="small">${index+1} of ${pool.length} in this session <span class="key-hint">· <span class="key">1–4</span> choose <span class="key">R</span> reveal <span class="key">←</span> <span class="key">→</span> move</span></span><div class="arrows"><button id="previous" ${index===0?'disabled':''}>← Previous</button><button class="primary" id="next" ${index===pool.length-1?'disabled':''}>Next →</button></div></div>
 </article>`;
 revealed=Boolean(selected);
 document.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>chooseAnswer(b.dataset.option));
 $('reveal-answer').onclick=toggleAnswer;$('timer-start').onclick=startTimer;
 $('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);
 $('retry-question').onclick=()=>{retryKey=q.key;renderCard();document.querySelector('[data-option]').focus();};
 $('mark-review').onclick=()=>grade('review');$('mark-know').onclick=()=>grade('know');$('unmark').onclick=()=>grade(null);
 bindSourceButtons($('practice-content'));
}
function chooseAnswer(optionId){
 const q=pool[index];if(!q)return;
 if(responses[q.key]&&retryKey!==q.key)return;
 const option=q.options.find(o=>o.id===optionId);if(!option)return;
 const previous=responses[q.key];
 responses[q.key]={selected:optionId,correct:option.correct,firstCorrect:previous?previous.firstCorrect:option.correct};
 marks[q.key]=option.correct?'know':'review';
 retryKey=null;persist();renderCard();
 // Keep feedback in view and preserve a useful keyboard focus after replacing the card.
 const chosen=document.querySelector('[data-option="'+optionId+'"]');
 if(chosen)chosen.scrollIntoView({behavior:'smooth',block:'nearest'});
 $('retry-question').focus({preventScroll:true});
}
function toggleAnswer(){
 revealed=!revealed;$('answer-area').hidden=!revealed;
 $('reveal-answer').setAttribute('aria-expanded',String(revealed));
 $('reveal-answer').textContent=revealed?'Hide explanation & evidence':responses[pool[index].key]?'Show explanation & evidence':'Reveal without scoring';
 if(revealed)stopTimer();
}
function grade(mark){
 const q=pool[index];if(!q)return;
 if(mark)marks[q.key]=mark;else delete marks[q.key];
 persist();
 $('mark-review').classList.toggle('active',mark==='review');$('mark-review').setAttribute('aria-pressed',String(mark==='review'));
 $('mark-know').classList.toggle('active',mark==='know');$('mark-know').setAttribute('aria-pressed',String(mark==='know'));
}

function move(delta){if(index+delta<0||index+delta>=pool.length)return;index+=delta;retryKey=null;renderCard();syncQuestionLink();$('question-card').scrollIntoView({behavior:'smooth',block:'start'});}
function startTimer(){if(timer){stopTimer();$('timer-start').textContent='Resume timer';return;}if(seconds<=0)seconds=60;$('timer-start').textContent='Pause timer';$('timer-digits').textContent=timerText();timer=setInterval(()=>{seconds--;$('timer-digits').textContent=timerText();if(seconds<=0){stopTimer();$('timer-start').textContent='Start again';$('timer-caption').textContent='Time to check your answer.';}},1000);}
function setView(name){stopTimer();view=name;document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});for(const v of ['practice','notes','glossary','sources'])$(v+'-view').hidden=v!==name;$('filters').hidden=name!=='practice';
 if(name==='practice'){if(chapter&&$('group-filter').value&&getChapter(chapter).group!==$('group-filter').value)$('group-filter').value='';updateDocumentOptions();$('mode-eyebrow').textContent='MULTIPLE CHOICE';$('mode-title').innerHTML='SEO interview quiz';$('mode-description').textContent='Choose one answer, then check the explanation and Google excerpts. Your first-choice score and review list stay in this browser.';rebuildPool();}
 if(name==='notes'){$('mode-eyebrow').textContent='95 DOCUMENTS';$('mode-title').innerHTML='Document notes';$('mode-description').textContent='Notes for each document. Use the document menu to read one page, practise its questions or open the source.';renderNotes();}
 if(name==='glossary'){$('mode-eyebrow').textContent='127 DEFINITIONS';$('mode-title').innerHTML='SEO definitions';$('mode-description').textContent='Search definitions, say them aloud, then check the evidence or open the related question.';renderGlossary();}
 if(name==='sources'){$('mode-eyebrow').textContent='102 SOURCE ENTRIES';$('mode-title').innerHTML='Google source library';$('mode-description').textContent='94 full licensed articles, a labeled Google Support summary and seven official supplements. Each entry includes its original link and revision date.';renderSource();}
}
function renderGlossary(){
 const term=$('glossary-search').value.trim().toLowerCase();const gs=DATA.glossary.filter(g=>[g.term,g.definition].join(' ').toLowerCase().includes(term)).sort((a,b)=>a.term.localeCompare(b.term));
 $('glossary-count').textContent=gs.length+' definitions · '+DATA.glossary.length+' total';
 $('glossary-content').innerHTML=gs.map(g=>'<article class="note-chapter definition-card"><div class="eyebrow">DEFINITION '+g.id+'</div><h2>'+esc(g.term)+'</h2><p>'+esc(g.definition)+'</p><details><summary>Check Google evidence</summary>'+g.evidence.map(quoteHtml).join('')+'</details>'+(g.question?'<button class="quiet" data-question="'+g.question+'">Practise the related question →</button>':'')+'</article>').join('');bindSourceButtons($('glossary-content'));
 $('glossary-content').querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{clearFilters();setView('practice');index=pool.findIndex(q=>q.id===+b.dataset.question);renderCard();window.scrollTo({top:0,behavior:'smooth'});});
}
$('glossary-search').oninput=renderGlossary;
function renderNotes(){const chapters=chapter?[getChapter(chapter)]:DATA.chapters;$('notes-content').innerHTML=chapters.map(c=>'<article class="note-chapter" id="note-'+c.id+'"><div class="eyebrow">DOCUMENT '+String(c.id).padStart(2,'0')+' · '+esc(c.group)+'</div><h2>'+esc(c.title)+'</h2><p class="small muted">Google last updated '+esc(c.updated)+' · Reviewed '+esc(DATA.reviewed)+' · '+c.questions.length+' practice questions</p><ul>'+c.notes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>'+(c.headings.length?'<details class="outline"><summary>Complete source section checklist · '+c.headings.length+' headings</summary><ul>'+c.headings.map(h=>'<li><a href="'+esc(c.url+(h.anchor?'#'+h.anchor:''))+'" target="_blank" rel="noopener">'+esc(h.text)+'</a></li>').join('')+'</ul></details>':'')+'<div class="note-actions"><button class="primary" data-practise="'+c.id+'">Practise this document →</button><button data-source="'+c.id+'">Read the source ↗</button><a class="small" href="'+esc(c.url)+'" target="_blank" rel="noopener">Original Google page</a></div></article>').join('');$('notes-content').querySelectorAll('[data-practise]').forEach(b=>b.onclick=()=>{chapter=+b.dataset.practise;clearFilters(false);setView('practice');activeSidebar();});bindSourceButtons($('notes-content'));
 $('flags-content').innerHTML=DATA.flags.map(f=>'<article class="flag"><div class="eyebrow">SOURCE CHECK · '+f.pages.map(p=>'D'+String(p).padStart(2,'0')).join(', ')+'</div><h3>'+esc(f.title)+'</h3><p>'+esc(f.text)+'</p>'+f.evidence.map(quoteHtml).join('')+'</article>').join('');bindSourceButtons($('flags-content'));
}
function renderSource(anchor=''){const meta=DATA.sources[String(source)];
 $('source-select').value=source;$('source-content').innerHTML='<div class="source-header"><div class="eyebrow">'+(source<=95?'DOCUMENT '+String(source).padStart(2,'0'):'SUPPLEMENT S'+(source-95))+'</div><h2>'+esc(meta.title)+'</h2><p>Google last updated / published: '+esc(meta.updated)+' · Reviewed '+esc(DATA.reviewed)+'</p><a class="small" href="'+esc(meta.url)+'" target="_blank" rel="noopener">Open the original Google page ↗</a></div><article class="source-body">'+DATA.sourceHtml[String(source)]+'</article>';
 if(anchor){requestAnimationFrame(()=>{const el=document.getElementById('s'+source+'-'+anchor);if(el){el.classList.add('highlight');el.scrollIntoView({behavior:'smooth',block:'start'});}});}
}
function openSource(n,anchor=''){source=n;if(n<=95)chapter=n;activeSidebar();setView('sources');if(anchor)renderSource(anchor);else $('source-content').scrollIntoView({behavior:'smooth',block:'start'});}
function clearFilters(resetChapter=true){
 retryKey=null;
 $('search').value='';$('search-scope').value='qa';$('group-filter').value='';
 $('status-filter').value='all';$('set-filter').value='all';order=null;
 if(resetChapter)chapter=0;
 updateDocumentOptions();activeSidebar();rebuildPool(false);
}
function chooseTopic(n){
 retryKey=null;
 chapter=n;if(n)source=n;
 $('search').value='';$('group-filter').value='';updateDocumentOptions();activeSidebar();
 if(view==='practice')rebuildPool(false);
 else if(view==='notes')renderNotes();else if(view==='glossary')renderGlossary();else renderSource();
 closeDocumentMenu();window.scrollTo({top:0,behavior:'smooth'});
}

DATA.groups.forEach(g=>{const option=document.createElement('option');option.value=g;option.textContent=groupLabel(g);$('group-filter').append(option);const label=document.createElement('div');label.className='navgroup';label.textContent=groupLabel(g);$('topic-nav').append(label);DATA.chapters.filter(c=>c.group===g).forEach(c=>{const b=document.createElement('button');b.className='topic';b.dataset.chapter=c.id;b.innerHTML='<span class="num">'+String(c.id).padStart(2,'0')+'</span>'+esc(c.short)+'<span class="count">'+c.questions.length+'</span>';$('topic-nav').append(b);});});
document.querySelectorAll('.topic[data-chapter]').forEach(b=>b.onclick=()=>chooseTopic(+b.dataset.chapter));
DATA.chapters.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent='D'+String(c.id).padStart(2,'0')+' · '+c.short;$('source-select').append(o);});Object.entries(DATA.sources).filter(([n])=>+n>95).forEach(([n,s])=>{const o=document.createElement('option');o.value=n;o.textContent='S'+(+n-95)+' · '+s.title;$('source-select').append(o);});
$('source-select').onchange=()=>{source=+$('source-select').value;if(source<=95)chapter=source;activeSidebar();renderSource();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('search').oninput=()=>{clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>rebuildPool(false),140);};
$('search-clear').onclick=()=>{clearTimeout(searchTimeout);$('search').value='';rebuildPool(false);$('search').focus();};
$('search-scope').onchange=()=>rebuildPool(false);
$('group-filter').onchange=()=>{chapter=0;updateDocumentOptions();activeSidebar();rebuildPool(false);};
$('document-filter').onchange=()=>{chapter=+$('document-filter').value;activeSidebar();rebuildPool(false);};
$('status-filter').onchange=()=>rebuildPool(false);
$('set-filter').onchange=()=>rebuildPool(false);
$('clear-filters').onclick=()=>clearFilters();

$('shuffle').onclick=()=>{order=DATA.questions.map(q=>q.id);for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}rebuildPool(false);};
$('review-queue').onclick=()=>{clearFilters();$('status-filter').value='review';rebuildPool(false);};
$('open-flags').onclick=()=>{chapter=0;activeSidebar();setView('notes');$('flags-section').scrollIntoView({behavior:'smooth',block:'start'});};
$('reset-progress').onclick=()=>{marks={};responses={};retryKey=null;persist();if(view==='practice')rebuildPool(false);};
$('menu-toggle').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(open));};
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea,[contenteditable]')||e.target.closest('.tabs')||view!=='practice'||!pool.length)return;if(/^[1-4]$/.test(e.key)){e.preventDefault();const q=pool[index];chooseAnswer(q.options[+e.key-1].id);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key.toLowerCase()==='r'&&$('reveal-answer')){e.preventDefault();toggleAnswer();}if(e.key==='Escape'){$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}});
$('scope-text').textContent=DATA.scope;updateDocumentOptions();setView('practice');$('license-text').textContent=DATA.license;updateProgress();rebuildPool(false);
if(/^#q\d+$/.test(location.hash)){const id=+location.hash.slice(2),found=pool.findIndex(q=>q.id===id);if(found>=0){index=found;renderCard();}}
window.practiceAudit=()=>({total:DATA.questions.length,documents:DATA.chapters.length,matched:pool.length,current:pool[index]?.id,chapter,view,quotes:DATA.questions.reduce((n,q)=>n+q.evidence.length,0),priority:DATA.questions.filter(q=>q.priority).length,additional:DATA.questions.filter(q=>q.additional).length,marks:{...marks},answered:Object.keys(responses).length,firstCorrect:Object.values(responses).filter(r=>r.firstCorrect).length,options:pool[index]?.options.length,quiz:true});

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

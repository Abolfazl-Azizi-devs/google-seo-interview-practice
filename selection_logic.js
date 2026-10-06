function clearFilters(resetChapter=true){
 QUIZ_RETRY_RESET
 $('search').value='';$('search-scope').value='qa';$('group-filter').value='';
 $('status-filter').value='all';$('set-filter').value='all';order=null;
 if(resetChapter)chapter=0;
 updateDocumentOptions();activeSidebar();rebuildPool(false);
}
function chooseTopic(n){
 QUIZ_RETRY_RESET
 chapter=n;if(n)source=n;
 $('search').value='';$('group-filter').value='';updateDocumentOptions();activeSidebar();
 if(view==='practice')rebuildPool(false);
 else if(view==='notes')renderNotes();else if(view==='glossary')renderGlossary();else renderSource();
 closeDocumentMenu();window.scrollTo({top:0,behavior:'smooth'});
}

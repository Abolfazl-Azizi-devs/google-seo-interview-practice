'use strict';
(async()=>{
 const mode=document.body.dataset.mode;
 const status=document.getElementById('load-message');
 const controls=[...document.querySelectorAll('button,input,select')];
 controls.forEach(el=>el.disabled=true);
 try{
  const fetchJSON=async(path)=>{const response=await fetch(path);if(!response.ok)throw new Error('HTTP '+response.status);return response.json();};
  const [data,choices]=await Promise.all([
   fetchJSON('../assets/study-data.json'),
   mode==='quiz'?fetchJSON('../assets/quiz-choices.json'):Promise.resolve(null)
  ]);
  const byId=new Map(data.questions.map(q=>[q.id,q]));
  if(choices)for(const q of data.questions)Object.assign(q,choices[q.key]);
  for(const chapter of data.chapters)chapter.questions=chapter.questions.map(id=>byId.get(id));
  window.SEOStudyData=data;
  controls.forEach(el=>el.disabled=false);
  const app=document.createElement('script');app.src='../assets/'+mode+'.js';
  app.onload=()=>{
   if(window.studyInitialized){status.hidden=true;window.studyReady=true;}
   else status.textContent='The questions could not load. Refresh this page to try again.';
  };
  app.onerror=()=>{status.textContent='The questions could not load. Refresh this page to try again.';};
  document.body.append(app);
 }catch(error){
  status.textContent='The questions could not load. Check your connection and refresh this page.';
  const card=document.getElementById('loading-card');
  if(card)card.textContent='You can still use the PDF and Word downloads below.';
 }
})();

"""Create the public editions in this repository; original study packs are read-only inputs."""
from pathlib import Path
import copy
import hashlib
import json
import re
import shutil
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent
WORKSPACE=ROOT.parent
PUBLIC=ROOT/'public'
ASSETS=PUBLIC/'assets'
ORIGINAL=WORKSPACE/'Complete Google SEO Interview Pack'
QUIZ=WORKSPACE/'Google SEO Four-Choice Quiz'
OWNER='Abolfazl-Azizi-devs'
REPO='google-seo-interview-practice'
BASE_URL=f'https://{OWNER.lower()}.github.io/{REPO}/'
for folder in (ASSETS,PUBLIC/'practice',PUBLIC/'quiz',PUBLIC/'downloads'):
    folder.mkdir(parents=True,exist_ok=True)
base=json.loads((ORIGINAL/'practice_data.json').read_text(encoding='utf-8'))
quiz=json.loads((QUIZ/'quiz_data.json').read_text(encoding='utf-8'))
assert len(base['questions'])==len(quiz['questions'])==669
for a,b in zip(base['questions'],quiz['questions']):
    assert all(a[k]==b[k] for k in a)
public_data=copy.deepcopy(base)
for chapter in public_data['chapters']:
    chapter['questions']=[q['id'] for q in chapter['questions']]
# Only editorial wrapper copy changes; questions, answers, excerpts and notes remain intact.
public_data['scope']=('669 questions covering 95 Google documentation pages: 9 fundamentals, '
                      '41 crawling and indexing, and 45 ranking and search appearance. '
                      'Includes 10 cross-topic scenarios, 76 additional appearance questions '
                      'and 127 definitions. The source library includes 94 full licensed articles, '
                      'a labeled brief of the Google Support article, and seven official supplements. '
                      'Linked subguides are not recursively included.')
public_data['license']=('Google article text: CC BY 4.0. Google code samples: Apache 2.0. '
                        'Original source links and revision dates accompany the excerpts. '
                        'Questions, explanations and definitions are editorial paraphrases.')
public_data.pop('plan',None)
public_data.pop('stories',None)
public_data.pop('employerQuestions',None)
(ASSETS/'study-data.json').write_text(json.dumps(public_data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
choices={q['key']:{'options':q['options'],'correctOptionId':q['correctOptionId']} for q in quiz['questions']}
(ASSETS/'quiz-choices.json').write_text(json.dumps(choices,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

filters='''<div class="filters" id="filters">
 <div class="filter-search-row">
  <label class="search-wrap" for="search"><span class="field-label">Search</span><span class="search-input-wrap"><input id="search" type="search" autocomplete="off" placeholder="e.g. canonical, robots.txt, Core Web Vitals"><button id="search-clear" type="button" aria-label="Clear search" hidden>×</button></span></label>
  <label class="scope-field" for="search-scope"><span class="field-label">Search in</span><select id="search-scope"><option value="qa">Questions and answers</option><option value="question">Questions only</option><option value="evidence">Google excerpts</option><option value="all">All content in question cards</option></select></label>
 </div>
 <p class="filter-help" id="search-help">Searches question and answer text. Filters below work together.</p>
 <button type="button" class="mobile-filter-toggle" id="filter-toggle" aria-expanded="false" aria-controls="filter-fields">Filters <span id="filter-count">0 active</span><span aria-hidden="true">⌄</span></button>
 <div class="filter-fields" id="filter-fields">
  <label for="group-filter"><span class="field-label">Topic group</span><select id="group-filter"><option value="">All topic groups</option></select></label>
  <label for="document-filter"><span class="field-label">Document</span><select id="document-filter"><option value="0">All 95 documents</option></select></label>
  <label for="status-filter"><span class="field-label">Your progress</span><select id="status-filter"><option value="all">Any progress</option><option value="unseen">Not marked</option><option value="review">Needs review</option><option value="know">Confident</option></select></label>
  <label for="set-filter"><span class="field-label">Question set</span><select id="set-filter"><option value="all">All 669 questions</option><option value="priority">Priority questions (179)</option><option value="scenarios">Cross-topic scenarios (10)</option><option value="extra">Additional appearance (76)</option></select></label>
 </div>
 <div class="filter-summary-row"><div class="active-filters" id="active-filters" aria-label="Current filters"></div><button class="quiet filter-reset" id="clear-filters">Reset all</button></div>
</div>'''

def metadata(soup,mode):
    prefix='assets/' if mode=='home' else '../assets/'
    title={'home':'SEO interview practice — 669 questions',
           'practice':'Answer aloud — SEO interview practice',
           'quiz':'Multiple choice — SEO interview practice'}[mode]
    description=('Practise 669 SEO interview questions from 95 Google documentation pages. '
                 'Choose answer-aloud practice or a four-choice quiz. Includes sources and 127 definitions.')
    soup.title.string=title
    url=BASE_URL+('' if mode=='home' else mode+'/')
    for attrs in [
      {'name':'description','content':description}, {'name':'theme-color','content':'#152d3a'},
      {'property':'og:title','content':title},{'property':'og:description','content':description},
      {'property':'og:type','content':'website'},{'property':'og:url','content':url},
      {'property':'og:image','content':BASE_URL+'assets/social-preview.png'},
      {'property':'og:image:width','content':'1200'},{'property':'og:image:height','content':'630'},
      {'property':'og:image:alt','content':'SEO interview practice: 669 questions, 95 Google documents, answer-aloud and multiple-choice modes.'},
      {'name':'twitter:card','content':'summary_large_image'}]:
        soup.head.append(soup.new_tag('meta',attrs=attrs))
    soup.head.append(soup.new_tag('link',rel='canonical',href=url))
    soup.head.append(soup.new_tag('link',rel='icon',href=prefix+'favicon.svg',type='image/svg+xml'))
    if mode!='home':soup.head.append(soup.new_tag('link',rel='stylesheet',href=prefix+mode+'-base.css'))
    soup.head.append(soup.new_tag('link',rel='stylesheet',href=prefix+'site.css'))
    for font in ('Manrope','SourceSans3'):
        soup.head.append(soup.new_tag('link',rel='preload',href=prefix+'fonts/'+font+'.woff2',attrs={'as':'font','type':'font/woff2','crossorigin':''}))

for mode,input_path in [('practice',ORIGINAL/'SEO_Interview_Practice.html'),('quiz',QUIZ/'SEO_Four_Choice_Quiz.html')]:
    soup=BeautifulSoup(input_path.read_text(encoding='utf-8'),'html.parser')
    script=soup.find_all('script')[-1].get_text()
    script=script.replace("const DATA=JSON.parse(document.getElementById('practice-data').textContent);",'const DATA=window.SEOStudyData;')
    script=re.sub(r"const KEY='[^']+';",f"const KEY='seo-public-{mode}-v1';",script,count=1)
    script=script.replace("$('priority-filter').checked", "$('set-filter').value==='priority'")
    start,end=script.index('function rebuildPool('),script.index('function renderCard(')
    script=script[:start]+(ROOT/'filter_logic.js').read_text(encoding='utf-8')+'\n'+script[end:]
    script=re.sub(r"\$\('match-count'\)\.textContent=pool\.length\+' matching question[^\n]+;",'updateFilterUI();',script,count=1)
    start,end=script.index('function clearFilters('),script.index('DATA.groups.forEach')
    selector_functions=(ROOT/'selection_logic.js').read_text(encoding='utf-8').replace('QUIZ_RETRY_RESET',"retryKey=null;" if mode=='quiz' else '')
    script=script[:start]+selector_functions+'\n'+script[end:]
    # Replace combined status/set behavior with separately labeled, independent filters.
    start=script.index("$('search').oninput=")
    end=script.index("$('shuffle').onclick=")
    script=script[:start]+(ROOT/'filter_events.js').read_text(encoding='utf-8')+'\n'+script[end:]
    script=script.replace("option.textContent=g;", "option.textContent=groupLabel(g);")
    script=script.replace("label.textContent=g;", "label.textContent=groupLabel(g);")
    # Descriptive headings replace catchphrases and private interview-day language.
    replacements={
      'READ IT. SAY IT. CHECK IT.':'ANSWER ALOUD',
      'CHOOSE. CHECK. EXPLAIN.':'MULTIPLE CHOICE',
      'Know the rule.<br>Explain the exception.':'SEO interview practice',
      'Pick one answer.<br>Check the evidence.':'SEO interview quiz',
      'Say your answer aloud before revealing it. Then check the exact Google evidence beneath it and save the questions you need to revisit.':'Answer aloud, then reveal the explanation and Google excerpts. Mark the questions you want to review.',
      'Choose one of four answers. See why it is right or wrong, read the full explanation and Google evidence, then explain the rule aloud. Wrong answers join your review queue.':'Choose one answer, then check the explanation and Google excerpts. Your first-choice score and review list stay in this browser.',
      'The points.<br>The important details.':'Document notes',
      'Know the term.<br>Explain the rule.':'SEO definitions',
      'Read the source.<br>Keep the context.':'Google source library',
      'THE COMPLETE DOCUMENT TRAIL':'102 SOURCE ENTRIES',
      'PAGE-BY-PAGE REVISION':'95 DOCUMENTS',
      '127 SOURCE-BACKED DEFINITIONS':'127 DEFINITIONS',
      'Detailed revision notes for every supplied Google page. Select a topic for focused reading, then practise its questions or inspect the full source.':'Notes for each document. Use the document menu to read one page, practise its questions or open the source.',
      '94 licensed supplied articles are preserved in full, with a complete-topic brief for the supplied Support page and seven official supplements. Source links and revision dates help you trace each answer.':'94 full licensed articles, a labeled Google Support summary and seven official supplements. Each entry includes its original link and revision date.',
      'NEW PRACTICE':'ADDITIONAL QUESTIONS',
      'ANSWER TO PRACTISE · PARAPHRASE / INTERVIEW APPLICATION':'ANSWER · EDITORIAL PARAPHRASE',
      'FULL EXPLANATION · ORIGINAL SOURCE-BACKED ANSWER':'EXPLANATION · EDITORIAL PARAPHRASE',
      'Read the source coverage ↗':'Read the source ↗',
      'Search questions, answers, or quoted evidence…':'Search questions and answers…',
    }
    for old,new in replacements.items():script=script.replace(old,new)
    # Record a shareable permalink whenever the displayed question changes.
    script=script.replace("$('question-card').scrollIntoView", "syncQuestionLink();$('question-card').scrollIntoView")
    script=script.replace('function renderCard(){','function renderCard(){\n queueMicrotask(syncQuestionLink);')
    script=script.replace("$('scope-text').textContent=DATA.scope;", "$('scope-text').textContent=DATA.scope;updateDocumentOptions();")
    script=script.replace("if(e.target.matches('input,select,textarea')", "if(e.target.matches('input,select,textarea,[contenteditable]')")
    script=script.replace("||view!=='practice'||", "||e.target.closest('.tabs')||view!=='practice'||")
    script=script.replace("if(name==='practice'){", "if(name==='practice'){if(chapter&&$('group-filter').value&&getChapter(chapter).group!==$('group-filter').value)$('group-filter').value='';updateDocumentOptions();",1)
    script+='\n'+(ROOT/'public_controls.js').read_text(encoding='utf-8')
    (ASSETS/(mode+'.js')).write_text(script,encoding='utf-8')
    for tag in soup.find_all('script'):tag.decompose()
    css='\n'.join(t.get_text() for t in soup.find_all('style'))
    for tag in soup.find_all('style'):tag.decompose()
    (ASSETS/(mode+'-base.css')).write_text(css,encoding='utf-8')
    soup.body['data-mode']=mode
    soup.body['class']='study-page'
    soup.find(id='filters').replace_with(BeautifulSoup(filters,'html.parser'))
    if mode=='quiz':soup.select_one('#status-filter option[value="unseen"]').string='Not answered'
    soup.find(id='sidebar')['aria-label']='Google documentation menu'
    brand=soup.select_one('.brand');brand.clear()
    brand.append(BeautifulSoup('<a href="../"><span>SEO STUDY GUIDE</span>Interview practice</a>','html.parser'))
    soup.select_one('.edition').clear()
    soup.select_one('.edition').append(BeautifulSoup('95 documents · 669 questions<br>Reviewed 6 October 2026','html.parser'))
    soup.find(id='menu-toggle').string='☰ Documents'
    soup.find(id='menu-toggle')['aria-label']='Open document menu'
    soup.select_one('.edition-badge').replace_with(BeautifulSoup(
        '<nav class="mode-switch" aria-label="Practice format"><a href="../practice/" '+('aria-current="page"' if mode=='practice' else '')+'>Answer aloud</a><a href="../quiz/" '+('aria-current="page"' if mode=='quiz' else '')+'>Multiple choice</a></nav>','html.parser'))
    soup.find(id='tab-practice').string='Questions'
    soup.find(id='tab-notes').string='Notes'
    soup.find(id='mode-eyebrow').string='ANSWER ALOUD' if mode=='practice' else 'MULTIPLE CHOICE'
    soup.find(id='mode-title').string='SEO interview practice' if mode=='practice' else 'SEO interview quiz'
    soup.find(id='mode-description').string=replacements['Say your answer aloud before revealing it. Then check the exact Google evidence beneath it and save the questions you need to revisit.'] if mode=='practice' else replacements['Choose one of four answers. See why it is right or wrong, read the full explanation and Google evidence, then explain the rule aloud. Wrong answers join your review queue.']
    # Compact useful reference links replace the private, time-based study plan.
    below=soup.select_one('.below-row');below.clear()
    below.append(BeautifulSoup('<div class="support-card"><div class="eyebrow">DOCUMENTATION UPDATES</div><h3>Guidance that needs context</h3><p>Ten notes explain changed tools, crawler limits, AI reporting and feature-specific requirements.</p><button id="open-flags">Read the source notes</button></div><div class="support-card plan"><div class="eyebrow">REFERENCE</div><h3>Definitions and full documents</h3><p>Check 127 definitions or read the original document sections behind an answer.</p><div class="reference-actions"><button data-open-view="glossary">Definitions</button><button data-open-view="sources">Source library</button></div></div>','html.parser'))
    row=soup.select_one('.session-actions')
    row.append(BeautifulSoup('<button class="quiet" id="copy-question">Copy question link</button><span id="copy-status" role="status"></span>','html.parser'))
    soup.find(id='practice-content').append(BeautifulSoup('<div class="loading-card" id="loading-card" role="status">Loading 669 questions…</div>','html.parser'))
    loading=BeautifulSoup('<p class="load-message" id="load-message" role="status">Loading study data…</p><noscript><p>Enable JavaScript to use questions and filters. The PDF and Word downloads remain available.</p></noscript>','html.parser')
    soup.find(id='filters').insert_before(loading)
    for link in soup.select('.download-row a'):link['href']='../downloads/'+link['href']
    soup.find('a',href='../downloads/Complete_SEO_Interview_Workbook.docx').string='Q&A workbook · Word'
    soup.find('a',href='../downloads/Complete_SEO_Interview_Workbook.pdf').string='Q&A workbook · PDF'
    download=BeautifulSoup(f'<a href="../downloads/{"Complete_Google_SEO_Interview_Pack.zip" if mode=="practice" else "Google_SEO_Four_Choice_Quiz.zip"}">Offline {"practice" if mode=="practice" else "quiz"} pack · ZIP</a>','html.parser')
    soup.select_one('.download-row').append(download)
    footer=soup.find('footer');footer.clear()
    footer.append(BeautifulSoup('<div class="footer-row"><p>By <a href="https://github.com/'+OWNER+'" target="_blank" rel="noopener">Abolfazl</a> · <a href="https://github.com/'+OWNER+'/'+REPO+'" target="_blank" rel="noopener">GitHub</a></p><button class="quiet" id="reset-progress">Reset '+('quiz' if mode=='quiz' else 'practice')+' progress</button></div><p>Your progress stays in this browser. No account is needed.</p><details><summary>Sources, coverage and licensing</summary><p id="scope-text"></p><p id="license-text"></p><p><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">Apache 2.0</a> · <a href="../downloads/All_95_Source_Links.txt">All 95 source links</a></p></details>','html.parser'))
    metadata(soup, mode)
    load=soup.new_tag('script',src='../assets/load.js');load['defer']='';soup.body.append(load)
    (PUBLIC/mode/'index.html').write_text(str(soup),encoding='utf-8')

downloads=['All_95_Source_Links.txt','Complete_SEO_Interview_Workbook.docx','Complete_SEO_Interview_Workbook.pdf',
           'Complete_Google_SEO_Source_Reference.docx','Complete_Google_SEO_Source_Reference.pdf',
           'SEO_Definitions_Quick_Review.docx','SEO_Definitions_Quick_Review.pdf','Complete_Google_SEO_Interview_Pack.zip']
for filename in downloads:shutil.copyfile(ORIGINAL/filename,PUBLIC/'downloads'/filename)
shutil.copyfile(QUIZ/'Google_SEO_Four_Choice_Quiz.zip',PUBLIC/'downloads/Google_SEO_Four_Choice_Quiz.zip')
for name in ('site.css','load.js'):
    shutil.copyfile(ROOT/name,ASSETS/name)
home=BeautifulSoup((ROOT/'home_template.html').read_text(encoding='utf-8'),'html.parser')
metadata(home,'home')
(PUBLIC/'index.html').write_text(str(home),encoding='utf-8')
(PUBLIC/'404.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><link rel="stylesheet" href="'''+BASE_URL+'''assets/site.css"><body class="landing"><main class="landing-main"><h1>Page not found</h1><p>The page may have moved.</p><a class="primary button-link" href="'''+BASE_URL+'''">Go to SEO interview practice</a></main></body></html>''',encoding='utf-8')
(ASSETS/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#152d3a"/><circle cx="27" cy="26" r="13" fill="none" stroke="#8ed9c9" stroke-width="5"/><path d="m37 37 12 12" stroke="#8ed9c9" stroke-width="6" stroke-linecap="round"/></svg>',encoding='utf-8')
(PUBLIC/'.nojekyll').write_text('',encoding='utf-8')
(PUBLIC/'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n',encoding='utf-8')
(PUBLIC/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join(f'<url><loc>{BASE_URL}{path}</loc></url>' for path in ('','practice/','quiz/'))+'</urlset>',encoding='utf-8')
audit={'questions':669,'documents':95,'definitions':127,'sources':102,
       'originalAnswersAndEvidenceUnchanged':True,'quizChoicesUnchanged':True,
       'sharedStudyDataBytes':(ASSETS/'study-data.json').stat().st_size,
       'sourceSnapshot':base['reviewed'],'baseUrl':BASE_URL}
(ROOT/'content_verification.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print(json.dumps(audit,indent=2))

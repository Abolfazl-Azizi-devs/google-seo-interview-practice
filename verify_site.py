from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import threading
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT/'public'
PREFIX='/google-seo-interview-practice/'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if not self.path.startswith(PREFIX):self.send_error(404);return
        self.path=self.path[len(PREFIX)-1:]
        super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{server.server_port}{PREFIX}'
errors=[];failed_requests=[]
results={'baseUrl':BASE,'cards':{},'mobileWidths':[]}
PREVIEWS=ROOT/'previews';PREVIEWS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1100},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(e.stack))
    page.on('response',lambda r:failed_requests.append(r.url) if r.status>=400 else None)
    page.goto(BASE,wait_until='networkidle')
    assert page.locator('.mode-card').count()==2
    assert page.locator('h1').inner_text()=='SEO interview practice'
    page.screenshot(path=str(PREVIEWS/'home-desktop.png'),full_page=True)
    for mode in ('practice','quiz'):
        page.set_viewport_size({'width':1440,'height':1100})
        page.goto(BASE+mode+'/',wait_until='networkidle')
        page.wait_for_function('window.studyReady===true')
        assert page.evaluate('typeof practiceAudit')=='function',errors
        assert page.evaluate('practiceAudit().total')==669
        assert page.locator('#topic-nav .topic').count()==95
        assert page.locator('#source-select option').count()==102
        assert page.locator('#document-filter option').count()==96
        assert page.locator('.field-label').count()==6
        assert page.locator('#load-message').is_hidden()
        assert page.locator('#mode-title').inner_text() in ('SEO interview practice','SEO interview quiz')
        # Independent group/document/set/status filters and their visible, removable summaries.
        page.select_option('#group-filter','Fundamentals')
        assert page.evaluate('practiceAudit().matched')==129
        assert page.locator('#document-filter option').count()==10
        assert page.locator('[data-clear-filter="group"]').count()==1
        page.select_option('#document-filter','1')
        assert page.evaluate('practiceAudit().matched')==18  # starter questions plus its scenario
        page.locator('[data-clear-filter="document"]').click()
        assert page.evaluate('practiceAudit().matched')==129
        page.locator('[data-clear-filter="group"]').click()
        assert page.evaluate('practiceAudit().matched')==669
        page.select_option('#set-filter','priority')
        assert page.evaluate('practiceAudit().matched')==179
        page.select_option('#set-filter','scenarios')
        assert page.evaluate('practiceAudit().matched')==10
        page.select_option('#set-filter','extra')
        assert page.evaluate('practiceAudit().matched')==76
        page.locator('#clear-filters').click()
        # Search matches its selected scope, and all words must match.
        page.locator('#search').fill('canonical')
        page.wait_for_timeout(180)
        assert page.evaluate('pool.length===DATA.questions.filter(q=>(q.question+" "+q.answer).toLowerCase().includes("canonical")).length')
        assert page.locator('#search-clear').is_visible()
        assert 'question and answer' in page.locator('#search-help').inner_text()
        page.select_option('#search-scope','question')
        assert page.evaluate('pool.length===DATA.questions.filter(q=>q.question.toLowerCase().includes("canonical")).length')
        page.select_option('#search-scope','evidence')
        assert page.evaluate('pool.length===DATA.questions.filter(q=>q.evidence.map(e=>e.quote).join(" ").toLowerCase().includes("canonical")).length')
        page.locator('#search').fill('canonical duplicate')
        page.wait_for_timeout(180)
        assert page.evaluate('pool.every(q=>["canonical","duplicate"].every(w=>q.evidence.map(e=>e.quote).join(" ").toLowerCase().includes(w)))')
        page.locator('#search').fill('noresultxyz123')
        page.wait_for_timeout(180)
        assert page.evaluate('practiceAudit().matched')==0
        assert page.locator('#copy-question').is_disabled()
        page.locator('#empty-clear').click()
        assert page.evaluate('practiceAudit().matched')==669
        assert page.locator('#search-scope').input_value()=='qa'
        # Full original content and source evidence on every card; quiz grading on all cards.
        failures=page.evaluate('''() => {
          const failures=[];clearFilters();marks={};
          if(document.body.dataset.mode==='quiz'){responses={};retryKey=null;}
          for(let i=0;i<DATA.questions.length;i++){
            index=i;renderCard();const q=DATA.questions[i];
            if($('question-text').textContent!==q.question)failures.push('question '+q.key);
            if(document.body.dataset.mode==='quiz'){
              const opts=[...document.querySelectorAll('[data-option]')];
              if(opts.length!==4)failures.push('choice count '+q.key);
              opts.forEach((b,j)=>{if(b.querySelector('.option-copy').textContent!==q.options[j].text)failures.push('choice '+q.key);});
              chooseAnswer((i%2?q.options.find(o=>o.correct):q.options.find(o=>!o.correct)).id);
              if(document.querySelectorAll('.correct-option').length!==1)failures.push('grading '+q.key);
            }else toggleAnswer();
            if($('answer-area').hidden)failures.push('answer visibility '+q.key);
            if(document.querySelector('.answer-text').textContent!==q.answer)failures.push('answer '+q.key);
            const qs=[...document.querySelectorAll('#answer-area blockquote')];
            if(qs.length!==q.evidence.length)failures.push('quote count '+q.key);
            qs.forEach((el,j)=>{if(el.textContent!=='“'+q.evidence[j].quote+'”')failures.push('quote '+q.key);});
          }return failures;
        }''')
        assert not failures,failures
        results['cards'][mode]=669
        page.locator('#reset-progress').click()
        page.locator('#clear-filters').click()
        if mode=='practice':
            page.locator('#reveal-answer').click();page.locator('#mark-review').click()
            page.reload();page.wait_for_function('window.studyReady')
            assert page.evaluate('practiceAudit().marks["F01-01"]')=='review'
            page.locator('#review-queue').click();assert page.evaluate('practiceAudit().matched')==1
        else:
            wrong=page.evaluate('DATA.questions[0].options.find(o=>!o.correct).id')
            page.locator('[data-option="'+wrong+'"]').click()
            assert page.locator('#quiz-score').inner_text()=='0 / 1 correct'
            page.locator('#retry-question').click()
            correct=page.evaluate('DATA.questions[0].correctOptionId')
            page.locator('[data-option="'+correct+'"]').click()
            assert page.locator('#quiz-score').inner_text()=='0 / 1 correct'
            page.reload();page.wait_for_function('window.studyReady')
            assert page.locator('#quiz-score').inner_text()=='0 / 1 correct'
            assert page.evaluate('JSON.parse(localStorage.getItem("seo-public-practice-v1"))["F01-01"]')=='review'
        page.locator('#clear-filters').click()
        page.locator('#tab-glossary').click()
        assert page.locator('.definition-card').count()==127
        page.locator('#glossary-search').fill('canonical');assert page.locator('.definition-card').count()>0
        page.locator('#glossary-search').fill('')
        page.locator('#tab-notes').click()
        assert page.locator('#notes-content .note-chapter').count()==95
        page.locator('#tab-sources').click()
        for number in ('1','28','68','77','95','102'):
            page.select_option('#source-select',number)
            assert page.locator('.source-body').inner_text()
        page.locator('#tab-practice').click();page.locator('#clear-filters').click()
        page.select_option('#group-filter','Fundamentals')
        page.locator('#tab-sources').click()
        page.select_option('#source-select','52')
        page.locator('#tab-practice').click()
        assert page.locator('#group-filter').input_value()==''
        assert page.locator('#document-filter').input_value()=='52'
        assert page.evaluate('practiceAudit().matched')==9
        page.locator('#clear-filters').click()
        page.locator('#next').click();assert page.url.endswith('#q2')
        page.locator('#copy-question').click()
        assert page.evaluate('navigator.clipboard.readText()').endswith(mode+'/#q2')
        page.goto(BASE+mode+'/#q500',wait_until='networkidle')
        page.wait_for_function('window.studyReady')
        page.wait_for_function('practiceAudit().current===500')
        assert page.evaluate('practiceAudit().current')==500
        page.locator('#clear-filters').click()
        page.locator('#reset-progress').click()
        page.evaluate("window.scrollTo(0,0);document.getElementById('sidebar').scrollTop=0;document.getElementById('copy-status').textContent='';")
        page.screenshot(path=str(PREVIEWS/(mode+'-desktop.png')),full_page=True)
        # Browser layout at narrow phone, standard phone, tablet and desktop widths.
        for width in (320,390,768,1024,1440):
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(mode,width,page.evaluate("[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().left>=0).map(el=>({tag:el.tagName,id:el.id,classes:el.className,right:el.getBoundingClientRect().right})).slice(0,20)"))
            if width<=780:
                assert page.locator('#filter-fields').is_hidden()
                page.locator('#filter-toggle').click()
                assert page.locator('#filter-fields').is_visible()
                page.select_option('#group-filter','Fundamentals')
                assert page.evaluate('practiceAudit().matched')==129
                page.locator('#clear-filters').click()
                page.locator('#filter-toggle').click()
                page.locator('#menu-toggle').click()
                assert page.locator('.main').evaluate('el=>el.inert')
                page.keyboard.press('Escape')
                assert not page.locator('.main').evaluate('el=>el.inert')
                page.locator('#menu-toggle').click()
                page.locator('.topic[data-chapter="95"]').click()
                assert not page.locator('#sidebar').evaluate("el=>el.classList.contains('open')")
                assert page.evaluate('practiceAudit().matched')==5
                page.locator('#clear-filters').click()
        page.set_viewport_size({'width':390,'height':844})
        mobile_failures=page.evaluate('''() => {
          const failures=[];clearFilters();
          for(let i=0;i<DATA.questions.length;i++){
            index=i;renderCard();
            if(document.documentElement.scrollWidth>innerWidth+1)failures.push(DATA.questions[i].key);
          }index=0;renderCard();return failures;
        }''')
        assert not mobile_failures,mobile_failures
        page.screenshot(path=str(PREVIEWS/(mode+'-mobile.png')),full_page=True)
        page.locator('#filter-toggle').click()
        page.select_option('#set-filter','priority')
        page.screenshot(path=str(PREVIEWS/(mode+'-mobile-filters.png')),full_page=True)
        page.locator('#clear-filters').click();page.locator('#filter-toggle').click()
        if mode=='quiz':page.locator('[data-option]').first.click()
        else:
            page.locator('#reveal-answer').click()
            page.locator('#mark-review').click()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.screenshot(path=str(PREVIEWS/(mode+'-mobile-answer.png')),full_page=True)
    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':844});page.goto(BASE,wait_until='networkidle')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),('home',width)
        if width==390:page.screenshot(path=str(PREVIEWS/'home-mobile.png'),full_page=True)
    assert not errors,errors
    assert not failed_requests,failed_requests
    browser.close()

# Check every bundled link and media resource independently of browser lazy loading.
for path in PUBLIC.rglob('*'):
    if path.is_file():
        with urlopen(BASE+path.relative_to(PUBLIC).as_posix(),timeout=30) as response:
            assert response.status==200
            assert hashlib.sha256(response.read()).hexdigest()==hashlib.sha256(path.read_bytes()).hexdigest()
hashes=json.loads((ROOT.parent/'Google SEO Four-Choice Quiz/original_files_sha256.json').read_text(encoding='utf-8'))
for relative,expected in hashes.items():
    assert hashlib.sha256((ROOT.parent/relative).read_bytes()).hexdigest()==expected,relative
results.update({'mobileWidths':[320,390,768,1024,1440],'allMobileCardsChecked':True,
                'scopedSearchAndIndependentFiltersChecked':True,'savedProgressAndModeIsolationChecked':True,
                'sourceNavigationKeepsDocumentFiltersConsistent':True,
                'questionPermalinksAndCopyChecked':True,'allDownloadsReturn200':True,
                'originalArtifactsUnchanged':len(hashes),'browserErrors':errors,'failedRequests':failed_requests})
(ROOT/'browser_verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
server.shutdown()
print(json.dumps(results,indent=2))

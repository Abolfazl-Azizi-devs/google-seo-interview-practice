"""Browser checks for the public site, served locally under the GitHub Pages project path.

    python verify_site.py

Uses Playwright with an installed Chrome, or Edge when Chrome is missing. Writes screenshots to
previews/ and a summary to browser_verification.json.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import threading
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
PREFIX = '/google-seo-interview-practice/'
CHROME = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if not self.path.startswith(PREFIX):
            self.send_error(404)
            return
        self.path = self.path[len(PREFIX) - 1:]
        super().do_GET()


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(PUBLIC)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}{PREFIX}'
errors, failed_requests = [], []
results = {'baseUrl': BASE, 'cards': {}}
PREVIEWS = ROOT / 'previews'
PREVIEWS.mkdir(exist_ok=True)
data = json.loads((PUBLIC / 'assets/study-data.json').read_text(encoding='utf-8'))
group3 = data['groups'][2]
group3_count = sum(1 for q in data['questions'] if next(c for c in data['chapters'] if c['id'] == q['chapter'])['group'] == group3)

CARD_CHECK = '''() => {
  const app = window.studyApp, D = app.data(), quiz = app.state.mode === 'quiz', failures = [];
  app.clearFilters(); app.store[app.state.mode].marks = {}; if (quiz) app.store.quiz.responses = {};
  for (let i = 0; i < D.questions.length; i++) {
    app.show(i); const q = D.questions[i];
    if (document.getElementById('question-text').textContent !== q.question) failures.push('question ' + q.key);
    if (quiz) {
      const opts = [...document.querySelectorAll('[data-option]')];
      if (opts.length !== 4) failures.push('choice count ' + q.key);
      opts.forEach((b, j) => { if (b.querySelector('.opt-text').textContent !== q.options[j].text) failures.push('choice ' + q.key); });
      app.choose((i % 2 ? q.options.find(o => o.correct) : q.options.find(o => !o.correct)).id);
      if (document.querySelectorAll('.opt.is-right').length !== 1) failures.push('grading ' + q.key);
    } else app.reveal();
    const answer = document.querySelector('.answer-text');
    if (!answer || answer.textContent !== q.answer) failures.push('answer ' + q.key);
    const quotes = [...document.querySelectorAll('#answer-area blockquote')];
    if (quotes.length !== q.evidence.length) failures.push('quote count ' + q.key);
    quotes.forEach((el, j) => { if (el.textContent !== '\u201c' + q.evidence[j].quote + '\u201d') failures.push('quote ' + q.key); });
  }
  return failures;
}'''


def ready(page):
    page.wait_for_function('window.studyReady === true')


def matched(page):
    return page.evaluate('practiceAudit().matched')


def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=str(CHROME), headless=True) if CHROME.exists() else p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['clipboard-read', 'clipboard-write'])
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(e.stack))
    page.on('response', lambda r: failed_requests.append(r.url) if r.status >= 400 else None)

    # Home: a real question can be answered on the page.
    page.goto(BASE, wait_until='networkidle')
    assert 'Google' in page.locator('h1').inner_text()
    assert page.locator('#try-opts [data-i]').count() == 4
    page.locator('#try-opts [data-i]').first.click()
    assert page.locator('#try-opts .is-right').count() == 1 and page.locator('#try-result').is_visible()
    assert page.locator('#resume').is_hidden()
    page.screenshot(path=str(PREVIEWS / 'home-desktop.png'), full_page=True)

    for mode in ('practice', 'quiz'):
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE + mode + '/', wait_until='networkidle')
        ready(page)
        audit = page.evaluate('practiceAudit()')
        assert audit['total'] == 669 and audit['documents'] == 95 and audit['mode'] == mode, audit
        assert page.locator('.doc[data-chapter]').count() == 95
        assert page.locator('#source-select option').count() == 102
        # Filters work independently and show as removable chips.
        page.evaluate("studyApp.setFilter('group', 'Fundamentals')")
        assert matched(page) == 129
        assert page.locator('[data-unchip="group"]').count() == 1
        page.evaluate("studyApp.setFilter('group', ''); studyApp.setFilter('chapter', 1)")
        assert matched(page) == 18
        page.locator('[data-unchip="chapter"]').click()
        assert matched(page) == 669
        for value, count in (('priority', 179), ('scenarios', 10), ('extra', 76)):
            page.evaluate(f"studyApp.setFilter('set', '{value}')")
            assert matched(page) == count, (value, matched(page))
        page.evaluate('studyApp.clearFilters()')
        # Search respects its scope and needs every word to match.
        page.locator('#q-search').fill('canonical')
        page.wait_for_timeout(250)
        assert matched(page) == page.evaluate('studyApp.data().questions.filter(q => (q.question + " " + q.answer).toLowerCase().includes("canonical")).length')
        assert page.locator('#search-clear').is_visible()
        page.evaluate("studyApp.setFilter('scope', 'question')")
        assert matched(page) == page.evaluate('studyApp.data().questions.filter(q => q.question.toLowerCase().includes("canonical")).length')
        page.evaluate("studyApp.setFilter('scope', 'evidence')")
        assert matched(page) == page.evaluate('studyApp.data().questions.filter(q => q.evidence.map(e => e.quote).join(" ").toLowerCase().includes("canonical")).length')
        page.locator('#q-search').fill('canonical duplicate')
        page.wait_for_timeout(250)
        assert page.evaluate('studyApp.state.pool.every(q => ["canonical", "duplicate"].every(w => q.evidence.map(e => e.quote).join(" ").toLowerCase().includes(w)))')
        page.locator('#q-search').fill('noresultxyz123')
        page.wait_for_timeout(250)
        assert matched(page) == 0 and page.locator('.empty [data-act="clear"]').is_visible()
        page.locator('.empty [data-act="clear"]').click()
        assert matched(page) == 669 and page.evaluate('studyApp.state.scope') == 'qa'
        # Every card shows its question, choices, model answer and every Google excerpt.
        failures = page.evaluate(CARD_CHECK)
        assert not failures, failures[:20]
        results['cards'][mode] = 669
        page.evaluate("studyApp.clearFilters(); studyApp.show(0)")
        page.locator('#reset-progress').click()
        page.locator('#reset-progress').click()
        # Saved progress, kept separately per format.
        if mode == 'practice':
            page.locator('#reveal-answer').click()
            page.locator('#mark-review').click()
            page.reload(); ready(page)
            assert page.evaluate('practiceAudit().marks["F01-01"]') == 'review'
            page.locator('#review-queue').click()
            assert matched(page) == 1
        else:
            wrong = page.evaluate('studyApp.data().questions[0].options.find(o => !o.correct).id')
            page.locator(f'[data-option="{wrong}"]').click()
            assert page.evaluate('[practiceAudit().answered, practiceAudit().firstCorrect]') == [1, 0]
            page.locator('[data-act="retry"]').click()
            correct = page.evaluate('studyApp.data().questions[0].correctOptionId')
            page.locator(f'[data-option="{correct}"]').click()
            assert page.evaluate('[practiceAudit().answered, practiceAudit().firstCorrect]') == [1, 0]
            page.reload(); ready(page)
            assert page.evaluate('[practiceAudit().answered, practiceAudit().firstCorrect]') == [1, 0]
            assert page.evaluate('JSON.parse(localStorage.getItem("seo-public-practice-v1"))["F01-01"]') == 'review'
        page.evaluate('studyApp.clearFilters()')
        # Reading views.
        page.locator('.views [data-view="glossary"]').click()
        assert page.locator('.definition-card').count() == 127
        page.locator('#glossary-search').fill('canonical')
        assert page.locator('.definition-card').count() > 0
        page.locator('.views [data-view="notes"]').click()
        assert page.locator('#notes-list .note-chapter').count() == 95
        page.locator('.views [data-view="sources"]').click()
        for number in ('1', '28', '68', '77', '95', '102'):
            page.select_option('#source-select', number)
            assert page.locator('.source-body').inner_text()
        page.locator('.views [data-view="practice"]').click()
        page.evaluate("(h => h.getAttribute('aria-expanded') === 'true' || h.click())(document.querySelector('.grp-head[data-grp=\"Appearance · Search presentation\"]'))")
        page.locator('.doc[data-chapter="52"]').click()
        assert matched(page) == 9
        page.evaluate('studyApp.clearFilters()')
        # Links to questions, copying and deep links.
        page.locator('[data-act="next"]').first.click()
        assert page.url.endswith('#q2'), page.url
        page.locator('#copy-question').click()
        assert page.evaluate('navigator.clipboard.readText()').endswith(mode + '/#q2')
        page.goto(BASE + mode + '/#q500', wait_until='networkidle'); ready(page)
        assert page.evaluate('practiceAudit().current') == 500
        page.goto(BASE + mode + '/#topic-3', wait_until='networkidle'); ready(page)
        assert matched(page) == group3_count
        page.goto(BASE + mode + '/', wait_until='networkidle'); ready(page)
        page.screenshot(path=str(PREVIEWS / (mode + '-desktop.png')), full_page=True)
        # Layout at narrow phone, phone, tablet, laptop and desktop widths.
        for width in (320, 390, 768, 1024, 1440):
            page.set_viewport_size({'width': width, 'height': 900})
            assert no_overflow(page), (mode, width)
            if width <= 880:
                page.locator('#menu-btn').click()
                assert page.evaluate("document.querySelector('.workspace').inert")
                page.keyboard.press('Escape')
                assert not page.evaluate("document.querySelector('.workspace').inert")
                page.locator('#menu-btn').click()
                page.evaluate("(h => h.getAttribute('aria-expanded') === 'true' || h.click())(document.querySelector('.grp-head[data-grp=\"Appearance · Titles, media & Stories\"]'))")
                page.locator('.doc[data-chapter="95"]').click()
                assert not page.evaluate("document.getElementById('rail').classList.contains('is-open')")
                assert matched(page) == 5
                page.evaluate('studyApp.clearFilters()')
                page.locator('#filter-btn').click()
                page.locator('input[name="set"][value="priority"]').check()
                page.locator('#sheet-apply').click()
                assert matched(page) == 179
                page.evaluate('studyApp.clearFilters()')
        page.set_viewport_size({'width': 390, 'height': 844})
        mobile_failures = page.evaluate('''() => { const f = []; studyApp.clearFilters();
          for (let i = 0; i < studyApp.data().questions.length; i++) { studyApp.show(i);
            if (document.documentElement.scrollWidth > innerWidth + 1) f.push(studyApp.data().questions[i].key); }
          studyApp.show(0); return f; }''')
        assert not mobile_failures, mobile_failures
        page.screenshot(path=str(PREVIEWS / (mode + '-mobile.png')), full_page=True)
        if mode == 'quiz':
            if page.locator('[data-act="retry"]').count():
                page.locator('[data-act="retry"]').click()
            page.locator('[data-option]').first.click()
        else:
            page.locator('#reveal-answer').click()
        assert no_overflow(page)
        page.screenshot(path=str(PREVIEWS / (mode + '-mobile-answer.png')), full_page=True)

    # Switching format keeps the question and changes the address.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.goto(BASE + 'quiz/#q40', wait_until='networkidle'); ready(page)
    page.locator('[data-mode="practice"]').click()
    page.wait_for_function("practiceAudit().mode === 'practice'")
    assert page.url.endswith('/practice/#q40'), page.url
    page.go_back(); page.wait_for_function("practiceAudit().mode === 'quiz'")

    page.goto(BASE, wait_until='networkidle')
    assert page.locator('#resume').is_visible()
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 844})
        page.goto(BASE, wait_until='networkidle')
        assert no_overflow(page), ('home', width)
        if width == 390:
            page.screenshot(path=str(PREVIEWS / 'home-mobile.png'), full_page=True)
    assert not errors, errors
    assert not failed_requests, failed_requests
    browser.close()

# Every published file is served unchanged.
for path in PUBLIC.rglob('*'):
    if path.is_file():
        with urlopen(BASE + path.relative_to(PUBLIC).as_posix(), timeout=30) as response:
            assert response.status == 200
            assert hashlib.sha256(response.read()).hexdigest() == hashlib.sha256(path.read_bytes()).hexdigest()
hash_file = ROOT.parent / 'Google SEO Four-Choice Quiz/original_files_sha256.json'
originals = 0
if hash_file.exists():
    for relative, expected in json.loads(hash_file.read_text(encoding='utf-8')).items():
        assert hashlib.sha256((ROOT.parent / relative).read_bytes()).hexdigest() == expected, relative
        originals += 1
results.update({'widths': [320, 390, 768, 1024, 1440], 'allMobileCardsChecked': True,
                'scopedSearchAndFiltersChecked': True, 'savedProgressPerFormatChecked': True,
                'formatSwitchKeepsQuestion': True, 'questionLinksAndCopyChecked': True,
                'allPublishedFilesServed': True, 'originalArtifactsChecked': originals,
                'browserErrors': errors, 'failedRequests': failed_requests})
(ROOT / 'browser_verification.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
server.shutdown()
print(json.dumps(results, indent=2))

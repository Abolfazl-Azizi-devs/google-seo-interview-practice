"""Export the shared data files and downloads from the original study packs.

Optional workspace step: it reads the original complete pack and four-choice pack from sibling
directories, which are not part of this repository. The committed public/ folder does not need it.

    python build_site.py   # data + downloads
    python build_pages.py  # HTML pages from site/ templates

Quiz option text comes from content/quiz-correct-options.json and content/quiz-wrong-options.json:
options of similar length and wording, so the answer can't be spotted from its form. The full model
answer stays in study-data.json and is shown after a choice. content/answer-fixes.json holds
reviewed corrections to a few model answers and their evidence.
"""
from pathlib import Path
import copy
import json
import shutil

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
PUBLIC = ROOT / 'public'
ASSETS = PUBLIC / 'assets'
ORIGINAL = WORKSPACE / 'Complete Google SEO Interview Pack'
QUIZ = WORKSPACE / 'Google SEO Four-Choice Quiz'
OWNER = 'Abolfazl-Azizi-devs'
REPO = 'google-seo-interview-practice'
BASE_URL = f'https://{OWNER.lower()}.github.io/{REPO}/'

for folder in (ASSETS, PUBLIC / 'downloads'):
    folder.mkdir(parents=True, exist_ok=True)

base = json.loads((ORIGINAL / 'practice_data.json').read_text(encoding='utf-8'))
quiz = json.loads((QUIZ / 'quiz_data.json').read_text(encoding='utf-8'))
assert len(base['questions']) == len(quiz['questions']) == 669
for a, b in zip(base['questions'], quiz['questions']):
    assert all(a[k] == b[k] for k in a)

public_data = copy.deepcopy(base)
for chapter in public_data['chapters']:
    chapter['questions'] = [q['id'] for q in chapter['questions']]
# Only editorial wrapper copy changes; questions, answers, excerpts and notes remain intact.
public_data['scope'] = ('669 questions covering 95 Google documentation pages: 9 fundamentals, '
                        '41 crawling and indexing, and 45 ranking and search appearance. '
                        'Includes 10 cross-topic scenarios, 76 additional appearance questions '
                        'and 127 definitions. The source library includes 94 full licensed articles, '
                        'a labeled brief of the Google Support article, and seven official supplements. '
                        'Linked subguides are not recursively included.')
public_data['license'] = ('Google article text: CC BY 4.0. Google code samples: Apache 2.0. '
                          'Original source links and revision dates accompany the excerpts. '
                          'Questions, explanations and definitions are editorial paraphrases.')
for key in ('plan', 'stories', 'employerQuestions'):
    public_data.pop(key, None)
# Reviewed corrections: answers whose original wording went beyond the quoted Google text.
answer_fixes = json.loads((ROOT / 'content/answer-fixes.json').read_text(encoding='utf-8'))
for q in public_data['questions']:
    fix = answer_fixes.get(q['key'])
    if fix:
        q.update({k: fix[k] for k in ('question', 'answer', 'evidence') if k in fix})
(ASSETS / 'study-data.json').write_text(json.dumps(public_data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

correct_text = json.loads((ROOT / 'content/quiz-correct-options.json').read_text(encoding='utf-8'))
wrong_text = json.loads((ROOT / 'content/quiz-wrong-options.json').read_text(encoding='utf-8'))
choices = {}
for q in quiz['questions']:
    options = copy.deepcopy(q['options'])
    for option in options:
        option['text'] = correct_text[q['key']] if option['correct'] else wrong_text[q['key']][option['id']]
    choices[q['key']] = {'options': options, 'correctOptionId': q['correctOptionId']}
assert len(choices) == len(correct_text) == 669
(ASSETS / 'quiz-choices.json').write_text(json.dumps(choices, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

downloads = ['All_95_Source_Links.txt', 'Complete_SEO_Interview_Workbook.docx', 'Complete_SEO_Interview_Workbook.pdf',
             'Complete_Google_SEO_Source_Reference.docx', 'Complete_Google_SEO_Source_Reference.pdf',
             'SEO_Definitions_Quick_Review.docx', 'SEO_Definitions_Quick_Review.pdf']
for filename in downloads:
    shutil.copyfile(ORIGINAL / filename, PUBLIC / 'downloads' / filename)

(ASSETS / 'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#152d3a"/><circle cx="27" cy="26" r="13" fill="none" stroke="#8ed9c9" stroke-width="5"/><path d="m37 37 12 12" stroke="#8ed9c9" stroke-width="6" stroke-linecap="round"/></svg>', encoding='utf-8')
(PUBLIC / '.nojekyll').write_text('', encoding='utf-8')
(PUBLIC / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n', encoding='utf-8')
(PUBLIC / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{BASE_URL}{path}</loc></url>' for path in ('', 'practice/', 'quiz/')) + '</urlset>', encoding='utf-8')
audit = {'questions': 669, 'documents': 95, 'definitions': 127, 'sources': 102,
         'originalAnswersAndEvidenceUnchanged': not answer_fixes,
         'correctQuizOptionsRewritten': 669, 'wrongQuizOptionsRewritten': 2007, 'answersCorrected': len(answer_fixes),
         'sharedStudyDataBytes': (ASSETS / 'study-data.json').stat().st_size,
         'sourceSnapshot': base['reviewed'], 'baseUrl': BASE_URL}
(ROOT / 'content_verification.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
print(json.dumps(audit, indent=2))

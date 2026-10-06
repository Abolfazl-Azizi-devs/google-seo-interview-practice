"""Render the public HTML pages from the templates in site/.

Run after changing a template or the data files:

    python build_pages.py

Reads public/assets/study-data.json and public/assets/quiz-choices.json and writes
public/index.html, public/practice/index.html, public/quiz/index.html and public/404.html.
Needs only the Python standard library.
"""
from html import escape
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'
SITE = ROOT / 'site'
OWNER = 'Abolfazl-Azizi-devs'
REPO = 'google-seo-interview-practice'
BASE_URL = f'https://{OWNER.lower()}.github.io/{REPO}/'
TRY_KEY = 'C19-06'

data = json.loads((PUBLIC / 'assets/study-data.json').read_text(encoding='utf-8'))
choices = json.loads((PUBLIC / 'assets/quiz-choices.json').read_text(encoding='utf-8'))
questions = data['questions']
total = len(questions)
chapters = {c['id']: c for c in data['chapters']}

DESCRIPTION = (f'Practise {total} SEO interview questions from {len(chapters)} Google documentation pages. '
               'Answer aloud or take a four-choice quiz, and check every answer against the Google excerpt it comes from.')
TITLES = {'home': 'SEO interview practice: 669 questions checked against Google’s documentation',
          'practice': 'Answer aloud · SEO interview practice',
          'quiz': 'Multiple choice · SEO interview practice'}
H1 = {'practice': 'Answer-aloud SEO interview practice', 'quiz': 'Multiple-choice SEO interview quiz'}


def meta(mode):
    prefix = 'assets/' if mode == 'home' else '../assets/'
    url = BASE_URL + ('' if mode == 'home' else mode + '/')
    title = TITLES[mode]
    tags = [
        ('name', 'description', DESCRIPTION), ('name', 'theme-color', '#152d3a'),
        ('property', 'og:title', title), ('property', 'og:description', DESCRIPTION),
        ('property', 'og:type', 'website'), ('property', 'og:url', url),
        ('property', 'og:image', BASE_URL + 'assets/social-preview.png'),
        ('property', 'og:image:width', '1200'), ('property', 'og:image:height', '630'),
        ('property', 'og:image:alt', f'SEO interview practice: {total} questions, {len(chapters)} Google documents, answer-aloud and multiple-choice modes.'),
        ('name', 'twitter:card', 'summary_large_image'),
    ]
    out = [f'<meta {a}="{escape(b)}" content="{escape(c)}">' for a, b, c in tags]
    out.append(f'<link rel="canonical" href="{url}">')
    out.append(f'<link rel="icon" href="{prefix}favicon.svg" type="image/svg+xml">')
    return '\n'.join(out)


def size(name):
    n = (PUBLIC / 'downloads' / name).stat().st_size
    return f'{n / 1048576:.1f} MB' if n >= 1048576 else f'{max(1, round(n / 1024))} KB'


DOWNLOADS = [
    ('Q&A workbook', f'All {total} questions with model answers', [('PDF', 'Complete_SEO_Interview_Workbook.pdf'), ('Word', 'Complete_SEO_Interview_Workbook.docx')]),
    ('Complete source reference', 'The licensed Google articles behind every answer', [('PDF', 'Complete_Google_SEO_Source_Reference.pdf'), ('Word', 'Complete_Google_SEO_Source_Reference.docx')]),
    ('Definitions quick review', f'{len(data["glossary"])} terms on a few pages', [('PDF', 'SEO_Definitions_Quick_Review.pdf'), ('Word', 'SEO_Definitions_Quick_Review.docx')]),
    ('All 95 source links', 'Plain list of the Google pages used', [('TXT', 'All_95_Source_Links.txt')]),
]


def downloads(prefix):
    rows = []
    for title, note, files in DOWNLOADS:
        links = ''.join(f'<a class="file-link" href="{prefix}downloads/{f}">{kind} <span>{size(f)}</span></a>' for kind, f in files)
        rows.append(f'<li><b>{escape(title)}</b><small>{escape(note)}</small><span class="files">{links}</span></li>')
    return ''.join(rows)


def fill(template, values):
    text = (SITE / template).read_text(encoding='utf-8')
    for k, v in values.items():
        text = text.replace('{{' + k + '}}', str(v))
    assert '{{' not in text, template
    return text


common = {'total': total, 'reviewed': escape(data['reviewed']), 'reviewed_short': escape(data['reviewed'].replace('October', 'Oct')), 'glossary_total': len(data['glossary']),
          'sources_total': len(data['sources'])}

for mode in ('practice', 'quiz'):
    html = fill('study.html', {**common, 'title': TITLES[mode], 'meta': meta(mode), 'mode': mode, 'h1': H1[mode],
                               'quiz_checked': str(mode == 'quiz').lower(), 'practice_checked': str(mode == 'practice').lower(),
                               'downloads_compact': downloads('../')})
    (PUBLIC / mode).mkdir(exist_ok=True)
    (PUBLIC / mode / 'index.html').write_text(html, encoding='utf-8')

# Home page: one real question, the coverage chart and the downloads list.
tq = next(q for q in questions if q['key'] == TRY_KEY)
opts = choices[TRY_KEY]['options']
correct = next(i for i, o in enumerate(opts) if o['correct'])
ev = tq['evidence'][0]
try_options = ''.join(f'<li><button class="opt" data-i="{i}"><span class="opt-key">{"ABCD"[i]}</span><span class="opt-text">{escape(o["text"])}</span></button></li>' for i, o in enumerate(opts))
try_json = json.dumps({'correct': correct, 'answer': tq['answer']}, ensure_ascii=False).replace('</', '<\\/')

AREAS = [('Fundamentals', lambda g: g == 'Fundamentals', 'a1', 'var(--ink)'),
         ('Crawling and indexing', lambda g: g.startswith('Crawl'), 'a2', 'var(--teal)'),
         ('Ranking and appearance', lambda g: g.startswith('Appearance'), 'a3', 'var(--right)')]
group_counts = {g: sum(1 for q in questions if chapters[q['chapter']]['group'] == g) for g in data['groups']}
group_docs = {g: sum(1 for c in chapters.values() if c['group'] == g) for g in data['groups']}
peak = max(group_counts.values())
split = legend = bars = ''
for name, test, cls, color in AREAS:
    gs = [g for g in data['groups'] if test(g)]
    n = sum(group_counts[g] for g in gs)
    docs = sum(group_docs[g] for g in gs)
    split += f'<i class="{cls}" style="width:{n / total * 100:.2f}%"></i>'
    legend += f'<span><i class="{cls}"></i>{name} <b>{n}</b></span>'
    rows = ''
    for g in gs:
        label = g.split(' · ', 1)[-1]
        idx = data['groups'].index(g) + 1
        rows += (f'<li><a href="quiz/#topic-{idx}"><span class="name">{escape(label)}<small>{group_docs[g]} docs</small></span>'
                 f'<span class="track"><span class="fill" style="width:{group_counts[g] / peak * 100:.1f}%;background:{color}"></span></span>'
                 f'<span class="v">{group_counts[g]}</span></a></li>')
    bars += f'<div class="area-block"><h3>{name} · {docs} documents</h3><ul class="bars">{rows}</ul></div>'

home = fill('home.html', {
    **common, 'title': TITLES['home'], 'meta': meta('home'), 'documents': len(chapters), 'definitions': len(data['glossary']),
    'flags': len(data['flags']), 'total_minus_one': total - 1,
    'try_key': TRY_KEY, 'try_question': escape(tq['question']), 'try_options': try_options,
    'try_quote': escape(ev['quote']), 'try_url': escape(ev['url']), 'try_url_short': escape(ev['url'].split('://', 1)[-1].split('#')[0]),
    'try_json': try_json, 'split': split, 'split_legend': legend, 'bars': bars, 'downloads_full': downloads(''),
})
(PUBLIC / 'index.html').write_text(home, encoding='utf-8')

(PUBLIC / '404.html').write_text(f'''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found · SEO interview practice</title>
<meta name="robots" content="noindex"><link rel="icon" href="{BASE_URL}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{BASE_URL}assets/site.css"></head>
<body class="home"><main class="wrap lost"><p class="label">Error 404</p><h1>This page does not exist</h1>
<p class="muted">The link may be old or mistyped. The questions are still here.</p>
<p class="hero-ctas"><a class="btn btn-primary" href="{BASE_URL}">Go to the home page</a><a class="btn" href="{BASE_URL}quiz/">Open the quiz</a></p></main></body>
</html>
''', encoding='utf-8')
print(f'Wrote index.html, practice/, quiz/ and 404.html ({total} questions, {len(chapters)} documents).')

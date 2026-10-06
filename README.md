# SEO interview practice

Two practice formats using the same 669 questions and Google source evidence:

- [Home](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/)
- [Multiple choice](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/quiz/)
- [Answer aloud](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/practice/)

The guide covers 95 Google documentation pages and includes 127 definitions, document notes, a source library, and downloadable Word/PDF workbooks. Documentation was reviewed on 6 October 2026; original links and revision dates are retained.

## How it works

- Both formats run on one script, `public/assets/app.js`. The format switch on the practice screen changes between `/quiz/` and `/practice/` without reloading and keeps the current question.
- Documents are grouped in the sidebar by area and topic group, with progress per group. Progress, question set, search scope and order are set in the Filters panel; every active filter shows as a removable chip.
- Each question has its own link, such as `quiz/#q500`. `#review` opens the review queue and `#topic-3` opens one topic group.
- The quiz has one correct option and three wrong ones. The correct option is a short form of the model answer, written to the same length as the wrong options (`content/quiz-correct-options.json`). After a choice, the full model answer and the Google excerpts are shown. The score counts the first choice per question; retries do not change it.
- Progress is stored only in the browser, under separate keys for the two formats (`seo-public-quiz-v1`, `seo-public-practice-v1`). No account, analytics or third-party scripts.

## Run locally

This is a static site with no installation step:

```sh
python -m http.server 9000 --directory public
```

Open `http://localhost:9000/`. Serve over HTTP rather than opening files directly, because the pages load their JSON data with `fetch`.

## Files

| Path | Purpose |
|---|---|
| `public/` | The published site. GitHub Pages deploys it after a push to `main` (`.github/workflows/pages.yml`). |
| `public/assets/app.js`, `site.css` | The app and the stylesheet for every page. |
| `public/assets/study-data.json` | Questions, answers, evidence, notes, definitions and source library. |
| `public/assets/quiz-choices.json` | The four options per question. |
| `site/` | Templates for the home page and the two practice pages. |
| `build_pages.py` | Renders `public/index.html`, `public/practice/`, `public/quiz/` and `404.html` from `site/`. Standard library only. |
| `build_site.py` | Optional. Re-exports the data files and downloads from the original study packs in sibling folders, applying `content/quiz-correct-options.json`. |
| `verify_site.py` | Playwright checks under the GitHub Pages path: all 669 cards in both formats, filters, search, saved progress, links, format switching, layout at 320–1440px and every published file. |

After editing a template run `python build_pages.py`, then `python verify_site.py`.

## Source notices

Google article text and excerpts retain source attribution under CC BY 4.0. Google code examples use Apache 2.0. The source library preserves 94 full licensed articles, a labeled summary for the selected Google Support article, and seven official supplements. Linked subguides are not recursively included. Questions, explanations, definitions and quiz options are editorial paraphrases; wrong quiz options are not Google quotations.

Manrope and Source Sans 3 are redistributed under the SIL Open Font License. Their license files are included in `public/assets/fonts/`.

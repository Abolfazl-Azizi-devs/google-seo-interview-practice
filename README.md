# SEO interview practice

Two public practice formats using the same 669 questions and Google source evidence:

- [Choose a format](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/)
- [Answer aloud](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/practice/)
- [Multiple choice](https://abolfazl-azizi-devs.github.io/google-seo-interview-practice/quiz/)

The guide covers 95 Google documentation pages and includes 127 definitions, document notes, a source library, and downloadable Word/PDF workbooks. Documentation was reviewed on 6 October 2026; original links and revision dates are retained.

Search has explicit scopes. Topic group, document, progress and question set are separate filters. Selected filters appear as removable chips. The document menu and filter panel work on mobile. Individual questions have links such as `quiz/#q500`.

The quiz has one correct answer and three editorial alternatives per question. The correct choice is the complete original interview answer. Its score counts the first choice per question; retries do not change that score. Answers and confidence marks are stored only in the browser, with separate storage keys for the two formats.

## Run locally

This is a static site. It has no installation or compilation step:

```sh
python -m http.server 9000 --directory public
```

Open `http://localhost:9000/`. Serve over HTTP rather than opening individual files, because the public editions load their shared JSON data with `fetch`.

## Publishing

GitHub Pages deploys the committed `public/` directory after a push to `main`, through `.github/workflows/pages.yml`. The original offline editions are preserved in separate workspace folders; this repository contains the public editions.

The shared study data is in `public/assets/study-data.json`; quiz choices are in `public/assets/quiz-choices.json`. Chapter question IDs are hydrated from the shared question bank when the page loads. Fonts are self-hosted. No analytics or third-party scripts are loaded.

`build_site.py` is the optional workspace export script. It reads the original complete pack and four-choice pack from sibling directories. Its inputs are not needed to serve or deploy the committed public site. `verify_site.py` runs browser checks with Playwright against a local server mounted under the GitHub Pages project path. Validation reports are `content_verification.json` and `browser_verification.json`.

## Source notices

Google article text and excerpts retain source attribution under CC BY 4.0. Google code examples use Apache 2.0. The source library preserves 94 full licensed articles, a labeled summary for the selected Google Support article, and seven official supplements. Linked subguides are not recursively included. Questions, explanations and definitions are editorial paraphrases; incorrect quiz alternatives are not Google quotations.

Manrope and Source Sans 3 are redistributed under the SIL Open Font License. Their license files are included in `public/assets/fonts/`.

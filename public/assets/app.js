'use strict';
/* SEO interview practice: one app for both formats.
   /practice/ (answer aloud) and /quiz/ (multiple choice) load this file. The format can be
   switched in place; each format keeps its own progress under its original storage key. */
(() => {
  const ROOT = document.body.dataset.root || '../';
  const KEYS = { practice: 'seo-public-practice-v1', quiz: 'seo-public-quiz-v1' };
  const LAST_KEY = 'seo-public-last-v1';
  const TITLES = { practice: 'Answer aloud · SEO interview practice', quiz: 'Multiple choice · SEO interview practice' };
  const LETTERS = 'ABCD';
  const AREAS = [
    ['Fundamentals', g => g === 'Fundamentals'],
    ['Crawling and indexing', g => g.startsWith('Crawl')],
    ['Ranking and appearance', g => g.startsWith('Appearance')]
  ];
  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>'
  };

  const $ = id => document.getElementById(id);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const fmtDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const shortUrl = u => String(u || '').replace(/^https?:\/\//, '').replace(/#.*$/, '');
  const groupName = g => g.replace(/^(Crawl|Appearance) · /, '');

  let DATA = null, chapterById = new Map(), searchIndex = new Map(), termIndex = [], choicesLoaded = false, storageOk = true;
  const S = {
    mode: document.body.dataset.mode === 'quiz' ? 'quiz' : 'practice',
    view: 'practice', chapter: 0, group: '', term: '', scope: 'qa', status: 'all', set: 'all', order: null,
    pool: [], index: 0, retryKey: null, revealed: false, source: 1, openGroups: new Set(), timer: { left: 60, id: null }
  };
  const store = { practice: { marks: {} }, quiz: { marks: {}, responses: {} } };
  const cur = () => store[S.mode];
  const q = () => S.pool[S.index];
  const chapterOf = x => chapterById.get(x.chapter);

  /* ---------- Storage ---------- */
  function readJSON(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
    catch (e) { storageOk = false; return null; }
  }
  function loadStores() {
    const p = readJSON(KEYS.practice);
    if (p) for (const [k, v] of Object.entries(p)) if (v === 'know' || v === 'review') store.practice.marks[k] = v;
    const z = readJSON(KEYS.quiz);
    if (z) {
      if (z.marks && typeof z.marks === 'object') for (const [k, v] of Object.entries(z.marks)) if (v === 'know' || v === 'review') store.quiz.marks[k] = v;
      if (z.responses && typeof z.responses === 'object') store.quiz.rawResponses = z.responses;
    }
  }
  function validateResponses() {
    const raw = store.quiz.rawResponses || {};
    for (const x of DATA.questions) {
      const r = raw[x.key];
      if (r && x.options && x.options.some(o => o.id === r.selected) && typeof r.firstCorrect === 'boolean')
        store.quiz.responses[x.key] = { selected: r.selected, correct: r.selected === x.correctOptionId, firstCorrect: r.firstCorrect };
    }
    delete store.quiz.rawResponses;
  }
  function persist() {
    try {
      const value = S.mode === 'quiz' ? { marks: store.quiz.marks, responses: store.quiz.responses } : store.practice.marks;
      localStorage.setItem(KEYS[S.mode], JSON.stringify(value));
    } catch (e) { storageOk = false; }
    $('storage-notice').hidden = storageOk;
  }
  function rememberPosition() {
    const x = q(); if (!x) return;
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ mode: S.mode, id: x.id })); } catch (e) { /* optional */ }
  }

  /* ---------- Data ---------- */
  async function fetchJSON(path) {
    const r = await fetch(ROOT + path);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function loadChoices() {
    if (choicesLoaded) return;
    const choices = await fetchJSON('assets/quiz-choices.json');
    for (const x of DATA.questions) Object.assign(x, choices[x.key]);
    choicesLoaded = true;
    validateResponses();
  }
  function prepare() {
    const byId = new Map(DATA.questions.map(x => [x.id, x]));
    for (const c of DATA.chapters) { c.questions = c.questions.map(id => byId.get(id)).filter(Boolean); chapterById.set(c.id, c); }
    for (const x of DATA.questions) {
      const question = x.question.toLowerCase(), answer = x.answer.toLowerCase(), evidence = x.evidence.map(e => e.quote).join(' ').toLowerCase();
      searchIndex.set(x.key, { question, qa: question + ' ' + answer, evidence, all: [question, answer, evidence, chapterOf(x).title.toLowerCase()].join(' ') });
    }
    // Definitions that appear in a question; very common terms are skipped because they say nothing specific.
    // Product names that are also ordinary words (Discover) only match with their capital letter.
    const PROPER = new Set(['Discover']);
    termIndex = DATA.glossary.map(g => {
      const t = g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { g, re: new RegExp('(^|[^A-Za-z0-9])' + t + '([^A-Za-z0-9]|$)', PROPER.has(g.term) ? '' : 'i') };
    }).filter(({ re }) => DATA.questions.filter(x => re.test(x.question + ' ' + x.answer)).length <= 60);
  }

  /* ---------- Pool ---------- */
  function counts(s) {
    let n = 0; const words = s.term.toLowerCase().split(/\s+/).filter(Boolean);
    const { marks } = cur(), responses = store.quiz.responses;
    for (const x of DATA.questions) if (passes(x, s, words, marks, responses)) n++;
    return n;
  }
  function passes(x, s, words, marks, responses) {
    if (s.chapter && x.chapter !== s.chapter) return false;
    if (s.group && chapterOf(x).group !== s.group) return false;
    if (s.set !== 'all' && !(s.set === 'priority' ? x.priority : s.set === 'scenarios' ? x.scenario : x.additional)) return false;
    if (s.status !== 'all') {
      if (s.status === 'unseen') { if (S.mode === 'quiz' ? responses[x.key] : marks[x.key]) return false; }
      else if (marks[x.key] !== s.status) return false;
    }
    if (words.length) { const text = searchIndex.get(x.key)[s.scope]; if (!words.every(w => text.includes(w))) return false; }
    return true;
  }
  function rebuildPool(keep = true) {
    const current = q()?.id;
    const words = S.term.toLowerCase().split(/\s+/).filter(Boolean);
    S.pool = DATA.questions.filter(x => passes(x, S, words, cur().marks, store.quiz.responses));
    if (S.order) { const rank = new Map(S.order.map((id, i) => [id, i])); S.pool.sort((a, b) => rank.get(a.id) - rank.get(b.id)); }
    const found = keep ? S.pool.findIndex(x => x.id === current) : -1;
    S.index = found >= 0 ? found : 0;
    S.revealed = false; S.retryKey = null;
  }
  function clearFilters() {
    Object.assign(S, { chapter: 0, group: '', term: '', scope: 'qa', status: 'all', set: 'all', order: null });
    $('q-search').value = '';
  }

  /* ---------- Rail ---------- */
  function progressFor(c) {
    const src = S.mode === 'quiz' ? store.quiz.responses : cur().marks;
    return c.questions.reduce((n, x) => n + (src[x.key] ? 1 : 0), 0);
  }
  function renderRail() {
    const term = $('doc-find').value.trim().toLowerCase();
    const hereId = S.view === 'practice' ? q()?.chapter : 0;
    let html = '', hits = 0;
    for (const [area, test] of AREAS) {
      let block = '';
      for (const g of DATA.groups.filter(test)) {
        const all = DATA.chapters.filter(c => c.group === g);
        const docs = all.filter(c => !term || c.title.toLowerCase().includes(term));
        if (!docs.length) continue;
        hits += docs.length;
        const total = all.reduce((n, c) => n + c.questions.length, 0), done = all.reduce((n, c) => n + progressFor(c), 0);
        const open = term || S.openGroups.has(g) || S.group === g;
        block += `<div class="grp"><button class="grp-head" data-grp="${esc(g)}" aria-expanded="${!!open}">${ICON.chev}<span>${esc(groupName(g))}</span><span class="n">${done}/${total}</span><span class="grp-bar"><i style="width:${(done / total * 100).toFixed(1)}%"></i></span></button>
          <ul class="grp-docs"${open ? '' : ' hidden'}>
          ${term ? '' : `<li><button class="doc all-in-group" data-group="${esc(g)}" aria-pressed="${S.group === g && !S.chapter}"><span>All questions in this group</span><span class="n">${total}</span></button></li>`}
          ${docs.map(c => {
            const dn = progressFor(c), n = c.questions.length, here = c.id === hereId;
            return `<li><button class="doc${here ? ' is-here' : ''}" data-chapter="${c.id}" aria-pressed="${S.chapter === c.id}"${here ? ' aria-current="location"' : ''}><span>${esc(c.title)}</span><span class="n${dn === n ? ' done' : ''}">${dn ? dn + '/' : ''}${n}</span></button></li>`;
          }).join('')}</ul></div>`;
      }
      if (block) html += `<div class="area"><p class="area-name">${area}</p>${block}</div>`;
    }
    $('rail-groups').innerHTML = hits ? html : `<p class="rail-empty">No document title contains “${esc(term)}”.</p>`;
    $('rail-all').setAttribute('aria-pressed', String(!S.chapter && !S.group));
  }
  const rail = $('rail'), scrim = $('scrim'), menuBtn = $('menu-btn'), workspace = document.querySelector('.workspace');
  const mobile = matchMedia('(max-width: 880px)');
  function openRail() {
    rail.classList.add('is-open'); scrim.classList.add('is-open'); menuBtn.setAttribute('aria-expanded', 'true');
    workspace.inert = true; requestAnimationFrame(() => (rail.querySelector('.rail-views button') || $('rail-all')).focus({ preventScroll: true }));
  }
  function closeRail(focusBack) {
    const was = rail.classList.contains('is-open');
    rail.classList.remove('is-open'); scrim.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); workspace.inert = false;
    if (was && focusBack) menuBtn.focus({ preventScroll: true });
  }
  mobile.addEventListener('change', () => { if (!mobile.matches) closeRail(false); });

  /* ---------- Views ---------- */
  const VIEWS = [['practice', 'Practice'], ['notes', 'Notes'], ['glossary', 'Definitions'], ['sources', 'Source library']];
  function renderViewTabs() {
    document.querySelectorAll('[data-views]').forEach(nav => {
      nav.innerHTML = VIEWS.map(([k, l]) => `<button role="tab" data-view="${k}" id="tab-${k}" aria-selected="${S.view === k}" tabindex="${S.view === k ? 0 : -1}">${l}</button>`).join('');
    });
  }
  function setView(v, opts = {}) {
    stopTimer();
    S.view = v;
    for (const k of ['practice', 'notes', 'glossary', 'sources']) $(k + '-pane').hidden = k !== v;
    $('context').hidden = v !== 'practice';
    $('content').classList.toggle('single', v !== 'practice');
    document.body.classList.toggle('has-bar', v === 'practice' && S.pool.length > 0);
    renderViewTabs();
    if (v === 'practice') renderPractice();
    if (v === 'notes') renderNotes();
    if (v === 'glossary') renderGlossary();
    if (v === 'sources') renderSource(opts.anchor || '');
    renderRail(); closeRail(false);
    if (!opts.keepScroll && !opts.anchor) window.scrollTo({ top: 0 });
  }

  /* ---------- Scope line ---------- */
  const STATUS = { all: 'Any progress', unseen: null, review: 'In review queue', know: 'Marked confident' };
  const SETS = { all: 'All questions', priority: 'Priority questions', scenarios: 'Cross-topic scenarios', extra: 'Additional appearance' };
  const SCOPES = { qa: 'Questions and answers', question: 'Questions only', evidence: 'Google excerpts', all: 'Everything on the card' };
  const unseenLabel = () => S.mode === 'quiz' ? 'Not answered yet' : 'Not marked yet';
  function activeChips() {
    const chips = [];
    if (S.term) chips.push(['term', `“${S.term}”` + (S.scope !== 'qa' ? ` in ${SCOPES[S.scope].toLowerCase()}` : '')]);
    if (S.group && !S.chapter) chips.push(['group', groupName(S.group)]);
    if (S.chapter) chips.push(['chapter', chapterById.get(S.chapter).title]);
    if (S.status !== 'all') chips.push(['status', S.status === 'unseen' ? unseenLabel() : STATUS[S.status]]);
    if (S.set !== 'all') chips.push(['set', SETS[S.set]]);
    if (S.order) chips.push(['order', 'Shuffled']);
    return chips;
  }
  function renderScope() {
    const chips = activeChips();
    const n = chips.filter(([k]) => k !== 'term' && k !== 'chapter' && k !== 'group').length;
    $('filter-badge').textContent = n; $('filter-badge').hidden = !n;
    $('scope').innerHTML = `<span class="count"><b>${S.pool.length}</b> of ${DATA.questions.length} questions</span>` +
      (chips.length ? '<span class="sep" aria-hidden="true"></span>' + chips.map(([k, l]) =>
        `<span class="chip"><span>${esc(l)}</span><button data-unchip="${k}" aria-label="Remove filter: ${esc(l)}">${ICON.x}</button></span>`).join('') +
        '<button class="btn btn-ghost" data-unchip="all">Clear all</button>' : '');
    $('search-clear').hidden = !S.term;
  }

  /* ---------- Practice view ---------- */
  function renderPractice() {
    renderModeSeg(); renderScope(); renderCard(); renderContext();
  }
  function renderModeSeg() {
    $('mode-seg').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === S.mode)));
    $('sr-title').textContent = S.mode === 'quiz' ? 'Multiple-choice SEO interview quiz' : 'Answer-aloud SEO interview practice';
  }
  function evidenceHtml(e) {
    const meta = DATA.sources[String(e.source)] || {}, date = fmtDate(meta.updated);
    return `<figure class="evidence">
      <div class="ev-head"><span class="label">From Google’s documentation</span><span class="ev-date">${esc(e.section)}${date ? ' · updated ' + date : ''}</span></div>
      <blockquote>“${esc(e.quote)}”</blockquote>
      <figcaption class="ev-src"><a class="url mono" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(shortUrl(e.url))}</a>
      <button class="btn btn-sm" data-source="${e.source}" data-anchor="${esc(e.anchor || '')}">Read the full section</button></figcaption>
    </figure>`;
  }
  function renderCard() {
    const box = $('card-slot');
    document.body.classList.toggle('has-bar', S.view === 'practice' && S.pool.length > 0);
    if (!S.pool.length) {
      box.innerHTML = `<div class="empty"><p class="label">No matching questions</p><h2>Nothing matches these filters.</h2><p class="muted">Remove a filter or clear the search to see more questions.</p><button class="btn btn-primary" data-act="clear">Clear all filters</button></div>`;
      syncLink(); return;
    }
    S.index = Math.min(S.index, S.pool.length - 1);
    const x = q(), c = chapterOf(x), quiz = S.mode === 'quiz', k = x.key;
    const resp = quiz && S.retryKey !== k ? store.quiz.responses[k] : null;
    const mark = cur().marks[k];
    const shown = quiz ? !!resp || S.revealed : S.revealed;
    const tag = x.scenario ? 'Scenario' : x.priority ? 'Priority' : x.additional ? 'Additional' : '';
    let body = '';
    if (quiz) {
      body = `<ol class="options" aria-label="Answer choices">${x.options.map((o, i) => {
        let cls = '', state = '';
        if (resp) {
          if (o.correct) { cls = ' is-right'; state = ICON.check + (resp.selected === o.id ? 'Your answer' : 'Correct answer'); }
          else if (resp.selected === o.id) { cls = ' is-wrong'; state = ICON.x + 'Your answer'; }
        } else if (S.revealed && o.correct) { cls = ' is-right'; state = ICON.check + 'Correct answer'; }
        return `<li><button class="opt${cls}" data-option="${esc(o.id)}"${shown ? ' disabled' : ''} aria-pressed="${!!(resp && resp.selected === o.id)}"><span class="opt-key">${LETTERS[i]}</span><span class="opt-text">${esc(o.text)}</span><span class="opt-state">${state}</span></button></li>`;
      }).join('')}</ol>` + (shown ? '' : '<button class="btn btn-ghost btn-sm peek" data-act="peek">Show the answer without scoring</button>');
      if (resp) {
        const ok = resp.correct, first = resp.firstCorrect;
        const ci = x.options.findIndex(o => o.correct);
        body += `<div class="verdict ${ok ? 'ok' : 'no'}" role="status">${ok ? ICON.check : ICON.x}<p>${ok
          ? (first ? '<b>Right on the first try.</b> Counted in your first-choice score.' : '<b>Right this time.</b> Your score keeps your first attempt.')
          : `<b>Not this one.</b> The answer is ${LETTERS[ci]}. It is now in your review queue.`}</p><button class="btn btn-sm" data-act="retry">Try again</button></div>`;
      } else if (S.revealed) {
        body += `<div class="verdict peeked" role="status">${ICON.eye}<p>Answer shown without scoring. This question still counts as not answered.</p></div>`;
      }
    } else if (!shown) {
      body = `<div class="aloud"><p class="aloud-prompt">Answer out loud before you reveal: give the rule, one exception, and how you would check it on a real site.</p>
        <div class="timer" id="timer"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="track" cx="20" cy="20" r="16" fill="none" stroke-width="4"/><circle class="arc" id="arc" cx="20" cy="20" r="16" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="0"/></svg>
        <output id="t-out">1:00</output><button class="btn" data-act="timer" id="t-btn">Start timer</button></div></div>`;
    }
    if (shown) {
      body += `<section class="explain" id="answer-area" aria-label="Explanation">
        <div><p class="label">Model answer</p><p class="model answer-text">${esc(x.answer)}</p></div>
        ${x.evidence.map(evidenceHtml).join('')}
        <p class="ev-note">The model answer is an editorial paraphrase. Excerpts are quoted from Google’s documentation under CC BY 4.0.</p>
        <div class="rate"><p>Could you explain this in an interview?</p>
          <div class="seg" role="radiogroup" aria-label="How well you know this">
            <button role="radio" aria-checked="${mark === 'review'}" data-rate="review" id="mark-review">Not yet, review later</button>
            <button role="radio" aria-checked="${mark === 'know'}" data-rate="know" id="mark-know">Yes, confidently</button>
          </div></div></section>`;
    }
    const last = S.index >= S.pool.length - 1;
    let primary = '';
    if (!shown && !quiz) primary = `<button class="btn" data-act="next" id="skip"${last ? ' disabled' : ''}>Skip</button><button class="btn btn-primary" data-act="reveal" id="reveal-answer">Reveal answer</button>`;
    else if (!shown) primary = `<button class="btn" data-act="next" id="skip"${last ? ' disabled' : ''}>Skip</button>`;
    else primary = `<button class="btn btn-primary" data-act="next" id="next"${last ? ' disabled' : ''}>${last ? 'Last question' : 'Next question' + ICON.next}</button>`;
    const hints = quiz
      ? (shown ? '<span><kbd>→</kbd> next</span>' : '<span><kbd>1</kbd>–<kbd>4</kbd> choose</span><span><kbd>R</kbd> show answer</span>')
      : (shown ? '<span><kbd>→</kbd> next</span>' : '<span><kbd>Space</kbd> timer</span><span><kbd>R</kbd> reveal</span>');

    box.innerHTML = `<article class="qcard" id="question-card" aria-labelledby="question-text">
      <header class="q-meta">
        <div class="q-where"><span class="q-pos">Question <b>${S.index + 1}</b> of ${S.pool.length}</span>
          <button class="q-doc" data-chapter="${c.id}" title="Practise only this document">${esc(c.title)}</button></div>
        <div class="q-tags">${tag ? `<span class="tag">${tag}</span>` : ''}<span class="mono q-key">${esc(x.key)}</span>
          <span class="copy-status" id="copy-status" role="status"></span>
          <button class="icon-btn" data-act="copy" id="copy-question" aria-label="Copy a link to this question" title="Copy link">${ICON.link}</button></div>
      </header>
      <h2 class="q-text" id="question-text">${esc(x.question)}</h2>
      ${body}
      <footer class="q-foot">
        <button class="btn btn-prev" data-act="prev" id="previous" aria-label="Previous question"${S.index === 0 ? ' disabled' : ''}>${ICON.prev}<span class="lbl">Previous</span></button>
        <div class="hints">${hints}</div><span class="grow"></span>${primary}
      </footer></article>`;
    if (!quiz && !shown) drawTimer();
    syncLink(); rememberPosition();
  }

  function renderContext() {
    if (!DATA) return;
    const total = DATA.questions.length, { marks } = cur();
    const know = Object.values(marks).filter(v => v === 'know').length, review = Object.values(marks).filter(v => v === 'review').length;
    let panel;
    if (S.mode === 'quiz') {
      const rs = Object.values(store.quiz.responses), answered = rs.length, right = rs.filter(r => r.firstCorrect).length, missed = answered - right;
      panel = `<p class="label">Your quiz progress</p>
        <div class="big"><strong id="quiz-answered">${answered}</strong><span>of ${total} answered${answered ? ` · ${Math.round(right / answered * 100)}% right first time` : ''}</span></div>
        <div class="stack" aria-hidden="true"><i class="c-right" style="width:${right / total * 100}%"></i><i class="c-wrong" style="width:${missed / total * 100}%"></i></div>
        <dl class="legend"><dt class="c-right"></dt><dd>Right on first try</dd><dd class="v" id="quiz-score">${right}</dd>
          <dt class="c-wrong"></dt><dd>Missed</dd><dd class="v">${missed}</dd>
          <dt class="c-know"></dt><dd>Marked confident</dd><dd class="v">${know}</dd>
          <dt class="c-review"></dt><dd>In review queue</dd><dd class="v" id="queue-count">${review}</dd></dl>`;
    } else {
      panel = `<p class="label">Your answer-aloud progress</p>
        <div class="big"><strong>${know + review}</strong><span>of ${total} marked</span></div>
        <div class="stack" aria-hidden="true"><i class="c-know" style="width:${know / total * 100}%"></i><i class="c-review" style="width:${review / total * 100}%"></i></div>
        <dl class="legend"><dt class="c-know"></dt><dd>Marked confident</dd><dd class="v" id="confident-count">${know}</dd>
          <dt class="c-review"></dt><dd>In review queue</dd><dd class="v" id="queue-count">${review}</dd></dl>`;
    }
    panel += `<button class="btn" data-act="queue" id="review-queue"${review ? '' : ' disabled'}>Practise review queue (${review})</button>
      <div class="reset-row"><button class="btn btn-ghost btn-sm" data-act="reset" id="reset-progress">Reset ${S.mode === 'quiz' ? 'quiz' : 'answer-aloud'} progress</button></div>`;
    $('progress-panel').innerHTML = panel;

    const x = q();
    let terms = [];
    if (x) {
      const text = x.question + ' ' + x.answer;
      terms = termIndex.filter(t => t.re.test(text)).map(t => t.g)
        .sort((a, b) => x.question.toLowerCase().includes(b.term.toLowerCase()) - x.question.toLowerCase().includes(a.term.toLowerCase())).slice(0, 3);
    }
    $('terms-panel').hidden = !terms.length;
    $('terms').innerHTML = terms.map(g => `<div><dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd></div>`).join('');
    const flags = x ? DATA.flags.filter(f => f.pages.includes(x.chapter)) : [];
    $('flag-panel').hidden = !flags.length;
    $('flag-panel').innerHTML = flags.length ? `<p class="label">Guidance that changed</p>${flags.map(f => `<h3>${esc(f.title)}</h3><p>${esc(f.text)}</p>`).join('')}<button class="more" data-act="flags">Read all 10 notes</button>` : '';
    $('tp-answered').textContent = S.mode === 'quiz' ? Object.keys(store.quiz.responses).length : know + review;
    $('tp-label').textContent = S.mode === 'quiz' ? ' answered' : ' marked';
  }

  /* ---------- Actions ---------- */
  function choose(optionId) {
    const x = q(); if (!x || S.mode !== 'quiz') return;
    const k = x.key, prev = store.quiz.responses[k];
    if (prev && S.retryKey !== k) return;
    if (S.revealed) return;
    const o = x.options.find(o => o.id === optionId); if (!o) return;
    store.quiz.responses[k] = { selected: o.id, correct: o.correct, firstCorrect: prev ? prev.firstCorrect : o.correct };
    store.quiz.marks[k] = o.correct ? 'know' : 'review';
    S.retryKey = null; persist(); renderCard(); renderContext(); renderRail();
    const v = document.querySelector('.verdict');
    if (v) v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function reveal() {
    if (!q()) return;
    if (S.mode === 'quiz' && store.quiz.responses[q().key] && S.retryKey !== q().key) return;
    S.revealed = true; S.retryKey = null; stopTimer(); renderCard();
  }
  function rate(mark) {
    const x = q(); if (!x) return;
    const m = cur().marks;
    if (m[x.key] === mark) delete m[x.key]; else m[x.key] = mark;
    persist();
    document.querySelectorAll('[data-rate]').forEach(b => b.setAttribute('aria-checked', String(m[x.key] === b.dataset.rate)));
    renderContext(); renderRail();
  }
  function move(d) {
    const n = S.index + d;
    if (n < 0 || n >= S.pool.length) return;
    S.index = n; S.revealed = false; S.retryKey = null; stopTimer(); S.timer.left = 60;
    renderCard(); renderContext(); renderRail();
    const card = $('question-card');
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function refresh(keep = false) {
    rebuildPool(keep); renderScope(); renderCard(); renderContext(); renderRail();
  }
  async function switchMode(m, push = true) {
    if (m === S.mode) return;
    if (m === 'quiz' && !choicesLoaded) {
      $('mode-seg').setAttribute('aria-busy', 'true');
      try { await loadChoices(); } catch (e) { $('mode-seg').removeAttribute('aria-busy'); showStatus('The quiz choices could not load. Check your connection and try again.'); return; }
      $('mode-seg').removeAttribute('aria-busy');
    }
    const keep = q()?.id;
    S.mode = m; document.body.dataset.mode = m; stopTimer(); S.timer.left = 60;
    if (push) history.pushState({ mode: m }, '', new URL(ROOT + m + '/' + (keep ? '#q' + keep : ''), location.href));
    document.title = TITLES[m];
    rebuildPool(false);
    const found = S.pool.findIndex(x => x.id === keep); if (found >= 0) S.index = found;
    if (S.view !== 'practice') setView('practice'); else renderPractice();
    renderRail();
  }
  function showStatus(msg) { const el = $('copy-status'); if (el) { el.textContent = msg; setTimeout(() => { if (el.isConnected) el.textContent = ''; }, 4000); } }
  async function copyLink() {
    syncLink();
    try { await navigator.clipboard.writeText(location.href); showStatus('Link copied'); }
    catch (e) { showStatus('Copy the link from the address bar'); }
  }
  let resetArmed = null;
  function resetProgress(btn) {
    if (!resetArmed) {
      btn.textContent = 'Select again to erase this progress';
      resetArmed = setTimeout(() => { resetArmed = null; renderContext(); }, 4000); return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    if (S.mode === 'quiz') { store.quiz.marks = {}; store.quiz.responses = {}; } else store.practice.marks = {};
    persist(); S.retryKey = null; S.revealed = false; refresh(true);
  }

  /* ---------- Timer ---------- */
  const CIRC = 100.5;
  function drawTimer() {
    const l = S.timer.left, out = $('t-out'); if (!out) return;
    out.textContent = `${Math.floor(l / 60)}:${pad(l % 60)}`;
    $('arc').style.strokeDashoffset = (CIRC * (1 - l / 60)).toFixed(1);
    $('timer').classList.toggle('is-low', l <= 10);
    $('t-btn').textContent = S.timer.id ? 'Pause' : l === 60 ? 'Start timer' : l === 0 ? 'Start again' : 'Resume';
  }
  function stopTimer() { clearInterval(S.timer.id); S.timer.id = null; drawTimer(); }
  function toggleTimer() {
    if (S.timer.id) return stopTimer();
    if (S.timer.left === 0) S.timer.left = 60;
    S.timer.id = setInterval(() => { S.timer.left = Math.max(0, S.timer.left - 1); if (!S.timer.left) stopTimer(); else drawTimer(); }, 1000);
    drawTimer();
  }

  /* ---------- Notes, definitions, sources ---------- */
  function renderNotes() {
    const list = S.chapter ? [chapterById.get(S.chapter)] : DATA.chapters;
    $('notes-list').innerHTML = (S.chapter ? `<button class="btn btn-sm" data-act="all-notes">Show notes for all 95 documents</button>` : '') + list.map(c => `
      <article class="reading note-chapter" id="note-${c.id}">
        <p class="label">Document ${pad(c.id)} · ${esc(c.group.replace(' · ', ': '))}</p>
        <h2>${esc(c.title)}</h2>
        <p class="meta">Google last updated ${esc(fmtDate(c.updated) || c.updated)} · reviewed ${esc(DATA.reviewed)} · ${c.questions.length} questions</p>
        ${c.takeaway ? `<p>${esc(c.takeaway)}</p>` : ''}
        <ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        ${c.headings && c.headings.length ? `<details><summary>Section checklist · ${c.headings.length} headings</summary><ul>${c.headings.map(h => `<li><a href="${esc(c.url + (h.anchor ? '#' + h.anchor : ''))}" target="_blank" rel="noopener">${esc(h.text)}</a></li>`).join('')}</ul></details>` : ''}
        <div class="actions"><button class="btn btn-primary btn-sm" data-practise="${c.id}">Practise this document</button><button class="btn btn-sm" data-source="${c.id}">Read the source</button><a class="btn btn-ghost btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">Google page</a></div>
      </article>`).join('');
    $('flags-list').innerHTML = DATA.flags.map(f => `<article class="reading flag"><p class="label">Affects ${f.pages.map(p => esc(chapterById.get(p)?.title || 'D' + pad(p))).join(' · ')}</p><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p>${f.evidence.map(evidenceHtml).join('')}</article>`).join('');
  }
  function renderGlossary() {
    const t = $('glossary-search').value.trim().toLowerCase();
    const gs = DATA.glossary.filter(g => (g.term + ' ' + g.definition).toLowerCase().includes(t)).sort((a, b) => a.term.localeCompare(b.term));
    $('glossary-count').textContent = `${gs.length} of ${DATA.glossary.length} definitions`;
    $('glossary-list').innerHTML = gs.map(g => `<article class="reading def-card definition-card"><h2>${esc(g.term)}</h2><p>${esc(g.definition)}</p>
      <details><summary>Check the Google evidence</summary>${g.evidence.map(evidenceHtml).join('')}</details>
      ${g.question ? `<div class="actions"><button class="btn btn-sm" data-question="${g.question}">Practise the related question</button></div>` : ''}</article>`).join('')
      || `<div class="empty"><h2>No definition matches “${esc(t)}”.</h2></div>`;
  }
  function renderSource(anchor) {
    const meta = DATA.sources[String(S.source)];
    $('source-select').value = String(S.source);
    $('source-view').innerHTML = `<div class="view-head"><p class="label">${S.source <= 95 ? 'Document ' + pad(S.source) : 'Supplement S' + (S.source - 95)}</p>
      <h2 class="section-title" style="margin:0">${esc(meta.title)}</h2>
      <p class="meta muted">Google last updated ${esc(fmtDate(meta.updated) || meta.updated)} · reviewed ${esc(DATA.reviewed)} · <a href="${esc(meta.url)}" target="_blank" rel="noopener">Open the original page</a></p></div>
      <article class="source-body">${DATA.sourceHtml[String(S.source)]}</article>`;
    if (anchor) requestAnimationFrame(() => {
      const el = document.getElementById('s' + S.source + '-' + anchor);
      if (el) { el.classList.add('highlight'); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  function openSource(n, anchor = '') { S.source = n; setView('sources', { anchor }); }

  /* ---------- Filter sheet ---------- */
  const sheet = $('sheet'), form = $('sheet-form');
  function sheetState() {
    const f = new FormData(form);
    return { ...S, scope: f.get('scope'), status: f.get('status'), set: f.get('set'), order: f.get('order') === 'shuffle' ? (S.order || []) : null };
  }
  function updateSheet() {
    const s = sheetState();
    form.querySelectorAll('[data-count]').forEach(el => {
      const [k, v] = el.dataset.count.split(':');
      el.textContent = counts({ ...s, [k]: v });
    });
    form.querySelector('[name="status"][value="unseen"]').nextElementSibling.textContent = unseenLabel();
    $('sheet-apply').textContent = `Show ${counts(s)} questions`;
  }
  function openSheet() {
    for (const [k, v] of [['scope', S.scope], ['status', S.status], ['set', S.set], ['order', S.order ? 'shuffle' : 'doc']])
      form.querySelector(`[name="${k}"][value="${v}"]`).checked = true;
    updateSheet(); sheet.showModal();
  }
  function shuffled() {
    const o = DATA.questions.map(x => x.id);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  }

  /* ---------- Links ---------- */
  function syncLink() {
    if (S.view !== 'practice') return;
    const x = q(), next = location.pathname + location.search + (x ? '#q' + x.id : '');
    if (location.pathname + location.search + location.hash !== next) history.replaceState(history.state, '', next);
  }
  function openFromHash(h = location.hash) {
    if (h === '#review') { clearFilters(); S.status = 'review'; refresh(); setView('practice'); return; }
    const t = h.match(/^#topic-(\d+)$/);
    if (t && DATA.groups[+t[1] - 1]) { clearFilters(); S.group = DATA.groups[+t[1] - 1]; refresh(); setView('practice'); return; }
    const m = h.match(/^#q(\d+)$/); if (!m) return;
    const id = +m[1]; if (!DATA.questions.some(x => x.id === id)) return;
    if (!S.pool.some(x => x.id === id)) { clearFilters(); rebuildPool(false); }
    S.index = S.pool.findIndex(x => x.id === id); S.revealed = false; S.retryKey = null;
    if (S.view !== 'practice') setView('practice'); else renderPractice();
    renderRail();
  }

  /* ---------- Events ---------- */
  function bind() {
    document.addEventListener('click', async e => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.dataset.view) return setView(t.dataset.view);
      if (t.dataset.mode) return switchMode(t.dataset.mode);
      if (t.dataset.option) return choose(t.dataset.option);
      if (t.dataset.rate) return rate(t.dataset.rate);
      if (t.dataset.source) return openSource(+t.dataset.source, t.dataset.anchor || '');
      if (t.dataset.grp) { const g = t.dataset.grp; S.openGroups.has(g) ? S.openGroups.delete(g) : S.openGroups.add(g); return renderRail(); }
      if (t.dataset.group) { S.group = t.dataset.group; S.chapter = 0; refresh(); return setView('practice'); }
      if (t.dataset.chapter) {
        const id = +t.dataset.chapter;
        if (S.view === 'notes') { S.chapter = id; renderNotes(); renderRail(); closeRail(false); return window.scrollTo({ top: 0 }); }
        if (S.view === 'sources') return openSource(id);
        S.chapter = id; S.group = ''; refresh(); return setView('practice');
      }
      if (t.dataset.practise) { clearFilters(); S.chapter = +t.dataset.practise; refresh(); return setView('practice'); }
      if (t.dataset.question) { clearFilters(); rebuildPool(false); S.index = Math.max(0, S.pool.findIndex(x => x.id === +t.dataset.question)); renderScope(); return setView('practice'); }
      if (t.dataset.unchip) {
        const k = t.dataset.unchip;
        if (k === 'all') clearFilters();
        else if (k === 'term') { S.term = ''; $('q-search').value = ''; }
        else if (k === 'order') S.order = null;
        else S[k] = k === 'chapter' ? 0 : k === 'group' ? '' : 'all';
        return refresh(true);
      }
      switch (t.dataset.act) {
        case 'peek': return reveal();
        case 'reveal': return reveal();
        case 'retry': S.retryKey = q().key; renderCard(); return document.querySelector('[data-option]')?.focus();
        case 'next': return move(1);
        case 'prev': return move(-1);
        case 'timer': return toggleTimer();
        case 'copy': return copyLink();
        case 'clear': clearFilters(); return refresh();
        case 'queue': clearFilters(); S.status = 'review'; return refresh();
        case 'reset': return resetProgress(t);
        case 'flags': setView('notes'); return $('flags-title').scrollIntoView({ block: 'start' });
        case 'all-notes': S.chapter = 0; renderNotes(); return renderRail();
      }
    });
    $('rail-all').addEventListener('click', () => { S.chapter = 0; S.group = ''; if (S.view === 'notes') { renderNotes(); renderRail(); return closeRail(false); } refresh(); setView('practice'); });
    $('doc-find').addEventListener('input', renderRail);
    menuBtn.addEventListener('click', openRail);
    scrim.addEventListener('click', () => closeRail(true));
    let searchTimer;
    $('q-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { S.term = $('q-search').value.trim(); refresh(); }, 140); });
    $('search-clear').addEventListener('click', () => { S.term = ''; $('q-search').value = ''; refresh(true); $('q-search').focus(); });
    $('filter-btn').addEventListener('click', openSheet);
    form.addEventListener('change', updateSheet);
    $('sheet-reset').addEventListener('click', () => {
      for (const [k, v] of [['scope', 'qa'], ['status', 'all'], ['set', 'all'], ['order', 'doc']]) form.querySelector(`[name="${k}"][value="${v}"]`).checked = true;
      updateSheet();
    });
    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close('cancel'); });
    // Apply on submit (synchronous), not on the dialog's close event, which fires a task later.
    form.addEventListener('submit', e => {
      if (!e.submitter || e.submitter.value !== 'apply') return;
      const f = new FormData(form);
      S.scope = f.get('scope'); S.status = f.get('status'); S.set = f.get('set');
      S.order = f.get('order') === 'shuffle' ? (S.order || shuffled()) : null;
      refresh(f.get('order') !== 'shuffle');
    });
    const dlBtn = $('dl-btn'), dlPop = $('dl-pop');
    dlBtn.addEventListener('click', e => { e.stopPropagation(); dlPop.hidden = !dlPop.hidden; dlBtn.setAttribute('aria-expanded', String(!dlPop.hidden)); });
    document.addEventListener('click', e => { if (!dlPop.hidden && !dlPop.contains(e.target) && e.target !== dlBtn) { dlPop.hidden = true; dlBtn.setAttribute('aria-expanded', 'false'); } });
    $('glossary-search').addEventListener('input', renderGlossary);
    $('source-select').addEventListener('change', () => openSource(+$('source-select').value));
    window.addEventListener('hashchange', () => openFromHash());
    window.addEventListener('popstate', () => {
      const m = /\/quiz\/?$/.test(location.pathname) ? 'quiz' : 'practice';
      if (m !== S.mode) switchMode(m, false).then(() => openFromHash()); else openFromHash();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (rail.classList.contains('is-open')) closeRail(true);
        if (!$('dl-pop').hidden) { $('dl-pop').hidden = true; $('dl-btn').setAttribute('aria-expanded', 'false'); }
        return;
      }
      const tab = e.target.closest && e.target.closest('[role="tab"]');
      if (tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')], i = tabs.indexOf(tab);
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setView(tabs[n].dataset.view); document.querySelector(`.views [data-view="${tabs[n].dataset.view}"]`)?.focus();
        return;
      }
      if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable], dialog')) return;
      if (e.metaKey || e.ctrlKey || e.altKey || S.view !== 'practice' || rail.classList.contains('is-open') || !S.pool.length) return;
      const key = e.key.toLowerCase();
      if (S.mode === 'quiz' && /^[1-4]$/.test(key)) { e.preventDefault(); const o = q().options[+key - 1]; if (o) choose(o.id); }
      else if (key === 'arrowright') { e.preventDefault(); move(1); }
      else if (key === 'arrowleft') { e.preventDefault(); move(-1); }
      else if (key === 'r') { e.preventDefault(); reveal(); }
      else if (key === ' ' && S.mode === 'practice' && !S.revealed && $('t-btn')) { e.preventDefault(); toggleTimer(); }
      else if (key === '/') { e.preventDefault(); $('q-search').focus(); }
    });
  }

  function buildStatic() {
    $('source-select').innerHTML = Object.entries(DATA.sources).map(([n, s]) =>
      `<option value="${n}">${+n <= 95 ? 'D' + pad(+n) : 'S' + (+n - 95)} · ${esc(s.title)}</option>`).join('');
    $('scope-text').textContent = DATA.scope;
    $('license-text').textContent = DATA.license;
    $('storage-notice').hidden = storageOk;
  }

  /* ---------- Test hooks ---------- */
  window.practiceAudit = () => ({
    total: DATA.questions.length, documents: DATA.chapters.length, matched: S.pool.length, current: q()?.id,
    chapter: S.chapter, view: S.view, mode: S.mode, marks: { ...cur().marks },
    answered: Object.keys(store.quiz.responses).length, firstCorrect: Object.values(store.quiz.responses).filter(r => r.firstCorrect).length,
    options: q()?.options?.length
  });
  window.studyApp = {
    state: S, data: () => DATA, store,
    show(i) { S.index = i; S.revealed = false; S.retryKey = null; renderCard(); },
    choose, reveal, rate, move, clearFilters() { clearFilters(); refresh(); },
    setFilter(k, v) { S[k] = v; refresh(); }, setView, switchMode
  };

  async function boot() {
    const startHash = location.hash;
    loadStores();
    try {
      DATA = await fetchJSON('assets/study-data.json');
      prepare();
      if (S.mode === 'quiz') await loadChoices();
    } catch (e) {
      $('card-slot').innerHTML = '<div class="empty"><h2>The questions could not load.</h2><p class="muted">Check your connection and refresh this page. The PDF and Word downloads still work.</p></div>';
      return;
    }
    const first = DATA.chapters[0];
    S.openGroups.add(first.group);
    buildStatic(); bind(); rebuildPool(false);
    if (/^#q\d+$/.test(location.hash)) {
      const id = +location.hash.slice(2), found = S.pool.findIndex(x => x.id === id);
      if (found >= 0) { S.index = found; S.openGroups.add(chapterOf(S.pool[found]).group); }
    }
    setView('practice', { keepScroll: true });
    if (/^#(review|topic-\d+)$/.test(startHash)) openFromHash(startHash);
    document.body.classList.add('is-ready');
    window.studyReady = true;
  }
  boot();
})();

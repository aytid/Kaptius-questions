/* ==========================================================
   Technical Interview Question Bank
   Categories, topics and counts are all read from questions.json,
   so adding data never requires changing this file.
   ========================================================== */
(() => {
  'use strict';

  const DIFFS = ['Easy', 'Medium', 'Hard'];
  const ALL = '__all';           // "all categories" value in the interview setup form
  const app = document.getElementById('app');

  /* ---------- small helpers ---------- */

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Fisher-Yates shuffle (returns a new array)
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const diffRank = (d) => DIFFS.indexOf(d);
  const sortDeck = (list) => list.slice().sort((a, b) => diffRank(a.difficulty) - diffRank(b.difficulty) || a._i - b._i);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------- state ---------- */

  const state = {
    all: [],
    view: 'dashboard',   // dashboard | browse | viewer | setup | complete | search | reviewlist | error
    mode: null,          // for view "viewer": session | jumble | result | review
    deck: [],
    index: 0,
    revealed: false,
    filter: { category: '', topic: 'All', difficulty: 'All' },
    setup: { category: ALL, topic: 'All', difficulty: 'All', count: 10, ordered: false },
    session: null,
    query: '',
    results: [],
    marked: new Set(store.get('marked', []))
  };

  /* ---------- data ---------- */

  function normalise(data) {
    if (!Array.isArray(data)) throw new Error('questions.json must contain a list of questions.');
    const seenIds = new Set();
    const seenText = new Set();
    const out = [];
    let nextId = 1 + data.reduce((m, q) => Math.max(m, Number(q && q.id) || 0), 0);

    data.forEach((q) => {
      if (!q || !q.question || !q.category || !q.topic) return;
      const textKey = String(q.question).trim().toLowerCase();
      if (seenText.has(textKey)) return;                       // no duplicate questions
      let id = q.id;
      if (id === undefined || id === null || seenIds.has(id)) id = nextId++;
      const diffMatch = DIFFS.find((d) => d.toLowerCase() === String(q.difficulty).trim().toLowerCase());
      seenIds.add(id);
      seenText.add(textKey);
      out.push({
        id,
        category: String(q.category).trim(),
        topic: String(q.topic).trim(),
        difficulty: diffMatch || 'Medium',
        question: String(q.question).trim(),
        answer: String(q.answer || '').trim(),
        keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.map(String) : [],
        _i: out.length
      });
    });
    return out;
  }

  function categoryMap() {
    const m = new Map();
    state.all.forEach((q) => {
      if (!m.has(q.category)) m.set(q.category, []);
      m.get(q.category).push(q);
    });
    return m;
  }

  function topicCounts(list) {
    const m = new Map();
    list.forEach((q) => m.set(q.topic, (m.get(q.topic) || 0) + 1));
    return m;
  }

  function searchQuestions(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return sortDeck(state.all.filter((q) => {
      const hay = [q.question, q.category, q.topic, ...q.keyPoints].join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    }));
  }

  const markedQuestions = () => state.all.filter((q) => state.marked.has(q.id));

  /* ---------- rendering: shared pieces ---------- */

  function diffBadge(d) {
    const level = diffRank(d);
    const dots = [0, 1, 2].map((i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('');
    return `<span class="badge diff" data-diff="${esc(d)}" title="Difficulty: ${esc(d)}"><span class="dots" aria-hidden="true">${dots}</span>${esc(d)}</span>`;
  }

  function diffBar(list) {
    const counts = DIFFS.map((d) => list.filter((q) => q.difficulty === d).length);
    const segs = DIFFS.map((d, i) => counts[i]
      ? `<span class="seg-${d.toLowerCase()}" style="flex:${counts[i]}"></span>` : '').join('');
    const label = DIFFS.map((d, i) => `${counts[i]} ${d.toLowerCase()}`).join(', ');
    return `<span class="diff-bar" role="img" aria-label="${esc(label)}">${segs}</span><span class="cat-meta">${esc(label)}</span>`;
  }

  function updateReviewCount() {
    const n = markedQuestions().length;
    document.getElementById('review-count').textContent = n;
  }

  /* ---------- rendering: views ---------- */

  function render() {
    switch (state.view) {
      case 'dashboard': app.innerHTML = dashboardHTML(); break;
      case 'browse': app.innerHTML = browseHTML(); renderViewer(); break;
      case 'viewer': app.innerHTML = `<div class="viewer" id="viewer"></div>`; renderViewer(); break;
      case 'setup': app.innerHTML = setupHTML(); break;
      case 'complete': app.innerHTML = completeHTML(); break;
      case 'search': app.innerHTML = searchHTML(); break;
      case 'reviewlist': app.innerHTML = reviewListHTML(); break;
      default: break;
    }
    updateReviewCount();
  }

  function dashboardHTML() {
    const cats = categoryMap();
    const cards = [...cats].map(([name, list]) => {
      const topics = new Set(list.map((q) => q.topic)).size;
      return `
        <button class="cat-card" data-action="open-category" data-category="${esc(name)}">
          <span class="cat-name">${esc(name)}</span>
          <span class="cat-count">${plural(list.length, 'Question')}</span>
          <span class="cat-meta">${plural(topics, 'topic')}</span>
          ${diffBar(list)}
          <span class="cat-go">Explore →</span>
        </button>`;
    }).join('');

    const rows = [...cats].map(([name, list]) => `<tr><th scope="row">${esc(name)}</th><td>${plural(list.length, 'Question')}</td></tr>`).join('');

    return `
      <section class="hero">
        <h1>Technical Interview Question Bank</h1>
        <p>Pick a category and topic, or mix everything. Each question has an expected answer and key points to compare with what the student says.</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="jumble">🎲 Jumble All Questions</button>
          <button class="btn btn-lg" data-action="setup">Start interview session</button>
        </div>
      </section>
      <section class="cats" aria-label="Categories">${cards}</section>
      <section class="panel" style="max-width:540px">
        <table class="totals">
          <caption>Question bank</caption>
          <tbody>${rows}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>${plural(state.all.length, 'Question')}</td></tr></tfoot>
        </table>
      </section>`;
  }

  function browseHTML() {
    const f = state.filter;
    const catList = state.all.filter((q) => q.category === f.category);
    const inDiff = catList.filter((q) => f.difficulty === 'All' || q.difficulty === f.difficulty);
    const counts = topicCounts(inDiff);
    const topicNames = [...topicCounts(catList).keys()];

    const chips = ['All', ...DIFFS].map((d) =>
      `<button class="chip" data-action="difficulty" data-difficulty="${d}" aria-pressed="${f.difficulty === d}">${d}</button>`).join('');

    const topicItems = [
      `<li><button class="topic" data-action="topic" data-topic="All" aria-pressed="${f.topic === 'All'}">All Topics <span class="n">${inDiff.length}</span></button></li>`,
      ...topicNames.map((t) => {
        const n = counts.get(t) || 0;
        return `<li><button class="topic ${n ? '' : 'is-empty'}" data-action="topic" data-topic="${esc(t)}" aria-pressed="${f.topic === t}">${esc(t)} <span class="n">${n}</span></button></li>`;
      })
    ].join('');

    return `
      <div class="browse">
        <aside class="sidebar" aria-label="Filters">
          <button class="link" data-action="home">← Dashboard</button>
          <h2>${esc(f.category)}</h2>
          <div class="filter-group">
            <h3>Difficulty</h3>
            <div class="chips" role="group" aria-label="Difficulty">${chips}</div>
          </div>
          <div class="filter-group">
            <h3>Topics</h3>
            <ul class="topics">${topicItems}</ul>
          </div>
        </aside>
        <section class="viewer" id="viewer" aria-label="Questions"></section>
      </div>`;
  }

  /* ----- viewer (one question at a time) ----- */

  function contextBarHTML() {
    if (state.view !== 'viewer') return '';
    if (state.mode === 'session' && state.session) {
      const p = state.session.params;
      const label = [p.category === ALL ? 'All categories' : p.category, p.topic === 'All' ? 'All topics' : p.topic, p.difficulty === 'All' ? 'All difficulties' : p.difficulty].join(', ');
      return `<div class="ctx"><div><div class="ctx-title">Interview session</div><div class="ctx-sub">${esc(label)}</div></div><button class="btn" data-action="home">End session</button></div>`;
    }
    if (state.mode === 'jumble') {
      return `<div class="ctx"><div><div class="ctx-title">🎲 Jumbled questions</div><div class="ctx-sub">All categories in random order, no repeats</div></div>
        <div class="row"><button class="btn" data-action="reshuffle">🔀 Shuffle Again</button><button class="btn btn-ghost" data-action="home">Dashboard</button></div></div>`;
    }
    if (state.mode === 'result') {
      return `<div class="ctx"><div class="ctx-title">Search results for “${esc(state.query)}”</div><button class="btn" data-action="back-results">← Back to results</button></div>`;
    }
    if (state.mode === 'review') {
      return `<div class="ctx"><div class="ctx-title">⭐ Review questions</div><button class="btn" data-action="review-list">← Back to review list</button></div>`;
    }
    return '';
  }

  function viewerHTML() {
    const n = state.deck.length;
    if (!n) {
      return `${contextBarHTML()}<p class="empty panel">No questions match these filters. Try another topic or difficulty.</p>`;
    }
    const q = state.deck[state.index];
    const pos = state.index + 1;
    const pct = Math.round((pos / n) * 100);
    const isMarked = state.marked.has(q.id);
    const isLast = pos === n;
    const finishes = state.view === 'viewer' && state.mode === 'session' && isLast;

    const points = q.keyPoints.length
      ? `<h3 class="kp">Key Points</h3><ul>${q.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : '';

    return `
      ${contextBarHTML()}
      <div class="progress-row"><span>Question ${pos} of ${n}</span><span>${pct}%</span></div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress"><div style="width:${pct}%"></div></div>

      <article class="qcard" data-diff="${esc(q.difficulty)}">
        <div class="qmeta">
          <span class="badge">Category: <b>${esc(q.category)}</b></span>
          <span class="badge">Topic: <b>${esc(q.topic)}</b></span>
          ${diffBadge(q.difficulty)}
        </div>
        <p class="qnum">Question ${pos}</p>
        <h2 class="qtext">${esc(q.question)}</h2>

        <div class="qtools">
          <button class="btn mark-btn" data-action="mark" aria-pressed="${isMarked}">${isMarked ? '⭐ Marked for Review' : '⭐ Mark for Review'}</button>
        </div>

        <div class="answer" id="answer">
          <h3>Expected Answer</h3>
          <p>${esc(q.answer)}</p>
          ${points}
        </div>
      </article>

      <div class="qnav">
        <button class="btn" data-action="prev" ${state.index === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="btn" data-action="next" ${isLast && !finishes ? 'disabled' : ''}>${finishes ? 'Finish ✓' : 'Next →'}</button>
      </div>
      <p class="kbd-hint"><kbd>←</kbd> previous, <kbd>→</kbd> next, <kbd>Space</kbd> show or hide answer</p>`;
  }

  function renderViewer(focusAction) {
    const el = document.getElementById('viewer');
    if (!el) return;
    el.innerHTML = viewerHTML();
    if (focusAction) {
      const target = el.querySelector(`[data-action="${focusAction}"]`);
      if (target && !target.disabled) target.focus();
    }
  }

  /* ----- setup, complete, search, review ----- */

  function setupPool(p = state.setup) {
    return state.all.filter((q) =>
      (p.category === ALL || q.category === p.category) &&
      (p.topic === 'All' || q.topic === p.topic) &&
      (p.difficulty === 'All' || q.difficulty === p.difficulty));
  }

  function setupHTML() {
    const s = state.setup;
    const cats = [...categoryMap().keys()];
    const topics = s.category === ALL ? [] : [...topicCounts(state.all.filter((q) => q.category === s.category)).keys()];
    const available = setupPool().length;

    const opt = (value, label, current) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;

    return `
      <button class="link" data-action="home">← Dashboard</button>
      <h1 class="page-title">Start an interview session</h1>
      <p class="page-sub">Questions are picked at random from the options you choose.</p>
      <form class="panel setup" data-form="setup">
        <div class="field">
          <label for="f-category">Category</label>
          <select id="f-category" data-field="category">
            ${opt(ALL, 'All categories', s.category)}
            ${cats.map((c) => opt(c, c, s.category)).join('')}
          </select>
        </div>
        <div class="field">
          <label for="f-topic">Topic</label>
          <select id="f-topic" data-field="topic" ${s.category === ALL ? 'disabled' : ''}>
            ${opt('All', 'All Topics', s.topic)}
            ${topics.map((t) => opt(t, t, s.topic)).join('')}
          </select>
        </div>
        <div class="field">
          <label for="f-difficulty">Difficulty</label>
          <select id="f-difficulty" data-field="difficulty">
            ${['All', ...DIFFS].map((d) => opt(d, d, s.difficulty)).join('')}
          </select>
        </div>
        <div class="field">
          <label for="f-count">Number of questions</label>
          <input id="f-count" data-field="count" type="number" min="1" max="${Math.max(available, 1)}" value="${esc(s.count)}" inputmode="numeric">
        </div>
        <label class="check"><input type="checkbox" data-field="ordered" ${s.ordered ? 'checked' : ''}> Order from easy to hard</label>
        <p class="hint ${available ? '' : 'warn'}">${available ? `${plural(available, 'question')} available with these options.` : 'No questions match these options.'}</p>
        <button class="btn btn-primary btn-lg" type="submit" ${available ? '' : 'disabled'}>Start Interview</button>
      </form>`;
  }

  function completeHTML() {
    const s = state.session;
    const p = s.params;
    const markedHere = state.deck.filter((q) => state.marked.has(q.id)).length;
    return `
      <section class="complete panel">
        <h1>Interview Session Complete</h1>
        <p class="big">Questions Asked: <b>${s.asked}</b></p>
        <p class="summary">${esc(p.category === ALL ? 'All categories' : p.category)}, ${esc(p.topic === 'All' ? 'All topics' : p.topic)}, ${esc(p.difficulty === 'All' ? 'All difficulties' : p.difficulty)}<br>
        ${markedHere ? `${plural(markedHere, 'question')} marked for review` : 'No questions marked for review'}</p>
        <div class="row">
          <button class="btn btn-primary" data-action="restart-session">Restart Session</button>
          <button class="btn" data-action="home">Back to Dashboard</button>
          ${markedHere ? '<button class="btn" data-action="review-list">⭐ Review marked</button>' : ''}
        </div>
      </section>`;
  }

  function searchHTML() {
    const items = state.results.map((q, i) => `
      <li><button class="result" data-action="open-result" data-index="${i}">
        <span class="qmeta" style="margin:0"><span class="badge"><b>${esc(q.category)}</b></span><span class="badge">${esc(q.topic)}</span>${diffBadge(q.difficulty)}</span>
        <span class="rq">${esc(q.question)}</span>
      </button></li>`).join('');
    return `
      <h1 class="page-title">Search results</h1>
      <p class="page-sub">${plural(state.results.length, 'question')} for “${esc(state.query)}”. Searches question text, category, topic and key points.</p>
      ${items ? `<ul class="list">${items}</ul>` : '<p class="empty panel">No matches. Try a shorter or different keyword.</p>'}`;
  }

  function reviewListHTML() {
    const list = markedQuestions();
    const items = list.map((q, i) => `
      <li><details class="review-item">
        <summary>${esc(q.question)}</summary>
        <div class="body">
          <div class="qmeta"><span class="badge"><b>${esc(q.category)}</b></span><span class="badge">${esc(q.topic)}</span>${diffBadge(q.difficulty)}</div>
          <p>${esc(q.answer)}</p>
          <div class="row">
            <button class="btn" data-action="review-open" data-index="${i}">Ask this one</button>
            <button class="btn btn-ghost" data-action="unmark" data-id="${esc(q.id)}">Remove from review</button>
          </div>
        </div>
      </details></li>`).join('');
    return `
      <h1 class="page-title">⭐ Review questions</h1>
      <p class="page-sub">Questions you marked because an answer was weak or worth revisiting. Marks are saved in this browser.</p>
      ${list.length ? `
        <div class="row" style="margin-bottom:16px">
          <button class="btn btn-primary" data-action="review-start">Ask them one by one</button>
          <button class="btn" data-action="clear-marks">Clear all</button>
        </div>
        <ul class="list">${items}</ul>` : '<p class="empty panel">Nothing marked yet. Use “Mark for Review” on any question.</p>'}`;
  }

  function errorHTML(err) {
    const isFile = location.protocol === 'file:';
    return `
      <section class="error-box panel">
        <h1>Could not load questions.json</h1>
        <p>${esc(err && err.message ? err.message : err)}</p>
        <p style="margin-top:12px">${isFile
          ? 'Browsers block <code>fetch()</code> for files opened directly from disk. Start a local server in this folder, for example <code>python -m http.server</code>, then open <code>http://localhost:8000</code>.'
          : 'Check that <code>questions.json</code> is in the same folder as <code>index.html</code> and contains valid JSON (a missing comma or quote is the usual cause).'}</p>
      </section>`;
  }

  /* ---------- actions ---------- */

  function setView(view, mode = null) {
    state.view = view;
    state.mode = mode;
    render();
    window.scrollTo(0, 0);
  }

  function showDashboard() {
    document.getElementById('search-input').value = '';
    state.query = '';
    setView('dashboard');
  }

  function applyBrowseFilter() {
    const f = state.filter;
    state.deck = sortDeck(state.all.filter((q) =>
      q.category === f.category &&
      (f.topic === 'All' || q.topic === f.topic) &&
      (f.difficulty === 'All' || q.difficulty === f.difficulty)));
    state.index = 0;
    state.revealed = false;
  }

  function openCategory(name) {
    state.filter = { category: name, topic: 'All', difficulty: 'All' };
    applyBrowseFilter();
    setView('browse');
  }

  function startJumble() {
    state.deck = shuffle(state.all);       // every question exactly once, so no duplicates
    state.index = 0;
    state.revealed = false;
    setView('viewer', 'jumble');
  }

  function startSession(params) {
    const pool = setupPool(params);
    if (!pool.length) return;
    const count = Math.max(1, Math.min(parseInt(params.count, 10) || 10, pool.length));
    let pick = shuffle(pool).slice(0, count);
    if (params.ordered) pick = sortDeck(pick);
    state.deck = pick;
    state.index = 0;
    state.revealed = false;
    state.session = { params: { ...params }, asked: pick.length };
    setView('viewer', 'session');
  }

  function openDeck(deck, index, mode) {
    state.deck = deck;
    state.index = index;
    state.revealed = false;
    setView('viewer', mode);
  }

  function go(delta, focusAction) {
    const next = state.index + delta;
    if (next < 0) return;
    if (next >= state.deck.length) {
      if (state.view === 'viewer' && state.mode === 'session') setView('complete');
      return;
    }
    state.index = next;
    state.revealed = false;
    renderViewer(focusAction);
  }

  function toggleMark(focusAction) {
    const q = state.deck[state.index];
    if (!q) return;
    if (state.marked.has(q.id)) state.marked.delete(q.id); else state.marked.add(q.id);
    store.set('marked', [...state.marked]);
    updateReviewCount();
    renderViewer(focusAction);
  }

  function runSearch(value) {
    state.query = value.trim();
    if (!state.query) {
      if (state.view === 'search') setView('dashboard');
      return;
    }
    state.results = searchQuestions(state.query);
    setView('search');
  }

  /* ---------- theme ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store.set('theme', next);
    applyTheme(next);
  }

  /* ---------- events ---------- */

  function handleAction(el, event) {
    const a = el.dataset.action;
    // Keep keyboard focus on the same control when it was activated with the keyboard
    const focus = event.detail === 0 ? a : undefined;

    switch (a) {
      case 'home': showDashboard(); break;
      case 'toggle-theme': toggleTheme(); break;
      case 'jumble': startJumble(); break;
      case 'reshuffle': startJumble(); break;
      case 'setup': setView('setup'); break;
      case 'open-category': openCategory(el.dataset.category); break;
      case 'topic': state.filter.topic = el.dataset.topic; applyBrowseFilter(); render(); break;
      case 'difficulty': state.filter.difficulty = el.dataset.difficulty; state.filter.topic = 'All'; applyBrowseFilter(); render(); break;
      case 'prev': go(-1, focus); break;
      case 'next': go(1, focus); break;
      case 'mark': toggleMark(focus); break;
      case 'open-result': openDeck(state.results, Number(el.dataset.index), 'result'); break;
      case 'back-results': setView('search'); break;
      case 'review-list': setView('reviewlist'); break;
      case 'review-start': openDeck(markedQuestions(), 0, 'review'); break;
      case 'review-open': openDeck(markedQuestions(), Number(el.dataset.index), 'review'); break;
      case 'unmark': {
        const q = state.all.find((x) => String(x.id) === el.dataset.id);
        if (q) { state.marked.delete(q.id); store.set('marked', [...state.marked]); }
        render();
        break;
      }
      case 'clear-marks':
        state.marked.clear();
        store.set('marked', []);
        render();
        break;
      case 'restart-session': startSession(state.session.params); break;
      default: break;
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) handleAction(el, e);
  });

  // Setup form fields
  app.addEventListener('change', (e) => {
    const field = e.target.dataset && e.target.dataset.field;
    if (!field || state.view !== 'setup') return;
    const s = state.setup;
    if (field === 'category') { s.category = e.target.value; s.topic = 'All'; }
    else if (field === 'topic') s.topic = e.target.value;
    else if (field === 'difficulty') s.difficulty = e.target.value;
    else if (field === 'ordered') s.ordered = e.target.checked;
    else if (field === 'count') s.count = e.target.value;
    setView('setup');
  });

  app.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.field === 'count') state.setup.count = e.target.value;
  });

  app.addEventListener('submit', (e) => {
    if (e.target.dataset.form !== 'setup') return;
    e.preventDefault();
    startSession(state.setup);
  });

  document.getElementById('search-input').addEventListener('input', (e) => runSearch(e.target.value));
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; runSearch(''); }
  });

  // Keyboard shortcuts: ← previous, → next, Space show/hide answer
  const isTyping = (t) => /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable;
  const questionOnScreen = () => state.view === 'browse' || state.view === 'viewer';

  document.addEventListener('keydown', (e) => {
    if (!questionOnScreen() || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  /* ---------- start ---------- */

  async function init() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    try {
      const res = await fetch('questions.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Server replied ${res.status} ${res.statusText}`);
      state.all = normalise(await res.json());
      if (!state.all.length) throw new Error('questions.json has no valid questions.');
    } catch (err) {
      state.view = 'error';
      app.innerHTML = errorHTML(err);
      return;
    }
    render();
  }

  init();
})();

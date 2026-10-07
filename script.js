/* ==========================================================
   Technical Interview Question Bank
   Three question sets (A, B, C) are loaded from
   questions-set-a.json, questions-set-b.json, questions-set-c.json.
   Categories, topics and counts are read from the data, so adding
   questions never requires changing this file.
   ========================================================== */
(() => {
  'use strict';

  const DIFFS = ['Easy', 'Medium'];
  const TYPES = ['Concept', 'Scenario', 'Output', 'Code', 'Debug'];
  const ALL = '__all';           // "all" value for category and set pickers

  // Each set uses different questions, so give different sets to different batches.
  const SETS = [
    { id: 'A', name: 'Set A', label: 'Full mix', blurb: 'Concepts, output, scenarios, coding and debugging.' },
    { id: 'B', name: 'Set B', label: 'Full mix', blurb: 'Concepts, output, scenarios, coding and debugging.' },
    { id: 'C', name: 'Set C', label: 'Full mix', blurb: 'Concepts, output, scenarios, coding and debugging.' }
  ];
  const fileFor = (s) => `questions-set-${s.id.toLowerCase()}.json`;

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
  const setName = (id) => (id === ALL ? 'All sets' : ((SETS.find((s) => s.id === id) || {}).name || id));

  /* ---------- state ---------- */

  const savedSet = store.get('qset', 'A');
  const startSet = (savedSet === ALL || SETS.some((s) => s.id === savedSet)) ? savedSet : 'A';

  const state = {
    all: [],
    set: startSet,
    view: 'dashboard',   // dashboard | browse | viewer | setup | complete | search | reviewlist | error
    mode: null,          // for view "viewer": session | jumble | result | review
    deck: [],
    index: 0,
    filter: { category: '', topic: 'All', difficulty: 'All', type: 'All' },
    setup: { set: startSet, category: ALL, topic: 'All', difficulty: 'All', type: 'All', count: 10, ordered: false },
    session: null,
    query: '',
    results: [],
    marked: new Set(store.get('marked2', []))
  };

  /* ---------- data ---------- */

  function normalise(data) {
    if (!Array.isArray(data)) throw new Error('The question files must contain a list of questions.');
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
      const typeMatch = TYPES.find((t) => t.toLowerCase() === String(q.type).trim().toLowerCase());
      seenIds.add(id);
      seenText.add(textKey);
      out.push({
        id,
        set: q.set,
        category: String(q.category).trim(),
        topic: String(q.topic).trim(),
        difficulty: diffMatch || 'Medium',
        type: typeMatch || 'Concept',
        question: String(q.question).trim(),
        code: q.code ? String(q.code) : '',
        answer: String(q.answer || '').trim(),
        solution: q.solution ? String(q.solution) : '',
        keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints.map(String) : [],
        _i: out.length
      });
    });
    return out;
  }

  // Questions of one set (or all sets)
  const poolFor = (setId) => (setId === ALL ? state.all : state.all.filter((q) => q.set === setId));

  function categoryMap(list = poolFor(state.set)) {
    const m = new Map();
    list.forEach((q) => {
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
    return sortDeck(poolFor(state.set).filter((q) => {
      const hay = [q.question, q.category, q.topic, q.type, ...q.keyPoints].join(' ').toLowerCase();
      return terms.every((t) => hay.includes(t));
    }));
  }

  const markedQuestions = () => state.all.filter((q) => state.marked.has(q.id));
  const saveMarks = () => store.set('marked2', [...state.marked]);

  /* ---------- rendering: shared pieces ---------- */

  function diffBadge(d) {
    const level = diffRank(d);
    const dots = DIFFS.map((_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('');
    return `<span class="badge diff" data-diff="${esc(d)}" title="Difficulty: ${esc(d)}"><span class="dots" aria-hidden="true">${dots}</span>${esc(d)}</span>`;
  }

  function diffBar(list) {
    const counts = DIFFS.map((d) => list.filter((q) => q.difficulty === d).length);
    const segs = DIFFS.map((d, i) => counts[i]
      ? `<span class="seg-${d.toLowerCase()}" style="flex:${counts[i]}"></span>` : '').join('');
    const label = DIFFS.map((d, i) => `${counts[i]} ${d.toLowerCase()}`).join(', ');
    return `<span class="diff-bar" role="img" aria-label="${esc(label)}">${segs}</span><span class="cat-meta">${esc(label)}</span>`;
  }

  const codeBlock = (code, label) =>
    `<pre class="code" tabindex="0" aria-label="${esc(label)}"><code>${esc(code)}</code></pre>`;

  function metaBadges(q) {
    return `<span class="badge setb">${esc(setName(q.set))}</span>
      <span class="badge">Category: <b>${esc(q.category)}</b></span>
      <span class="badge">Topic: <b>${esc(q.topic)}</b></span>
      <span class="badge type">${esc(q.type)}</span>
      ${diffBadge(q.difficulty)}`;
  }

  function updateReviewCount() {
    document.getElementById('review-count').textContent = markedQuestions().length;
  }

  function updateSetPill() {
    document.getElementById('set-pill').textContent = setName(state.set);
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
    updateSetPill();
  }

  function setPickerHTML() {
    const options = [
      ...SETS.map((s) => ({ ...s, count: poolFor(s.id).length })),
      { id: ALL, name: 'All sets', label: 'Everything mixed', blurb: 'Questions from every set. Repeats are possible between batches.', count: state.all.length }
    ];
    const cards = options.map((s) => `
      <button class="set-card" data-action="set" data-set="${esc(s.id)}" aria-pressed="${state.set === s.id}">
        <span class="set-name">${esc(s.name)}</span>
        <span class="set-label">${esc(s.label)}</span>
        <span class="set-blurb">${esc(s.blurb)}</span>
        <span class="set-count">${plural(s.count, 'question')}</span>
      </button>`).join('');
    return `
      <section class="setpick" aria-label="Question set">
        <h2>Question set</h2>
        <p class="page-sub">Every set has a similar mix of question types and categories, but all questions are different. Give each student the next set (A, B, C, then A again) to reduce repeats.</p>
        <div class="sets">${cards}</div>
      </section>`;
  }

  function dashboardHTML() {
    const pool = poolFor(state.set);
    const cats = categoryMap(pool);
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
        <p>OOPS, Java, JavaScript and DBMS. Questions include concepts, output prediction, scenarios, and small coding and debugging tasks, each with an expected answer to compare with what the student says.</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" data-action="jumble">🎲 Jumble ${esc(setName(state.set))}</button>
          <button class="btn btn-lg" data-action="setup">Start interview session</button>
        </div>
      </section>
      ${setPickerHTML()}
      <section class="cats" aria-label="Categories">${cards}</section>
      <section class="panel" style="max-width:540px">
        <table class="totals">
          <caption>${esc(setName(state.set))}</caption>
          <tbody>${rows}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>${plural(pool.length, 'Question')}</td></tr></tfoot>
        </table>
      </section>`;
  }

  function browseHTML() {
    const f = state.filter;
    const catList = poolFor(state.set).filter((q) => q.category === f.category);
    const inFilter = catList.filter((q) =>
      (f.difficulty === 'All' || q.difficulty === f.difficulty) &&
      (f.type === 'All' || q.type === f.type));
    const counts = topicCounts(inFilter);
    const topicNames = [...topicCounts(catList).keys()];
    const typesHere = TYPES.filter((t) => catList.some((q) => q.type === t));

    const diffChips = ['All', ...DIFFS].map((d) =>
      `<button class="chip" data-action="difficulty" data-difficulty="${d}" aria-pressed="${f.difficulty === d}">${d}</button>`).join('');
    const typeChips = ['All', ...typesHere].map((t) =>
      `<button class="chip" data-action="type-filter" data-type="${t}" aria-pressed="${f.type === t}">${t}</button>`).join('');

    const topicItems = [
      `<li><button class="topic" data-action="topic" data-topic="All" aria-pressed="${f.topic === 'All'}">All Topics <span class="n">${inFilter.length}</span></button></li>`,
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
          <p class="cat-meta" style="margin:-10px 0 14px">${esc(setName(state.set))}</p>
          <div class="filter-group">
            <h3>Difficulty</h3>
            <div class="chips" role="group" aria-label="Difficulty">${diffChips}</div>
          </div>
          <div class="filter-group">
            <h3>Question type</h3>
            <div class="chips" role="group" aria-label="Question type">${typeChips}</div>
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
      const label = [
        setName(p.set),
        p.category === ALL ? 'All categories' : p.category,
        p.topic === 'All' ? 'All topics' : p.topic,
        p.difficulty === 'All' ? 'All difficulties' : p.difficulty,
        p.type === 'All' ? 'All types' : p.type
      ].join(', ');
      return `<div class="ctx"><div><div class="ctx-title">Interview session</div><div class="ctx-sub">${esc(label)}</div></div><button class="btn" data-action="home">End session</button></div>`;
    }
    if (state.mode === 'jumble') {
      return `<div class="ctx"><div><div class="ctx-title">🎲 Jumbled questions</div><div class="ctx-sub">${esc(setName(state.set))}, all categories in random order, no repeats</div></div>
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
      return `${contextBarHTML()}<p class="empty panel">No questions match these filters. Try another topic, type or difficulty.</p>`;
    }
    const q = state.deck[state.index];
    const pos = state.index + 1;
    const pct = Math.round((pos / n) * 100);
    const isMarked = state.marked.has(q.id);
    const isLast = pos === n;
    const finishes = state.view === 'viewer' && state.mode === 'session' && isLast;
    const isCoding = q.type === 'Code' || q.type === 'Debug';

    const questionCode = q.code ? codeBlock(q.code, 'Code in the question') : '';
    const solution = q.solution
      ? `<h3 class="kp">${isCoding || q.type === 'Output' ? 'Sample Solution' : 'Example'}</h3>${codeBlock(q.solution, 'Sample solution')}` : '';
    const points = q.keyPoints.length
      ? `<h3 class="kp">${isCoding ? 'What to Check' : 'Key Points'}</h3><ul>${q.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : '';

    return `
      ${contextBarHTML()}
      <div class="progress-row"><span>Question ${pos} of ${n}</span><span>${pct}%</span></div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress"><div style="width:${pct}%"></div></div>

      <article class="qcard" data-diff="${esc(q.difficulty)}">
        <div class="qmeta">${metaBadges(q)}</div>
        <p class="qnum">Question ${pos}</p>
        <h2 class="qtext">${esc(q.question)}</h2>
        ${questionCode}

        <div class="qtools">
          <button class="btn mark-btn" data-action="mark" aria-pressed="${isMarked}">${isMarked ? '⭐ Marked for Review' : '⭐ Mark for Review'}</button>
        </div>

        <div class="answer" id="answer">
          <h3>${isCoding ? 'Expected Approach' : 'Expected Answer'}</h3>
          <p>${esc(q.answer)}</p>
          ${solution}
          ${points}
        </div>
      </article>

      <div class="qnav">
        <button class="btn" data-action="prev" ${state.index === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="btn" data-action="next" ${isLast && !finishes ? 'disabled' : ''}>${finishes ? 'Finish ✓' : 'Next →'}</button>
      </div>
      <p class="kbd-hint"><kbd>←</kbd> previous, <kbd>→</kbd> next</p>`;
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
    return poolFor(p.set).filter((q) =>
      (p.category === ALL || q.category === p.category) &&
      (p.topic === 'All' || q.topic === p.topic) &&
      (p.difficulty === 'All' || q.difficulty === p.difficulty) &&
      (p.type === 'All' || q.type === p.type));
  }

  function setupHTML() {
    const s = state.setup;
    const setPool = poolFor(s.set);
    const cats = [...categoryMap(setPool).keys()];
    const topics = s.category === ALL ? [] : [...topicCounts(setPool.filter((q) => q.category === s.category)).keys()];
    const available = setupPool().length;

    const opt = (value, label, current) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;

    return `
      <button class="link" data-action="home">← Dashboard</button>
      <h1 class="page-title">Start an interview session</h1>
      <p class="page-sub">Questions are picked at random from the options you choose.</p>
      <form class="panel setup" data-form="setup">
        <div class="field">
          <label for="f-set">Question set</label>
          <select id="f-set" data-field="set">
            ${SETS.map((x) => opt(x.id, `${x.name}: ${x.label}`, s.set)).join('')}
            ${opt(ALL, 'All sets', s.set)}
          </select>
        </div>
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
          <label for="f-type">Question type</label>
          <select id="f-type" data-field="type">
            ${['All', ...TYPES].map((t) => opt(t, t === 'All' ? 'All types' : t, s.type)).join('')}
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
        <label class="check"><input type="checkbox" data-field="ordered" ${s.ordered ? 'checked' : ''}> Order from easy to medium</label>
        <p class="hint ${available ? '' : 'warn'}">${available ? `${plural(available, 'question')} available with these options.` : 'No questions match these options.'}</p>
        <button class="btn btn-primary btn-lg" type="submit" ${available ? '' : 'disabled'}>Start Interview</button>
      </form>`;
  }

  function completeHTML() {
    const s = state.session;
    const p = s.params;
    const markedHere = state.deck.filter((q) => state.marked.has(q.id)).length;
    const summary = [
      setName(p.set),
      p.category === ALL ? 'All categories' : p.category,
      p.topic === 'All' ? 'All topics' : p.topic,
      p.difficulty === 'All' ? 'All difficulties' : p.difficulty,
      p.type === 'All' ? 'All types' : p.type
    ].join(', ');
    return `
      <section class="complete panel">
        <h1>Interview Session Complete</h1>
        <p class="big">Questions Asked: <b>${s.asked}</b></p>
        <p class="summary">${esc(summary)}<br>
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
        <span class="qmeta" style="margin:0"><span class="badge"><b>${esc(q.category)}</b></span><span class="badge">${esc(q.topic)}</span><span class="badge type">${esc(q.type)}</span>${diffBadge(q.difficulty)}</span>
        <span class="rq">${esc(q.question)}</span>
      </button></li>`).join('');
    return `
      <h1 class="page-title">Search results</h1>
      <p class="page-sub">${plural(state.results.length, 'question')} for “${esc(state.query)}” in ${esc(setName(state.set))}. Searches question text, category, topic, type and key points.</p>
      ${items ? `<ul class="list">${items}</ul>` : '<p class="empty panel">No matches. Try a shorter or different keyword.</p>'}`;
  }

  function reviewListHTML() {
    const list = markedQuestions();
    const items = list.map((q, i) => `
      <li><details class="review-item">
        <summary>${esc(q.question)}</summary>
        <div class="body">
          <div class="qmeta">${metaBadges(q)}</div>
          ${q.code ? codeBlock(q.code, 'Code in the question') : ''}
          <p style="margin-top:12px">${esc(q.answer)}</p>
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
    const files = SETS.map((s) => `<code>${fileFor(s)}</code>`).join(', ');
    return `
      <section class="error-box panel">
        <h1>Could not load the question files</h1>
        <p>${esc(err && err.message ? err.message : err)}</p>
        <p style="margin-top:12px">${isFile
          ? 'Browsers block <code>fetch()</code> for files opened directly from disk. Start a local server in this folder, for example <code>python -m http.server</code>, then open <code>http://localhost:8000</code>.'
          : `Check that ${files} are in the same folder as <code>index.html</code> and contain valid JSON (a missing comma or quote is the usual cause).`}</p>
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

  function chooseSet(id) {
    state.set = id;
    state.setup.set = id;
    state.setup.category = ALL;
    state.setup.topic = 'All';
    store.set('qset', id);
  }

  function applyBrowseFilter() {
    const f = state.filter;
    state.deck = sortDeck(poolFor(state.set).filter((q) =>
      q.category === f.category &&
      (f.topic === 'All' || q.topic === f.topic) &&
      (f.difficulty === 'All' || q.difficulty === f.difficulty) &&
      (f.type === 'All' || q.type === f.type)));
    state.index = 0;
  }

  function openCategory(name) {
    state.filter = { category: name, topic: 'All', difficulty: 'All', type: 'All' };
    applyBrowseFilter();
    setView('browse');
  }

  function startJumble() {
    state.deck = shuffle(poolFor(state.set));       // every question exactly once, so no duplicates
    state.index = 0;
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
    state.session = { params: { ...params }, asked: pick.length };
    setView('viewer', 'session');
  }

  function openDeck(deck, index, mode) {
    state.deck = deck;
    state.index = index;
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
    renderViewer(focusAction);
  }

  function toggleMark(focusAction) {
    const q = state.deck[state.index];
    if (!q) return;
    if (state.marked.has(q.id)) state.marked.delete(q.id); else state.marked.add(q.id);
    saveMarks();
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
      case 'set': chooseSet(el.dataset.set); render(); break;
      case 'jumble': startJumble(); break;
      case 'reshuffle': startJumble(); break;
      case 'setup': setView('setup'); break;
      case 'open-category': openCategory(el.dataset.category); break;
      case 'topic': state.filter.topic = el.dataset.topic; applyBrowseFilter(); render(); break;
      case 'difficulty': state.filter.difficulty = el.dataset.difficulty; state.filter.topic = 'All'; applyBrowseFilter(); render(); break;
      case 'type-filter': state.filter.type = el.dataset.type; state.filter.topic = 'All'; applyBrowseFilter(); render(); break;
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
        if (q) { state.marked.delete(q.id); saveMarks(); }
        render();
        break;
      }
      case 'clear-marks':
        state.marked.clear();
        saveMarks();
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
    if (field === 'set') { chooseSet(e.target.value); }
    else if (field === 'category') { s.category = e.target.value; s.topic = 'All'; }
    else if (field === 'topic') s.topic = e.target.value;
    else if (field === 'difficulty') s.difficulty = e.target.value;
    else if (field === 'type') s.type = e.target.value;
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

  // Keyboard shortcuts: left arrow previous, right arrow next
  const isTyping = (t) => /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable;
  const questionOnScreen = () => state.view === 'browse' || state.view === 'viewer';

  document.addEventListener('keydown', (e) => {
    if (!questionOnScreen() || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  /* ---------- start ---------- */

  async function loadSet(s) {
    const file = fileFor(s);
    const res = await fetch(file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${file}: server replied ${res.status} ${res.statusText}`);
    let data;
    try { data = await res.json(); } catch (e) { throw new Error(`${file} is not valid JSON.`); }
    if (!Array.isArray(data)) throw new Error(`${file} must contain a list of questions.`);
    return data.map((q) => ({ ...q, set: s.id }));
  }

  async function init() {
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    try {
      const parts = await Promise.all(SETS.map(loadSet));
      state.all = normalise(parts.flat());
      if (!state.all.length) throw new Error('The question files have no valid questions.');
    } catch (err) {
      state.view = 'error';
      app.innerHTML = errorHTML(err);
      return;
    }
    render();
  }

  init();
})();
